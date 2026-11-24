/**
 * NeoCalender/neocalender-app.js
 *
 * Core Frontend Application for NeoCalender:
 * - State management (tasks, lists, settings, active view, active filters)
 * - Task CRUD, drag-and-drop reordering, subtask toggle
 * - Custom list management
 * - View switching (My Tasks, Calendar, Analytics, AI Assistant)
 * - Search, sort, and priority filters
 * - Seamless integration with auth, calendar, analytics, AI, and notifications
 */

import { auth, onAuthStateChanged } from '../js/auth.js';
import { neocalenderApi } from './neocalender-api.js';
import { NeoCalenderCalendar } from './neocalender-calendar.js';
import { NeoCalenderAnalytics } from './neocalender-analytics.js';
import { NeoCalenderAI } from './neocalender-ai.js';
import { notifier } from './neocalender-notifications.js';
import { NeoCalenderHabits } from './neocalender-habits.js';
import { NeoCalenderRoutines } from './neocalender-routines.js';
import { NeoCalenderGoals } from './neocalender-goals.js';
import { NeoCalenderFocus } from './neocalender-focus.js';
import { NeoCalenderTimeBlocks } from './neocalender-time-blocks.js';
import { NeoCalenderWeeklyReview } from './neocalender-weekly-review.js';

class NeoCalenderApp {
  constructor() {
    this.currentUser = null;
    this.tasks = [];
    this.lists = [];
    this.settings = {};
    this.activeTab = 'tasks'; // 'tasks', 'calendar', 'habits', 'routines', 'goals', 'focus', 'timeblocks', 'analytics', 'weeklyreview', 'ai'
    this.activeListFilter = 'all'; // 'all', 'today', 'upcoming', 'completed', or listId
    this.searchQuery = '';
    this.priorityFilter = '';
    this.sortBy = 'order';
    this.sortDir = 'asc';
    this.editingTaskId = null;

    // Sub-components
    this.calendar = null;
    this.analytics = null;
    this.ai = null;
    this.habits = null;
    this.routines = null;
    this.goals = null;
    this.focus = null;
    this.timeBlocks = null;
    this.weeklyReview = null;
    this.api = neocalenderApi;
    this.notifications = notifier;

    // Cache DOM Elements
    this.dom = {
      appContainer: document.getElementById('neocalenderApp'),
      authGate: document.getElementById('authGate'),
      tasksContainer: document.getElementById('tasksListContainer'),
      emptyState: document.getElementById('tasksEmptyState'),
      listsNav: document.getElementById('listsNavContainer'),
      calendarContainer: document.getElementById('calendarMount'),
      analyticsContainer: document.getElementById('analyticsMount'),
      aiMessages: document.getElementById('aiChatMessages'),
      aiInput: document.getElementById('aiChatInput'),
      aiSendBtn: document.getElementById('aiChatSendBtn'),
      aiChips: document.getElementById('aiPromptChips'),
      activeViewTitle: document.getElementById('activeViewTitle'),
      activeViewCount: document.getElementById('activeViewCount'),
      searchInput: document.getElementById('taskSearchInput'),
      priorityFilterSelect: document.getElementById('priorityFilterSelect'),
      sortSelect: document.getElementById('sortSelect'),
      quickAddInput: document.getElementById('quickTaskInput'),
      quickAddBtn: document.getElementById('quickTaskAddBtn'),
      openModalBtn: document.getElementById('openNewTaskModalBtn'),
      taskModal: document.getElementById('taskModal'),
      taskForm: document.getElementById('taskForm'),
      subtasksContainer: document.getElementById('subtaskItemsContainer'),
      addSubtaskBtn: document.getElementById('addSubtaskBtn'),
      newSubtaskInput: document.getElementById('newSubtaskInput'),
      listModal: document.getElementById('listModal'),
      listForm: document.getElementById('listForm'),
      notifBadge: document.getElementById('notifBadge'),
      notifDrawer: document.getElementById('notifDrawer'),
      notifDrawerList: document.getElementById('notifDrawerList'),
      notifToggleBtn: document.getElementById('notifToggleBtn'),
      closeNotifDrawerBtn: document.getElementById('closeNotifDrawerBtn'),
      clearNotifsBtn: document.getElementById('clearNotifsBtn'),
      calPrevBtn: document.getElementById('calPrevBtn'),
      calNextBtn: document.getElementById('calNextBtn'),
      calTodayBtn: document.getElementById('calTodayBtn'),
      calTitle: document.getElementById('calTitle'),
      calViewSelector: document.getElementById('calViewSelector'),
      userAvatar: document.getElementById('userAvatarDisplay'),
      userName: document.getElementById('userNameDisplay'),
      greetingDate: document.getElementById('greetingDate'),
      mobileMenuToggle: document.getElementById('mobileMenuToggle'),
      sidebar: document.getElementById('ncSidebar'),
      sidebarBackdrop: document.getElementById('ncSidebarBackdrop')
    };

    this.init();
  }

  init() {
    this.setupDateDisplay();
    this.setupThemeToggle();
    this.bindEvents();

    // Listen to Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      if (user && !user.isAnonymous) {
        if (this.dom.authGate) this.dom.authGate.classList.add('d-none');
        if (this.dom.appContainer) this.dom.appContainer.classList.remove('d-none');
        this.updateUserUI(user);
        await this.loadInitialData();
        notifier.startTaskMonitor(() => this.tasks);
      } else {
        if (this.dom.authGate) this.dom.authGate.classList.remove('d-none');
        if (this.dom.appContainer) this.dom.appContainer.classList.add('d-none');
        notifier.stopTaskMonitor();
      }
    });

    // Subscribe to notifications updates
    notifier.subscribe((notifs, unread) => {
      this.updateNotificationsUI(notifs, unread);
    });
  }

  setupDateDisplay() {
    if (this.dom.greetingDate) {
      const now = new Date();
      this.dom.greetingDate.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  setupThemeToggle() {
    const toggle = document.getElementById('ncThemeToggle');
    if (!toggle) return;
    const currentTheme = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    toggle.checked = currentTheme === 'dark';

    toggle.addEventListener('change', () => {
      const next = toggle.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('neobranium_theme', next);
    });
  }

  getSafeUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return null;
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  updateUserUI(user) {
    if (this.dom.userName) {
      this.dom.userName.textContent = user.displayName || user.email?.split('@')[0] || 'Scholar';
    }
    if (this.dom.userAvatar) {
      this.dom.userAvatar.replaceChildren();
      const safeUrl = this.getSafeUrl(user.photoURL);
      if (safeUrl) {
        const img = document.createElement('img');
        img.src = safeUrl;
        img.alt = 'User Avatar';
        img.className = 'nc-user-img';
        img.onerror = () => {
          this.dom.userAvatar.replaceChildren();
          const fallback = document.createElement('div');
          fallback.className = 'nc-avatar-fallback';
          fallback.textContent = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
          this.dom.userAvatar.appendChild(fallback);
        };
        this.dom.userAvatar.appendChild(img);
      } else {
        const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
        const fallback = document.createElement('div');
        fallback.className = 'nc-avatar-fallback';
        fallback.textContent = initial;
        this.dom.userAvatar.appendChild(fallback);
      }
    }
  }

  async loadInitialData() {
    try {
      this.showGlobalLoader(true);
      const [tasks, lists, settings] = await Promise.all([
        neocalenderApi.getTasks(),
        neocalenderApi.getLists(),
        neocalenderApi.getSettings()
      ]);

      this.tasks = tasks || [];
      this.lists = lists || [];
      this.settings = settings || {};

      this.initSubComponents();
      this.renderListsNavigation();
      this.populateListSelectDropdown();
      this.renderTasks();
      this.updateCounts();
    } catch (err) {
      console.error('Failed to load initial data:', err);
      notifier.showToast('Could not load NeoCalender data. Please refresh.', 'danger');
    } finally {
      this.showGlobalLoader(false);
    }
  }

  initSubComponents() {
    // 1. Calendar
    if (this.dom.calendarContainer && !this.calendar) {
      this.calendar = new NeoCalenderCalendar(this.dom.calendarContainer, {
        preferredView: this.settings.preferredView || 'month',
        weekStartDay: this.settings.weekStartDay || 'monday',
        onTaskClick: (task) => this.openEditTaskModal(task),
        onDateClick: (dateStr, timeStr) => this.openNewTaskModal({ dueDate: dateStr, dueTime: timeStr })
      });
      this.updateCalendarHeader();
    }
    if (this.calendar) {
      this.calendar.setTasks(this.tasks);
    }

    // 2. Analytics
    if (this.dom.analyticsContainer && !this.analytics) {
      this.analytics = new NeoCalenderAnalytics(this.dom.analyticsContainer);
    }

    // 3. AI Assistant
    if (this.dom.aiMessages && !this.ai) {
      this.ai = new NeoCalenderAI({
        messagesContainer: this.dom.aiMessages,
        input: this.dom.aiInput,
        sendBtn: this.dom.aiSendBtn,
        chipsContainer: this.dom.aiChips
      }, {
        onTasksChanged: async () => {
          await this.refreshTasks();
          notifier.showToast('NeoCalender updated by AI Assistant', 'success');
        }
      });
    }

    // 4. Habits
    const habitsMount = document.getElementById('habitsMount');
    if (habitsMount && !this.habits) {
      this.habits = new NeoCalenderHabits(this);
      this.habits.init(habitsMount);
    }

    // 5. Routines
    const routinesMount = document.getElementById('routinesMount');
    if (routinesMount && !this.routines) {
      this.routines = new NeoCalenderRoutines(this);
      this.routines.init(routinesMount);
    }

    // 6. Goals
    const goalsMount = document.getElementById('goalsMount');
    if (goalsMount && !this.goals) {
      this.goals = new NeoCalenderGoals(this);
      this.goals.init(goalsMount);
    }

    // 7. Focus Mode
    const focusMount = document.getElementById('focusMount');
    if (focusMount && !this.focus) {
      this.focus = new NeoCalenderFocus(this);
      this.focus.init(focusMount);
    }

    // 8. Time Blocks
    const timeBlocksMount = document.getElementById('timeBlocksMount');
    if (timeBlocksMount && !this.timeBlocks) {
      this.timeBlocks = new NeoCalenderTimeBlocks(this);
      this.timeBlocks.init(timeBlocksMount);
    }

    // 9. Weekly Review
    const weeklyReviewMount = document.getElementById('weeklyReviewMount');
    if (weeklyReviewMount && !this.weeklyReview) {
      this.weeklyReview = new NeoCalenderWeeklyReview(this);
      this.weeklyReview.init(weeklyReviewMount);
    }
  }

  async refreshTasks() {
    this.tasks = await neocalenderApi.getTasks();
    if (this.calendar) this.calendar.setTasks(this.tasks);
    if (this.activeTab === 'analytics') this.loadAndRenderAnalytics();
    this.renderTasks();
    this.updateCounts();
  }

  // ── NAVIGATION & VIEWS ──────────────────────────────────────────────────

  switchView(tabName) {
    this.activeTab = tabName;

    // Update active nav links
    document.querySelectorAll('[data-view-tab]').forEach(el => {
      el.classList.toggle('active', el.dataset.viewTab === tabName);
    });

    // Update main panels
    const panels = {
      tasks: document.getElementById('viewPanelTasks'),
      calendar: document.getElementById('viewPanelCalendar'),
      habits: document.getElementById('viewPanelHabits'),
      routines: document.getElementById('viewPanelRoutines'),
      goals: document.getElementById('viewPanelGoals'),
      focus: document.getElementById('viewPanelFocus'),
      timeblocks: document.getElementById('viewPanelTimeBlocks'),
      analytics: document.getElementById('viewPanelAnalytics'),
      weeklyreview: document.getElementById('viewPanelWeeklyReview'),
      ai: document.getElementById('viewPanelAI')
    };

    for (const [key, panel] of Object.entries(panels)) {
      if (panel) panel.classList.toggle('d-none', key !== tabName);
    }

    if (tabName === 'calendar' && this.calendar) {
      this.calendar.setTasks(this.tasks);
      this.updateCalendarHeader();
    } else if (tabName === 'analytics') {
      this.loadAndRenderAnalytics();
    } else if (tabName === 'habits' && this.habits) {
      this.habits.loadData().then(() => this.habits.render());
    } else if (tabName === 'routines' && this.routines) {
      this.routines.loadData().then(() => this.routines.render());
    } else if (tabName === 'goals' && this.goals) {
      this.goals.loadData().then(() => this.goals.render());
    } else if (tabName === 'focus' && this.focus) {
      this.focus.loadData().then(() => this.focus.render());
    } else if (tabName === 'timeblocks' && this.timeBlocks) {
      this.timeBlocks.loadData().then(() => this.timeBlocks.render());
    } else if (tabName === 'weeklyreview' && this.weeklyReview) {
      this.weeklyReview.loadData().then(() => this.weeklyReview.render());
    }
  }

  async loadAndRenderAnalytics() {
    try {
      const stats = await neocalenderApi.getStats();
      if (this.analytics) {
        this.analytics.render(stats);
      }
    } catch (err) {
      console.error('Failed to render analytics:', err);
    }
  }

  // ── LISTS NAVIGATION ────────────────────────────────────────────────────

  renderListsNavigation() {
    if (!this.dom.listsNav) return;

    this.dom.listsNav.innerHTML = this.lists.map(list => `
      <div class="nc-nav-item ${this.activeListFilter === list.id ? 'active' : ''}" data-list-id="${list.id}">
        <div class="nc-nav-icon" style="color: ${list.color || '#6366f1'}">
          <i class="bi ${list.icon || 'bi-list-task'}"></i>
        </div>
        <span class="nc-nav-label">${this.escapeHtml(list.name)}</span>
        <span class="nc-nav-badge" id="badge_list_${list.id}">0</span>
      </div>
    `).join('');

    // Bind click
    this.dom.listsNav.querySelectorAll('[data-list-id]').forEach(el => {
      el.addEventListener('click', () => {
        const listId = el.dataset.listId;
        this.setListFilter(listId);
      });
    });
  }

  populateListSelectDropdown() {
    const select = document.getElementById('taskCategorySelect');
    if (!select) return;
    select.innerHTML = this.lists.map(list => `
      <option value="${list.id}" data-color="${list.color}">${this.escapeHtml(list.name)}</option>
    `).join('');
  }

  setListFilter(filterId) {
    this.activeListFilter = filterId;
    this.switchView('tasks');

    // Update nav classes
    document.querySelectorAll('.nc-nav-item').forEach(el => {
      if (el.dataset.filter) {
        el.classList.toggle('active', el.dataset.filter === filterId);
      } else if (el.dataset.listId) {
        el.classList.toggle('active', el.dataset.listId === filterId);
      }
    });

    // Update heading
    this.updateHeadingTitle();
    this.renderTasks();
  }

  updateHeadingTitle() {
    let title = 'My Tasks';
    if (this.activeListFilter === 'all') title = 'All Tasks';
    else if (this.activeListFilter === 'today') title = "Today's Agenda";
    else if (this.activeListFilter === 'upcoming') title = 'Upcoming Deadlines';
    else if (this.activeListFilter === 'completed') title = 'Completed Tasks';
    else {
      const match = this.lists.find(l => l.id === this.activeListFilter);
      if (match) title = match.name;
    }

    if (this.dom.activeViewTitle) {
      this.dom.activeViewTitle.textContent = title;
    }
  }

  // ── TASKS RENDERING & FILTERING ─────────────────────────────────────────

  getFilteredTasks() {
    const todayStr = new Date().toISOString().slice(0, 10);

    return this.tasks.filter(task => {
      // List/category filter
      if (this.activeListFilter === 'today') {
        if (!task.dueDate || task.dueDate.slice(0, 10) !== todayStr) return false;
      } else if (this.activeListFilter === 'upcoming') {
        if (task.status === 'completed' || !task.dueDate) return false;
      } else if (this.activeListFilter === 'completed') {
        if (task.status !== 'completed') return false;
      } else if (this.activeListFilter !== 'all') {
        if (task.listId !== this.activeListFilter) return false;
      }

      // Priority filter
      if (this.priorityFilter && task.priority !== this.priorityFilter) {
        return false;
      }

      // Search query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description && task.description.toLowerCase().includes(q);
        const matchesSubtasks = task.subtasks && task.subtasks.some(s => s.title.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesSubtasks) return false;
      }

      return true;
    });
  }

  renderTasks() {
    if (!this.dom.tasksContainer) return;

    let tasks = this.getFilteredTasks();

    // Sort tasks
    tasks = this.sortTasksList(tasks);

    if (this.dom.activeViewCount) {
      this.dom.activeViewCount.textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
    }

    if (tasks.length === 0) {
      if (this.dom.emptyState) this.dom.emptyState.classList.remove('d-none');
      this.dom.tasksContainer.innerHTML = '';
      return;
    }

    if (this.dom.emptyState) this.dom.emptyState.classList.add('d-none');

    const todayStr = new Date().toISOString().slice(0, 10);

    this.dom.tasksContainer.innerHTML = tasks.map(task => {
      const isCompleted = task.status === 'completed';
      const isOverdue = !isCompleted && task.dueDate && task.dueDate.slice(0, 10) < todayStr;
      const isToday = task.dueDate && task.dueDate.slice(0, 10) === todayStr;

      let dateBadgeClass = 'nc-due-normal';
      let dateText = '';
      if (task.dueDate) {
        const d = new Date(task.dueDate);
        dateText = isToday ? 'Today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (task.dueTime) dateText += ` ${task.dueTime}`;
        if (isOverdue) dateBadgeClass = 'nc-due-overdue';
        else if (isToday) dateBadgeClass = 'nc-due-today';
      }

      const listMatch = this.lists.find(l => l.id === task.listId);
      const listName = listMatch ? listMatch.name : (task.category || 'General');
      const listColor = listMatch ? listMatch.color : '#6366f1';

      // Subtasks count
      const totalSubs = task.subtasks?.length || 0;
      const compSubs = task.subtasks?.filter(s => s.completed).length || 0;

      return `
        <div class="nc-task-item ${isCompleted ? 'nc-task-completed' : ''} ${isOverdue ? 'nc-task-overdue-border' : ''}" data-task-id="${task.id}" draggable="true">
          <div class="nc-task-drag-handle" title="Drag to reorder"><i class="bi bi-grip-vertical"></i></div>

          <button class="nc-check-btn ${isCompleted ? 'nc-checked' : ''}" data-action="toggle" title="${isCompleted ? 'Mark as incomplete' : 'Mark as complete'}">
            <i class="bi ${isCompleted ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
          </button>

          <div class="nc-task-content" data-action="edit">
            <div class="nc-task-title-row">
              <span class="nc-task-title">${this.escapeHtml(task.title)}</span>
              <span class="nc-priority-pill nc-pri-${task.priority || 'medium'}">${task.priority || 'medium'}</span>
            </div>

            ${task.description ? `<p class="nc-task-desc">${this.escapeHtml(task.description)}</p>` : ''}

            <div class="nc-task-meta-row">
              <span class="nc-meta-badge" style="color: ${listColor}">
                <i class="bi ${listMatch?.icon || 'bi-folder'} me-1"></i>${this.escapeHtml(listName)}
              </span>

              ${dateText ? `
                <span class="nc-meta-badge ${dateBadgeClass}">
                  <i class="bi ${isOverdue ? 'bi-exclamation-circle-fill' : 'bi-clock'} me-1"></i>${dateText}
                </span>
              ` : ''}

              ${task.recurrence && task.recurrence !== 'none' ? `
                <span class="nc-meta-badge nc-badge-recurrence" title="Repeats ${task.recurrence}">
                  <i class="bi bi-arrow-repeat me-1"></i>${task.recurrence}
                </span>
              ` : ''}

              ${totalSubs > 0 ? `
                <span class="nc-meta-badge nc-badge-subtasks" data-action="toggle-subs">
                  <i class="bi bi-list-check me-1"></i>${compSubs}/${totalSubs} subtasks
                </span>
              ` : ''}
            </div>

            <!-- Inline subtasks checklist (collapsible) -->
            ${totalSubs > 0 ? `
              <div class="nc-inline-subtasks d-none" id="subs_${task.id}">
                ${task.subtasks.map(s => `
                  <div class="nc-sub-row ${s.completed ? 'nc-sub-completed' : ''}" data-sub-id="${s.id}">
                    <input type="checkbox" class="form-check-input nc-sub-check" ${s.completed ? 'checked' : ''}>
                    <span class="nc-sub-title">${this.escapeHtml(s.title)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div class="nc-task-actions">
            <button class="nc-task-act-btn" data-action="edit" title="Edit task"><i class="bi bi-pencil"></i></button>
            <button class="nc-task-act-btn text-danger" data-action="delete" title="Delete task"><i class="bi bi-trash3"></i></button>
          </div>
        </div>
      `;
    }).join('');

    this.bindTaskItemEvents();
    this.setupDragAndDrop();
  }

  sortTasksList(tasks) {
    return tasks.sort((a, b) => {
      if (this.sortBy === 'priority') {
        const weights = { urgent: 4, high: 3, medium: 2, low: 1 };
        const diff = (weights[a.priority] || 2) - (weights[b.priority] || 2);
        return this.sortDir === 'desc' ? -diff : diff;
      }
      if (this.sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return this.sortDir === 'desc' ? -diff : diff;
      }
      if (this.sortBy === 'title') {
        return this.sortDir === 'desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title);
      }
      // Default: order
      return this.sortDir === 'desc' ? b.order - a.order : a.order - b.order;
    });
  }

  bindTaskItemEvents() {
    this.dom.tasksContainer.querySelectorAll('.nc-task-item').forEach(el => {
      const taskId = el.dataset.taskId;

      // Toggle status button
      const toggleBtn = el.querySelector('[data-action="toggle"]');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleTaskStatus(taskId);
        });
      }

      // Edit click
      el.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const task = this.tasks.find(t => t.id === taskId);
          if (task) this.openEditTaskModal(task);
        });
      });

      // Delete click
      const deleteBtn = el.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('Are you sure you want to delete this task?')) {
            await this.deleteTask(taskId);
          }
        });
      }

      // Subtasks accordion toggle
      const subToggle = el.querySelector('[data-action="toggle-subs"]');
      if (subToggle) {
        subToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const subContainer = el.querySelector(`#subs_${taskId}`);
          if (subContainer) subContainer.classList.toggle('d-none');
        });
      }

      // Inline subtask checkbox toggling
      el.querySelectorAll('.nc-sub-check').forEach(chk => {
        chk.addEventListener('change', async (e) => {
          e.stopPropagation();
          const subRow = chk.closest('.nc-sub-row');
          const subId = subRow?.dataset.subId;
          await this.toggleSubtask(taskId, subId, chk.checked);
        });
      });
    });
  }

  setupDragAndDrop() {
    let draggedItem = null;

    this.dom.tasksContainer.querySelectorAll('.nc-task-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('nc-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', async () => {
        draggedItem = null;
        item.classList.remove('nc-dragging');

        // Persist new ordering across all visible task items
        const orderedIds = Array.from(this.dom.tasksContainer.querySelectorAll('.nc-task-item'))
          .map(el => el.dataset.taskId);

        // Update orders in memory and backend
        for (let i = 0; i < orderedIds.length; i++) {
          const tId = orderedIds[i];
          const task = this.tasks.find(t => t.id === tId);
          if (task && task.order !== i) {
            task.order = i;
            neocalenderApi.updateTask(tId, { order: i }).catch(console.error);
          }
        }
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedItem && draggedItem !== item) {
          const rect = item.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          if (e.clientY < midpoint) {
            this.dom.tasksContainer.insertBefore(draggedItem, item);
          } else {
            this.dom.tasksContainer.insertBefore(draggedItem, item.nextSibling);
          }
        }
      });
    });
  }

  // ── TASK ACTIONS ────────────────────────────────────────────────────────

  async toggleTaskStatus(taskId) {
    try {
      const updated = await neocalenderApi.toggleTask(taskId);
      const idx = this.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        this.tasks[idx] = updated;
      }
      this.renderTasks();
      this.updateCounts();
      if (this.calendar) this.calendar.setTasks(this.tasks);

      if (updated.status === 'completed') {
        notifier.playChime();
        notifier.showToast(`Completed "${updated.title}"! 🎉`, 'success');
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
      notifier.showToast('Could not update task status', 'danger');
    }
  }

  async deleteTask(taskId) {
    try {
      await neocalenderApi.deleteTask(taskId);
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.renderTasks();
      this.updateCounts();
      if (this.calendar) this.calendar.setTasks(this.tasks);
      notifier.showToast('Task deleted', 'info');
    } catch (err) {
      console.error('Failed to delete task:', err);
      notifier.showToast('Could not delete task', 'danger');
    }
  }

  async toggleSubtask(taskId, subId, isCompleted) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const sub = task.subtasks.find(s => s.id === subId);
    if (!sub) return;
    sub.completed = isCompleted;

    try {
      await neocalenderApi.updateTask(taskId, { subtasks: task.subtasks });
      this.renderTasks();
    } catch (err) {
      console.error('Failed to update subtask:', err);
    }
  }

  async handleQuickAdd() {
    if (!this.dom.quickAddInput) return;
    const title = this.dom.quickAddInput.value.trim();
    if (!title) return;

    const listId = ['all', 'today', 'upcoming', 'completed'].includes(this.activeListFilter)
      ? 'study'
      : this.activeListFilter;

    const dueDate = this.activeListFilter === 'today'
      ? new Date().toISOString().slice(0, 10)
      : null;

    try {
      const task = await neocalenderApi.createTask({
        title,
        listId,
        dueDate,
        priority: this.settings.defaultPriority || 'medium'
      });

      this.tasks.unshift(task);
      this.dom.quickAddInput.value = '';
      this.renderTasks();
      this.updateCounts();
      if (this.calendar) this.calendar.setTasks(this.tasks);
      notifier.showToast(`Task "${title}" added!`, 'success');
    } catch (err) {
      console.error('Failed to quick add task:', err);
      notifier.showToast(err.message, 'danger');
    }
  }

  // ── MODAL: CREATE / EDIT TASK ───────────────────────────────────────────

  openNewTaskModal(prefill = {}) {
    this.editingTaskId = null;
    document.getElementById('taskModalTitle').textContent = 'Create New Task';
    this.dom.taskForm.reset();

    // Defaults
    if (prefill.dueDate) document.getElementById('taskDueDateInput').value = prefill.dueDate;
    if (prefill.dueTime) document.getElementById('taskDueTimeInput').value = prefill.dueTime;
    if (prefill.title) document.getElementById('taskTitleInput').value = prefill.title;

    document.getElementById('taskPrioritySelect').value = this.settings.defaultPriority || 'medium';
    document.getElementById('taskRecurrenceSelect').value = 'none';

    if (this.dom.subtasksContainer) this.dom.subtasksContainer.innerHTML = '';

    const modal = new bootstrap.Modal(this.dom.taskModal);
    modal.show();
  }

  openEditTaskModal(task) {
    this.editingTaskId = task.id;
    document.getElementById('taskModalTitle').textContent = 'Edit Task';
    this.dom.taskForm.reset();

    document.getElementById('taskTitleInput').value = task.title || '';
    document.getElementById('taskDescInput').value = task.description || '';
    document.getElementById('taskCategorySelect').value = task.listId || 'study';
    document.getElementById('taskPrioritySelect').value = task.priority || 'medium';
    document.getElementById('taskDueDateInput').value = task.dueDate ? task.dueDate.slice(0, 10) : '';
    document.getElementById('taskDueTimeInput').value = task.dueTime || '';
    document.getElementById('taskRecurrenceSelect').value = task.recurrence || 'none';

    // Subtasks builder
    if (this.dom.subtasksContainer) {
      this.dom.subtasksContainer.innerHTML = '';
      (task.subtasks || []).forEach(st => {
        this.appendSubtaskRow(st.title, st.completed, st.id);
      });
    }

    const modal = new bootstrap.Modal(this.dom.taskModal);
    modal.show();
  }

  appendSubtaskRow(title = '', completed = false, id = null) {
    if (!this.dom.subtasksContainer) return;
    const subDiv = document.createElement('div');
    subDiv.className = 'nc-modal-sub-row d-flex align-items-center gap-2 mb-2';
    subDiv.dataset.subId = id || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    subDiv.innerHTML = `
      <input type="checkbox" class="form-check-input nc-modal-sub-check" ${completed ? 'checked' : ''}>
      <input type="text" class="form-control form-control-sm nc-modal-sub-title" value="${this.escapeHtml(title)}" placeholder="Subtask title...">
      <button type="button" class="btn btn-sm btn-outline-danger nc-remove-sub-btn"><i class="bi bi-x"></i></button>
    `;

    subDiv.querySelector('.nc-remove-sub-btn').addEventListener('click', () => subDiv.remove());
    this.dom.subtasksContainer.appendChild(subDiv);
  }

  async handleTaskFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('taskTitleInput').value.trim();
    if (!title) {
      notifier.showToast('Please enter a task title', 'warning');
      return;
    }

    const description = document.getElementById('taskDescInput').value.trim();
    const listId = document.getElementById('taskCategorySelect').value;
    const priority = document.getElementById('taskPrioritySelect').value;
    const dueDate = document.getElementById('taskDueDateInput').value || null;
    const dueTime = document.getElementById('taskDueTimeInput').value || null;
    const recurrence = document.getElementById('taskRecurrenceSelect').value;

    // Collect subtasks
    const subtasks = [];
    if (this.dom.subtasksContainer) {
      this.dom.subtasksContainer.querySelectorAll('.nc-modal-sub-row').forEach(row => {
        const subTitle = row.querySelector('.nc-modal-sub-title')?.value.trim();
        const completed = row.querySelector('.nc-modal-sub-check')?.checked || false;
        const subId = row.dataset.subId;
        if (subTitle) {
          subtasks.push({ id: subId, title: subTitle, completed });
        }
      });
    }

    const listMatch = this.lists.find(l => l.id === listId);
    const category = listMatch ? listMatch.name : 'General';

    const payload = {
      title,
      description,
      listId,
      category,
      priority,
      dueDate,
      dueTime,
      recurrence,
      subtasks
    };

    try {
      if (this.editingTaskId) {
        const updated = await neocalenderApi.updateTask(this.editingTaskId, payload);
        const idx = this.tasks.findIndex(t => t.id === this.editingTaskId);
        if (idx !== -1) this.tasks[idx] = updated;
        notifier.showToast('Task updated successfully', 'success');
      } else {
        const created = await neocalenderApi.createTask(payload);
        this.tasks.unshift(created);
        notifier.showToast('Task created successfully', 'success');
      }

      this.renderTasks();
      this.updateCounts();
      if (this.calendar) this.calendar.setTasks(this.tasks);

      bootstrap.Modal.getInstance(this.dom.taskModal)?.hide();
    } catch (err) {
      console.error('Failed to save task:', err);
      notifier.showToast(err.message, 'danger');
    }
  }

  // ── MODAL: CUSTOM LISTS ─────────────────────────────────────────────────

  openNewListModal() {
    this.dom.listForm.reset();
    const modal = new bootstrap.Modal(this.dom.listModal);
    modal.show();
  }

  async handleListFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('listNameInput').value.trim();
    if (!name) return;
    const color = document.getElementById('listColorInput').value;
    const icon = document.getElementById('listIconSelect').value;

    try {
      const list = await neocalenderApi.createList({ name, color, icon });
      this.lists.push(list);
      this.renderListsNavigation();
      this.populateListSelectDropdown();
      bootstrap.Modal.getInstance(this.dom.listModal)?.hide();
      notifier.showToast(`List "${name}" created!`, 'success');
    } catch (err) {
      console.error('Failed to create list:', err);
      notifier.showToast(err.message, 'danger');
    }
  }

  // ── NOTIFICATIONS & COUNTS ──────────────────────────────────────────────

  updateNotificationsUI(notifs, unread) {
    if (this.dom.notifBadge) {
      this.dom.notifBadge.textContent = unread > 0 ? unread : '';
      this.dom.notifBadge.classList.toggle('d-none', unread === 0);
    }

    if (this.dom.notifDrawerList) {
      if (notifs.length === 0) {
        this.dom.notifDrawerList.innerHTML = `
          <div class="nc-empty-state"><i class="bi bi-bell"></i><p>No new notifications</p></div>
        `;
        return;
      }
      this.dom.notifDrawerList.innerHTML = notifs.map(n => `
        <div class="nc-notif-item nc-notif-${n.type} ${n.read ? 'nc-notif-read' : ''}">
          <div class="nc-notif-header">
            <strong>${this.escapeHtml(n.title)}</strong>
            <span class="nc-notif-time">${new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p class="nc-notif-msg">${this.escapeHtml(n.message)}</p>
        </div>
      `).join('');
    }
  }

  updateCounts() {
    const todayStr = new Date().toISOString().slice(0, 10);

    const allCount = this.tasks.filter(t => t.status === 'pending').length;
    const todayCount = this.tasks.filter(t => t.status === 'pending' && t.dueDate && t.dueDate.slice(0, 10) === todayStr).length;
    const completedCount = this.tasks.filter(t => t.status === 'completed').length;

    const elAll = document.getElementById('badge_all');
    if (elAll) elAll.textContent = allCount;

    const elToday = document.getElementById('badge_today');
    if (elToday) elToday.textContent = todayCount;

    const elCompleted = document.getElementById('badge_completed');
    if (elCompleted) elCompleted.textContent = completedCount;

    // List badges
    this.lists.forEach(l => {
      const cnt = this.tasks.filter(t => t.status === 'pending' && t.listId === l.id).length;
      const b = document.getElementById(`badge_list_${l.id}`);
      if (b) b.textContent = cnt;
    });
  }

  updateCalendarHeader() {
    if (this.dom.calTitle && this.calendar) {
      this.dom.calTitle.textContent = this.calendar.getTitle();
    }
  }

  showGlobalLoader(show) {
    const loader = document.getElementById('ncGlobalLoader');
    if (loader) loader.classList.toggle('d-none', !show);
  }

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── EVENT LISTENERS ─────────────────────────────────────────────────────

  bindEvents() {
    // Mobile Sidebar Toggle and Backdrop
    const closeSidebar = () => {
      this.dom.sidebar?.classList.remove('nc-sidebar-open');
      this.dom.sidebarBackdrop?.classList.remove('active');
    };

    const openSidebar = () => {
      this.dom.sidebar?.classList.add('nc-sidebar-open');
      this.dom.sidebarBackdrop?.classList.add('active');
    };

    if (this.dom.mobileMenuToggle) {
      this.dom.mobileMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.dom.sidebar?.classList.contains('nc-sidebar-open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (this.dom.sidebarBackdrop) {
      this.dom.sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    // Auto-close sidebar on mobile when navigating
    document.querySelectorAll('#ncSidebar [data-view-tab], #ncSidebar [data-filter], #ncSidebar [data-list-id]').forEach(el => {
      el.addEventListener('click', () => {
        if (window.innerWidth <= 992) {
          closeSidebar();
        }
      });
    });

    // Nav tabs
    document.querySelectorAll('[data-view-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchView(tab.dataset.viewTab);
      });
    });

    // Built-in list filters
    document.querySelectorAll('[data-filter]').forEach(el => {
      el.addEventListener('click', () => {
        this.setListFilter(el.dataset.filter);
      });
    });

    // Quick task add
    if (this.dom.quickAddBtn) {
      this.dom.quickAddBtn.addEventListener('click', () => this.handleQuickAdd());
    }
    if (this.dom.quickAddInput) {
      this.dom.quickAddInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleQuickAdd();
      });
    }

    // Modal open
    if (this.dom.openModalBtn) {
      this.dom.openModalBtn.addEventListener('click', () => this.openNewTaskModal());
    }

    // Task form submit
    if (this.dom.taskForm) {
      this.dom.taskForm.addEventListener('submit', (e) => this.handleTaskFormSubmit(e));
    }

    // Add subtask in modal
    if (this.dom.addSubtaskBtn) {
      this.dom.addSubtaskBtn.addEventListener('click', () => {
        const title = this.dom.newSubtaskInput?.value.trim();
        if (title) {
          this.appendSubtaskRow(title, false);
          this.dom.newSubtaskInput.value = '';
        }
      });
    }

    // List creation modal & form
    const createListBtn = document.getElementById('openCreateListBtn');
    if (createListBtn) {
      createListBtn.addEventListener('click', () => this.openNewListModal());
    }
    if (this.dom.listForm) {
      this.dom.listForm.addEventListener('submit', (e) => this.handleListFormSubmit(e));
    }

    // Search and filters
    if (this.dom.searchInput) {
      this.dom.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderTasks();
      });
    }
    if (this.dom.priorityFilterSelect) {
      this.dom.priorityFilterSelect.addEventListener('change', (e) => {
        this.priorityFilter = e.target.value;
        this.renderTasks();
      });
    }
    if (this.dom.sortSelect) {
      this.dom.sortSelect.addEventListener('change', (e) => {
        const [field, dir] = e.target.value.split('-');
        this.sortBy = field;
        this.sortDir = dir || 'asc';
        this.renderTasks();
      });
    }

    // Calendar navigation
    if (this.dom.calPrevBtn) {
      this.dom.calPrevBtn.addEventListener('click', () => {
        if (this.calendar) {
          this.calendar.prev();
          this.updateCalendarHeader();
        }
      });
    }
    if (this.dom.calNextBtn) {
      this.dom.calNextBtn.addEventListener('click', () => {
        if (this.calendar) {
          this.calendar.next();
          this.updateCalendarHeader();
        }
      });
    }
    if (this.dom.calTodayBtn) {
      this.dom.calTodayBtn.addEventListener('click', () => {
        if (this.calendar) {
          this.calendar.today();
          this.updateCalendarHeader();
        }
      });
    }
    if (this.dom.calViewSelector) {
      this.dom.calViewSelector.addEventListener('change', (e) => {
        if (this.calendar) {
          this.calendar.setView(e.target.value);
          this.updateCalendarHeader();
        }
      });
    }

    // Notification center drawer
    if (this.dom.notifToggleBtn) {
      this.dom.notifToggleBtn.addEventListener('click', () => {
        this.dom.notifDrawer?.classList.toggle('nc-drawer-open');
        notifier.markAllAsRead();
      });
    }
    if (this.dom.closeNotifDrawerBtn) {
      this.dom.closeNotifDrawerBtn.addEventListener('click', () => {
        this.dom.notifDrawer?.classList.remove('nc-drawer-open');
      });
    }
    if (this.dom.clearNotifsBtn) {
      this.dom.clearNotifsBtn.addEventListener('click', () => {
        notifier.clearAll();
      });
    }
    // Modal forms for new expansion modules
    const habitForm = document.getElementById('ncHabitForm');
    if (habitForm) {
      habitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const title = document.getElementById('ncHabitTitleInput')?.value.trim();
          const frequency = document.getElementById('ncHabitFrequencySelect')?.value || 'daily';
          const category = document.getElementById('ncHabitCategoryInput')?.value.trim() || 'Study';
          const reminderTime = document.getElementById('ncHabitTimeInput')?.value || null;
          await neocalenderApi.createHabit({ title, frequency, category, reminderTime });
          notifier.showToast('Habit created!', 'success');
          habitForm.reset();
          const modalEl = document.getElementById('ncHabitModal');
          if (modalEl && window.bootstrap) window.bootstrap.Modal.getInstance(modalEl)?.hide();
          if (this.habits) {
            await this.habits.loadData();
            this.habits.render();
          }
        } catch (err) {
          notifier.showToast('Failed to create habit: ' + err.message, 'danger');
        }
      });
    }

    const routineForm = document.getElementById('ncRoutineForm');
    if (routineForm) {
      routineForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const name = document.getElementById('ncRoutineNameInput')?.value.trim();
          const category = document.getElementById('ncRoutineCategoryInput')?.value.trim() || 'Study';
          const estimatedMinutes = Number(document.getElementById('ncRoutineDurationInput')?.value) || 60;
          const description = document.getElementById('ncRoutineDescInput')?.value.trim() || '';
          await neocalenderApi.createRoutine({
            name, category, estimatedMinutes, description,
            activities: [
              { title: `${name} - Primary Block`, durationMinutes: Math.round(estimatedMinutes * 0.7) },
              { title: `${name} - Review & Quiz`, durationMinutes: Math.round(estimatedMinutes * 0.3) }
            ]
          });
          notifier.showToast('Routine template created!', 'success');
          routineForm.reset();
          const modalEl = document.getElementById('ncRoutineModal');
          if (modalEl && window.bootstrap) window.bootstrap.Modal.getInstance(modalEl)?.hide();
          if (this.routines) {
            await this.routines.loadData();
            this.routines.render();
          }
        } catch (err) {
          notifier.showToast('Failed to create routine: ' + err.message, 'danger');
        }
      });
    }

    const goalForm = document.getElementById('ncGoalForm');
    if (goalForm) {
      goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const title = document.getElementById('ncGoalTitleInput')?.value.trim();
          const category = document.getElementById('ncGoalCategorySelect')?.value || 'academic';
          const priority = document.getElementById('ncGoalPrioritySelect')?.value || 'high';
          const targetDate = document.getElementById('ncGoalTargetDateInput')?.value || null;
          const description = document.getElementById('ncGoalDescInput')?.value.trim() || '';
          await neocalenderApi.createGoal({ title, category, priority, targetDate, description });
          notifier.showToast('Goal created!', 'success');
          goalForm.reset();
          const modalEl = document.getElementById('ncGoalModal');
          if (modalEl && window.bootstrap) window.bootstrap.Modal.getInstance(modalEl)?.hide();
          if (this.goals) {
            await this.goals.loadData();
            this.goals.render();
          }
        } catch (err) {
          notifier.showToast('Failed to create goal: ' + err.message, 'danger');
        }
      });
    }

    const blockForm = document.getElementById('ncTimeBlockForm');
    if (blockForm) {
      blockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const title = document.getElementById('ncBlockTitleInput')?.value.trim();
          const date = document.getElementById('ncBlockModalDateInput')?.value;
          const startTime = document.getElementById('ncBlockStartTimeInput')?.value;
          const endTime = document.getElementById('ncBlockEndTimeInput')?.value;
          const category = document.getElementById('ncBlockCategoryInput')?.value.trim() || 'Study';
          const isBreak = document.getElementById('ncBlockIsBreakInput')?.checked || false;

          const res = await neocalenderApi.createTimeBlock({ title, date, startTime, endTime, category, isBreak });
          if (res?.hasConflicts) {
            notifier.showToast('Time block created (warning: schedule conflict detected)', 'warning');
          } else {
            notifier.showToast('Time block scheduled!', 'success');
          }
          blockForm.reset();
          const modalEl = document.getElementById('ncTimeBlockModal');
          if (modalEl && window.bootstrap) window.bootstrap.Modal.getInstance(modalEl)?.hide();
          if (this.timeBlocks) {
            await this.timeBlocks.loadData();
            this.timeBlocks.render();
          }
        } catch (err) {
          notifier.showToast('Failed to schedule block: ' + err.message, 'danger');
        }
      });
    }
  }
}

// Start app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.neocalenderApp = new NeoCalenderApp();
});
