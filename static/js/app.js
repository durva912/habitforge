/* ═══════════════════════════════════════════════════
   HABITFORGE — app.js
   Full client-side logic with animations
═══════════════════════════════════════════════════ */

// ─── STATE ───────────────────────────────────────────
const App = {
  user: null,
  currentPage: 'dashboard',
  editingHabitId: null,
  selectedIcon: '⚡',
  selectedFreq: 'daily',
  selectedDays: [],
};

// ─── API HELPER ───────────────────────────────────────
async function api(method, url, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

// ─── PARTICLE CANVAS ──────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  
  const particles = Array.from({length: 40}, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.5 + 0.3,
    dx: (Math.random() - 0.5) * 0.3,
    dy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.3 + 0.05,
  }));

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(178,107,255,${p.alpha})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
  window.addEventListener('resize', () => {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W; canvas.height = H;
  });
})();

// ─── SCREEN MANAGEMENT ────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) {
    pageEl.classList.add('active');
    App.currentPage = page;
  }
  
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Load data per page
  if (page === 'dashboard') loadDashboard();
  else if (page === 'stats') loadStats();
  else if (page === 'gamification') loadGamePage();
  else if (page === 'profile') loadProfile();
}

// ─── AUTH ─────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab + '-form').classList.add('active');
  });
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  
  if (!email || !password) { err.textContent = 'Please fill all fields'; return; }
  
  const data = await api('POST', '/api/login', { email, password });
  if (data.error) { err.textContent = data.error; return; }
  
  App.user = data;
  onLogin();
});

document.getElementById('signup-btn').addEventListener('click', async () => {
  const username = document.getElementById('signup-username').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const err = document.getElementById('signup-error');
  
  if (!username || !email || !password) { err.textContent = 'Please fill all fields'; return; }
  if (password.length < 6) { err.textContent = 'Password must be at least 6 characters'; return; }
  
  const data = await api('POST', '/api/signup', { username, email, password });
  if (data.error) { err.textContent = data.error; return; }
  
  App.user = data;
  onLogin();
});

// Allow Enter key on inputs
['login-email', 'login-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });
});

async function onLogin() {
  const me = await api('GET', '/api/me');
  App.user = { ...App.user, ...me };
  updateHeader(me);
  showScreen('app-screen');
  navigateTo('dashboard');
  setTodayDate();
}

async function checkSession() {
  try {
    const me = await api('GET', '/api/me');
    if (!me || me.error) {
      showScreen('auth-screen');
      return;
    }
    App.user = me;
    updateHeader(me);
    showScreen('app-screen');
    navigateTo('dashboard');
    setTodayDate();
  } catch (e) {
    showScreen('auth-screen');
  }
}

function updateHeader(me) {
  document.getElementById('header-xp').textContent = me.xp + ' XP';
  document.getElementById('header-level').textContent = me.level;
  document.getElementById('avatar-initial').textContent = (me.username || '?')[0].toUpperCase();
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('POST', '/api/logout');
  App.user = null;
  showScreen('auth-screen');
});

function setTodayDate() {
  const today = new Date();
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('today-date').textContent = today.toLocaleDateString('en-US', opts);
}

// ─── NAVIGATION ───────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

document.getElementById('profile-nav-btn').addEventListener('click', () => navigateTo('profile'));

// ─── DASHBOARD ────────────────────────────────────────
async function loadDashboard() {
  const me = await api('GET', '/api/me');
  updateHeader(me);
  updateXpBar('dash', me);
  
  const habits = await api('GET', '/api/habits');
  renderHabits(habits);
}

function updateXpBar(prefix, me) {
  const pct = me.xp_needed > 0 ? (me.xp_in_level / me.xp_needed * 100) : 0;
  const bar = document.getElementById(prefix + '-xp-bar');
  if (bar) {
    setTimeout(() => bar.style.width = pct + '%', 50);
  }
  const lvl = document.getElementById(prefix + '-level');
  if (lvl) lvl.textContent = me.level;
  const cur = document.getElementById(prefix + '-xp-current');
  if (cur) cur.textContent = me.xp_in_level;
  const need = document.getElementById(prefix + '-xp-needed');
  if (need) need.textContent = me.xp_needed;
  const rem = document.getElementById(prefix + '-xp-remaining');
  if (rem) rem.textContent = me.xp_needed - me.xp_in_level;
}

function renderHabits(habits) {
  const list = document.getElementById('habit-list');
  const empty = document.getElementById('empty-state');
  
  // Remove old habit cards
  list.querySelectorAll('.habit-card').forEach(c => c.remove());
  
  if (!habits.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  
  habits.forEach((habit, i) => {
    const card = createHabitCard(habit, i);
    list.appendChild(card);
  });
}

function createHabitCard(habit, index = 0) {
  const card = document.createElement('div');
  card.className = 'habit-card' + (habit.completed_today ? ' completed' : '');
  card.dataset.habitId = habit.id;
  card.style.animationDelay = (index * 0.07) + 's';

  const streakIcon = habit.current_streak >= 7 ? '🔥' : '⚡';

  card.innerHTML = `
    <div class="habit-icon-wrap">${habit.icon}</div>
    <div class="habit-info">
      <div class="habit-name">${escHtml(habit.name)}</div>
      <div class="habit-streak">
        <span class="streak-flame" id="streak-${habit.id}">${streakIcon}</span>
        <span id="streak-count-${habit.id}">${habit.current_streak} day streak</span>
      </div>
    </div>
    <button class="done-btn ${habit.completed_today ? 'done' : ''}" 
            id="done-btn-${habit.id}"
            data-habit-id="${habit.id}"
            ${habit.completed_today ? 'disabled' : ''}>
      <span class="check-icon">${habit.completed_today ? '✓' : '○'}</span>
    </button>
  `;

  if (!habit.completed_today) {
    card.querySelector('.done-btn').addEventListener('click', function (e) {
      markHabitDone(habit.id, e.currentTarget);
    });
  }

  return card;
}

async function markHabitDone(habitId, btn) {
  if (btn.classList.contains('done')) return;

  // Ripple effect
  btn.classList.add('ripple');
  setTimeout(() => btn.classList.remove('ripple'), 500);

  const data = await api('POST', '/api/mark_done', { habit_id: habitId });
  if (data.error) { console.error(data.error); return; }

  // Update button
  btn.classList.add('done');
  btn.disabled = true;
  btn.querySelector('.check-icon').textContent = '✓';

  // Card animation
  const card = document.querySelector(`.habit-card[data-habit-id="${habitId}"]`);
  if (card) {
    card.classList.add('completed');
    card.classList.add('pop-anim');
    setTimeout(() => card.classList.remove('pop-anim'), 600);
  }

  // Streak update with animation
  const streakEl = document.getElementById(`streak-count-${habitId}`);
  const flameEl = document.getElementById(`streak-${habitId}`);
  if (streakEl) {
    streakEl.textContent = data.current_streak + ' day streak';
    flameEl.classList.add('streak-bounce');
    setTimeout(() => flameEl.classList.remove('streak-bounce'), 700);
    if (data.current_streak >= 7) flameEl.textContent = '🔥';
  }

  // XP float
  showXpFloat(btn, '+' + data.xp_earned + ' XP');
  if (data.bonus_xp > 0) {
    setTimeout(() => showXpFloat(btn, data.streak_bonus_msg || '+' + data.bonus_xp + ' XP', '#ffd740'), 600);
  }

  // Update header
  updateHeader({ xp: data.total_xp, level: data.level, username: App.user?.username });
  
  // Refresh XP bar
  updateXpBar('dash', {
    xp_in_level: data.xp_in_level,
    xp_needed: data.xp_needed,
    level: data.level
  });

  // Level up?
  if (data.leveled_up) {
    setTimeout(() => showLevelUp(data.level), 800);
  }

  // Badge unlock?
  if (data.new_badges && data.new_badges.length > 0) {
    let delay = data.leveled_up ? 2500 : 800;
    data.new_badges.forEach((badge, i) => {
      setTimeout(() => showBadgeUnlock(badge), delay + i * 2000);
    });
  }
}

function showXpFloat(anchorEl, text, color = '#00e676') {
  const rect = anchorEl.getBoundingClientRect();
  const float = document.createElement('div');
  float.className = 'xp-float';
  float.textContent = text;
  float.style.left = (rect.left + rect.width / 2 - 30) + 'px';
  float.style.top = (rect.top - 10) + 'px';
  float.style.color = color;
  document.getElementById('xp-floats').appendChild(float);
  setTimeout(() => float.remove(), 1300);
}

function showBadgeUnlock(badge) {
  document.getElementById('badge-unlock-icon').textContent = badge.icon;
  document.getElementById('badge-unlock-name').textContent = badge.name;
  document.getElementById('badge-unlock-desc').textContent = badge.description;
  openModal('badge-modal');
  spawnConfetti();
}

function showLevelUp(level) {
  document.getElementById('levelup-number').textContent = level;
  openModal('levelup-modal');
  spawnConfetti();
}

function spawnConfetti() {
  const colors = ['#00e676', '#b26bff', '#4da6ff', '#ffd740', '#ff5252'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.top = '-10px';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.getElementById('xp-floats').appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

// ─── STATS PAGE ────────────────────────────────────────
async function loadStats() {
  const stats = await api('GET', '/api/stats');
  
  document.getElementById('stat-best-streak').textContent = stats.best_streak;
  document.getElementById('stat-total').textContent = stats.total_completions;
  document.getElementById('stat-rate').textContent = stats.completion_rate + '%';
  document.getElementById('stat-level').textContent = stats.level;
  
  document.getElementById('stats-level').textContent = stats.level;
  document.getElementById('stats-xp').textContent = stats.xp;
  
  const pct = stats.xp_needed > 0 ? (stats.xp_in_level / stats.xp_needed * 100) : 0;
  setTimeout(() => {
    const bar = document.getElementById('stats-xp-bar');
    if (bar) bar.style.width = pct + '%';
  }, 100);
  
  renderWeekChart(stats.week_data);
}

function renderWeekChart(weekData) {
  const chart = document.getElementById('week-chart');
  chart.innerHTML = '';
  const max = Math.max(...weekData.map(d => d.count), 1);
  const today = new Date().toISOString().split('T')[0];
  
  weekData.forEach(day => {
    const pct = (day.count / max) * 100;
    const isToday = day.full_date === today;
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <div class="bar-count">${day.count}</div>
      <div class="bar-fill ${isToday ? 'today' : ''}" style="height: 0%; max-height: 90px;"></div>
      <div class="bar-label">${day.date}</div>
    `;
    chart.appendChild(col);
    setTimeout(() => {
      col.querySelector('.bar-fill').style.height = Math.max(pct * 0.9, 4) + 'px';
    }, 100);
  });
}

// ─── GAMIFICATION PAGE ────────────────────────────────
async function loadGamePage() {
  const me = await api('GET', '/api/me');
  const badges = await api('GET', '/api/badges');
  
  document.getElementById('game-level').textContent = me.level;
  document.getElementById('game-xp').textContent = me.xp;
  document.getElementById('game-xp-current').textContent = me.xp_in_level;
  document.getElementById('game-xp-needed').textContent = me.xp_needed;
  
  const pct = me.xp_needed > 0 ? (me.xp_in_level / me.xp_needed * 100) : 0;
  setTimeout(() => {
    const bar = document.getElementById('game-xp-bar');
    if (bar) bar.style.width = pct + '%';
  }, 100);

  renderBadges(badges);
}

function renderBadges(badges) {
  const grid = document.getElementById('badges-grid');
  grid.innerHTML = '';
  
  badges.forEach((badge, i) => {
    const card = document.createElement('div');
    card.className = 'badge-card ' + (badge.unlocked ? 'unlocked' : 'locked');
    card.style.animationDelay = (i * 0.05) + 's';
    card.innerHTML = `
      <div class="badge-icon">${badge.icon}</div>
      <div class="badge-name">${escHtml(badge.name)}</div>
      <div class="badge-desc">${escHtml(badge.description)}</div>
      ${badge.unlocked ? `<div class="badge-date">${badge.unlocked_at}</div>` : '<div class="badge-desc" style="color:var(--text3)">Locked</div>'}
    `;
    grid.appendChild(card);
  });
}

// ─── PROFILE PAGE ─────────────────────────────────────
async function loadProfile() {
  const me = await api('GET', '/api/me');
  document.getElementById('profile-username-display').textContent = '@' + me.username;
  document.getElementById('profile-email').textContent = me.email;
  
  const habits = await api('GET', '/api/habits/all');
  renderAllHabits(habits);
}

function renderAllHabits(habits) {
  const list = document.getElementById('all-habits-list');
  list.innerHTML = '';
  
  if (!habits.length) {
    list.innerHTML = '<p style="color:var(--text2);font-size:0.9rem;text-align:center;padding:1rem 0">No habits yet. Add one!</p>';
    return;
  }
  
  habits.forEach(habit => {
    const item = document.createElement('div');
    item.className = 'habit-manage-item';
    item.innerHTML = `
      <div class="habit-manage-icon">${habit.icon}</div>
      <div class="habit-manage-info">
        <div class="habit-manage-name">${escHtml(habit.name)}</div>
        <div class="habit-manage-sub">${habit.frequency === 'daily' ? 'Daily' : habit.custom_days} · ${habit.total_completions} completions · ${habit.current_streak} day streak</div>
      </div>
      <div class="habit-manage-actions">
        <button class="edit-btn" data-id="${habit.id}" title="Edit">✏️</button>
        <button class="del-btn" data-id="${habit.id}" title="Delete">🗑️</button>
      </div>
    `;
    item.querySelector('.edit-btn').addEventListener('click', () => openEditHabit(habit));
    item.querySelector('.del-btn').addEventListener('click', () => deleteHabit(habit.id));
    list.appendChild(item);
  });
}

async function deleteHabit(id) {
  if (!confirm('Delete this habit? This cannot be undone.')) return;
  await api('DELETE', `/api/delete_habit/${id}`);
  loadProfile();
}

function openEditHabit(habit) {
  App.editingHabitId = habit.id;
  document.getElementById('habit-modal-title').textContent = 'Edit Habit';
  document.getElementById('save-btn-text').textContent = 'Save Changes';
  
  document.getElementById('habit-name').value = habit.name;
  document.getElementById('habit-reminder').value = habit.reminder_time || '';
  
  // Icon
  App.selectedIcon = habit.icon;
  document.querySelectorAll('.icon-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.icon === habit.icon);
  });
  
  // Frequency
  App.selectedFreq = habit.frequency;
  document.querySelectorAll('.freq-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.freq === habit.frequency);
  });
  document.getElementById('custom-days-group').style.display = habit.frequency === 'custom' ? 'flex' : 'none';
  
  // Days
  App.selectedDays = habit.custom_days ? habit.custom_days.split(',') : [];
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.toggle('active', App.selectedDays.includes(btn.dataset.day));
  });
  
  openModal('habit-modal');
}

// ─── ADD / EDIT HABIT MODAL ───────────────────────────
document.getElementById('add-habit-btn').addEventListener('click', () => openAddHabit());
document.getElementById('profile-add-btn').addEventListener('click', () => openAddHabit());

function openAddHabit() {
  App.editingHabitId = null;
  document.getElementById('habit-modal-title').textContent = 'Add Habit';
  document.getElementById('save-btn-text').textContent = 'Add Habit';
  document.getElementById('habit-name').value = '';
  document.getElementById('habit-reminder').value = '';
  App.selectedIcon = '⚡';
  App.selectedFreq = 'daily';
  App.selectedDays = [];
  
  document.querySelectorAll('.icon-opt').forEach((btn, i) => btn.classList.toggle('active', i === 0));
  document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.freq === 'daily'));
  document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('custom-days-group').style.display = 'none';
  
  openModal('habit-modal');
}

// Icon picker
document.querySelectorAll('.icon-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.icon-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    App.selectedIcon = btn.dataset.icon;
  });
});

// Frequency toggle
document.querySelectorAll('.freq-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    App.selectedFreq = btn.dataset.freq;
    document.getElementById('custom-days-group').style.display = btn.dataset.freq === 'custom' ? 'flex' : 'none';
  });
});

// Days picker
document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const day = btn.dataset.day;
    if (btn.classList.contains('active')) {
      if (!App.selectedDays.includes(day)) App.selectedDays.push(day);
    } else {
      App.selectedDays = App.selectedDays.filter(d => d !== day);
    }
  });
});

// Save habit
document.getElementById('habit-modal-save').addEventListener('click', async () => {
  const name = document.getElementById('habit-name').value.trim();
  if (!name) { alert('Please enter a habit name'); return; }
  if (App.selectedFreq === 'custom' && App.selectedDays.length === 0) {
    alert('Please select at least one day'); return;
  }
  
  const payload = {
    name,
    icon: App.selectedIcon,
    frequency: App.selectedFreq,
    custom_days: App.selectedDays,
    reminder_time: document.getElementById('habit-reminder').value
  };
  
  if (App.editingHabitId) {
    await api('PUT', `/api/edit_habit/${App.editingHabitId}`, payload);
  } else {
    await api('POST', '/api/add_habit', payload);
  }
  
  closeModal('habit-modal');
  
  if (App.currentPage === 'dashboard') loadDashboard();
  else if (App.currentPage === 'profile') loadProfile();
});

// Close habit modal
document.getElementById('habit-modal-close').addEventListener('click', () => closeModal('habit-modal'));
document.getElementById('habit-modal-cancel').addEventListener('click', () => closeModal('habit-modal'));

// Badge modal close
document.getElementById('badge-modal-close').addEventListener('click', () => closeModal('badge-modal'));
document.getElementById('levelup-close').addEventListener('click', () => closeModal('levelup-modal'));

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ─── UTILITIES ────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── INIT ─────────────────────────────────────────────
checkSession();
