/**
 * NeoCalender/neocalender-goals.js
 *
 * Advanced Goal & Milestone Management System.
 * - Short & long-term goals
 * - Milestone breakdown with automatic progress % from actual completions
 * - Associated tasks linking
 * - Progress history tracking
 */

export class NeoCalenderGoals {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.goals = [];
    this.milestonesByGoal = {};
  }

  async init(containerEl) {
    this.container = containerEl;
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      this.goals = await this.api.getGoals();
      for (const g of this.goals) {
        const ms = await this.api.getMilestones(g.id);
        this.milestonesByGoal[g.id] = ms || [];
      }
    } catch (err) {
      console.error('[NeoCalender Goals] Load error:', err);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="nc-goals-header d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h4 class="fw-bold mb-1"><i class="bi bi-bullseye text-danger me-2"></i>Goals & Milestones</h4>
          <p class="text-secondary small mb-0">Track long-term academic and personal targets with verifiable milestone completion data.</p>
        </div>
        <button class="btn btn-primary btn-sm rounded-pill px-3" id="ncBtnNewGoal">
          <i class="bi bi-plus-lg me-1"></i>New Goal
        </button>
      </div>

      ${this.goals.length === 0 ? `
        <div class="text-center py-5 text-secondary">
          <i class="bi bi-flag display-4 mb-3 d-block text-muted opacity-50"></i>
          <h5>No goals created yet</h5>
          <p class="small">Define an academic or personal goal, break it into milestones, and track verifiable progress.</p>
          <button class="btn btn-outline-primary btn-sm rounded-pill mt-2" id="ncBtnNewGoalEmpty">
            <i class="bi bi-plus-lg me-1"></i>Create First Goal
          </button>
        </div>
      ` : `
        <div class="row g-4">
          ${this.goals.map(g => {
            const milestones = this.milestonesByGoal[g.id] || [];
            const completedCount = milestones.filter(m => m.status === 'completed').length;
            const progress = g.progress || 0;
            const targetDateStr = g.targetDate ? new Date(g.targetDate).toLocaleDateString() : 'Ongoing';

            return `
              <div class="col-12 col-lg-6">
                <div class="nc-goal-card p-4 rounded-3 border bg-card h-100 d-flex flex-column justify-content-between" data-id="${g.id}">
                  <div>
                    <div class="d-flex align-items-center justify-content-between mb-2">
                      <span class="badge bg-primary-subtle text-primary-emphasis text-capitalize">${g.category || 'Academic'}</span>
                      <div class="d-flex align-items-center gap-2">
                        <span class="badge ${g.priority === 'urgent' ? 'bg-danger' : (g.priority === 'high' ? 'bg-warning text-dark' : 'bg-secondary')}">${g.priority}</span>
                        <div class="dropdown">
                          <button class="btn btn-sm btn-link text-secondary p-0" data-bs-toggle="dropdown">
                            <i class="bi bi-three-dots-vertical"></i>
                          </button>
                          <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                            <li><a class="dropdown-item nc-goal-add-ms" href="#" data-id="${g.id}"><i class="bi bi-plus-circle me-2"></i>Add Milestone</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger nc-goal-delete" href="#" data-id="${g.id}"><i class="bi bi-trash me-2"></i>Delete Goal</a></li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <h5 class="fw-bold mb-1">${this.escapeHtml(g.title)}</h5>
                    <p class="text-secondary small mb-3">${this.escapeHtml(g.description || 'Academic target')}</p>

                    <!-- Real Data Progress Bar -->
                    <div class="mb-3">
                      <div class="d-flex justify-content-between small mb-1">
                        <span class="text-secondary">Progress (${completedCount}/${milestones.length} milestones)</span>
                        <span class="fw-bold text-primary">${progress}%</span>
                      </div>
                      <div class="progress" style="height: 8px;">
                        <div class="progress-bar ${progress === 100 ? 'bg-success' : 'bg-primary'}" role="progressbar" style="width: ${progress}%"></div>
                      </div>
                    </div>

                    <!-- Milestones Checklist -->
                    <div class="nc-milestones-container mt-3">
                      <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="text-secondary small fw-bold text-uppercase" style="font-size: 0.7rem;">Milestones</span>
                        <button class="btn btn-link btn-sm p-0 nc-goal-add-ms text-primary small" data-id="${g.id}">+ Add</button>
                      </div>
                      ${milestones.length === 0 ? `
                        <p class="text-muted small fst-italic mb-0">No milestones yet. Click "+ Add" to divide this goal into steps.</p>
                      ` : `
                        <div class="d-flex flex-column gap-2">
                          ${milestones.map(m => {
                            const isDone = m.status === 'completed';
                            return `
                              <div class="d-flex align-items-center justify-content-between p-2 rounded border border-light-subtle bg-body-tertiary">
                                <div class="form-check mb-0 d-flex align-items-center gap-2">
                                  <input class="form-check-input nc-ms-checkbox" type="checkbox" data-id="${m.id}" data-goal-id="${g.id}" ${isDone ? 'checked' : ''}>
                                  <label class="form-check-label small ${isDone ? 'text-decoration-line-through text-muted' : ''}">
                                    ${this.escapeHtml(m.title)}
                                  </label>
                                </div>
                                <button class="btn btn-sm btn-link text-secondary p-0 nc-ms-delete" data-id="${m.id}" title="Remove milestone">
                                  <i class="bi bi-x"></i>
                                </button>
                              </div>
                            `;
                          }).join('')}
                        </div>
                      `}
                    </div>
                  </div>

                  <div class="d-flex justify-content-between align-items-center pt-3 border-top mt-4 small text-secondary">
                    <span><i class="bi bi-calendar-event me-1"></i>Target: ${targetDateStr}</span>
                    <span class="badge ${progress === 100 ? 'bg-success' : 'bg-light text-dark'}">${progress === 100 ? 'Achieved' : 'In Progress'}</span>
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
    const newBtn = this.container.querySelector('#ncBtnNewGoal') || this.container.querySelector('#ncBtnNewGoalEmpty');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.showNewGoalModal());
    }

    // Toggle milestone
    this.container.querySelectorAll('.nc-ms-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.currentTarget.dataset.id;
        const newStatus = e.currentTarget.checked ? 'completed' : 'pending';
        try {
          await this.api.updateMilestone(id, { status: newStatus });
          this.app.notifications.showToast(`Milestone ${newStatus}`, 'info');
          await this.loadData();
          this.render();
        } catch (err) {
          this.app.notifications.showToast('Failed to update milestone: ' + err.message, 'error');
        }
      });
    });

    // Delete milestone
    this.container.querySelectorAll('.nc-ms-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await this.api.deleteMilestone(id);
        this.app.notifications.showToast('Milestone removed', 'info');
        await this.loadData();
        this.render();
      });
    });

    // Add milestone prompt
    this.container.querySelectorAll('.nc-goal-add-ms').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const goalId = e.currentTarget.dataset.id;
        const title = prompt('Enter milestone title (e.g. "Complete Chapter 5 revision"):');
        if (title && title.trim()) {
          try {
            await this.api.createMilestone({ goalId, title: title.trim() });
            this.app.notifications.showToast('Milestone added', 'success');
            await this.loadData();
            this.render();
          } catch (err) {
            this.app.notifications.showToast('Failed to add milestone: ' + err.message, 'error');
          }
        }
      });
    });

    // Delete goal
    this.container.querySelectorAll('.nc-goal-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.id;
        if (confirm('Are you sure you want to delete this goal and its milestones?')) {
          await this.api.deleteGoal(id);
          this.app.notifications.showToast('Goal deleted', 'info');
          await this.loadData();
          this.render();
        }
      });
    });
  }

  showNewGoalModal() {
    const modalEl = document.getElementById('ncGoalModal');
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
