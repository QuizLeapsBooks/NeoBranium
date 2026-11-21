/**
 * NeoCalender/neocalender-habits.js
 *
 * Habit Tracker & Streak Management Component.
 * - Displays habits with streaks, 7-day completion matrix, consistency stats
 * - Optimistic toggle completion
 * - Create, edit, pause, archive, delete habits
 */

export class NeoCalenderHabits {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.habits = [];
    this.stats = null;
    this.activeFilter = 'active'; // 'active', 'all', 'paused'
  }

  async init(containerEl) {
    this.container = containerEl;
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      const [habits, stats] = await Promise.all([
        this.api.getHabits(),
        this.api.getHabitStats()
      ]);
      this.habits = habits || [];
      this.stats = stats || {};
    } catch (err) {
      console.error('[NeoCalender Habits] Load error:', err);
    }
  }

  render() {
    if (!this.container) return;

    const filtered = this.habits.filter(h => {
      if (this.activeFilter === 'all') return true;
      if (this.activeFilter === 'paused') return h.status === 'paused';
      return h.status === 'active';
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const past7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      past7Days.push(d.toISOString().slice(0, 10));
    }

    this.container.innerHTML = `
      <div class="nc-habits-header d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h4 class="fw-bold mb-1"><i class="bi bi-fire text-warning me-2"></i>Habit Tracker</h4>
          <p class="text-secondary small mb-0">Build positive daily study routines and maintain consistency streaks.</p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <div class="btn-group btn-group-sm" role="group">
            <button type="button" class="btn btn-outline-secondary ${this.activeFilter === 'active' ? 'active' : ''}" data-filter="active">Active</button>
            <button type="button" class="btn btn-outline-secondary ${this.activeFilter === 'paused' ? 'active' : ''}" data-filter="paused">Paused</button>
            <button type="button" class="btn btn-outline-secondary ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
          </div>
          <button class="btn btn-primary btn-sm rounded-pill px-3" id="ncBtnNewHabit">
            <i class="bi bi-plus-lg me-1"></i>New Habit
          </button>
        </div>
      </div>

      <!-- Quick Metrics Banner -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="nc-metric-card p-3 rounded-3 text-center">
            <span class="text-secondary small d-block mb-1">Active Habits</span>
            <span class="fs-4 fw-bold text-primary">${this.stats?.activeHabits || 0}</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="nc-metric-card p-3 rounded-3 text-center">
            <span class="text-secondary small d-block mb-1">Done Today</span>
            <span class="fs-4 fw-bold text-success">${this.stats?.completedToday || 0}</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="nc-metric-card p-3 rounded-3 text-center">
            <span class="text-secondary small d-block mb-1">Best Streak</span>
            <span class="fs-4 fw-bold text-warning">${this.stats?.bestStreak || 0} <small class="fs-6">days</small></span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="nc-metric-card p-3 rounded-3 text-center">
            <span class="text-secondary small d-block mb-1">Total Check-ins</span>
            <span class="fs-4 fw-bold text-info">${this.stats?.totalCompletions || 0}</span>
          </div>
        </div>
      </div>

      <!-- Habits List -->
      ${filtered.length === 0 ? `
        <div class="text-center py-5 text-secondary">
          <i class="bi bi-check2-circle display-4 mb-3 d-block text-muted opacity-50"></i>
          <h5>No habits tracked yet</h5>
          <p class="small">Create your first habit like "Read 30 minutes" or "Revise formulas daily" to start your streak.</p>
          <button class="btn btn-outline-primary btn-sm rounded-pill mt-2" id="ncBtnNewHabitEmpty">
            <i class="bi bi-plus-lg me-1"></i>Add a Habit
          </button>
        </div>
      ` : `
        <div class="nc-habit-list d-flex flex-column gap-3">
          ${filtered.map(h => {
            const isDoneToday = Array.isArray(h.completionDates) && h.completionDates.includes(todayStr);
            const compDates = new Set(h.completionDates || []);
            return `
              <div class="nc-habit-card p-3 rounded-3 border" data-id="${h.id}">
                <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div class="d-flex align-items-center gap-3">
                    <button class="btn btn-sm nc-habit-toggle-btn rounded-circle ${isDoneToday ? 'btn-success' : 'btn-outline-secondary'}" data-id="${h.id}" title="${isDoneToday ? 'Completed today! Click to undo' : 'Mark done for today'}">
                      <i class="bi ${isDoneToday ? 'bi-check-lg' : 'bi-circle'}"></i>
                    </button>
                    <div>
                      <h6 class="mb-0 fw-bold ${isDoneToday ? 'text-decoration-line-through text-muted' : ''}">${this.escapeHtml(h.title)}</h6>
                      <div class="d-flex align-items-center gap-2 small text-secondary">
                        <span class="badge bg-secondary-subtle text-secondary-emphasis">${h.category || 'General'}</span>
                        <span><i class="bi bi-repeat me-1"></i>${h.frequency}</span>
                        ${h.reminderTime ? `<span><i class="bi bi-alarm me-1"></i>${h.reminderTime}</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <div class="d-flex align-items-center gap-3">
                    <div class="nc-streak-badge px-3 py-1 rounded-pill bg-warning-subtle text-warning-emphasis fw-bold small d-flex align-items-center gap-1">
                      <i class="bi bi-fire"></i>
                      <span>${h.currentStreak || 0} streak</span>
                    </div>
                    <div class="dropdown">
                      <button class="btn btn-sm btn-link text-secondary p-0" data-bs-toggle="dropdown">
                        <i class="bi bi-three-dots-vertical"></i>
                      </button>
                      <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                        <li><a class="dropdown-item nc-habit-action" href="#" data-action="toggle-status" data-id="${h.id}">${h.status === 'paused' ? 'Resume Habit' : 'Pause Habit'}</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger nc-habit-action" href="#" data-action="delete" data-id="${h.id}">Delete Habit</a></li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- 7-day completion matrix -->
                <div class="nc-habit-matrix d-flex align-items-center justify-content-between pt-2 border-top">
                  <span class="text-secondary small">Last 7 days:</span>
                  <div class="d-flex gap-2">
                    ${past7Days.map(dStr => {
                      const completed = compDates.has(dStr);
                      const isToday = dStr === todayStr;
                      const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'narrow' });
                      return `
                        <div class="text-center">
                          <span class="d-block text-muted" style="font-size: 0.65rem;">${dayName}</span>
                          <span class="nc-matrix-dot d-inline-block rounded-circle ${completed ? 'bg-success' : 'bg-secondary-subtle'} ${isToday ? 'border border-primary' : ''}"
                                style="width: 14px; height: 14px;" title="${dStr}: ${completed ? 'Completed' : 'Missed'}"></span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Filter buttons
    this.container.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeFilter = e.currentTarget.dataset.filter;
        this.render();
      });
    });

    // New habit button
    const newBtn = this.container.querySelector('#ncBtnNewHabit') || this.container.querySelector('#ncBtnNewHabitEmpty');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.showNewHabitModal());
    }

    // Toggle check
    this.container.querySelectorAll('.nc-habit-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const habitId = e.currentTarget.dataset.id;
        await this.toggleHabit(habitId);
      });
    });

    // Menu actions
    this.container.querySelectorAll('.nc-habit-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const action = e.currentTarget.dataset.action;
        const habitId = e.currentTarget.dataset.id;
        if (action === 'delete') {
          if (confirm('Are you sure you want to delete this habit and all streak history?')) {
            await this.api.deleteHabit(habitId);
            this.app.notifications.showToast('Habit deleted', 'info');
            await this.loadData();
            this.render();
          }
        } else if (action === 'toggle-status') {
          const habit = this.habits.find(h => h.id === habitId);
          if (habit) {
            const newStatus = habit.status === 'paused' ? 'active' : 'paused';
            await this.api.updateHabit(habitId, { status: newStatus });
            this.app.notifications.showToast(`Habit ${newStatus}`, 'info');
            await this.loadData();
            this.render();
          }
        }
      });
    });
  }

  async toggleHabit(habitId) {
    try {
      const res = await this.api.toggleHabit(habitId);
      if (res?.completed) {
        this.app.notifications.showToast(`🔥 Habit checked! Streak: ${res.currentStreak} days`, 'success');
      } else {
        this.app.notifications.showToast('Habit check removed', 'info');
      }
      await this.loadData();
      this.render();
    } catch (err) {
      this.app.notifications.showToast('Failed to update habit: ' + err.message, 'error');
    }
  }

  showNewHabitModal() {
    const modalEl = document.getElementById('ncHabitModal');
    if (modalEl && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
