/**
 * NeoCalender/neocalender.test.js
 *
 * Unit and integration tests for NeoCalender:
 * - Data sanitization (cleanForFirestore)
 * - Recurrence nextDueDate calculation
 * - AI Intent detection (positive & negative cases)
 * - Controlled AI Tool execution & confirmation barriers
 * - Mock database tests for tasks CRUD, lists, settings, and productivity stats
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanForFirestore,
  calculateNextDueDate,
  calculateStreaks,
  createTask,
  updateTask,
  toggleTask,
  deleteTask,
  getTask,
  getTasks,
  getDailySchedule,
  getProductivityStats,
  createList,
  updateList,
  deleteList,
  getLists,
  getSettings,
  updateSettings,
  createHabit,
  getHabits,
  toggleHabitCompletion,
  deleteHabit,
  getHabitStats,
  createRoutine,
  getRoutines,
  convertRoutineToTasks,
  deleteRoutine,
  createGoal,
  getGoals,
  createMilestone,
  getMilestonesByGoal,
  updateMilestone,
  deleteMilestone,
  deleteGoal,
  startFocusSession,
  completeFocusSession,
  getFocusSessions,
  getFocusStats,
  createTimeBlock,
  getTimeBlocks,
  detectConflicts,
  getAvailableSlots,
  deleteTimeBlock,
  generateWeeklyReview,
  setNeoCalenderDb,
  DEFAULT_LISTS,
  DEFAULT_SETTINGS
} from './neocalender-service.js';
import {
  detectNeoCalenderIntent,
  executeNeoCalenderTool,
  NEOCALENDER_TOOL_DECLARATIONS,
  processNeoCalenderAIRequest
} from './neocalender-ai-tools.js';
import { AI_FEATURES } from '../services/aiUsageTracker.js';
import { FEATURE_LABELS } from '../js/ai-usage-dashboard-model.js';
import { neocalenderQuota } from '../middleware/quotaByUID.js';

test('cleanForFirestore strips undefined fields while keeping null and nested structures', () => {
  const input = {
    title: 'Study Physics',
    dueTime: undefined,
    description: null,
    priority: 'high',
    subtasks: [
      { id: '1', title: 'Chapter 1', completed: false, extra: undefined },
      { id: '2', title: 'Chapter 2', completed: true }
    ],
    metadata: {
      tags: ['exam', 'science'],
      emptyField: undefined
    }
  };

  const cleaned = cleanForFirestore(input);

  assert.equal(cleaned.title, 'Study Physics');
  assert.equal('dueTime' in cleaned, false);
  assert.equal(cleaned.description, null);
  assert.equal(cleaned.priority, 'high');
  assert.equal(cleaned.subtasks.length, 2);
  assert.equal('extra' in cleaned.subtasks[0], false);
  assert.equal('emptyField' in cleaned.metadata, false);
  assert.deepEqual(cleaned.metadata.tags, ['exam', 'science']);
});

test('calculateNextDueDate computes future dates accurately across intervals', () => {
  const baseDate = '2026-11-20T10:00:00.000Z';

  // Daily
  const nextDaily = calculateNextDueDate(baseDate, 'daily', 1);
  assert.equal(nextDaily.slice(0, 10), '2026-11-21');

  // Weekly
  const nextWeekly = calculateNextDueDate(baseDate, 'weekly', 1);
  assert.equal(nextWeekly.slice(0, 10), '2026-11-27');

  // Monthly
  const nextMonthly = calculateNextDueDate(baseDate, 'monthly', 1);
  assert.equal(nextMonthly.slice(0, 10), '2026-12-20');

  // Custom 3 days
  const nextCustom = calculateNextDueDate(baseDate, 'custom', 3);
  assert.equal(nextCustom.slice(0, 10), '2026-11-23');

  // None
  assert.equal(calculateNextDueDate(baseDate, 'none'), null);
  // Invalid
  assert.equal(calculateNextDueDate('invalid-date', 'daily'), null);
});

test('detectNeoCalenderIntent accurately classifies productivity queries vs normal queries', () => {
  const positiveQueries = [
    'Create a task to complete Chemistry Chapter 3 tomorrow at 5 PM',
    'Plan my entire day',
    'What tasks are pending?',
    'What do I have planned for tomorrow?',
    'Add Mathematics revision to my schedule',
    'Show my pending tasks',
    'How many tasks did I complete this week?',
    'Reschedule my incomplete tasks',
    'Help me plan my study routine',
    'Set a reminder to submit my project on Friday',
    'What is on my calendar today?',
    'Show me today agenda'
  ];

  for (const q of positiveQueries) {
    assert.equal(
      detectNeoCalenderIntent(q),
      true,
      `Expected "${q}" to be detected as NeoCalender intent`
    );
  }

  const negativeQueries = [
    'What is Newton third law of motion?',
    'Explain photosynthesis in plants',
    'Solve the quadratic equation x^2 + 5x + 6 = 0',
    'Who is Shubham Singh?',
    'What is the syllabus for class 10 science?'
  ];

  for (const q of negativeQueries) {
    assert.equal(
      detectNeoCalenderIntent(q),
      false,
      `Expected "${q}" NOT to be detected as NeoCalender intent`
    );
  }
});

test('NEOCALENDER_TOOL_DECLARATIONS exposes required schemas for Gemini function calling', () => {
  assert.ok(Array.isArray(NEOCALENDER_TOOL_DECLARATIONS));
  const toolNames = NEOCALENDER_TOOL_DECLARATIONS.map(t => t.name);

  assert.ok(toolNames.includes('createTask'));
  assert.ok(toolNames.includes('getTasks'));
  assert.ok(toolNames.includes('getUpcomingTasks'));
  assert.ok(toolNames.includes('getDailySchedule'));
  assert.ok(toolNames.includes('rescheduleIncompleteTasks'));
  assert.ok(toolNames.includes('getProductivityStats'));
  assert.ok(toolNames.includes('deleteTask'));
  assert.ok(toolNames.includes('updateTask'));

  const createTaskTool = NEOCALENDER_TOOL_DECLARATIONS.find(t => t.name === 'createTask');
  assert.deepEqual(createTaskTool.parameters.required, ['title']);
});

test('executeNeoCalenderTool enforces authentication and confirmation gates', async () => {
  // 1. Missing UID throws
  await assert.rejects(
    () => executeNeoCalenderTool(null, 'getTasks'),
    /Authentication required/
  );

  // 2. Destructive action without confirmation: deleteTask
  const deleteResult = await executeNeoCalenderTool('test-user-123', 'deleteTask', {
    taskId: 'task_abc',
    confirmed: false
  });
  assert.equal(deleteResult.success, false);
  assert.equal(deleteResult.requiresConfirmation, true);
  assert.equal(deleteResult.action, 'deleteTask');

  // 3. Destructive action without confirmation: rescheduleIncompleteTasks
  const rescheduleResult = await executeNeoCalenderTool('test-user-123', 'rescheduleIncompleteTasks', {
    confirmed: false
  });
  assert.equal(rescheduleResult.success, false);
  assert.equal(rescheduleResult.requiresConfirmation, true);
  assert.equal(rescheduleResult.action, 'rescheduleIncompleteTasks');

  // 4. Unknown tool returns clear error
  const unknownResult = await executeNeoCalenderTool('test-user-123', 'nonExistentTool', {});
  assert.equal(unknownResult.success, false);
  assert.match(unknownResult.error, /Unknown NeoCalender tool/);
});

test('DEFAULT_LISTS and DEFAULT_SETTINGS provide complete initial states', () => {
  assert.ok(DEFAULT_LISTS.length >= 4);
  const defaultList = DEFAULT_LISTS.find(l => l.isDefault);
  assert.ok(defaultList);
  assert.equal(defaultList.id, 'study');

  assert.equal(DEFAULT_SETTINGS.remindersEnabled, true);
  assert.equal(DEFAULT_SETTINGS.notificationPref, 'all');
  assert.equal(DEFAULT_SETTINGS.defaultPriority, 'medium');
  assert.equal(DEFAULT_SETTINGS.weekStartDay, 'monday');
  assert.equal(DEFAULT_SETTINGS.aiAutonomy, 'confirm_destructive');
});

// ── In-Memory Firestore Mock Tests ──────────────────────────────────────────

function createInMemoryDb() {
  const store = new Map(); // key: path, val: data

  const makeDocRef = (path) => ({
    path,
    get: async () => ({
      exists: store.has(path),
      id: path.split('/').pop(),
      data: () => store.get(path)
    }),
    set: async (data, opts = {}) => {
      if (opts.merge && store.has(path)) {
        store.set(path, { ...store.get(path), ...data });
      } else {
        store.set(path, data);
      }
    },
    update: async (data) => {
      if (!store.has(path)) throw new Error('Document not found');
      store.set(path, { ...store.get(path), ...data });
    },
    delete: async () => {
      store.delete(path);
    }
  });

  const makeCollectionRef = (colPath) => ({
    doc: (docId) => makeDocRef(`${colPath}/${docId}`),
    limit: () => ({
      get: async () => {
        const docs = [];
        for (const [p, d] of store.entries()) {
          if (p.startsWith(colPath + '/') && p.split('/').length === colPath.split('/').length + 1) {
            docs.push({ id: p.split('/').pop(), data: () => d, exists: true });
            break;
          }
        }
        return { empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
      }
    }),
    orderBy: () => ({
      get: async () => {
        const docs = [];
        for (const [p, d] of store.entries()) {
          if (p.startsWith(colPath + '/') && p.split('/').length === colPath.split('/').length + 1) {
            docs.push({ id: p.split('/').pop(), data: () => d, exists: true });
          }
        }
        return { empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
      }
    }),
    where: (field, op, val) => ({
      get: async () => {
        const docs = [];
        for (const [p, d] of store.entries()) {
          if (p.startsWith(colPath + '/') && p.split('/').length === colPath.split('/').length + 1) {
            if (op === '==' && d[field] === val) {
              docs.push({ id: p.split('/').pop(), data: () => d, ref: makeDocRef(p), exists: true });
            }
          }
        }
        return { empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
      }
    }),
    get: async () => {
      const docs = [];
      for (const [p, d] of store.entries()) {
        if (p.startsWith(colPath + '/') && p.split('/').length === colPath.split('/').length + 1) {
          docs.push({ id: p.split('/').pop(), data: () => d, exists: true });
        }
      }
      return { empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
    }
  });

  return {
    collection: (col) => {
      if (col === 'users') {
        return {
          doc: (uid) => ({
            collection: (subCol) => makeCollectionRef(`users/${uid}/${subCol}`)
          })
        };
      }
      return makeCollectionRef(col);
    },
    batch: () => {
      const ops = [];
      return {
        set: (ref, data) => ops.push(() => ref.set(data)),
        update: (ref, data) => ops.push(() => ref.update(data)),
        delete: (ref) => ops.push(() => ref.delete()),
        commit: async () => {
          for (const op of ops) await op();
        }
      };
    }
  };
}

test('NeoCalender Service: Task CRUD, recurring auto-advance, and productivity stats in mock DB', async () => {
  const mockDb = createInMemoryDb();
  setNeoCalenderDb(mockDb);

  const testUid = 'user_student_1';

  // 1. Create a non-recurring task
  const task1 = await createTask(testUid, {
    title: 'Study Physics Chapter 4',
    description: 'Solve numericals 1-10',
    priority: 'high',
    dueDate: '2026-11-23T17:00:00.000Z',
    dueTime: '17:00',
    subtasks: ['Section 4.1 Notes', 'Problem 1-5', 'Problem 6-10']
  });

  assert.equal(task1.title, 'Study Physics Chapter 4');
  assert.equal(task1.priority, 'high');
  assert.equal(task1.subtasks.length, 3);
  assert.equal(task1.status, 'pending');

  // 2. Fetch task by ID
  const fetchedTask1 = await getTask(testUid, task1.id);
  assert.ok(fetchedTask1);
  assert.equal(fetchedTask1.id, task1.id);

  // 3. Create a recurring task (Daily)
  const task2 = await createTask(testUid, {
    title: 'Daily Math Practice',
    priority: 'urgent',
    dueDate: '2026-11-21T18:00:00.000Z',
    dueTime: '18:00',
    recurrence: 'daily'
  });

  assert.equal(task2.recurrence, 'daily');

  // 4. Complete the recurring task: should advance dueDate to next day and remain pending!
  const toggledRecurring = await toggleTask(testUid, task2.id);
  assert.equal(toggledRecurring.status, 'pending'); // auto-advances to next occurrence
  assert.equal(toggledRecurring.dueDate.slice(0, 10), '2026-11-22');
  assert.equal(toggledRecurring.completionHistory.length, 1);

  // 5. Complete task1 normally
  const toggledTask1 = await toggleTask(testUid, task1.id);
  assert.equal(toggledTask1.status, 'completed');

  // 6. Productivity statistics
  const stats = await getProductivityStats(testUid);
  assert.equal(stats.totalTasks, 2);
  assert.equal(stats.totalCompleted, 1);
  assert.equal(stats.pendingCount, 1);
  assert.equal(stats.completionRate, 50);

  // 7. Get Daily Schedule
  const schedule = await getDailySchedule(testUid, '2026-11-22');
  assert.equal(schedule.total, 1);
  assert.equal(schedule.tasks[0].title, 'Daily Math Practice');

  // 8. Custom list creation and update
  const newList = await createList(testUid, {
    name: 'Olympiad Training',
    color: '#8b5cf6',
    icon: 'bi-trophy'
  });
  assert.equal(newList.name, 'Olympiad Training');

  const updatedList = await updateList(testUid, newList.id, { name: 'Math Olympiad' });
  assert.equal(updatedList.name, 'Math Olympiad');

  // 9. Settings
  const settings = await getSettings(testUid);
  assert.equal(settings.remindersEnabled, true);

  const updatedSettings = await updateSettings(testUid, { defaultPriority: 'urgent', preferredView: 'week' });
  assert.equal(updatedSettings.defaultPriority, 'urgent');
  assert.equal(updatedSettings.preferredView, 'week');

  // 10. Delete task
  const delRes = await deleteTask(testUid, task1.id);
  assert.equal(delRes.success, true);
  const deletedFetch = await getTask(testUid, task1.id);
  assert.equal(deletedFetch, null);
});

test('calculateStreaks computes current and longest streak from historical dates', () => {
  const dates = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'];
  const res = calculateStreaks(dates, '2026-11-21');
  assert.equal(res.currentStreak, 4);
  assert.equal(res.longestStreak, 4);

  // With a gap: [10, 11, 12, 14, 15] relative to 15
  const gapped = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-14', '2026-11-15'];
  const res2 = calculateStreaks(gapped, '2026-11-15');
  assert.equal(res2.currentStreak, 2);
  assert.equal(res2.longestStreak, 3);
});

test('NeoCalender Habits: Create, toggle check-ins, and track streaks', async () => {
  const mockDb = createInMemoryDb();
  setNeoCalenderDb(mockDb);
  const uid = 'user_habit_test';

  const habit = await createHabit(uid, {
    title: 'Solve 5 Physics Numericals',
    frequency: 'daily',
    category: 'Study'
  });

  assert.equal(habit.title, 'Solve 5 Physics Numericals');
  assert.equal(habit.currentStreak, 0);

  // Toggle completion for today
  const today = new Date().toISOString().slice(0, 10);
  const toggled = await toggleHabitCompletion(uid, habit.id, today);
  assert.equal(toggled.completed, true);
  assert.equal(toggled.totalCompletions, 1);
  assert.equal(toggled.currentStreak, 1);

  // Stats
  const stats = await getHabitStats(uid);
  assert.equal(stats.totalHabits, 1);
  assert.equal(stats.completedToday, 1);
  assert.equal(stats.bestStreak, 1);
});

test('NeoCalender Routines: Create routine and convert to tasks without duplication', async () => {
  const mockDb = createInMemoryDb();
  setNeoCalenderDb(mockDb);
  const uid = 'user_routine_test';

  const routine = await createRoutine(uid, {
    name: 'Morning Exam Prep',
    category: 'Study',
    estimatedMinutes: 60,
    activities: [
      { title: 'Formula Sheet Revision', durationMinutes: 20 },
      { title: 'Practice 10 Questions', durationMinutes: 40 }
    ]
  });

  assert.equal(routine.name, 'Morning Exam Prep');
  assert.equal(routine.activities.length, 2);

  // Convert to tasks for today
  const today = '2026-11-21';
  const res1 = await convertRoutineToTasks(uid, routine.id, today);
  assert.equal(res1.createdCount, 2);

  // Applying again for the same date must NOT create duplicate tasks!
  const res2 = await convertRoutineToTasks(uid, routine.id, today);
  assert.equal(res2.createdCount, 0); // Duplicates avoided!
});

test('NeoCalender Goals & Milestones: Progress % dynamically recalculates from real milestone data', async () => {
  const mockDb = createInMemoryDb();
  setNeoCalenderDb(mockDb);
  const uid = 'user_goal_test';

  const goal = await createGoal(uid, {
    title: 'Master Linear Algebra',
    category: 'academic',
    priority: 'high'
  });

  assert.equal(goal.progress, 0);

  // Add 2 milestones
  const m1 = await createMilestone(uid, {
    goalId: goal.id,
    title: 'Complete Matrix Multiplication Exercises'
  });
  const m2 = await createMilestone(uid, {
    goalId: goal.id,
    title: 'Solve Eigenvalues & Eigenvectors Problem Set'
  });

  // Check progress: 0/2 = 0%
  const milestonesBefore = await getMilestonesByGoal(uid, goal.id);
  assert.equal(milestonesBefore.length, 2);

  // Complete milestone 1: should update goal progress to 50%
  await updateMilestone(uid, m1.id, { status: 'completed' });
  const goals = await getGoals(uid);
  const updatedGoal = goals.find(g => g.id === goal.id);
  assert.equal(updatedGoal.progress, 50);

  // Complete milestone 2: should update goal progress to 100%
  await updateMilestone(uid, m2.id, { status: 'completed' });
  const goalsAfter = await getGoals(uid);
  const finalGoal = goalsAfter.find(g => g.id === goal.id);
  assert.equal(finalGoal.progress, 100);
  assert.equal(finalGoal.status, 'completed');
});

test('NeoCalender Focus Mode: Start session, complete, and track focus metrics', async () => {
  const mockDb = createInMemoryDb();
  setNeoCalenderDb(mockDb);
  const uid = 'user_focus_test';

  const session = await startFocusSession(uid, {
    taskTitle: 'Chemistry Equilibrium Notes',
    durationMinutes: 25
  });

  assert.equal(session.taskTitle, 'Chemistry Equilibrium Notes');
  assert.equal(session.status, 'in_progress');

  const completed = await completeFocusSession(uid, session.id, {
    actualMinutes: 25,
    status: 'completed'
  });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.actualMinutes, 25);

  const stats = await getFocusStats(uid);
  assert.equal(stats.completedSessions, 1);
  assert.equal(stats.totalMinutes, 25);
  assert.equal(stats.taskDistribution['Chemistry Equilibrium Notes'], 25);
});

test('NeoCalender Time Blocking: Detect conflicts and calculate open study windows', async () => {
  const mockDb = createInMemoryDb();
  setNeoCalenderDb(mockDb);
  const uid = 'user_block_test';
  const date = '2026-11-21';

  // Create block 10:00 to 11:30
  await createTimeBlock(uid, {
    title: 'Physics Lab Preparation',
    date,
    startTime: '10:00',
    endTime: '11:30'
  });

  // Overlapping test: 11:00 to 12:00
  const conflicts = await detectConflicts(uid, {
    date,
    startTime: '11:00',
    endTime: '12:00'
  });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].title, 'Physics Lab Preparation');

  // Available slots check between 09:00 and 21:00
  const slots = await getAvailableSlots(uid, { date, minDurationMinutes: 30 });
  assert.ok(slots.length >= 2);
  // First slot should be 09:00 to 10:00
  assert.equal(slots[0].startTime, '09:00');
  assert.equal(slots[0].endTime, '10:00');
});

test('NeoCalender Weekly Review: Aggregates real data across all pillars', async () => {
  const mockDb = createInMemoryDb();
  setNeoCalenderDb(mockDb);
  const uid = 'user_review_test';

  // Seed 1 task, 1 habit, 1 goal
  await createTask(uid, { title: 'Math Chapter 2', status: 'completed' });
  await createHabit(uid, { title: 'Read 30 mins' });
  await createGoal(uid, { title: 'Score 95% in Science' });

  const review = await generateWeeklyReview(uid);
  assert.ok(review.period);
  assert.equal(typeof review.tasks.completedCount, 'number');
  assert.equal(typeof review.habits.totalActive, 'number');
  assert.equal(typeof review.goals.activeCount, 'number');
  assert.equal(typeof review.focus.weekMinutes, 'number');
});

test('NeoCalender AI Tools: Extended tool declarations and safe execution', async () => {
  const mockDb = createInMemoryDb();
  setNeoCalenderDb(mockDb);
  const uid = 'user_ai_test';

  // Verify declaration count covers new capabilities
  const toolNames = NEOCALENDER_TOOL_DECLARATIONS.map(t => t.name);
  assert.ok(toolNames.includes('createHabit'));
  assert.ok(toolNames.includes('createRoutine'));
  assert.ok(toolNames.includes('createGoal'));
  assert.ok(toolNames.includes('createTimeBlock'));
  assert.ok(toolNames.includes('startFocusSession'));
  assert.ok(toolNames.includes('generateWeeklyReview'));
  assert.ok(toolNames.includes('suggestReschedule'));

  // Test executing createHabit tool
  const habitRes = await executeNeoCalenderTool(uid, 'createHabit', {
    title: 'Daily Coding Practice',
    frequency: 'daily'
  });
  assert.equal(habitRes.success, true);
  assert.ok(habitRes.habit);

  // Test executing createGoal tool
  const goalRes = await executeNeoCalenderTool(uid, 'createGoal', {
    title: 'Learn Machine Learning',
    category: 'academic'
  });
  assert.equal(goalRes.success, true);
  assert.ok(goalRes.goal);

  // Test suggestReschedule requires user approval proposal
  const rescheduleRes = await executeNeoCalenderTool(uid, 'suggestReschedule', {
    targetDate: '2026-11-22'
  });
  assert.equal(rescheduleRes.success, true);
  assert.equal(rescheduleRes.requiresConfirmation, true);
  assert.equal(rescheduleRes.action, 'approveRescheduleProposal');

  // Test intent detection with new expansion keywords
  assert.equal(detectNeoCalenderIntent('Track my reading habit'), true);
  assert.equal(detectNeoCalenderIntent('Start a pomodoro focus session'), true);
  assert.equal(detectNeoCalenderIntent('How is my goal progress?'), true);
  assert.equal(detectNeoCalenderIntent('Generate my weekly review'), true);
  assert.equal(detectNeoCalenderIntent('What is quantum entanglement?'), false);
});

test('NeoCalender AI Usage & Quota Accounting Integration', async () => {
  // 1. Verify constant registration
  assert.equal(AI_FEATURES.NEOCALENDER, 'neocalender');
  assert.equal(FEATURE_LABELS.neocalender, 'NeoCalender AI');

  // 2. Verify quota middleware configuration
  assert.ok(typeof neocalenderQuota === 'function');

  // 3. Verify processNeoCalenderAIRequest provider token recording with mock aiUsageRequest
  const attempts = [];
  let finalizedStatus = null;
  const mockAiUsageRequest = {
    recordAttempt: (data) => {
      attempts.push(data);
    },
    finalize: (data) => {
      finalizedStatus = data.status;
    }
  };

  // Mock fetch to simulate Gemini API response with usageMetadata
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: 'Here is your plan for today!' }]
          }
        }],
        usageMetadata: {
          promptTokenCount: 85,
          candidatesTokenCount: 42,
          totalTokenCount: 127
        }
      })
    };
  };

  try {
    const res = await processNeoCalenderAIRequest(
      'user_ai_accounting_test',
      { message: 'What should I work on today?', history: [] },
      'mock-gemini-key',
      { aiUsageRequest: mockAiUsageRequest }
    );

    assert.equal(res.reply, 'Here is your plan for today!');
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].usage.inputTokens, 85);
    assert.equal(attempts[0].usage.outputTokens, 42);
    assert.equal(attempts[0].usage.totalTokens, 127);
    assert.equal(attempts[0].status, 'success');
    assert.equal(finalizedStatus, 'success');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
