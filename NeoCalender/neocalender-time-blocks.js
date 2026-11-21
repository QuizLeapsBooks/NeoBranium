/**
 * NeoCalender/neocalender-time-blocks.js
 *
 * Smart Time Blocking Component.
 * - Daily and weekly hour-by-hour time grid
 * - Overlapping schedule detection and conflict warnings
 * - Free slot finder
 * - Color-coded block scheduling
 */

export class NeoCalenderTimeBlocks {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.blocks = [];
    this.currentDate = new Date().toISOString().slice(0, 10);
    this.availableSlots = [];
  }

  async init(containerEl) {
    this.container = containerEl;
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      const [blocks, slots] = await Promise.all([
        this.api.getTimeBlocks(this.currentDate),
        this.api.getAvailableSlots(this.currentDate)
      ]);
      this.blocks = blocks || [];
      this.availableSlots = slots || [];
    } catch (err) {
      console.error('[NeoCalender TimeBlocks] Load error:', err);
    }
  }

  render() {
    if (!this.container) return;

    const hours = [];
    for (let h = 8; h <= 21; h++) {
      hours.push(`${String(h).padStart(2, '0')}:00`);
    }

    this.container.innerHTML = `
      <div class="nc-blocks-header d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h4 class="fw-bold mb-1"><i class="bi bi-grid-3x3-gap text-primary me-2"></i>Smart Time Blocking</h4>
          <p class="text-secondary small mb-0">Plan deep-work blocks, prevent overlapping conflicts, and discover open study windows.</p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <input type="date" class="form-control form-control-sm" id="ncBlockDateInput" value="${this.currentDate}">
          <button class="btn btn-primary btn-sm rounded-pill px-3 text-nowrap" id="ncBtnNewBlock">
            <i class="bi bi-plus-lg me-1"></i>New Block
          </button>
        </div>
      </div>

      <div class="row g-4">
        <!-- Time Blocks Grid -->
        <div class="col-12 col-lg-8">
          <div class="p-4 rounded-4 border bg-card shadow-sm">
            <h6 class="fw-bold mb-3 d-flex justify-content-between align-items-center">
              <span>Schedule for ${new Date(this.currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
              <span class="badge bg-secondary-subtle text-secondary small">${this.blocks.length} blocks</span>
            </h6>

            ${this.blocks.length === 0 ? `
              <div class="text-center py-5 text-secondary">
                <i class="bi bi-calendar-range display-4 mb-3 d-block text-muted opacity-50"></i>
                <p class="small mb-2">No time blocks scheduled for this date.</p>
                <button class="btn btn-outline-primary btn-sm rounded-pill" id="ncBtnNewBlockEmpty">
                  <i class="bi bi-plus-lg me-1"></i>Add a Time Slot
                </button>
              </div>
            ` : `
              <div class="nc-blocks-timeline d-flex flex-column gap-2">
                ${this.blocks.map(b => `
                  <div class="nc-time-block-item p-3 rounded-3 border d-flex justify-content-between align-items-center" style="border-left: 5px solid ${b.color || '#3b82f6'} !important;">
                    <div>
                      <div class="d-flex align-items-center gap-2 mb-1">
                        <span class="badge ${b.isBreak ? 'bg-success-subtle text-success' : 'bg-primary-subtle text-primary'} small">
                          <i class="bi bi-clock me-1"></i>${b.startTime} - ${b.endTime}
                        </span>
                        <span class="badge bg-secondary-subtle text-secondary small">${b.category || 'Study'}</span>
                      </div>
                      <h6 class="mb-0 fw-bold">${this.escapeHtml(b.title)}</h6>
                      ${b.description ? `<p class="text-secondary small mb-0 mt-1">${this.escapeHtml(b.description)}</p>` : ''}
                    </div>
                    <button class="btn btn-sm btn-link text-danger nc-delete-block-btn p-1" data-id="${b.id}" title="Remove block">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Available Slots & Conflicts sidebar -->
        <div class="col-12 col-lg-4">
          <div class="p-4 rounded-4 border bg-card h-100 d-flex flex-column justify-content-between">
            <div>
              <h6 class="fw-bold mb-3"><i class="bi bi-lightning-charge text-warning me-2"></i>Open Study Windows</h6>
              <p class="text-secondary small">Calculated free slots between scheduled commitments:</p>

              ${this.availableSlots.length === 0 ? `
                <div class="alert alert-secondary py-2 small">No free windows &gt;30m found or fully booked.</div>
              ` : `
                <div class="d-flex flex-column gap-2 mb-4">
                  ${this.availableSlots.map(s => `
                    <div class="p-2 rounded border border-success-subtle bg-success-subtle d-flex justify-content-between align-items-center">
                      <span class="small fw-bold text-success-emphasis">
                        <i class="bi bi-check-circle me-1"></i>${s.startTime} - ${s.endTime}
                      </span>
                      <span class="badge bg-success text-white small">${s.durationMinutes}m free</span>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <div class="alert alert-light border small text-secondary mb-0">
              <i class="bi bi-shield-check me-1 text-primary"></i>
              <strong>Conflict Protection:</strong> NeoCalender AI checks for time overlaps before scheduling new blocks to prevent study collisions.
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const dateInput = this.container.querySelector('#ncBlockDateInput');
    if (dateInput) {
      dateInput.addEventListener('change', async (e) => {
        this.currentDate = e.target.value;
        await this.loadData();
        this.render();
      });
    }

    const newBtn = this.container.querySelector('#ncBtnNewBlock') || this.container.querySelector('#ncBtnNewBlockEmpty');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.showNewBlockModal());
    }

    this.container.querySelectorAll('.nc-delete-block-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this time block?')) {
          await this.api.deleteTimeBlock(id);
          this.app.notifications.showToast('Time block removed', 'info');
          await this.loadData();
          this.render();
        }
      });
    });
  }

  showNewBlockModal() {
    const modalEl = document.getElementById('ncTimeBlockModal');
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
