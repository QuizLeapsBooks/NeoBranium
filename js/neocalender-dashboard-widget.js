/**
 * js/neocalender-dashboard-widget.js
 *
 * Dedicated NeoCalender widget for the NeoBranium Dashboard (htmls/dashboard.html).
 * - Shows today's tasks with quick inline checkoff
 * - Shows daily completion progress bar (e.g. 4/7 Tasks Completed)
 * - Shows next scheduled activity / deadline
 * - Deep link to full NeoCalender app (/NeoCalender/index.html)
 */

import { auth } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';

class NeoCalenderDashboardWidget {
  constructor() {
    this.container = document.getElementById('neocalenderDashboardWidget');
    if (!this.container) return;
    this.init();
  }

  init() {
    onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        await this.loadAndRender(user);
      } else {
        this.renderGuestState();
      }
    });
  }

  getApiBaseUrl() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      if (window.location.port && window.location.port !== '3000') {
        return 'http://localhost:3000/api/neocalender';
      }
      return '/api/neocalender';
    }
    return '/api/neocalender';
  }

  async getAuthHeaders() {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  renderGuestState() {
    this.container.innerHTML = `
      <div class="nb-widget h-100">
        <div class="nb-widget-header d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-calendar2-check-fill text-success" style="font-size: 1.15rem;"></i>
            <span class="nb-widget-title">NeoCalender — Today's Progress</span>
          </div>
          <a href="/NeoCalender/index.html" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 0.75rem;">Open</a>
        </div>
        <div class="nb-widget-body py-3">
          <p class="small text-muted mb-3">Organize your study goals, daily routine, and academic deadlines with NeoCalender.</p>
          <a href="/htmls/sign.html" class="btn btn-sm btn-primary">Sign in to track tasks</a>
        </div>
      </div>
    `;
  }

  async loadAndRender(user) {
    try {
      const headers = await this.getAuthHeaders();
      const baseUrl = this.getApiBaseUrl();

      // Fetch today's schedule, overall stats, habits stats, and focus stats in parallel
      const [schedRes, statsRes, habitStatsRes, focusStatsRes] = await Promise.all([
        fetch(`${baseUrl}/schedule?date=today`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/stats`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/habits/stats`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/focus/stats`, { headers }).then(r => r.json()).catch(() => ({}))
      ]);

      const schedule = schedRes.schedule || { tasks: [], total: 0, completed: 0, pending: 0 };
      const stats = statsRes.stats || {};
      const habitStats = habitStatsRes.stats || {};
      const focusStats = focusStatsRes.stats || {};

      const tasks = schedule.tasks || [];
      const total = schedule.total || tasks.length;
      const completed = schedule.completed || tasks.filter(t => t.status === 'completed').length;
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const todayFocusMins = focusStats.todayMinutes || 0;

      // Find next scheduled activity
      const nextPending = tasks.find(t => t.status === 'pending');

      const tasksHtml = tasks.slice(0, 4).map(task => {
        const isCompleted = task.status === 'completed';
        return `
          <div class="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary border-opacity-10" data-task-id="${task.id}">
            <div class="d-flex align-items-center gap-2 text-truncate me-2">
              <input type="checkbox" class="form-check-input mt-0 nc-dash-task-check" ${isCompleted ? 'checked' : ''} style="cursor: pointer;">
              <span class="small ${isCompleted ? 'text-decoration-line-through text-muted' : 'text-body'} text-truncate" title="${this.escapeHtml(task.title)}">
                ${this.escapeHtml(task.title)}
              </span>
            </div>
            ${task.dueTime ? `<span class="badge bg-secondary-subtle text-secondary py-0 px-1" style="font-size: 0.7rem;">${task.dueTime}</span>` : ''}
          </div>
        `;
      }).join('');

      this.container.innerHTML = `
        <div class="nb-widget h-100">
          <div class="nb-widget-header d-flex justify-content-between align-items-center mb-2">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-calendar2-check-fill text-success" style="font-size: 1.15rem;"></i>
              <span class="nb-widget-title">Today's Progress</span>
            </div>
            <a href="/NeoCalender/index.html" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 0.75rem;">
              Open NeoCalender <i class="bi bi-arrow-right"></i>
            </a>
          </div>

          <div class="nb-widget-body">
            <!-- Progress summary -->
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="small fw-semibold text-secondary">
                ${total > 0 ? `${completed}/${total} Tasks Completed` : 'No tasks scheduled for today'}
              </span>
              <span class="small fw-bold ${progressPercent === 100 ? 'text-success' : 'text-primary'}">${progressPercent}%</span>
            </div>
            <div class="progress mb-3" style="height: 6px;">
              <div class="progress-bar ${progressPercent === 100 ? 'bg-success' : 'bg-primary'}" role="progressbar" style="width: ${progressPercent}%;" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>

            <!-- Multiverse quick pills -->
            <div class="d-flex align-items-center gap-1 mb-2 flex-wrap">
              <span class="badge bg-warning-subtle text-warning-emphasis px-2 py-1" style="font-size: 0.7rem;">
                <i class="bi bi-fire me-1"></i>${habitStats.completedToday || 0}/${habitStats.activeHabits || 0} Habits
              </span>
              <span class="badge bg-info-subtle text-info-emphasis px-2 py-1" style="font-size: 0.7rem;">
                <i class="bi bi-hourglass-split me-1"></i>${todayFocusMins}m Focus
              </span>
              <span class="badge bg-success-subtle text-success-emphasis px-2 py-1" style="font-size: 0.7rem;">
                <i class="bi bi-trophy me-1"></i>Streak: ${habitStats.bestStreak || 0}d
              </span>
            </div>

            <!-- Next up banner -->
            ${nextPending ? `
              <div class="p-2 rounded mb-2 d-flex align-items-center gap-2" style="background: rgba(99, 102, 241, 0.08); border-left: 3px solid var(--nc-accent, #6366f1);">
                <i class="bi bi-clock-history text-primary"></i>
                <div class="text-truncate">
                  <div class="small fw-semibold text-truncate">Next: ${this.escapeHtml(nextPending.title)}</div>
                  <div class="text-muted" style="font-size: 0.7rem;">${nextPending.dueTime ? 'Due at ' + nextPending.dueTime : 'Today'}</div>
                </div>
              </div>
            ` : ''}

            <!-- Task items list -->
            <div class="nc-dash-tasks-list mb-2">
              ${tasks.length > 0 ? tasksHtml : '<p class="small text-muted my-2">Your today\'s schedule is clean. Plan study sessions or create new tasks!</p>'}
            </div>

            <div class="d-flex justify-content-between align-items-center pt-1 border-top border-secondary border-opacity-10">
              <span class="text-muted" style="font-size: 0.75rem;">
                <i class="bi bi-check2-all text-success me-1"></i>${stats.completedThisWeek || 0} completed this week
              </span>
              <a href="/NeoCalender/index.html" class="text-primary text-decoration-none" style="font-size: 0.75rem;">+ Add Task</a>
            </div>
          </div>
        </div>
      `;

      // Bind inline checkbox toggle
      this.container.querySelectorAll('.nc-dash-task-check').forEach(chk => {
        chk.addEventListener('change', async (e) => {
          const row = chk.closest('[data-task-id]');
          const taskId = row?.dataset.taskId;
          if (!taskId) return;
          try {
            await fetch(`${baseUrl}/tasks/${encodeURIComponent(taskId)}/toggle`, {
              method: 'POST',
              headers
            });
            await this.loadAndRender(user);
          } catch (err) {
            console.error('Failed to toggle task from dashboard:', err);
          }
        });
      });

    } catch (err) {
      console.error('Error loading NeoCalender dashboard widget:', err);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new NeoCalenderDashboardWidget();
});
