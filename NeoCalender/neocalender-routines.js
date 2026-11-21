/**
 * NeoCalender/neocalender-routines.js
 *
 * Daily & Study Routine Management Component.
 * - Create, edit, and organize reusable daily routines
 * - Activity sequence builder with duration calculation
 * - One-click routine execution that converts activities to tasks without duplicates
 */

export class NeoCalenderRoutines {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.routines = [];
  }

  async init(containerEl) {
    this.container = containerEl;
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      this.routines = await this.api.getRoutines();
    } catch (err) {
      console.error('[NeoCalender Routines] Load error:', err);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="nc-routines-header d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h4 class="fw-bold mb-1"><i class="bi bi-clock-history text-info me-2"></i>Daily & Study Routines</h4>
          <p class="text-secondary small mb-0">Build automated activity sequences for study sessions, morning prep, or evening reviews.</p>
        </div>
        <button class="btn btn-primary btn-sm rounded-pill px-3" id="ncBtnNewRoutine">
          <i class="bi bi-plus-lg me-1"></i>New Routine
        </button>
      </div>

      ${this.routines.length === 0 ? `
        <div class="text-center py-5 text-secondary">
          <i class="bi bi-collection-play display-4 mb-3 d-block text-muted opacity-50"></i>
          <h5>No routines created yet</h5>
          <p class="small">Create reusable routines like "Morning Exam Prep" or "Deep Focus Session" and add their tasks with one click.</p>
          <button class="btn btn-outline-primary btn-sm rounded-pill mt-2" id="ncBtnNewRoutineEmpty">
            <i class="bi bi-plus-lg me-1"></i>Create First Routine
          </button>
        </div>
      ` : `
        <div class="row g-3">
          ${this.routines.map(r => `
            <div class="col-12 col-md-6 col-lg-4">
              <div class="nc-routine-card p-3 rounded-3 border h-100 d-flex flex-column justify-content-between bg-card">
                <div>
                  <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="badge bg-info-subtle text-info-emphasis">${r.category || 'Study'}</span>
                    <span class="small text-secondary"><i class="bi bi-stopwatch me-1"></i>~${r.estimatedMinutes || 0} mins</span>
                  </div>
                  <h5 class="fw-bold mb-1">${this.escapeHtml(r.name)}</h5>
                  <p class="text-secondary small mb-3">${this.escapeHtml(r.description || 'Structured sequence of study activities')}</p>

                  <div class="nc-activity-preview mb-3">
                    <span class="text-secondary" style="font-size: 0.75rem;">ACTIVITIES (${r.activities?.length || 0})</span>
                    <ul class="list-unstyled mb-0 mt-1 small">
                      ${(r.activities || []).slice(0, 4).map((a, idx) => `
                        <li class="d-flex justify-content-between py-1 border-bottom border-light-subtle">
                          <span>${idx + 1}. ${this.escapeHtml(a.title)}</span>
                          <span class="text-muted">${a.durationMinutes}m</span>
                        </li>
                      `).join('')}
                      ${(r.activities?.length || 0) > 4 ? `
                        <li class="py-1 text-muted small">+${r.activities.length - 4} more activities</li>
                      ` : ''}
                    </ul>
                  </div>
                </div>

                <div class="d-flex align-items-center justify-content-between pt-3 border-top mt-2">
                  <button class="btn btn-sm btn-outline-danger nc-routine-delete-btn p-1 px-2" data-id="${r.id}" title="Delete Routine">
                    <i class="bi bi-trash"></i>
                  </button>
                  <button class="btn btn-sm btn-primary rounded-pill px-3 nc-apply-routine-btn" data-id="${r.id}">
                    <i class="bi bi-play-circle me-1"></i>Apply for Today
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    this.bindEvents();
  }

  bindEvents() {
    const newBtn = this.container.querySelector('#ncBtnNewRoutine') || this.container.querySelector('#ncBtnNewRoutineEmpty');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.showNewRoutineModal());
    }

    // Apply routine
    this.container.querySelectorAll('.nc-apply-routine-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        try {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Applying...';
          const res = await this.api.convertRoutineToTasks(id);
          this.app.notifications.showToast(`Applied routine: created ${res.createdCount} tasks for today (duplicates skipped)`, 'success');
          // Reload tasks
          if (this.app.loadTasks) await this.app.loadTasks();
        } catch (err) {
          this.app.notifications.showToast('Failed to apply routine: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-play-circle me-1"></i>Apply for Today';
        }
      });
    });

    // Delete routine
    this.container.querySelectorAll('.nc-routine-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this routine template?')) {
          await this.api.deleteRoutine(id);
          this.app.notifications.showToast('Routine deleted', 'info');
          await this.loadData();
          this.render();
        }
      });
    });
  }

  showNewRoutineModal() {
    const modalEl = document.getElementById('ncRoutineModal');
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
