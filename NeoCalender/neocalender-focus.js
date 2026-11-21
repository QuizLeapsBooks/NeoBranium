/**
 * NeoCalender/neocalender-focus.js
 *
 * Dedicated Focus Mode & Pomodoro Deep-Work Component.
 * - Configurable timer intervals (work/break)
 * - Associated task selection
 * - Session history & time tracking
 * - Safe productivity metrics (no unhealthy guilt/overwork framing)
 */

export class NeoCalenderFocus {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.sessions = [];
    this.stats = null;

    // Timer state
    this.durationMinutes = 25;
    this.breakMinutes = 5;
    this.remainingSeconds = 25 * 60;
    this.isRunning = false;
    this.isBreak = false;
    this.activeSessionId = null;
    this.selectedTaskId = null;
    this.selectedTaskTitle = 'Deep Focus Session';
    this.timerInterval = null;
  }

  async init(containerEl) {
    this.container = containerEl;
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      const [sessions, stats] = await Promise.all([
        this.api.getFocusSessions(10),
        this.api.getFocusStats()
      ]);
      this.sessions = sessions || [];
      this.stats = stats || {};
    } catch (err) {
      console.error('[NeoCalender Focus] Load error:', err);
    }
  }

  render() {
    if (!this.container) return;

    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const totalTodayHours = ((this.stats?.todayMinutes || 0) / 60).toFixed(1);

    this.container.innerHTML = `
      <div class="nc-focus-header d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h4 class="fw-bold mb-1"><i class="bi bi-hourglass-split text-info me-2"></i>Focus Mode</h4>
          <p class="text-secondary small mb-0">Eliminate distractions, focus on one task at a time, and log mindful deep work sessions.</p>
        </div>
      </div>

      <!-- Main Focus Timer Card -->
      <div class="row g-4 mb-4">
        <div class="col-12 col-lg-7">
          <div class="nc-focus-timer-card p-5 rounded-4 border bg-card text-center d-flex flex-column align-items-center justify-content-center shadow-sm">
            <span class="badge ${this.isBreak ? 'bg-success' : 'bg-primary'} px-3 py-2 rounded-pill mb-3 text-uppercase fw-bold" style="letter-spacing: 1px;">
              ${this.isBreak ? 'Break Time' : 'Deep Work Session'}
            </span>

            <div class="nc-timer-display my-3 fw-bold display-1" style="font-family: monospace; letter-spacing: 2px;">
              ${timeFormatted}
            </div>

            <!-- Task Selector -->
            <div class="mb-4 w-100" style="max-width: 380px;">
              <label class="form-label small text-secondary">Working on:</label>
              <select class="form-select form-select-sm" id="ncFocusTaskSelect" ${this.isRunning ? 'disabled' : ''}>
                <option value="">General Deep Work</option>
                ${(this.app.tasks || []).filter(t => t.status === 'pending').map(t => `
                  <option value="${t.id}" ${this.selectedTaskId === t.id ? 'selected' : ''}>${this.escapeHtml(t.title)}</option>
                `).join('')}
              </select>
            </div>

            <!-- Preset Controls -->
            <div class="btn-group btn-group-sm mb-4" role="group">
              <button type="button" class="btn btn-outline-secondary ${this.durationMinutes === 25 && !this.isBreak ? 'active' : ''}" data-preset="25" ${this.isRunning ? 'disabled' : ''}>25m Pomodoro</button>
              <button type="button" class="btn btn-outline-secondary ${this.durationMinutes === 50 && !this.isBreak ? 'active' : ''}" data-preset="50" ${this.isRunning ? 'disabled' : ''}>50m Deep Work</button>
              <button type="button" class="btn btn-outline-secondary ${this.isBreak ? 'active' : ''}" data-preset="5_break" ${this.isRunning ? 'disabled' : ''}>5m Short Break</button>
            </div>

            <!-- Action Controls -->
            <div class="d-flex align-items-center gap-3">
              ${!this.isRunning ? `
                <button class="btn btn-primary btn-lg rounded-pill px-5 shadow" id="ncBtnStartFocus">
                  <i class="bi bi-play-fill me-2 fs-5"></i>Start Session
                </button>
              ` : `
                <button class="btn btn-warning btn-lg rounded-pill px-4" id="ncBtnPauseFocus">
                  <i class="bi bi-pause-fill me-1"></i>Pause
                </button>
                <button class="btn btn-success btn-lg rounded-pill px-4" id="ncBtnCompleteFocus">
                  <i class="bi bi-check-circle me-1"></i>Complete
                </button>
              `}
              <button class="btn btn-outline-secondary btn-sm rounded-circle p-2" id="ncBtnResetFocus" title="Reset Timer">
                <i class="bi bi-arrow-counterclockwise fs-6"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Focus Stats & Trends -->
        <div class="col-12 col-lg-5">
          <div class="p-4 rounded-4 border bg-card h-100 d-flex flex-column justify-content-between">
            <div>
              <h6 class="fw-bold mb-3"><i class="bi bi-graph-up text-primary me-2"></i>Focus Analytics</h6>
              <div class="row g-2 mb-4">
                <div class="col-6">
                  <div class="p-3 rounded border text-center">
                    <span class="text-secondary small d-block">Today's Focus</span>
                    <span class="fs-4 fw-bold text-primary">${totalTodayHours} <small class="fs-6">hrs</small></span>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-3 rounded border text-center">
                    <span class="text-secondary small d-block">Completed</span>
                    <span class="fs-4 fw-bold text-success">${this.stats?.completedSessions || 0}</span>
                  </div>
                </div>
              </div>

              <!-- Task Distribution -->
              <h6 class="small text-secondary fw-bold text-uppercase mb-2" style="font-size: 0.7rem;">Time by Task</h6>
              <div class="nc-focus-distribution d-flex flex-column gap-2 mb-3">
                ${Object.keys(this.stats?.taskDistribution || {}).length === 0 ? `
                  <p class="text-muted small fst-italic">No logged sessions yet this week.</p>
                ` : Object.entries(this.stats.taskDistribution).slice(0, 4).map(([title, mins]) => `
                  <div class="d-flex justify-content-between small py-1 border-bottom border-light-subtle">
                    <span class="text-truncate" style="max-width: 200px;">${this.escapeHtml(title)}</span>
                    <span class="fw-bold">${mins}m</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="alert alert-info py-2 px-3 small mb-0 rounded-3">
              <i class="bi bi-lightbulb me-1"></i>
              Remember to take mindful breaks and stay hydrated between study blocks.
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Presets
    this.container.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.currentTarget.dataset.preset;
        if (preset === '5_break') {
          this.isBreak = true;
          this.durationMinutes = 5;
          this.remainingSeconds = 5 * 60;
        } else {
          this.isBreak = false;
          this.durationMinutes = Number(preset);
          this.remainingSeconds = Number(preset) * 60;
        }
        this.render();
      });
    });

    // Task select
    const taskSelect = this.container.querySelector('#ncFocusTaskSelect');
    if (taskSelect) {
      taskSelect.addEventListener('change', (e) => {
        this.selectedTaskId = e.target.value || null;
        const opt = e.target.options[e.target.selectedIndex];
        this.selectedTaskTitle = opt ? opt.text : 'Deep Focus Session';
      });
    }

    // Start
    const startBtn = this.container.querySelector('#ncBtnStartFocus');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startTimer());
    }

    // Pause
    const pauseBtn = this.container.querySelector('#ncBtnPauseFocus');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.pauseTimer());
    }

    // Complete
    const completeBtn = this.container.querySelector('#ncBtnCompleteFocus');
    if (completeBtn) {
      completeBtn.addEventListener('click', () => this.completeTimer());
    }

    // Reset
    const resetBtn = this.container.querySelector('#ncBtnResetFocus');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetTimer());
    }
  }

  async startTimer() {
    if (this.isRunning) return;

    try {
      if (!this.isBreak) {
        const session = await this.api.startFocusSession({
          taskId: this.selectedTaskId,
          taskTitle: this.selectedTaskTitle,
          durationMinutes: this.durationMinutes
        });
        this.activeSessionId = session?.id || null;
      }

      this.isRunning = true;
      this.timerInterval = setInterval(() => {
        if (this.remainingSeconds > 0) {
          this.remainingSeconds--;
          this.updateDisplay();
        } else {
          this.completeTimer();
        }
      }, 1000);

      this.render();
    } catch (err) {
      console.error('[Focus] Start error:', err);
    }
  }

  pauseTimer() {
    this.isRunning = false;
    clearInterval(this.timerInterval);
    this.render();
  }

  async completeTimer() {
    this.isRunning = false;
    clearInterval(this.timerInterval);

    if (this.activeSessionId) {
      try {
        const elapsedMins = Math.max(1, Math.round((this.durationMinutes * 60 - this.remainingSeconds) / 60));
        await this.api.completeFocusSession(this.activeSessionId, {
          actualMinutes: elapsedMins,
          status: 'completed'
        });
        this.app.notifications.showToast(`🎉 Focus session recorded (${elapsedMins} mins)!`, 'success');
        this.activeSessionId = null;
      } catch (err) {
        console.error('[Focus] Complete error:', err);
      }
    }

    // Play chime sound
    if (this.app.notifications?.playChime) {
      this.app.notifications.playChime();
    }

    // Switch to break or reset
    if (!this.isBreak) {
      this.isBreak = true;
      this.durationMinutes = this.breakMinutes;
      this.remainingSeconds = this.breakMinutes * 60;
    } else {
      this.isBreak = false;
      this.durationMinutes = 25;
      this.remainingSeconds = 25 * 60;
    }

    await this.loadData();
    this.render();
  }

  resetTimer() {
    this.isRunning = false;
    clearInterval(this.timerInterval);
    this.activeSessionId = null;
    this.remainingSeconds = this.durationMinutes * 60;
    this.render();
  }

  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = this.container.querySelector('.nc-timer-display');
    if (el) el.textContent = timeFormatted;
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
