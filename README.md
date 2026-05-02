# ⚡ HabitForge

> Build habits. Earn XP. Level up your life.

A full-stack habit tracking web app with gamification, dark theme, and Duolingo-inspired animations.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the app
```bash
python app.py
```

### 3. Open in browser
```
http://localhost:5000
```

---

## 🗃️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Python + Flask |
| Database | SQLite (swap to MySQL in `app.py` — see below) |
| Auth | Session-based with bcrypt password hashing |

---

## 🐬 Switch to MySQL

In `app.py`, replace the SQLite URI:

```python
# SQLite (default, zero-setup)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///habitforge.db'

# MySQL (production)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://user:password@localhost/habitforge'
```

Install MySQL driver: `pip install pymysql`

---

## 🎮 Feature Map

### Core
- ✅ User auth (signup / login / logout)
- ✅ Add / edit / delete habits
- ✅ Daily habit completion (1 click)
- ✅ Streak tracking (current + longest)
- ✅ Daily reset at midnight

### Gamification
- ✅ XP system (+10 per habit)
- ✅ Streak bonuses (7-day: +50, 30-day: +200)
- ✅ Level system with increasing thresholds
- ✅ 8 badges (first step, streak milestones, total completions, levels)

### Animations
- ✅ Mark done: ripple → green → pop → XP float
- ✅ Streak bounce on increase
- ✅ Badge unlock modal with confetti
- ✅ Level up celebration with confetti
- ✅ Animated weekly bar chart
- ✅ Animated XP progress bar
- ✅ Floating particles background
- ✅ Page transition animations

### Insights
- ✅ Weekly completion chart
- ✅ Success rate %
- ✅ Best streak
- ✅ Total completions

---

## 📁 Project Structure

```
habitforge/
├── app.py              # Flask backend + all API routes
├── requirements.txt    # Python deps
├── habitforge.db       # SQLite DB (auto-created)
├── templates/
│   └── index.html      # Single-page app shell
└── static/
    ├── css/
    │   └── style.css   # Full dark theme + animations
    └── js/
        └── app.js      # All client logic
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup` | Register new user |
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| GET | `/api/me` | Current user info + XP/level |
| GET | `/api/habits` | Today's scheduled habits |
| GET | `/api/habits/all` | All habits (for profile page) |
| POST | `/api/add_habit` | Create habit |
| PUT | `/api/edit_habit/<id>` | Update habit |
| DELETE | `/api/delete_habit/<id>` | Remove habit |
| POST | `/api/mark_done` | Complete a habit (awards XP, checks badges) |
| GET | `/api/stats` | Weekly stats + analytics |
| GET | `/api/badges` | All badges with unlock status |

---

## 🎨 Design System

- **Font**: Outfit (display) + Space Mono (numbers)
- **Background**: `#0a0a0f` deep dark
- **Accents**: Green `#00e676` · Purple `#b26bff` · Blue `#4da6ff` · Yellow `#ffd740`
- **Theme**: Neon glow + dark cards + rounded everything

---

## 🔮 Phase 3 Roadmap

- [ ] Email reminder system (Flask-Mail)
- [ ] Push notification support
- [ ] Habit categories & filtering
- [ ] Friends / social streaks
- [ ] Data export (CSV)
- [ ] Weekly summary email
