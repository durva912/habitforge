from flask import Flask, request, jsonify, render_template, session
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from datetime import datetime, date, timedelta
import json
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'habitforge-secret-key-2024'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///habitforge.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
CORS(app, supports_credentials=True)

# ─── MODELS ──────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    habits = db.relationship('Habit', backref='owner', lazy=True, cascade='all, delete-orphan')
    stats = db.relationship('UserStats', backref='user', uselist=False, cascade='all, delete-orphan')
    badges = db.relationship('UserBadge', backref='user', lazy=True, cascade='all, delete-orphan')

class Habit(db.Model):
    __tablename__ = 'habits'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    icon = db.Column(db.String(10), default='⚡')
    frequency = db.Column(db.String(20), default='daily')
    custom_days = db.Column(db.String(50), default='')
    reminder_time = db.Column(db.String(10), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    current_streak = db.Column(db.Integer, default=0)
    longest_streak = db.Column(db.Integer, default=0)
    total_completions = db.Column(db.Integer, default=0)
    last_completed = db.Column(db.Date, nullable=True)
    logs = db.relationship('HabitLog', backref='habit', lazy=True, cascade='all, delete-orphan')

class HabitLog(db.Model):
    __tablename__ = 'habit_logs'
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habits.id'), nullable=False)
    completed_date = db.Column(db.Date, nullable=False)
    xp_earned = db.Column(db.Integer, default=10)

class UserStats(db.Model):
    __tablename__ = 'user_stats'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    xp = db.Column(db.Integer, default=0)
    level = db.Column(db.Integer, default=1)
    total_completions = db.Column(db.Integer, default=0)

class Badge(db.Model):
    __tablename__ = 'badges'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200))
    icon = db.Column(db.String(10), default='🏆')
    condition_type = db.Column(db.String(50))
    condition_value = db.Column(db.Integer)

class UserBadge(db.Model):
    __tablename__ = 'user_badges'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=False)
    unlocked_at = db.Column(db.DateTime, default=datetime.utcnow)
    badge = db.relationship('Badge')

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def get_level_threshold(level):
    """XP needed to reach next level — increasing difficulty"""
    return int(100 * (level ** 1.5))

def get_current_level(xp):
    level = 1
    while xp >= get_level_threshold(level):
        xp -= get_level_threshold(level)
        level += 1
    return level, xp, get_level_threshold(level)

def check_and_award_badges(user_id, stats, habit=None):
    """Returns list of newly unlocked badge names"""
    new_badges = []
    all_badges = Badge.query.all()
    existing_badge_ids = {ub.badge_id for ub in UserBadge.query.filter_by(user_id=user_id).all()}
    
    for badge in all_badges:
        if badge.id in existing_badge_ids:
            continue
        unlocked = False
        if badge.condition_type == 'first_completion' and stats.total_completions >= 1:
            unlocked = True
        elif badge.condition_type == 'total_completions' and stats.total_completions >= badge.condition_value:
            unlocked = True
        elif badge.condition_type == 'streak' and habit and habit.current_streak >= badge.condition_value:
            unlocked = True
        elif badge.condition_type == 'level' and stats.level >= badge.condition_value:
            unlocked = True
        
        if unlocked:
            ub = UserBadge(user_id=user_id, badge_id=badge.id)
            db.session.add(ub)
            new_badges.append({'name': badge.name, 'icon': badge.icon, 'description': badge.description})
    
    return new_badges

def requires_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    if not data or not data.get('email') or not data.get('password') or not data.get('username'):
        return jsonify({'error': 'Missing fields'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username taken'}), 409
    
    hashed = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    user = User(username=data['username'], email=data['email'], password=hashed)
    db.session.add(user)
    db.session.flush()
    
    stats = UserStats(user_id=user.id)
    db.session.add(stats)
    db.session.commit()
    
    session['user_id'] = user.id
    session['username'] = user.username
    return jsonify({'success': True, 'username': user.username, 'user_id': user.id})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data.get('email', '')).first()
    if not user or not bcrypt.check_password_hash(user.password, data.get('password', '')):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    session['user_id'] = user.id
    session['username'] = user.username
    return jsonify({'success': True, 'username': user.username, 'user_id': user.id})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me', methods=['GET'])
@requires_auth
def me():
    user = User.query.get(session['user_id'])
    stats = user.stats
    level, xp_in_level, xp_needed = get_current_level(stats.xp)
    stats.level = level
    db.session.commit()
    return jsonify({
        'username': user.username,
        'email': user.email,
        'xp': stats.xp,
        'level': level,
        'xp_in_level': xp_in_level,
        'xp_needed': xp_needed,
        'total_completions': stats.total_completions
    })

@app.route('/api/habits', methods=['GET'])
@requires_auth
def get_habits():
    today = date.today()
    day_name = today.strftime('%A').lower()
    habits = Habit.query.filter_by(user_id=session['user_id']).all()
    result = []
    for h in habits:
        # Check if today is a scheduled day
        if h.frequency == 'daily':
            scheduled = True
        else:
            days = h.custom_days.split(',') if h.custom_days else []
            scheduled = day_name in days
        
        if not scheduled:
            continue
        
        # Check if completed today
        log = HabitLog.query.filter_by(habit_id=h.id, completed_date=today).first()
        completed_today = log is not None
        
        # Check for missed streak
        if h.last_completed and not completed_today:
            yesterday = today - timedelta(days=1)
            if h.last_completed < yesterday:
                h.current_streak = 0
                db.session.commit()
        
        result.append({
            'id': h.id,
            'name': h.name,
            'icon': h.icon,
            'frequency': h.frequency,
            'current_streak': h.current_streak,
            'longest_streak': h.longest_streak,
            'total_completions': h.total_completions,
            'completed_today': completed_today,
            'reminder_time': h.reminder_time
        })
    
    return jsonify(result)

@app.route('/api/habits/all', methods=['GET'])
@requires_auth
def get_all_habits():
    habits = Habit.query.filter_by(user_id=session['user_id']).all()
    return jsonify([{
        'id': h.id, 'name': h.name, 'icon': h.icon,
        'frequency': h.frequency, 'custom_days': h.custom_days,
        'reminder_time': h.reminder_time,
        'current_streak': h.current_streak, 'total_completions': h.total_completions
    } for h in habits])

@app.route('/api/add_habit', methods=['POST'])
@requires_auth
def add_habit():
    data = request.json
    habit = Habit(
        user_id=session['user_id'],
        name=data['name'],
        icon=data.get('icon', '⚡'),
        frequency=data.get('frequency', 'daily'),
        custom_days=','.join(data.get('custom_days', [])),
        reminder_time=data.get('reminder_time', '')
    )
    db.session.add(habit)
    db.session.commit()
    return jsonify({'success': True, 'id': habit.id})

@app.route('/api/edit_habit/<int:habit_id>', methods=['PUT'])
@requires_auth
def edit_habit(habit_id):
    habit = Habit.query.filter_by(id=habit_id, user_id=session['user_id']).first_or_404()
    data = request.json
    habit.name = data.get('name', habit.name)
    habit.icon = data.get('icon', habit.icon)
    habit.frequency = data.get('frequency', habit.frequency)
    habit.custom_days = ','.join(data.get('custom_days', []))
    habit.reminder_time = data.get('reminder_time', habit.reminder_time)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/delete_habit/<int:habit_id>', methods=['DELETE'])
@requires_auth
def delete_habit(habit_id):
    habit = Habit.query.filter_by(id=habit_id, user_id=session['user_id']).first_or_404()
    db.session.delete(habit)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/mark_done', methods=['POST'])
@requires_auth
def mark_done():
    data = request.json
    habit_id = data.get('habit_id')
    today = date.today()
    
    habit = Habit.query.filter_by(id=habit_id, user_id=session['user_id']).first_or_404()
    
    # Prevent duplicates
    existing = HabitLog.query.filter_by(habit_id=habit_id, completed_date=today).first()
    if existing:
        return jsonify({'error': 'Already completed today'}), 409
    
    # Update streak
    yesterday = today - timedelta(days=1)
    if habit.last_completed == yesterday:
        habit.current_streak += 1
    elif habit.last_completed == today:
        pass
    else:
        habit.current_streak = 1
    
    if habit.current_streak > habit.longest_streak:
        habit.longest_streak = habit.current_streak
    
    habit.last_completed = today
    habit.total_completions += 1
    
    # Calculate XP
    xp_earned = 10
    bonus_xp = 0
    streak_bonus_msg = None
    if habit.current_streak == 7:
        bonus_xp = 50
        streak_bonus_msg = "7-Day Streak Bonus!"
    elif habit.current_streak == 30:
        bonus_xp = 200
        streak_bonus_msg = "30-Day Streak Bonus!"
    total_xp = xp_earned + bonus_xp
    
    log = HabitLog(habit_id=habit_id, completed_date=today, xp_earned=total_xp)
    db.session.add(log)
    
    # Update user stats
    stats = UserStats.query.filter_by(user_id=session['user_id']).first()
    old_level = stats.level
    stats.xp += total_xp
    stats.total_completions += 1
    
    new_level, xp_in_level, xp_needed = get_current_level(stats.xp)
    stats.level = new_level
    leveled_up = new_level > old_level
    
    db.session.commit()
    
    # Check badges
    new_badges = check_and_award_badges(session['user_id'], stats, habit)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'xp_earned': total_xp,
        'bonus_xp': bonus_xp,
        'streak_bonus_msg': streak_bonus_msg,
        'current_streak': habit.current_streak,
        'longest_streak': habit.longest_streak,
        'total_xp': stats.xp,
        'level': new_level,
        'xp_in_level': xp_in_level,
        'xp_needed': xp_needed,
        'leveled_up': leveled_up,
        'new_badges': new_badges
    })

@app.route('/api/stats', methods=['GET'])
@requires_auth
def get_stats():
    user_id = session['user_id']
    stats = UserStats.query.filter_by(user_id=user_id).first()
    
    # Weekly completion data
    today = date.today()
    week_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = db.session.query(HabitLog).join(Habit).filter(
            Habit.user_id == user_id,
            HabitLog.completed_date == day
        ).count()
        week_data.append({'date': day.strftime('%a'), 'count': count, 'full_date': day.isoformat()})
    
    # Best streak across all habits
    habits = Habit.query.filter_by(user_id=user_id).all()
    best_streak = max((h.longest_streak for h in habits), default=0)
    total_habits = len(habits)
    
    # Completion rate (last 7 days)
    total_possible = sum(1 for d in week_data for _ in range(total_habits)) if total_habits else 1
    total_done = sum(d['count'] for d in week_data)
    completion_rate = round((total_done / max(total_possible, 1)) * 100)
    
    level, xp_in_level, xp_needed = get_current_level(stats.xp)
    
    return jsonify({
        'xp': stats.xp,
        'level': level,
        'xp_in_level': xp_in_level,
        'xp_needed': xp_needed,
        'total_completions': stats.total_completions,
        'best_streak': best_streak,
        'completion_rate': completion_rate,
        'week_data': week_data,
        'total_habits': total_habits
    })

@app.route('/api/badges', methods=['GET'])
@requires_auth
def get_badges():
    all_badges = Badge.query.all()
    unlocked_ids = {ub.badge_id: ub.unlocked_at for ub in UserBadge.query.filter_by(user_id=session['user_id']).all()}
    result = []
    for b in all_badges:
        result.append({
            'id': b.id, 'name': b.name, 'description': b.description,
            'icon': b.icon, 'unlocked': b.id in unlocked_ids,
            'unlocked_at': unlocked_ids[b.id].strftime('%b %d, %Y') if b.id in unlocked_ids else None
        })
    return jsonify(result)

def seed_badges():
    if Badge.query.count() == 0:
        badges = [
            Badge(name='First Step', description='Complete your first habit', icon='✅', condition_type='first_completion', condition_value=1),
            Badge(name='Week Warrior', description='Maintain a 7-day streak', icon='🔥', condition_type='streak', condition_value=7),
            Badge(name='Month Master', description='Maintain a 30-day streak', icon='💪', condition_type='streak', condition_value=30),
            Badge(name='Century Club', description='Complete 100 habits total', icon='🧠', condition_type='total_completions', condition_value=100),
            Badge(name='Level 5', description='Reach Level 5', icon='⭐', condition_type='level', condition_value=5),
            Badge(name='Level 10', description='Reach Level 10', icon='🌟', condition_type='level', condition_value=10),
            Badge(name='Half Century', description='Complete 50 habits total', icon='🎯', condition_type='total_completions', condition_value=50),
            Badge(name='Unstoppable', description='Maintain a 14-day streak', icon='⚡', condition_type='streak', condition_value=14),
        ]
        for b in badges:
            db.session.add(b)
        db.session.commit()

with app.app_context():
    db.create_all()
    seed_badges()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
