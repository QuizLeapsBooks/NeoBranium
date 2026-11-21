/**
 * NeoCalender/neocalender-calendar.js
 *
 * Interactive Calendar Engine for NeoCalender:
 * - Month Grid View
 * - Weekly Hour-Grid View
 * - Daily Schedule View
 * - Upcoming / Past Views
 * - Direct scheduling & quick-date modification
 */

export class NeoCalenderCalendar {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.currentDate = new Date();
    this.viewMode = options.preferredView || 'month'; // 'month', 'week', 'day', 'upcoming'
    this.weekStartDay = options.weekStartDay || 'monday'; // 'monday', 'sunday'
    this.tasks = [];
    this.onTaskClick = options.onTaskClick || (() => {});
    this.onDateClick = options.onDateClick || (() => {});
    this.onTaskReschedule = options.onTaskReschedule || (() => {});
  }

  setTasks(tasks) {
    this.tasks = tasks || [];
    this.render();
  }

  setView(viewMode) {
    this.viewMode = viewMode;
    this.render();
  }

  next() {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    } else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    } else if (this.viewMode === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
    }
    this.render();
  }

  prev() {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    } else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
    } else if (this.viewMode === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
    }
    this.render();
  }

  today() {
    this.currentDate = new Date();
    this.render();
  }

  render() {
    if (!this.container) return;

    switch (this.viewMode) {
      case 'week':
        this.renderWeekView();
        break;
      case 'day':
        this.renderDayView();
        break;
      case 'upcoming':
        this.renderUpcomingView();
        break;
      case 'month':
      default:
        this.renderMonthView();
        break;
    }
  }

  getTitle() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const m = months[this.currentDate.getMonth()];
    const y = this.currentDate.getFullYear();

    if (this.viewMode === 'day') {
      return `${this.currentDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (this.viewMode === 'week') {
      const startOfWeek = this.getStartOfWeek(this.currentDate);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return `${m} ${y}`;
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = this.weekStartDay === 'monday'
      ? (day === 0 ? -6 : 1 - day)
      : -day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ── MONTH VIEW ────────────────────────────────────────────────────────────

  renderMonthView() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const todayStr = new Date().toISOString().slice(0, 10);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startOffset = firstDay.getDay();
    if (this.weekStartDay === 'monday') {
      startOffset = startOffset === 0 ? 6 : startOffset - 1;
    }

    const dayLabels = this.weekStartDay === 'monday'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    let cellsHtml = '';

    for (let i = 0; i < totalCells; i++) {
      let cellDate;
      let isCurrentMonth = true;
      let dayNum;

      if (i < startOffset) {
        // Prev month
        dayNum = prevMonthLastDay - startOffset + i + 1;
        cellDate = new Date(year, month - 1, dayNum);
        isCurrentMonth = false;
      } else if (i >= startOffset + lastDay.getDate()) {
        // Next month
        dayNum = i - (startOffset + lastDay.getDate()) + 1;
        cellDate = new Date(year, month + 1, dayNum);
        isCurrentMonth = false;
      } else {
        // Current month
        dayNum = i - startOffset + 1;
        cellDate = new Date(year, month, dayNum);
      }

      const dateStr = cellDate.toISOString().slice(0, 10);
      const isToday = dateStr === todayStr;

      // Filter tasks for this date
      const cellTasks = this.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === dateStr);

      const taskChipsHtml = cellTasks.slice(0, 3).map(t => {
        const isCompleted = t.status === 'completed';
        return `
          <div class="nc-cal-chip nc-pri-${t.priority || 'medium'} ${isCompleted ? 'nc-chip-completed' : ''}"
               data-task-id="${t.id}" title="${this.escapeHtml(t.title)}${t.dueTime ? ' at ' + t.dueTime : ''}">
            <span class="nc-chip-time">${t.dueTime ? t.dueTime : ''}</span>
            <span class="nc-chip-title">${this.escapeHtml(t.title)}</span>
          </div>
        `;
      }).join('');

      const overflowCount = cellTasks.length - 3;
      const overflowHtml = overflowCount > 0 ? `<div class="nc-cal-overflow">+${overflowCount} more</div>` : '';

      cellsHtml += `
        <div class="nc-cal-cell ${!isCurrentMonth ? 'nc-cell-outside' : ''} ${isToday ? 'nc-cell-today' : ''}" data-date="${dateStr}">
          <div class="nc-cell-header">
            <span class="nc-cell-num">${dayNum}</span>
            <button class="nc-cell-add-btn" data-add-date="${dateStr}" title="Add task on ${dateStr}">
              <i class="bi bi-plus"></i>
            </button>
          </div>
          <div class="nc-cell-tasks">
            ${taskChipsHtml}
            ${overflowHtml}
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="nc-month-view">
        <div class="nc-cal-weekdays">
          ${dayLabels.map(l => `<div class="nc-cal-weekday">${l}</div>`).join('')}
        </div>
        <div class="nc-cal-grid">
          ${cellsHtml}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  // ── WEEK VIEW ─────────────────────────────────────────────────────────────

  renderWeekView() {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const todayStr = new Date().toISOString().slice(0, 10);
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      weekDays.push(d);
    }

    const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7 AM to 10 PM (22:00)

    const headerCols = weekDays.map(d => {
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dateStr === todayStr;
      const weekdayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      return `
        <div class="nc-week-header-col ${isToday ? 'nc-week-today' : ''}" data-date="${dateStr}">
          <span class="nc-week-dayname">${weekdayName}</span>
          <span class="nc-week-daynum">${d.getDate()}</span>
        </div>
      `;
    }).join('');

    const hourRowsHtml = hours.map(hour => {
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      const timeColsHtml = weekDays.map(d => {
        const dateStr = d.toISOString().slice(0, 10);
        const tasksAtHour = this.tasks.filter(t => {
          if (!t.dueDate || t.dueDate.slice(0, 10) !== dateStr) return false;
          if (!t.dueTime) return hour === 9; // Unspecified time placed at 9 AM slot
          const taskHour = parseInt(t.dueTime.split(':')[0], 10);
          return taskHour === hour;
        });

        const tasksHtml = tasksAtHour.map(t => `
          <div class="nc-week-task-card nc-pri-${t.priority || 'medium'} ${t.status === 'completed' ? 'nc-chip-completed' : ''}" data-task-id="${t.id}">
            <div class="nc-week-task-time">${t.dueTime || ''}</div>
            <div class="nc-week-task-title">${this.escapeHtml(t.title)}</div>
          </div>
        `).join('');

        return `
          <div class="nc-week-grid-cell" data-date="${dateStr}" data-time="${hourStr}" title="Click to schedule at ${hourStr}">
            ${tasksHtml}
          </div>
        `;
      }).join('');

      return `
        <div class="nc-week-hour-row">
          <div class="nc-week-time-label">${hourStr}</div>
          <div class="nc-week-row-cells">
            ${timeColsHtml}
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="nc-week-view">
        <div class="nc-week-header-row">
          <div class="nc-week-time-gutter"></div>
          <div class="nc-week-header-cols">${headerCols}</div>
        </div>
        <div class="nc-week-scroll-body">
          ${hourRowsHtml}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  // ── DAY VIEW ──────────────────────────────────────────────────────────────

  renderDayView() {
    const targetDateStr = this.currentDate.toISOString().slice(0, 10);
    const dayTasks = this.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === targetDateStr);
    const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7 AM to 10 PM

    const hourSlotsHtml = hours.map(hour => {
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      const tasksAtHour = dayTasks.filter(t => {
        if (!t.dueTime) return hour === 9;
        const taskHour = parseInt(t.dueTime.split(':')[0], 10);
        return taskHour === hour;
      });

      const cardsHtml = tasksAtHour.map(t => `
        <div class="nc-day-task-card nc-pri-${t.priority || 'medium'} ${t.status === 'completed' ? 'nc-chip-completed' : ''}" data-task-id="${t.id}">
          <div class="nc-day-card-header">
            <span class="badge bg-secondary me-2">${t.category || 'General'}</span>
            <span class="nc-day-card-time">${t.dueTime || 'No time set'}</span>
          </div>
          <h5 class="nc-day-card-title">${this.escapeHtml(t.title)}</h5>
          ${t.description ? `<p class="nc-day-card-desc">${this.escapeHtml(t.description)}</p>` : ''}
          ${t.subtasks?.length ? `
            <div class="nc-day-subtasks">
              <span class="nc-subtasks-count"><i class="bi bi-check2-square me-1"></i>${t.subtasks.filter(s => s.completed).length}/${t.subtasks.length} subtasks</span>
            </div>
          ` : ''}
        </div>
      `).join('');

      return `
        <div class="nc-day-slot" data-date="${targetDateStr}" data-time="${hourStr}">
          <div class="nc-day-slot-time">${hourStr}</div>
          <div class="nc-day-slot-content">
            ${cardsHtml}
            <button class="nc-day-slot-add-btn" data-add-date="${targetDateStr}" data-add-time="${hourStr}" title="Add task at ${hourStr}">
              <i class="bi bi-plus-lg me-1"></i> Add Task
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="nc-day-view">
        <div class="nc-day-summary-bar">
          <div>
            <h4 class="mb-1">${this.currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h4>
            <span class="nc-muted-text">${dayTasks.length} activities scheduled (${dayTasks.filter(t => t.status === 'completed').length} completed)</span>
          </div>
          <button class="btn btn-sm btn-primary" data-add-date="${targetDateStr}">
            <i class="bi bi-plus-lg me-1"></i> Schedule Task
          </button>
        </div>
        <div class="nc-day-slots-container">
          ${hourSlotsHtml}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  // ── UPCOMING VIEW ─────────────────────────────────────────────────────────

  renderUpcomingView() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcomingTasks = this.tasks.filter(t => t.status === 'pending');

    upcomingTasks.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    if (upcomingTasks.length === 0) {
      this.container.innerHTML = `
        <div class="nc-empty-state">
          <i class="bi bi-calendar-check"></i>
          <h4>All Caught Up!</h4>
          <p>You have no pending deadlines or upcoming scheduled tasks.</p>
        </div>
      `;
      return;
    }

    // Group by date
    const groups = {};
    upcomingTasks.forEach(t => {
      const d = t.dueDate ? t.dueDate.slice(0, 10) : 'No Due Date';
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });

    const groupsHtml = Object.entries(groups).map(([dateKey, tasks]) => {
      let headerText = dateKey;
      if (dateKey === todayStr) headerText = 'Today';
      else if (dateKey !== 'No Due Date') {
        const parsed = new Date(dateKey);
        headerText = parsed.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      }

      const tasksHtml = tasks.map(t => `
        <div class="nc-upcoming-item nc-pri-${t.priority || 'medium'}" data-task-id="${t.id}">
          <div class="nc-upcoming-time">
            ${t.dueTime ? `<i class="bi bi-clock me-1"></i>${t.dueTime}` : '<i class="bi bi-calendar3 me-1"></i>All Day'}
          </div>
          <div class="nc-upcoming-body">
            <span class="nc-upcoming-title">${this.escapeHtml(t.title)}</span>
            <span class="badge bg-secondary ms-2">${t.category || 'General'}</span>
          </div>
          <div class="nc-upcoming-actions">
            <button class="btn btn-sm btn-outline-secondary nc-quick-reschedule-btn" data-task-id="${t.id}" title="Reschedule">
              <i class="bi bi-calendar-event"></i>
            </button>
          </div>
        </div>
      `).join('');

      return `
        <div class="nc-upcoming-group mb-4">
          <h5 class="nc-upcoming-group-title"><i class="bi bi-calendar-date me-2"></i>${headerText}</h5>
          <div class="nc-upcoming-list">
            ${tasksHtml}
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="nc-upcoming-view">
        ${groupsHtml}
      </div>
    `;

    this.bindEvents();
  }

  // ── EVENT BINDINGS ────────────────────────────────────────────────────────

  bindEvents() {
    // Task chip / card click
    this.container.querySelectorAll('[data-task-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = el.getAttribute('data-task-id');
        const task = this.tasks.find(t => t.id === taskId);
        if (task) this.onTaskClick(task);
      });
    });

    // Add task buttons on dates/slots
    this.container.querySelectorAll('[data-add-date]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const date = el.getAttribute('data-add-date');
        const time = el.getAttribute('data-add-time') || null;
        this.onDateClick(date, time);
      });
    });

    // Cell click (empty space)
    this.container.querySelectorAll('.nc-cal-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.nc-cal-chip') || e.target.closest('.nc-cell-add-btn')) return;
        const date = cell.getAttribute('data-date');
        if (date) this.onDateClick(date, null);
      });
    });

    // Week cell click
    this.container.querySelectorAll('.nc-week-grid-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.nc-week-task-card')) return;
        const date = cell.getAttribute('data-date');
        const time = cell.getAttribute('data-time');
        if (date) this.onDateClick(date, time);
      });
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
