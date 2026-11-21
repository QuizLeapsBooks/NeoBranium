/**
 * NeoCalender/neocalender-notifications.js
 *
 * In-app and browser notifications for NeoCalender:
 * - Deadline reminders & overdue alerts
 * - In-app animated toasts
 * - Web Notifications API permission & fallback
 * - Synthesized audio chime via Web Audio API (zero external assets needed)
 * - Notification history drawer / center
 */

export class NeoCalenderNotifier {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.audioCtx = null;
    this.hasBrowserPermission = false;
    this.listeners = new Set();
    this.checkInterval = null;

    this.checkBrowserPermission();
  }

  checkBrowserPermission() {
    if ('Notification' in window) {
      this.hasBrowserPermission = Notification.permission === 'granted';
    }
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      this.showToast('Browser notifications are not supported in this browser.', 'warning');
      return false;
    }
    try {
      const perm = await Notification.requestPermission();
      this.hasBrowserPermission = perm === 'granted';
      if (this.hasBrowserPermission) {
        this.showToast('Browser notifications enabled successfully!', 'success');
      } else {
        this.showToast('Browser notifications blocked. In-app notifications will still alert you.', 'info');
      }
      return this.hasBrowserPermission;
    } catch {
      return false;
    }
  }

  playChime() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.36);
    } catch {
      // Audio playback fails silently if blocked by user interaction policy
    }
  }

  notify({ title, message, type = 'info', taskId = null, silent = false }) {
    const item = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      type, // 'info', 'success', 'warning', 'danger'
      taskId,
      timestamp: new Date().toISOString(),
      read: false
    };

    this.notifications.unshift(item);
    this.unreadCount++;
    this.emitChange();

    if (!silent) {
      this.playChime();
      this.showToast(message, type, title);

      if (this.hasBrowserPermission && document.hidden) {
        try {
          new Notification(title || 'NeoCalender Reminder', {
            body: message,
            icon: '/online-graduation_16847316.png'
          });
        } catch {
          // ignore notification constructor failure
        }
      }
    }
  }

  showToast(message, type = 'info', title = null) {
    let container = document.getElementById('neocalender-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'neocalender-toast-container';
      container.className = 'nc-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `nc-toast nc-toast-${type}`;

    const iconMap = {
      info: 'bi-info-circle-fill text-primary',
      success: 'bi-check-circle-fill text-success',
      warning: 'bi-exclamation-triangle-fill text-warning',
      danger: 'bi-exclamation-octagon-fill text-danger'
    };

    const iconHtml = `<i class="bi ${iconMap[type] || 'bi-bell-fill'} nc-toast-icon"></i>`;

    toast.innerHTML = `
      ${iconHtml}
      <div class="nc-toast-content">
        ${title ? `<strong class="nc-toast-title">${this.escapeHtml(title)}</strong>` : ''}
        <p class="nc-toast-text">${this.escapeHtml(message)}</p>
      </div>
      <button class="nc-toast-close" aria-label="Close">&times;</button>
    `;

    const closeBtn = toast.querySelector('.nc-toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('nc-toast-fadeout');
      setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    // Auto dismiss after 4.5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('nc-toast-fadeout');
        setTimeout(() => toast.remove(), 250);
      }
    }, 4500);
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.unreadCount = 0;
    this.emitChange();
  }

  clearAll() {
    this.notifications = [];
    this.unreadCount = 0;
    this.emitChange();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitChange() {
    for (const listener of this.listeners) {
      try {
        listener(this.notifications, this.unreadCount);
      } catch (err) {
        console.error('Notifier listener error:', err);
      }
    }
  }

  /**
   * Monitor tasks for upcoming deadlines and overdue items.
   */
  startTaskMonitor(tasksGetter, intervalMs = 60000) {
    if (this.checkInterval) clearInterval(this.checkInterval);

    const check = async () => {
      try {
        const tasks = await tasksGetter();
        if (!Array.isArray(tasks)) return;

        const now = new Date();
        const notifiedKey = 'nc_notified_tasks';
        const alreadyNotified = new Set(JSON.parse(sessionStorage.getItem(notifiedKey) || '[]'));

        tasks.forEach(task => {
          if (task.status === 'completed' || !task.dueDate) return;

          const due = new Date(task.dueDate);
          const diffMinutes = Math.round((due.getTime() - now.getTime()) / 60000);

          // Overdue alert
          if (diffMinutes < 0 && !alreadyNotified.has(`${task.id}_overdue`)) {
            alreadyNotified.add(`${task.id}_overdue`);
            this.notify({
              title: 'Task Overdue',
              message: `"${task.title}" is overdue (${Math.abs(diffMinutes)} mins ago).`,
              type: 'danger',
              taskId: task.id
            });
          }
          // Due soon (within 30 mins)
          else if (diffMinutes >= 0 && diffMinutes <= 30 && !alreadyNotified.has(`${task.id}_due_soon`)) {
            alreadyNotified.add(`${task.id}_due_soon`);
            this.notify({
              title: 'Upcoming Deadline',
              message: `"${task.title}" is due in ${diffMinutes} minutes!`,
              type: 'warning',
              taskId: task.id
            });
          }
        });

        sessionStorage.setItem(notifiedKey, JSON.stringify([...alreadyNotified]));
      } catch (err) {
        console.warn('[NeoCalender] Task monitor check failed:', err);
      }
    };

    this.checkInterval = setInterval(check, intervalMs);
    // Initial run
    setTimeout(check, 3000);
  }

  stopTaskMonitor() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const notifier = new NeoCalenderNotifier();
