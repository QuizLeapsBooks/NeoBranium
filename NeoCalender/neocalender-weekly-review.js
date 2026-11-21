/**
 * NeoCalender/neocalender-weekly-review.js
 *
 * Weekly Review & Productivity Insights Component.
 * - Synthesizes actual real data across Tasks, Habits, Goals, and Focus sessions
 * - No fabricated statistics
 * - Auto-reschedule proposal triggers with user confirmation
 */

export class NeoCalenderWeeklyReview {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.reviewData = null;
    this.isLoading = true;
  }

  async init(containerEl) {
    this.container = containerEl;
    await this.loadData();
    this.render();
  }

  async loadData() {
    this.isLoading = true;
    try {
      this.reviewData = await this.api.getWeeklyReview();
    } catch (err) {
      console.error('[NeoCalender Weekly Review] Load error:', err);
    } finally {
      this.isLoading = false;
    }
  }

  render() {
    if (!this.container) return;

    if (this.isLoading) {
      this.container.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <h5>Analyzing your weekly productivity...</h5>
          <p class="text-secondary small">Gathering tasks, habits consistency, goal milestones, and focus logs.</p>
        </div>
      `;
      return;
    }

    const { period, tasks, habits, goals, focus } = this.reviewData || {};
    const totalFocusHours = ((focus?.weekMinutes || 0) / 60).toFixed(1);

    this.container.innerHTML = `
      <div class="nc-review-header d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h4 class="fw-bold mb-1"><i class="bi bi-journal-text text-primary me-2"></i>Weekly Productivity Review</h4>
          <p class="text-secondary small mb-0">Period: ${period?.startDate || '7 days ago'} to ${period?.endDate || 'Today'}</p>
        </div>
        <button class="btn btn-outline-primary btn-sm rounded-pill px-3" id="ncBtnRefreshReview">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>

      <!-- Core 4 Pillars Metric Row -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="p-3 rounded-3 border bg-card text-center">
            <span class="text-secondary small d-block mb-1">Tasks Completed</span>
            <span class="fs-4 fw-bold text-success">${tasks?.completedCount || 0}</span>
            <span class="small text-muted d-block" style="font-size: 0.75rem;">${tasks?.pendingCount || 0} pending</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="p-3 rounded-3 border bg-card text-center">
            <span class="text-secondary small d-block mb-1">Habit Consistency</span>
            <span class="fs-4 fw-bold text-warning">${habits?.consistencyPercentage || 0}%</span>
            <span class="small text-muted d-block" style="font-size: 0.75rem;">${habits?.totalActive || 0} active habits</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="p-3 rounded-3 border bg-card text-center">
            <span class="text-secondary small d-block mb-1">Deep Work Logged</span>
            <span class="fs-4 fw-bold text-info">${totalFocusHours} <small class="fs-6">hrs</small></span>
            <span class="small text-muted d-block" style="font-size: 0.75rem;">${focus?.completedSessions || 0} sessions</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="p-3 rounded-3 border bg-card text-center">
            <span class="text-secondary small d-block mb-1">Active Goals</span>
            <span class="fs-4 fw-bold text-primary">${goals?.activeCount || 0}</span>
            <span class="small text-muted d-block" style="font-size: 0.75rem;">${goals?.completedCount || 0} completed</span>
          </div>
        </div>
      </div>

      <!-- Auto Reschedule Recommendation Banner (if overdue tasks exist) -->
      ${(tasks?.overdueCount || 0) > 0 ? `
        <div class="alert alert-warning p-3 rounded-3 mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div class="d-flex align-items-center gap-3">
            <i class="bi bi-exclamation-triangle-fill fs-3 text-warning"></i>
            <div>
              <h6 class="mb-1 fw-bold">You have ${tasks.overdueCount} overdue/incomplete tasks</h6>
              <p class="mb-0 small text-warning-emphasis">Would you like AI to inspect open time slots and propose an optimal rearranged schedule?</p>
            </div>
          </div>
          <button class="btn btn-warning btn-sm rounded-pill px-4 fw-bold" id="ncBtnAutoReschedule">
            <i class="bi bi-magic me-1"></i>Rearrange with AI
          </button>
        </div>
      ` : ''}

      <!-- Detailed Insights Grid -->
      <div class="row g-4">
        <!-- Completed Highlights -->
        <div class="col-12 col-md-6">
          <div class="p-4 rounded-3 border bg-card h-100">
            <h6 class="fw-bold mb-3"><i class="bi bi-check2-all text-success me-2"></i>Completed Tasks</h6>
            ${(tasks?.completedList || []).length === 0 ? `
              <p class="text-muted small">No tasks completed in this 7-day period.</p>
            ` : `
              <ul class="list-unstyled mb-0 d-flex flex-column gap-2 small">
                ${tasks.completedList.map(t => `
                  <li class="d-flex justify-content-between py-1 border-bottom border-light-subtle">
                    <span><i class="bi bi-check-circle-fill text-success me-2"></i>${this.escapeHtml(t.title)}</span>
                    <span class="badge bg-secondary-subtle text-secondary">${t.category}</span>
                  </li>
                `).join('')}
              </ul>
            `}
          </div>
        </div>

        <!-- Upcoming Deadlines Priority -->
        <div class="col-12 col-md-6">
          <div class="p-4 rounded-3 border bg-card h-100">
            <h6 class="fw-bold mb-3"><i class="bi bi-calendar-event text-danger me-2"></i>Upcoming Deadlines (Next 7 Days)</h6>
            ${(tasks?.upcomingList || []).length === 0 ? `
              <p class="text-muted small">No urgent deadlines scheduled in the upcoming week.</p>
            ` : `
              <ul class="list-unstyled mb-0 d-flex flex-column gap-2 small">
                ${tasks.upcomingList.map(t => `
                  <li class="d-flex justify-content-between align-items-center py-1 border-bottom border-light-subtle">
                    <span><i class="bi bi-clock-history text-danger me-2"></i>${this.escapeHtml(t.title)}</span>
                    <span class="small text-secondary">${t.dueDate ? t.dueDate.slice(0, 10) : 'Soon'}</span>
                  </li>
                `).join('')}
              </ul>
            `}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const refreshBtn = this.container.querySelector('#ncBtnRefreshReview');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.loadData();
        this.render();
      });
    }

    const rescheduleBtn = this.container.querySelector('#ncBtnAutoReschedule');
    if (rescheduleBtn) {
      rescheduleBtn.addEventListener('click', async () => {
        // Switch to AI assistant tab and ask AI to rearrange schedule
        if (this.app.switchView) {
          this.app.switchView('ai');
          if (this.app.ai && this.app.ai.sendMessage) {
            this.app.ai.sendMessage("I couldn't complete yesterday's tasks. Rearrange my schedule.");
          }
        }
      });
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
