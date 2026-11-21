/**
 * NeoCalender/neocalender-service.js
 *
 * Backend business logic for NeoCalender:
 * - Tasks CRUD, filters, sorting, search
 * - Task completion, recurrence advancing, subtasks
 * - Custom lists CRUD & default list provisioning
 * - User preferences & settings
 * - Schedule & calendar queries
 * - Productivity analytics calculation from real data
 */

import { db as defaultDb } from '../firebaseAdmin.js';
import crypto from 'crypto';

let customDbInstance = null;

export function setNeoCalenderDb(mockDb) {
  customDbInstance = mockDb;
}

export function getDb() {
  return customDbInstance || defaultDb;
}

/**
 * Sanitizes object by removing undefined values to prevent Firestore write rejections.
 */
export function cleanForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj !== 'object' || obj instanceof Date) return obj;
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = cleanForFirestore(val);
    }
  }
  return clean;
}

/**
 * Default lists created for each user on first visit.
 */
export const DEFAULT_LISTS = [
  { id: 'study', name: 'Study & Academics', color: '#6366f1', icon: 'bi-mortarboard', isDefault: true, order: 0 },
  { id: 'personal', name: 'Personal', color: '#10b981', icon: 'bi-person-heart', isDefault: false, order: 1 },
  { id: 'work', name: 'Work & Projects', color: '#3b82f6', icon: 'bi-briefcase', isDefault: false, order: 2 },
  { id: 'important', name: 'Important Deadlines', color: '#ef4444', icon: 'bi-exclamation-diamond', isDefault: false, order: 3 }
];

export const DEFAULT_SETTINGS = {
  remindersEnabled: true,
  notificationPref: 'all', // 'all', 'important', 'none'
  defaultPriority: 'medium',
  preferredView: 'month', // 'month', 'week', 'day', 'tasks'
  weekStartDay: 'monday', // 'monday', 'sunday'
  dailySummaryTime: '08:00',
  aiAutonomy: 'confirm_destructive', // 'confirm_destructive', 'auto_quick_actions'
  timeZone: 'Asia/Kolkata',
  dailyAvailableHours: 8,
  workStartTime: '09:00',
  workEndTime: '21:00',
  defaultBreakMinutes: 10,
  preferredFocusDuration: 25,
  habitTrackingEnabled: true,
  goalPlanningEnabled: true,
  weekAvailability: {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: false
  }
};

/**
 * Returns references to user's isolated subcollections.
 */
export function getUserCollections(uid) {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Valid user UID is required for NeoCalender operations');
  }
  const db = getDb();
  if (!db) {
    throw new Error('Firestore database is not initialized');
  }
  const userRef = db.collection('users').doc(uid);
  return {
    userRef,
    tasksRef: userRef.collection('neocalender_tasks'),
    listsRef: userRef.collection('neocalender_lists'),
    settingsDoc: userRef.collection('neocalender_settings').doc('preferences'),
    eventsRef: userRef.collection('neocalender_events'),
    habitsRef: userRef.collection('neocalender_habits'),
    routinesRef: userRef.collection('neocalender_routines'),
    goalsRef: userRef.collection('neocalender_goals'),
    milestonesRef: userRef.collection('neocalender_milestones'),
    focusSessionsRef: userRef.collection('neocalender_focus_sessions'),
    timeBlocksRef: userRef.collection('neocalender_time_blocks')
  };
}

/**
 * Provision default lists if user does not have any.
 */
export async function ensureDefaultLists(uid) {
  const { listsRef } = getUserCollections(uid);
  const snap = await listsRef.limit(1).get();
  if (snap.empty) {
    const batch = getDb().batch();
    for (const list of DEFAULT_LISTS) {
      const docRef = listsRef.doc(list.id);
      batch.set(docRef, {
        ...list,
        createdAt: new Date().toISOString()
      });
    }
    await batch.commit();
  }
}

/**
 * Get all task lists for user.
 */
export async function getLists(uid) {
  await ensureDefaultLists(uid);
  const { listsRef } = getUserCollections(uid);
  const snap = await listsRef.orderBy('order', 'asc').get();
  const lists = [];
  snap.forEach(doc => {
    lists.push({ id: doc.id, ...doc.data() });
  });
  return lists;
}

/**
 * Create a new task list.
 */
export async function createList(uid, data) {
  const { listsRef } = getUserCollections(uid);
  const name = String(data.name || '').trim();
  if (!name) throw new Error('List name is required');
  const id = data.id || `list_${crypto.randomUUID().slice(0, 8)}`;
  const newList = {
    id,
    name,
    color: data.color || '#6366f1',
    icon: data.icon || 'bi-list-task',
    isDefault: false,
    order: Number.isInteger(data.order) ? data.order : Date.now(),
    createdAt: new Date().toISOString()
  };
  await listsRef.doc(id).set(cleanForFirestore(newList));
  return newList;
}

/**
 * Update an existing task list.
 */
export async function updateList(uid, listId, updates) {
  const { listsRef } = getUserCollections(uid);
  const docRef = listsRef.doc(listId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('List not found');
  
  const allowed = ['name', 'color', 'icon', 'order'];
  const toUpdate = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) toUpdate[k] = updates[k];
  }
  toUpdate.updatedAt = new Date().toISOString();
  await docRef.update(cleanForFirestore(toUpdate));
  return { id: listId, ...doc.data(), ...toUpdate };
}

/**
 * Delete a task list.
 */
export async function deleteList(uid, listId) {
  const { listsRef, tasksRef } = getUserCollections(uid);
  const docRef = listsRef.doc(listId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('List not found');
  if (doc.data().isDefault) throw new Error('Cannot delete default list');
  
  // Reassign any tasks in this list to 'study' or default list
  const tasksInList = await tasksRef.where('listId', '==', listId).get();
  const batch = getDb().batch();
  tasksInList.forEach(tDoc => {
    batch.update(tDoc.ref, { listId: 'study', category: 'Study & Academics' });
  });
  batch.delete(docRef);
  await batch.commit();
  return { success: true, deletedListId: listId };
}

/**
 * Get user settings.
 */
export async function getSettings(uid) {
  const { settingsDoc } = getUserCollections(uid);
  const doc = await settingsDoc.get();
  if (!doc.exists) {
    await settingsDoc.set(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...doc.data() };
}

/**
 * Update user settings.
 */
export async function updateSettings(uid, updates) {
  const { settingsDoc } = getUserCollections(uid);
  const current = await getSettings(uid);
  const allowed = [
    'remindersEnabled', 'notificationPref', 'defaultPriority',
    'preferredView', 'weekStartDay', 'dailySummaryTime', 'aiAutonomy', 'timeZone',
    'dailyAvailableHours', 'workStartTime', 'workEndTime', 'defaultBreakMinutes',
    'preferredFocusDuration', 'habitTrackingEnabled', 'goalPlanningEnabled', 'weekAvailability'
  ];
  const toUpdate = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) toUpdate[k] = updates[k];
  }
  const merged = { ...current, ...toUpdate, updatedAt: new Date().toISOString() };
  await settingsDoc.set(cleanForFirestore(merged), { merge: true });
  return merged;
}

/**
 * Calculate the next due date for recurring tasks.
 */
export function calculateNextDueDate(currentDueDateStr, recurrence, interval = 1) {
  if (!currentDueDateStr || recurrence === 'none') return null;
  const curr = new Date(currentDueDateStr);
  if (isNaN(curr.getTime())) return null;

  const next = new Date(curr);
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + (interval || 1));
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7 * (interval || 1));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + (interval || 1));
      break;
    case 'custom':
      next.setDate(next.getDate() + (interval || 1));
      break;
    default:
      return null;
  }
  return next.toISOString();
}

/**
 * Create a new task.
 */
export async function createTask(uid, taskData) {
  const { tasksRef } = getUserCollections(uid);
  const title = String(taskData.title || '').trim();
  if (!title) throw new Error('Task title is required');

  const taskId = taskData.id || `task_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  // Validate priority
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const priority = validPriorities.includes(taskData.priority?.toLowerCase())
    ? taskData.priority.toLowerCase()
    : 'medium';

  // Subtasks normalization
  const rawSubtasks = Array.isArray(taskData.subtasks) ? taskData.subtasks : [];
  const subtasks = rawSubtasks.map((st, i) => ({
    id: st.id || `sub_${i}_${crypto.randomUUID().slice(0, 6)}`,
    title: String(st.title || st || '').trim(),
    completed: Boolean(st.completed)
  })).filter(st => Boolean(st.title));

  const task = {
    id: taskId,
    uid,
    title,
    description: String(taskData.description || '').trim(),
    status: taskData.status === 'completed' ? 'completed' : 'pending',
    priority,
    category: String(taskData.category || 'Study & Academics').trim(),
    listId: String(taskData.listId || 'study').trim(),
    dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
    dueTime: taskData.dueTime ? String(taskData.dueTime).trim() : null,
    startDate: taskData.startDate ? new Date(taskData.startDate).toISOString() : null,
    startTime: taskData.startTime ? String(taskData.startTime).trim() : null,
    reminder: taskData.reminder || null,
    recurrence: ['none', 'daily', 'weekly', 'monthly', 'custom'].includes(taskData.recurrence)
      ? taskData.recurrence
      : 'none',
    recurrenceInterval: Number(taskData.recurrenceInterval) || 1,
    subtasks,
    tags: Array.isArray(taskData.tags) ? taskData.tags.map(t => String(t).trim()).filter(Boolean) : [],
    order: Number.isInteger(taskData.order) ? taskData.order : Date.now(),
    completionHistory: [],
    completedAt: taskData.status === 'completed' ? now : null,
    createdAt: now,
    updatedAt: now
  };

  await tasksRef.doc(taskId).set(cleanForFirestore(task));
  return task;
}

/**
 * Update an existing task.
 */
export async function updateTask(uid, taskId, updates) {
  const { tasksRef } = getUserCollections(uid);
  const docRef = tasksRef.doc(taskId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Task not found');

  const current = doc.data();
  const allowed = [
    'title', 'description', 'status', 'priority', 'category', 'listId',
    'dueDate', 'dueTime', 'startDate', 'startTime', 'reminder',
    'recurrence', 'recurrenceInterval', 'subtasks', 'tags', 'order'
  ];

  const toUpdate = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) {
      if (k === 'dueDate' || k === 'startDate') {
        toUpdate[k] = updates[k] ? new Date(updates[k]).toISOString() : null;
      } else if (k === 'subtasks' && Array.isArray(updates[k])) {
        toUpdate[k] = updates[k].map((st, i) => ({
          id: st.id || `sub_${i}_${crypto.randomUUID().slice(0, 6)}`,
          title: String(st.title || st || '').trim(),
          completed: Boolean(st.completed)
        })).filter(st => Boolean(st.title));
      } else {
        toUpdate[k] = updates[k];
      }
    }
  }

  // Handle status toggle if provided
  if (updates.status && updates.status !== current.status) {
    if (updates.status === 'completed') {
      toUpdate.completedAt = new Date().toISOString();
      const hist = Array.isArray(current.completionHistory) ? [...current.completionHistory] : [];
      hist.push(toUpdate.completedAt);
      toUpdate.completionHistory = hist;

      // If task is recurring, calculate next due date
      if (current.recurrence && current.recurrence !== 'none' && current.dueDate) {
        const nextDue = calculateNextDueDate(current.dueDate, current.recurrence, current.recurrenceInterval);
        if (nextDue) {
          toUpdate.dueDate = nextDue;
          toUpdate.status = 'pending'; // Auto-reopen for the next occurrence!
          toUpdate.completedAt = null;
        }
      }
    } else {
      toUpdate.completedAt = null;
    }
  }

  toUpdate.updatedAt = new Date().toISOString();
  await docRef.update(cleanForFirestore(toUpdate));
  return { ...current, ...toUpdate };
}

/**
 * Toggle task completion status.
 */
export async function toggleTask(uid, taskId) {
  const { tasksRef } = getUserCollections(uid);
  const docRef = tasksRef.doc(taskId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Task not found');

  const current = doc.data();
  const newStatus = current.status === 'completed' ? 'pending' : 'completed';
  return updateTask(uid, taskId, { status: newStatus });
}

/**
 * Delete a task.
 */
export async function deleteTask(uid, taskId) {
  const { tasksRef } = getUserCollections(uid);
  const docRef = tasksRef.doc(taskId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Task not found');
  await docRef.delete();
  return { success: true, deletedTaskId: taskId };
}

/**
 * Get single task by ID.
 */
export async function getTask(uid, taskId) {
  const { tasksRef } = getUserCollections(uid);
  const doc = await tasksRef.doc(taskId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Query tasks with filters, sorting, and search.
 */
export async function getTasks(uid, options = {}) {
  const { tasksRef } = getUserCollections(uid);
  let query = tasksRef;

  if (options.status) {
    query = query.where('status', '==', options.status);
  }
  if (options.listId) {
    query = query.where('listId', '==', options.listId);
  }
  if (options.priority) {
    query = query.where('priority', '==', options.priority);
  }

  const snap = await query.get();
  let tasks = [];
  snap.forEach(doc => {
    tasks.push({ id: doc.id, ...doc.data() });
  });

  // Client-side / in-memory filtering for date ranges & search query
  if (options.search) {
    const q = options.search.toLowerCase();
    tasks = tasks.filter(t => 
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  }

  if (options.startDate) {
    const start = new Date(options.startDate).getTime();
    tasks = tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() >= start);
  }

  if (options.endDate) {
    const end = new Date(options.endDate).getTime();
    tasks = tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() <= end);
  }

  // Date specific filter (e.g. date: 'YYYY-MM-DD' or 'today')
  if (options.date) {
    const targetDateStr = options.date === 'today'
      ? new Date().toISOString().slice(0, 10)
      : options.date.slice(0, 10);
    tasks = tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === targetDateStr);
  }

  // Sorting
  const sortBy = options.sortBy || 'order';
  const sortDir = options.sortDir === 'desc' ? -1 : 1;

  tasks.sort((a, b) => {
    if (sortBy === 'priority') {
      const pWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
      const diff = (pWeights[a.priority] || 2) - (pWeights[b.priority] || 2);
      return diff !== 0 ? diff * sortDir : (a.order - b.order);
    }
    if (sortBy === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) * sortDir;
    }
    if (sortBy === 'createdAt') {
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title) * sortDir;
    }
    return (a.order - b.order) * sortDir;
  });

  if (options.limit && Number.isInteger(options.limit)) {
    tasks = tasks.slice(0, options.limit);
  }

  return tasks;
}

/**
 * Get upcoming schedule (tasks within next N days).
 */
export async function getUpcomingTasks(uid, days = 7) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59).toISOString();

  return getTasks(uid, {
    status: 'pending',
    startDate: startOfDay,
    endDate: endOfDay,
    sortBy: 'dueDate',
    sortDir: 'asc'
  });
}

/**
 * Get daily schedule for a specific date (defaults to today).
 */
export async function getDailySchedule(uid, dateStr = null) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const targetDate = d.toISOString().slice(0, 10);

  const allTasks = await getTasks(uid, {});
  const scheduledTasks = allTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === targetDate);

  scheduledTasks.sort((a, b) => {
    const timeA = a.dueTime || '23:59';
    const timeB = b.dueTime || '23:59';
    return timeA.localeCompare(timeB);
  });

  return {
    date: targetDate,
    total: scheduledTasks.length,
    completed: scheduledTasks.filter(t => t.status === 'completed').length,
    pending: scheduledTasks.filter(t => t.status === 'pending').length,
    tasks: scheduledTasks
  };
}

/**
 * Reorganize / reschedule incomplete tasks to a target date.
 */
export async function rescheduleIncompleteTasks(uid, targetDateStr = null) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const targetDate = targetDateStr ? new Date(targetDateStr).toISOString() : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0).toISOString();

  const allTasks = await getTasks(uid, { status: 'pending' });
  const overdueTasks = allTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) < todayStr);

  const updatedTasks = [];
  for (const t of overdueTasks) {
    const updated = await updateTask(uid, t.id, {
      dueDate: targetDate,
      updatedAt: new Date().toISOString()
    });
    updatedTasks.push(updated);
  }

  return {
    rescheduledCount: updatedTasks.length,
    targetDate,
    tasks: updatedTasks
  };
}

/**
 * Calculate accurate productivity stats from real user data.
 */
export async function getProductivityStats(uid) {
  const allTasks = await getTasks(uid, {});
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  
  // 7 days ago
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let completedToday = 0;
  let completedThisWeek = 0;
  let totalCompleted = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  const categoryCounts = {};
  const priorityCounts = { low: 0, medium: 0, high: 0, urgent: 0 };
  const dailyTrends = {};

  // Initialize last 7 days trend
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().slice(0, 10);
    dailyTrends[dateKey] = { date: dateKey, completed: 0, created: 0 };
  }

  for (const t of allTasks) {
    // Priority count
    if (priorityCounts[t.priority] !== undefined) {
      priorityCounts[t.priority]++;
    }

    // Category count
    const cat = t.category || 'General';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    // Creation trend
    if (t.createdAt) {
      const createdDateKey = t.createdAt.slice(0, 10);
      if (dailyTrends[createdDateKey]) {
        dailyTrends[createdDateKey].created++;
      }
    }

    if (t.status === 'completed') {
      totalCompleted++;
      const completedTime = t.completedAt ? new Date(t.completedAt) : null;
      if (completedTime) {
        const compDateKey = completedTime.toISOString().slice(0, 10);
        if (compDateKey === todayStr) {
          completedToday++;
        }
        if (completedTime >= sevenDaysAgo) {
          completedThisWeek++;
        }
        if (dailyTrends[compDateKey]) {
          dailyTrends[compDateKey].completed++;
        }
      }
    } else {
      pendingCount++;
      // Check overdue
      if (t.dueDate && t.dueDate.slice(0, 10) < todayStr) {
        overdueCount++;
      }
    }
  }

  const totalTasks = allTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  // Find most productive day of week
  const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  allTasks.forEach(t => {
    if (t.status === 'completed' && t.completedAt) {
      const dayIdx = new Date(t.completedAt).getDay();
      dayOfWeekCounts[dayIdx]++;
    }
  });
  let maxDayIdx = 0;
  let maxCount = -1;
  dayOfWeekCounts.forEach((cnt, idx) => {
    if (cnt > maxCount) {
      maxCount = cnt;
      maxDayIdx = idx;
    }
  });
  const mostProductiveDay = maxCount > 0 ? dayOfWeekNames[maxDayIdx] : 'N/A';

  return {
    totalTasks,
    totalCompleted,
    pendingCount,
    overdueCount,
    completedToday,
    completedThisWeek,
    completionRate,
    categoryCounts,
    priorityCounts,
    dailyTrends: Object.values(dailyTrends),
    mostProductiveDay
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 1. HABITS & STREAK MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────

/**
 * Calculates current and longest streak from an array of 'YYYY-MM-DD' dates.
 */
export function calculateStreaks(datesArray, targetDateStr = null) {
  if (!Array.isArray(datesArray) || datesArray.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const uniqueSorted = Array.from(new Set(datesArray.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
  if (uniqueSorted.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Calculate longest streak across history
  let longestStreak = 1;
  let tempStreak = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const prev = new Date(uniqueSorted[i - 1]);
    const curr = new Date(uniqueSorted[i]);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else if (diffDays > 1) {
      tempStreak = 1;
    }
  }

  // Calculate current streak relative to today (or targetDateStr)
  const today = targetDateStr ? new Date(targetDateStr) : new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const set = new Set(uniqueSorted);
  let currentStreak = 0;
  let checkDate = new Date(today);

  // If completed today, count backwards from today.
  // If not completed today, but completed yesterday, count backwards from yesterday.
  if (set.has(todayStr)) {
    while (set.has(checkDate.toISOString().slice(0, 10))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  } else if (set.has(yesterdayStr)) {
    checkDate = new Date(yesterday);
    while (set.has(checkDate.toISOString().slice(0, 10))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) };
}

export async function createHabit(uid, habitData) {
  const { habitsRef } = getUserCollections(uid);
  const title = String(habitData.title || '').trim();
  if (!title) throw new Error('Habit title is required');

  const habitId = habitData.id || `habit_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const frequency = ['daily', 'weekly', 'custom'].includes(habitData.frequency)
    ? habitData.frequency
    : 'daily';

  const habit = {
    id: habitId,
    uid,
    title,
    description: String(habitData.description || '').trim(),
    frequency,
    customDays: Array.isArray(habitData.customDays) ? habitData.customDays : [],
    category: String(habitData.category || 'General').trim(),
    color: habitData.color || '#10b981',
    icon: habitData.icon || 'bi-check2-circle',
    targetCount: Number(habitData.targetCount) || 1,
    reminderTime: habitData.reminderTime ? String(habitData.reminderTime).trim() : null,
    status: habitData.status === 'paused' ? 'paused' : (habitData.status === 'archived' ? 'archived' : 'active'),
    currentStreak: 0,
    longestStreak: 0,
    totalCompletions: 0,
    completionDates: [],
    createdAt: now,
    updatedAt: now
  };

  await habitsRef.doc(habitId).set(cleanForFirestore(habit));
  return habit;
}

export async function getHabits(uid, options = {}) {
  const { habitsRef } = getUserCollections(uid);
  let query = habitsRef;
  if (options.status) {
    query = query.where('status', '==', options.status);
  }
  const snap = await query.get();
  const habits = [];
  snap.forEach(doc => {
    habits.push({ id: doc.id, ...doc.data() });
  });

  habits.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return habits;
}

export async function getHabit(uid, habitId) {
  const { habitsRef } = getUserCollections(uid);
  const doc = await habitsRef.doc(habitId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function updateHabit(uid, habitId, updates) {
  const { habitsRef } = getUserCollections(uid);
  const docRef = habitsRef.doc(habitId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Habit not found');

  const current = doc.data();
  const allowed = [
    'title', 'description', 'frequency', 'customDays', 'category',
    'color', 'icon', 'targetCount', 'reminderTime', 'status'
  ];

  const toUpdate = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) toUpdate[k] = updates[k];
  }
  toUpdate.updatedAt = new Date().toISOString();
  await docRef.update(cleanForFirestore(toUpdate));
  return { ...current, ...toUpdate };
}

export async function toggleHabitCompletion(uid, habitId, dateStr = null) {
  const { habitsRef } = getUserCollections(uid);
  const docRef = habitsRef.doc(habitId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Habit not found');

  const habit = doc.data();
  const targetDate = (dateStr ? dateStr.slice(0, 10) : new Date().toISOString().slice(0, 10));

  let dates = Array.isArray(habit.completionDates) ? [...habit.completionDates] : [];
  const exists = dates.includes(targetDate);

  if (exists) {
    dates = dates.filter(d => d !== targetDate);
  } else {
    dates.push(targetDate);
    dates.sort();
  }

  const { currentStreak, longestStreak } = calculateStreaks(dates);
  const updates = {
    completionDates: dates,
    totalCompletions: dates.length,
    currentStreak,
    longestStreak: Math.max(habit.longestStreak || 0, longestStreak),
    updatedAt: new Date().toISOString()
  };

  await docRef.update(cleanForFirestore(updates));
  return { id: habitId, ...habit, ...updates, toggledDate: targetDate, completed: !exists };
}

export async function deleteHabit(uid, habitId) {
  const { habitsRef } = getUserCollections(uid);
  const docRef = habitsRef.doc(habitId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Habit not found');
  await docRef.delete();
  return { success: true, deletedHabitId: habitId };
}

export async function getHabitStats(uid) {
  const habits = await getHabits(uid, {});
  const activeHabits = habits.filter(h => h.status === 'active');
  const todayStr = new Date().toISOString().slice(0, 10);

  const completedToday = activeHabits.filter(h => Array.isArray(h.completionDates) && h.completionDates.includes(todayStr)).length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.longestStreak || 0), 0);
  const totalCompletions = habits.reduce((sum, h) => sum + (h.totalCompletions || 0), 0);

  return {
    totalHabits: habits.length,
    activeHabits: activeHabits.length,
    completedToday,
    bestStreak,
    totalCompletions,
    habits
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 2. ROUTINE MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────

export async function createRoutine(uid, routineData) {
  const { routinesRef } = getUserCollections(uid);
  const name = String(routineData.name || '').trim();
  if (!name) throw new Error('Routine name is required');

  const routineId = routineData.id || `routine_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const rawActivities = Array.isArray(routineData.activities) ? routineData.activities : [];
  const activities = rawActivities.map((act, i) => ({
    id: act.id || `act_${i}_${crypto.randomUUID().slice(0, 6)}`,
    title: String(act.title || act || '').trim(),
    durationMinutes: Number(act.durationMinutes) || 15,
    category: act.category || 'Study & Academics',
    order: Number.isInteger(act.order) ? act.order : i
  })).filter(a => Boolean(a.title));

  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMinutes, 0);

  const routine = {
    id: routineId,
    uid,
    name,
    description: String(routineData.description || '').trim(),
    category: routineData.category || 'Study',
    activities,
    estimatedMinutes: routineData.estimatedMinutes || totalMinutes,
    scheduledDays: Array.isArray(routineData.scheduledDays) ? routineData.scheduledDays : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    startTime: routineData.startTime ? String(routineData.startTime).trim() : null,
    isActive: routineData.isActive !== false,
    createdAt: now,
    updatedAt: now
  };

  await routinesRef.doc(routineId).set(cleanForFirestore(routine));
  return routine;
}

export async function getRoutines(uid) {
  const { routinesRef } = getUserCollections(uid);
  const snap = await routinesRef.get();
  const routines = [];
  snap.forEach(doc => {
    routines.push({ id: doc.id, ...doc.data() });
  });
  return routines;
}

export async function updateRoutine(uid, routineId, updates) {
  const { routinesRef } = getUserCollections(uid);
  const docRef = routinesRef.doc(routineId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Routine not found');

  const allowed = ['name', 'description', 'category', 'activities', 'estimatedMinutes', 'scheduledDays', 'startTime', 'isActive'];
  const toUpdate = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) toUpdate[k] = updates[k];
  }
  toUpdate.updatedAt = new Date().toISOString();
  await docRef.update(cleanForFirestore(toUpdate));
  return { id: routineId, ...doc.data(), ...toUpdate };
}

export async function deleteRoutine(uid, routineId) {
  const { routinesRef } = getUserCollections(uid);
  const docRef = routinesRef.doc(routineId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Routine not found');
  await docRef.delete();
  return { success: true, deletedRoutineId: routineId };
}

/**
 * Converts routine activities into tasks for a given date, skipping duplicates.
 */
export async function convertRoutineToTasks(uid, routineId, targetDateStr = null) {
  const { routinesRef } = getUserCollections(uid);
  const doc = await routinesRef.doc(routineId).get();
  if (!doc.exists) throw new Error('Routine not found');

  const routine = doc.data();
  const targetDate = targetDateStr ? targetDateStr.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const routineTag = `routine:${routineId}`;

  // Check existing tasks for this date to avoid duplicate creation
  const existingTasks = await getTasks(uid, { date: targetDate });
  const existingTitles = new Set(existingTasks.filter(t => t.tags && t.tags.includes(routineTag)).map(t => t.title.toLowerCase()));

  const createdTasks = [];
  for (const activity of routine.activities || []) {
    if (existingTitles.has(activity.title.toLowerCase())) {
      continue; // Skip duplicate!
    }

    const task = await createTask(uid, {
      title: activity.title,
      description: `Part of ${routine.name} routine (${activity.durationMinutes} mins)`,
      dueDate: targetDate,
      dueTime: routine.startTime || null,
      priority: 'medium',
      category: activity.category || 'Study & Academics',
      tags: [routineTag, 'routine']
    });
    createdTasks.push(task);
  }

  return {
    routineId,
    routineName: routine.name,
    targetDate,
    createdCount: createdTasks.length,
    tasks: createdTasks
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. GOALS & MILESTONES
// ──────────────────────────────────────────────────────────────────────────

export async function createGoal(uid, goalData) {
  const { goalsRef } = getUserCollections(uid);
  const title = String(goalData.title || '').trim();
  if (!title) throw new Error('Goal title is required');

  const goalId = goalData.id || `goal_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const validCategories = ['academic', 'personal', 'health', 'career', 'project', 'custom'];
  const category = validCategories.includes(goalData.category?.toLowerCase())
    ? goalData.category.toLowerCase()
    : 'academic';

  const goal = {
    id: goalId,
    uid,
    title,
    description: String(goalData.description || '').trim(),
    category,
    priority: goalData.priority || 'high',
    startDate: goalData.startDate ? new Date(goalData.startDate).toISOString() : now,
    targetDate: goalData.targetDate ? new Date(goalData.targetDate).toISOString() : null,
    status: goalData.status || 'in_progress', // 'not_started', 'in_progress', 'completed', 'paused'
    progress: 0,
    progressHistory: [{ date: now.slice(0, 10), progress: 0 }],
    associatedTaskIds: Array.isArray(goalData.associatedTaskIds) ? goalData.associatedTaskIds : [],
    createdAt: now,
    updatedAt: now
  };

  await goalsRef.doc(goalId).set(cleanForFirestore(goal));
  return goal;
}

export async function getGoals(uid, options = {}) {
  const { goalsRef } = getUserCollections(uid);
  let query = goalsRef;
  if (options.status) {
    query = query.where('status', '==', options.status);
  }
  const snap = await query.get();
  const goals = [];
  snap.forEach(doc => {
    goals.push({ id: doc.id, ...doc.data() });
  });

  goals.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return goals;
}

export async function getGoal(uid, goalId) {
  const { goalsRef } = getUserCollections(uid);
  const doc = await goalsRef.doc(goalId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function updateGoal(uid, goalId, updates) {
  const { goalsRef } = getUserCollections(uid);
  const docRef = goalsRef.doc(goalId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Goal not found');

  const allowed = [
    'title', 'description', 'category', 'priority',
    'startDate', 'targetDate', 'status', 'associatedTaskIds'
  ];
  const toUpdate = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) toUpdate[k] = updates[k];
  }
  toUpdate.updatedAt = new Date().toISOString();
  await docRef.update(cleanForFirestore(toUpdate));
  return { id: goalId, ...doc.data(), ...toUpdate };
}

export async function deleteGoal(uid, goalId) {
  const { goalsRef, milestonesRef } = getUserCollections(uid);
  const docRef = goalsRef.doc(goalId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Goal not found');

  // Also delete associated milestones
  const mSnap = await milestonesRef.where('goalId', '==', goalId).get();
  const batch = getDb().batch();
  mSnap.forEach(mDoc => batch.delete(mDoc.ref));
  batch.delete(docRef);
  await batch.commit();

  return { success: true, deletedGoalId: goalId };
}

export async function createMilestone(uid, milestoneData) {
  const { milestonesRef } = getUserCollections(uid);
  const goalId = String(milestoneData.goalId || '').trim();
  const title = String(milestoneData.title || '').trim();
  if (!goalId) throw new Error('goalId is required for milestone');
  if (!title) throw new Error('Milestone title is required');

  const milestoneId = milestoneData.id || `ms_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const milestone = {
    id: milestoneId,
    uid,
    goalId,
    title,
    description: String(milestoneData.description || '').trim(),
    targetDate: milestoneData.targetDate ? new Date(milestoneData.targetDate).toISOString() : null,
    status: milestoneData.status === 'completed' ? 'completed' : 'pending',
    order: Number.isInteger(milestoneData.order) ? milestoneData.order : Date.now(),
    associatedTaskIds: Array.isArray(milestoneData.associatedTaskIds) ? milestoneData.associatedTaskIds : [],
    completedAt: milestoneData.status === 'completed' ? now : null,
    createdAt: now,
    updatedAt: now
  };

  await milestonesRef.doc(milestoneId).set(cleanForFirestore(milestone));
  await recalculateGoalProgress(uid, goalId);
  return milestone;
}

export async function getMilestonesByGoal(uid, goalId) {
  const { milestonesRef } = getUserCollections(uid);
  const snap = await milestonesRef.where('goalId', '==', goalId).get();
  const milestones = [];
  snap.forEach(doc => {
    milestones.push({ id: doc.id, ...doc.data() });
  });
  milestones.sort((a, b) => (a.order || 0) - (b.order || 0));
  return milestones;
}

export async function updateMilestone(uid, milestoneId, updates) {
  const { milestonesRef } = getUserCollections(uid);
  const docRef = milestonesRef.doc(milestoneId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Milestone not found');

  const current = doc.data();
  const allowed = ['title', 'description', 'targetDate', 'status', 'order', 'associatedTaskIds'];
  const toUpdate = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) toUpdate[k] = updates[k];
  }

  if (updates.status && updates.status !== current.status) {
    toUpdate.completedAt = updates.status === 'completed' ? new Date().toISOString() : null;
  }
  toUpdate.updatedAt = new Date().toISOString();

  await docRef.update(cleanForFirestore(toUpdate));
  await recalculateGoalProgress(uid, current.goalId);
  return { id: milestoneId, ...current, ...toUpdate };
}

export async function deleteMilestone(uid, milestoneId) {
  const { milestonesRef } = getUserCollections(uid);
  const docRef = milestonesRef.doc(milestoneId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Milestone not found');
  const goalId = doc.data().goalId;
  await docRef.delete();
  await recalculateGoalProgress(uid, goalId);
  return { success: true, deletedMilestoneId: milestoneId };
}

/**
 * Calculates progress % strictly from actual milestone and task data, not arbitrary estimates.
 */
export async function recalculateGoalProgress(uid, goalId) {
  const { goalsRef } = getUserCollections(uid);
  const goalDoc = await goalsRef.doc(goalId).get();
  if (!goalDoc.exists) return null;

  const milestones = await getMilestonesByGoal(uid, goalId);
  let progress = 0;

  if (milestones.length > 0) {
    const completed = milestones.filter(m => m.status === 'completed').length;
    progress = Math.round((completed / milestones.length) * 100);
  } else {
    // If no milestones, check associated tasks
    const goal = goalDoc.data();
    if (goal.associatedTaskIds && goal.associatedTaskIds.length > 0) {
      const allTasks = await getTasks(uid, {});
      const linked = allTasks.filter(t => goal.associatedTaskIds.includes(t.id));
      if (linked.length > 0) {
        const completedTasks = linked.filter(t => t.status === 'completed').length;
        progress = Math.round((completedTasks / linked.length) * 100);
      }
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentData = goalDoc.data();
  const history = Array.isArray(currentData.progressHistory) ? [...currentData.progressHistory] : [];
  
  // Update or append today's progress history entry
  const existingIdx = history.findIndex(h => h.date === todayStr);
  if (existingIdx >= 0) {
    history[existingIdx].progress = progress;
  } else {
    history.push({ date: todayStr, progress });
  }

  const status = progress === 100 ? 'completed' : (progress > 0 ? 'in_progress' : currentData.status);
  const updates = {
    progress,
    progressHistory: history,
    status,
    updatedAt: new Date().toISOString()
  };

  await goalsRef.doc(goalId).update(cleanForFirestore(updates));
  return { id: goalId, ...currentData, ...updates };
}

// ──────────────────────────────────────────────────────────────────────────
// 4. FOCUS MODE & SESSIONS
// ──────────────────────────────────────────────────────────────────────────

export async function startFocusSession(uid, sessionData) {
  const { focusSessionsRef } = getUserCollections(uid);
  const sessionId = sessionData.id || `focus_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const durationMinutes = Number(sessionData.durationMinutes) || 25;

  const session = {
    id: sessionId,
    uid,
    taskId: sessionData.taskId || null,
    taskTitle: sessionData.taskTitle || 'Focus Session',
    startTime: now,
    endTime: null,
    durationMinutes,
    actualMinutes: 0,
    breakMinutes: Number(sessionData.breakMinutes) || 5,
    intervals: sessionData.intervals || 1,
    status: 'in_progress', // 'in_progress', 'completed', 'abandoned'
    notes: sessionData.notes || '',
    createdAt: now
  };

  await focusSessionsRef.doc(sessionId).set(cleanForFirestore(session));
  return session;
}

export async function completeFocusSession(uid, sessionId, updates = {}) {
  const { focusSessionsRef } = getUserCollections(uid);
  const docRef = focusSessionsRef.doc(sessionId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Focus session not found');

  const current = doc.data();
  const now = new Date().toISOString();
  const actualMinutes = updates.actualMinutes !== undefined
    ? Number(updates.actualMinutes)
    : Math.max(1, Math.round((new Date(now) - new Date(current.startTime)) / (1000 * 60)));

  const finalUpdates = {
    endTime: now,
    actualMinutes,
    status: updates.status || 'completed',
    notes: updates.notes !== undefined ? updates.notes : current.notes
  };

  await docRef.update(cleanForFirestore(finalUpdates));
  return { id: sessionId, ...current, ...finalUpdates };
}

export async function getFocusSessions(uid, options = {}) {
  const { focusSessionsRef } = getUserCollections(uid);
  let query = focusSessionsRef;
  const snap = await query.get();
  const sessions = [];
  snap.forEach(doc => {
    sessions.push({ id: doc.id, ...doc.data() });
  });

  sessions.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
  if (options.limit && Number.isInteger(options.limit)) {
    return sessions.slice(0, options.limit);
  }
  return sessions;
}

export async function getFocusStats(uid) {
  const sessions = await getFocusSessions(uid, {});
  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let totalMinutes = 0;
  let todayMinutes = 0;
  let weekMinutes = 0;
  let completedSessions = 0;
  const taskDistribution = {};

  for (const s of sessions) {
    if (s.status === 'completed') {
      completedSessions++;
      const mins = s.actualMinutes || s.durationMinutes || 0;
      totalMinutes += mins;

      const dateStr = s.startTime ? s.startTime.slice(0, 10) : '';
      if (dateStr === todayStr) {
        todayMinutes += mins;
      }
      if (s.startTime && new Date(s.startTime) >= sevenDaysAgo) {
        weekMinutes += mins;
      }

      const taskName = s.taskTitle || 'General Focus';
      taskDistribution[taskName] = (taskDistribution[taskName] || 0) + mins;
    }
  }

  return {
    totalMinutes,
    todayMinutes,
    weekMinutes,
    completedSessions,
    taskDistribution,
    recentSessions: sessions.slice(0, 10)
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 5. SMART TIME BLOCKING
// ──────────────────────────────────────────────────────────────────────────

export async function createTimeBlock(uid, blockData) {
  const { timeBlocksRef } = getUserCollections(uid);
  const title = String(blockData.title || '').trim();
  const date = String(blockData.date || '').slice(0, 10);
  const startTime = String(blockData.startTime || '').trim();
  const endTime = String(blockData.endTime || '').trim();

  if (!title) throw new Error('Time block title is required');
  if (!date) throw new Error('Time block date (YYYY-MM-DD) is required');
  if (!startTime || !endTime) throw new Error('Both startTime and endTime (HH:mm) are required');

  const blockId = blockData.id || `block_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  // Check for conflicts
  const conflicts = await detectConflicts(uid, { date, startTime, endTime });

  const block = {
    id: blockId,
    uid,
    title,
    description: String(blockData.description || '').trim(),
    date,
    startTime,
    endTime,
    taskId: blockData.taskId || null,
    category: blockData.category || 'Study',
    color: blockData.color || '#3b82f6',
    type: blockData.type || 'focus', // 'focus', 'task', 'break', 'meeting', 'routine'
    isBreak: Boolean(blockData.isBreak),
    createdAt: now,
    updatedAt: now
  };

  await timeBlocksRef.doc(blockId).set(cleanForFirestore(block));
  return { ...block, hasConflicts: conflicts.length > 0, conflicts };
}

export async function getTimeBlocks(uid, options = {}) {
  const { timeBlocksRef } = getUserCollections(uid);
  let query = timeBlocksRef;
  if (options.date) {
    query = query.where('date', '==', options.date.slice(0, 10));
  }
  const snap = await query.get();
  const blocks = [];
  snap.forEach(doc => {
    blocks.push({ id: doc.id, ...doc.data() });
  });

  blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return blocks;
}

export async function updateTimeBlock(uid, blockId, updates) {
  const { timeBlocksRef } = getUserCollections(uid);
  const docRef = timeBlocksRef.doc(blockId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Time block not found');

  const allowed = ['title', 'description', 'date', 'startTime', 'endTime', 'taskId', 'category', 'color', 'type', 'isBreak'];
  const toUpdate = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) toUpdate[k] = updates[k];
  }
  toUpdate.updatedAt = new Date().toISOString();
  await docRef.update(cleanForFirestore(toUpdate));
  return { id: blockId, ...doc.data(), ...toUpdate };
}

export async function deleteTimeBlock(uid, blockId) {
  const { timeBlocksRef } = getUserCollections(uid);
  const docRef = timeBlocksRef.doc(blockId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Time block not found');
  await docRef.delete();
  return { success: true, deletedBlockId: blockId };
}

export async function detectConflicts(uid, { date, startTime, endTime, excludeId = null }) {
  const blocks = await getTimeBlocks(uid, { date });
  const conflicts = [];

  for (const b of blocks) {
    if (excludeId && b.id === excludeId) continue;
    // Overlap condition: startA < endB && endA > startB
    if (startTime < b.endTime && endTime > b.startTime) {
      conflicts.push(b);
    }
  }

  return conflicts;
}

export async function getAvailableSlots(uid, { date, minDurationMinutes = 30 }) {
  const settings = await getSettings(uid);
  const workStart = settings.workStartTime || '09:00';
  const workEnd = settings.workEndTime || '21:00';

  const blocks = await getTimeBlocks(uid, { date: date || new Date().toISOString().slice(0, 10) });
  blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const slots = [];
  let cursor = workStart;

  for (const b of blocks) {
    if (b.startTime > cursor) {
      // Calculate gap duration in minutes
      const [cH, cM] = cursor.split(':').map(Number);
      const [bH, bM] = b.startTime.split(':').map(Number);
      const gapMins = (bH * 60 + bM) - (cH * 60 + cM);
      if (gapMins >= minDurationMinutes) {
        slots.push({ startTime: cursor, endTime: b.startTime, durationMinutes: gapMins });
      }
    }
    if (b.endTime > cursor) {
      cursor = b.endTime;
    }
  }

  // After the last block
  if (cursor < workEnd) {
    const [cH, cM] = cursor.split(':').map(Number);
    const [eH, eM] = workEnd.split(':').map(Number);
    const gapMins = (eH * 60 + eM) - (cH * 60 + cM);
    if (gapMins >= minDurationMinutes) {
      slots.push({ startTime: cursor, endTime: workEnd, durationMinutes: gapMins });
    }
  }

  return slots;
}

// ──────────────────────────────────────────────────────────────────────────
// 6. WEEKLY REVIEW & PRODUCTIVITY INSIGHTS
// ──────────────────────────────────────────────────────────────────────────

export async function generateWeeklyReview(uid) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fetch real data across all modules
  const allTasks = await getTasks(uid, {});
  const habits = await getHabits(uid, {});
  const goals = await getGoals(uid, {});
  const focusStats = await getFocusStats(uid);

  // Tasks analysis
  const completedThisWeek = allTasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo);
  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const upcomingDeadlines = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= sevenDaysAhead);
  const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);

  // Habits consistency
  let habitConsistency = 0;
  if (habits.length > 0) {
    const activeHabits = habits.filter(h => h.status === 'active');
    let totalCompletionsLast7Days = 0;
    const past7DateStrs = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      past7DateStrs.push(d.toISOString().slice(0, 10));
    }

    activeHabits.forEach(h => {
      const completions = (h.completionDates || []).filter(d => past7DateStrs.includes(d)).length;
      totalCompletionsLast7Days += completions;
    });

    const expectedTotal = activeHabits.length * 7;
    habitConsistency = expectedTotal > 0 ? Math.round((totalCompletionsLast7Days / expectedTotal) * 100) : 0;
  }

  // Goals progress
  const activeGoals = goals.filter(g => g.status !== 'completed');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return {
    period: {
      startDate: sevenDaysAgo.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10)
    },
    tasks: {
      completedCount: completedThisWeek.length,
      pendingCount: pendingTasks.length,
      overdueCount: overdueTasks.length,
      upcomingDeadlinesCount: upcomingDeadlines.length,
      completedList: completedThisWeek.slice(0, 10).map(t => ({ id: t.id, title: t.title, category: t.category })),
      upcomingList: upcomingDeadlines.slice(0, 10).map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority }))
    },
    habits: {
      totalActive: habits.filter(h => h.status === 'active').length,
      consistencyPercentage: habitConsistency,
      habitsList: habits.map(h => ({ id: h.id, title: h.title, streak: h.currentStreak, total: h.totalCompletions }))
    },
    goals: {
      activeCount: activeGoals.length,
      completedCount: completedGoals.length,
      goalsList: goals.map(g => ({ id: g.id, title: g.title, progress: g.progress, priority: g.priority }))
    },
    focus: {
      weekMinutes: focusStats.weekMinutes,
      completedSessions: focusStats.completedSessions,
      taskDistribution: focusStats.taskDistribution
    }
  };
}
