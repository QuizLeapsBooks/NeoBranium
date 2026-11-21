/**
 * NeoCalender/neocalender-ai-tools.js
 *
 * Controlled AI-to-NeoCalender integration layer:
 * - Structured tool declarations
 * - Safe backend tool execution scoped strictly to authenticated req.uid
 * - Intent detection for routing from main chatbot (/api/chat)
 * - Confirmation gates for destructive or bulk actions
 */

import * as service from './neocalender-service.js';
import { getRoutineTextModel } from '../gemini-models.js';
import { fetchWithRetry } from '../utils/backendRequestProtection.js';
import { normalizeGeminiUsage } from '../services/aiUsageTracker.js';

/**
 * Tool definitions exposed to Gemini function calling.
 */
export const NEOCALENDER_TOOL_DECLARATIONS = [
  {
    name: 'createTask',
    description: 'Create a new task or study reminder in NeoCalender with title, priority, due date, category, and subtasks.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title of the task (e.g. "Complete Chemistry Chapter 3")' },
        description: { type: 'STRING', description: 'Detailed notes, instructions, or chapter topics' },
        dueDate: { type: 'STRING', description: 'Due date in YYYY-MM-DD or ISO 8601 format' },
        dueTime: { type: 'STRING', description: 'Time of day in HH:mm 24-hour format (e.g. "17:00")' },
        priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority level' },
        category: { type: 'STRING', description: 'Task category e.g. "Study & Academics", "Personal", "Work & Projects", "Important Deadlines"' },
        subtasks: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Checklist of subtasks to break down this assignment'
        },
        recurrence: { type: 'STRING', enum: ['none', 'daily', 'weekly', 'monthly'], description: 'Repetition frequency' }
      },
      required: ['title']
    }
  },
  {
    name: 'getTasks',
    description: 'Fetch tasks for the authenticated user, optionally filtered by status (pending/completed), priority, list, or search keyword.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['pending', 'completed'], description: 'Filter by completion state' },
        priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'], description: 'Filter by priority' },
        search: { type: 'STRING', description: 'Search term matching title or description' },
        date: { type: 'STRING', description: 'Specific date (YYYY-MM-DD) or "today"' },
        limit: { type: 'INTEGER', description: 'Maximum number of tasks to return (default 15)' }
      }
    }
  },
  {
    name: 'getUpcomingTasks',
    description: 'Retrieve pending tasks and deadlines scheduled for the next specified number of days (default 7 days).',
    parameters: {
      type: 'OBJECT',
      properties: {
        days: { type: 'INTEGER', description: 'Number of upcoming days to inspect (default 7)' }
      }
    }
  },
  {
    name: 'getDailySchedule',
    description: 'Get the exact hour-by-hour schedule of tasks and deadlines for a given date (defaults to today).',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'Date in YYYY-MM-DD format, or null for today' }
      }
    }
  },
  {
    name: 'rescheduleIncompleteTasks',
    description: 'Move overdue or incomplete tasks from previous days to today or a designated target date.',
    parameters: {
      type: 'OBJECT',
      properties: {
        targetDate: { type: 'STRING', description: 'Date to reschedule tasks to (YYYY-MM-DD), defaults to today' },
        confirmed: { type: 'BOOLEAN', description: 'True if user explicitly approved the reschedule action' }
      }
    }
  },
  {
    name: 'getProductivityStats',
    description: 'Get real productivity statistics: tasks completed today, completed this week, pending, overdue, completion rate, and most productive days.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'deleteTask',
    description: 'Delete a task from NeoCalender by its ID. Requires user confirmation before permanent removal.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING', description: 'The unique ID of the task to delete' },
        confirmed: { type: 'BOOLEAN', description: 'Set true only if the user explicitly confirmed deletion' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'updateTask',
    description: 'Update an existing task details like title, status (completed/pending), priority, or due date.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING', description: 'ID of the task to update' },
        title: { type: 'STRING', description: 'Updated title' },
        status: { type: 'STRING', enum: ['pending', 'completed'], description: 'Mark complete or pending' },
        priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'] },
        dueDate: { type: 'STRING', description: 'New due date in YYYY-MM-DD' },
        dueTime: { type: 'STRING', description: 'New due time in HH:mm' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'createHabit',
    description: 'Create a new recurring habit to track (e.g., "Read for 30 minutes", "Practice Math daily").',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Habit name' },
        description: { type: 'STRING', description: 'Details or intention' },
        frequency: { type: 'STRING', enum: ['daily', 'weekly', 'custom'], description: 'Repetition frequency' },
        category: { type: 'STRING', description: 'Category e.g. Study, Health, Personal' },
        targetCount: { type: 'INTEGER', description: 'Target times per day/week' }
      },
      required: ['title']
    }
  },
  {
    name: 'getHabits',
    description: 'Fetch current habits, streak counts, completion records, and consistency status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['active', 'paused', 'archived'] }
      }
    }
  },
  {
    name: 'toggleHabitCompletion',
    description: 'Mark a habit as completed or uncompleted for today or a specific date.',
    parameters: {
      type: 'OBJECT',
      properties: {
        habitId: { type: 'STRING', description: 'ID of the habit' },
        date: { type: 'STRING', description: 'Date in YYYY-MM-DD format (defaults to today)' }
      },
      required: ['habitId']
    }
  },
  {
    name: 'createRoutine',
    description: 'Create a reusable daily or study routine with a sequence of activities.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Routine name (e.g. "Morning Study Routine")' },
        category: { type: 'STRING', description: 'Category' },
        activities: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              durationMinutes: { type: 'INTEGER' }
            }
          },
          description: 'Ordered list of activities'
        },
        startTime: { type: 'STRING', description: 'Start time in HH:mm' }
      },
      required: ['name']
    }
  },
  {
    name: 'getRoutines',
    description: 'Fetch saved routines and their activity lists.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'convertRoutineToTasks',
    description: 'Convert a saved routine into scheduled tasks for a given date without duplicate creation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        routineId: { type: 'STRING', description: 'ID of the routine to convert' },
        targetDate: { type: 'STRING', description: 'Date to schedule tasks for (YYYY-MM-DD, defaults to today)' }
      },
      required: ['routineId']
    }
  },
  {
    name: 'createGoal',
    description: 'Create a new personal or academic goal with category, priority, and target deadline.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Goal title' },
        description: { type: 'STRING', description: 'Goal description and success criteria' },
        category: { type: 'STRING', enum: ['academic', 'personal', 'health', 'career', 'project', 'custom'] },
        priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'] },
        targetDate: { type: 'STRING', description: 'Target completion date (YYYY-MM-DD)' }
      },
      required: ['title']
    }
  },
  {
    name: 'getGoals',
    description: 'Fetch user goals with actual progress % calculated from milestone completions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['not_started', 'in_progress', 'completed', 'paused'] }
      }
    }
  },
  {
    name: 'createMilestone',
    description: 'Add a measurable milestone to break down a larger goal.',
    parameters: {
      type: 'OBJECT',
      properties: {
        goalId: { type: 'STRING', description: 'ID of the parent goal' },
        title: { type: 'STRING', description: 'Milestone description' },
        targetDate: { type: 'STRING', description: 'Target date (YYYY-MM-DD)' }
      },
      required: ['goalId', 'title']
    }
  },
  {
    name: 'createTimeBlock',
    description: 'Schedule a specific time slot on the calendar with conflict checking.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title of the blocked activity' },
        date: { type: 'STRING', description: 'Date (YYYY-MM-DD)' },
        startTime: { type: 'STRING', description: 'Start time (HH:mm)' },
        endTime: { type: 'STRING', description: 'End time (HH:mm)' },
        category: { type: 'STRING', description: 'Category' },
        isBreak: { type: 'BOOLEAN', description: 'True if this block is buffer or break time' }
      },
      required: ['title', 'date', 'startTime', 'endTime']
    }
  },
  {
    name: 'getAvailableSlots',
    description: 'Find free time slots for study or tasks on a given date considering existing blocks.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'Date (YYYY-MM-DD, defaults to today)' },
        minDuration: { type: 'INTEGER', description: 'Minimum slot duration in minutes (default 30)' }
      }
    }
  },
  {
    name: 'startFocusSession',
    description: 'Start a focused Pomodoro or deep-work timer linked to a task.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskTitle: { type: 'STRING', description: 'What you are working on' },
        taskId: { type: 'STRING', description: 'Optional task ID' },
        durationMinutes: { type: 'INTEGER', description: 'Session duration in minutes (default 25)' }
      }
    }
  },
  {
    name: 'completeFocusSession',
    description: 'Record completion of a focus session and log time spent.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sessionId: { type: 'STRING', description: 'Focus session ID' },
        actualMinutes: { type: 'INTEGER', description: 'Actual focus minutes completed' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'getFocusStats',
    description: 'Get deep work and focus metrics: today focus time, weekly trends, and task breakdown.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'generateWeeklyReview',
    description: 'Generate an automatic comprehensive productivity review based on actual tasks, habits, goals, and focus sessions over the past 7 days.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'suggestReschedule',
    description: 'Analyze overdue and incomplete tasks, evaluate available time slots, and propose a sensible rearranged schedule for user approval.',
    parameters: {
      type: 'OBJECT',
      properties: {
        targetDate: { type: 'STRING', description: 'Target date to fit tasks into (YYYY-MM-DD, defaults to today)' }
      }
    }
  }
];

/**
 * Execute a recognized NeoCalender tool securely with the authenticated user's UID.
 */
export async function executeNeoCalenderTool(uid, toolName, args = {}) {
  if (!uid) {
    throw new Error('Authentication required: Cannot execute NeoCalender tool without user UID');
  }

  switch (toolName) {
    case 'createTask': {
      if (!args.title || !String(args.title).trim()) {
        return { success: false, error: 'Task title is required' };
      }
      const task = await service.createTask(uid, args);
      return {
        success: true,
        message: `Task "${task.title}" created successfully for ${task.dueDate ? task.dueDate.slice(0, 10) : 'no fixed date'}${task.dueTime ? ' at ' + task.dueTime : ''}.`,
        task
      };
    }

    case 'getTasks': {
      const tasks = await service.getTasks(uid, args);
      return {
        success: true,
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          dueDate: t.dueDate ? t.dueDate.slice(0, 10) : null,
          dueTime: t.dueTime,
          subtasksCount: t.subtasks?.length || 0,
          subtasksCompleted: t.subtasks?.filter(s => s.completed).length || 0
        }))
      };
    }

    case 'getUpcomingTasks': {
      const days = Number(args.days) || 7;
      const tasks = await service.getUpcomingTasks(uid, days);
      return {
        success: true,
        daysChecked: days,
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.slice(0, 10) : null,
          dueTime: t.dueTime,
          category: t.category
        }))
      };
    }

    case 'getDailySchedule': {
      const schedule = await service.getDailySchedule(uid, args.date);
      return {
        success: true,
        schedule
      };
    }

    case 'rescheduleIncompleteTasks': {
      if (!args.confirmed) {
        // Return a confirmation request to prevent accidental bulk moves
        let overdueCount = 0;
        try {
          const stats = await service.getProductivityStats(uid);
          overdueCount = stats?.overdueCount || 0;
        } catch {
          // Fallback if db is unavailable in mock tests
        }
        return {
          success: false,
          requiresConfirmation: true,
          action: 'rescheduleIncompleteTasks',
          overdueCount,
          message: `You have ${overdueCount} incomplete/overdue tasks. Would you like me to reschedule them to ${args.targetDate || 'today'}? Please confirm to proceed.`
        };
      }
      const result = await service.rescheduleIncompleteTasks(uid, args.targetDate);
      return {
        success: true,
        message: `Rescheduled ${result.rescheduledCount} overdue tasks to ${result.targetDate.slice(0, 10)}.`,
        rescheduledCount: result.rescheduledCount
      };
    }

    case 'getProductivityStats': {
      const stats = await service.getProductivityStats(uid);
      return {
        success: true,
        stats
      };
    }

    case 'deleteTask': {
      if (!args.taskId) {
        return { success: false, error: 'taskId is required' };
      }
      if (!args.confirmed) {
        let task = null;
        try {
          task = await service.getTask(uid, args.taskId);
        } catch {
          // Fallback if db is unavailable in mock tests
        }
        return {
          success: false,
          requiresConfirmation: true,
          action: 'deleteTask',
          taskId: args.taskId,
          taskTitle: task?.title || 'Unknown Task',
          message: `Are you sure you want to permanently delete the task "${task?.title || args.taskId}"? Please confirm to proceed.`
        };
      }
      await service.deleteTask(uid, args.taskId);
      return {
        success: true,
        message: `Task ${args.taskId} has been deleted successfully.`
      };
    }

    case 'updateTask': {
      if (!args.taskId) {
        return { success: false, error: 'taskId is required' };
      }
      const updated = await service.updateTask(uid, args.taskId, args);
      return {
        success: true,
        message: `Task "${updated.title}" updated successfully.`,
        task: updated
      };
    }

    // ── HABITS & ROUTINES ──
    case 'createHabit': {
      if (!args.title) return { success: false, error: 'Habit title is required' };
      const habit = await service.createHabit(uid, args);
      return {
        success: true,
        message: `Habit "${habit.title}" created with ${habit.frequency} frequency.`,
        habit
      };
    }

    case 'getHabits': {
      const habits = await service.getHabits(uid, args);
      return {
        success: true,
        count: habits.length,
        habits: habits.map(h => ({
          id: h.id,
          title: h.title,
          frequency: h.frequency,
          streak: h.currentStreak,
          longestStreak: h.longestStreak,
          totalCompletions: h.totalCompletions,
          status: h.status
        }))
      };
    }

    case 'toggleHabitCompletion': {
      if (!args.habitId) return { success: false, error: 'habitId is required' };
      const res = await service.toggleHabitCompletion(uid, args.habitId, args.date);
      return {
        success: true,
        message: `Habit "${res.title}" marked as ${res.completed ? 'completed' : 'uncompleted'} for ${res.toggledDate}. Current streak: ${res.currentStreak} days!`,
        result: res
      };
    }

    case 'createRoutine': {
      if (!args.name) return { success: false, error: 'Routine name is required' };
      const routine = await service.createRoutine(uid, args);
      return {
        success: true,
        message: `Routine "${routine.name}" created with ${routine.activities?.length || 0} activities (~${routine.estimatedMinutes} mins).`,
        routine
      };
    }

    case 'getRoutines': {
      const routines = await service.getRoutines(uid);
      return { success: true, count: routines.length, routines };
    }

    case 'convertRoutineToTasks': {
      if (!args.routineId) return { success: false, error: 'routineId is required' };
      const res = await service.convertRoutineToTasks(uid, args.routineId, args.targetDate);
      return {
        success: true,
        message: `Converted "${res.routineName}" into ${res.createdCount} tasks for ${res.targetDate}.`,
        tasks: res.tasks
      };
    }

    // ── GOALS & MILESTONES ──
    case 'createGoal': {
      if (!args.title) return { success: false, error: 'Goal title is required' };
      const goal = await service.createGoal(uid, args);
      return {
        success: true,
        message: `Goal "${goal.title}" created (${goal.category}, target: ${goal.targetDate ? goal.targetDate.slice(0, 10) : 'ongoing'}).`,
        goal
      };
    }

    case 'getGoals': {
      const goals = await service.getGoals(uid, args);
      return {
        success: true,
        count: goals.length,
        goals: goals.map(g => ({
          id: g.id,
          title: g.title,
          category: g.category,
          progress: g.progress,
          status: g.status,
          priority: g.priority,
          targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null
        }))
      };
    }

    case 'createMilestone': {
      if (!args.goalId || !args.title) return { success: false, error: 'goalId and title are required' };
      const ms = await service.createMilestone(uid, args);
      return {
        success: true,
        message: `Milestone "${ms.title}" added to goal. Goal progress automatically recalculated.`,
        milestone: ms
      };
    }

    // ── TIME BLOCKING ──
    case 'createTimeBlock': {
      if (!args.title || !args.date || !args.startTime || !args.endTime) {
        return { success: false, error: 'title, date, startTime, and endTime are required' };
      }
      const block = await service.createTimeBlock(uid, args);
      return {
        success: true,
        message: `Time block "${block.title}" scheduled on ${block.date} (${block.startTime} - ${block.endTime}).${block.hasConflicts ? ' (Note: overlaps with existing blocks)' : ''}`,
        block
      };
    }

    case 'getAvailableSlots': {
      const slots = await service.getAvailableSlots(uid, {
        date: args.date,
        minDurationMinutes: args.minDuration
      });
      return { success: true, slots };
    }

    case 'detectScheduleConflicts': {
      const conflicts = await service.detectConflicts(uid, args);
      return { success: true, count: conflicts.length, conflicts };
    }

    // ── FOCUS MODE ──
    case 'startFocusSession': {
      const session = await service.startFocusSession(uid, args);
      return {
        success: true,
        message: `Focus session started for "${session.taskTitle}" (${session.durationMinutes} mins). Stay focused!`,
        session
      };
    }

    case 'completeFocusSession': {
      if (!args.sessionId) return { success: false, error: 'sessionId is required' };
      const session = await service.completeFocusSession(uid, args.sessionId, args);
      return {
        success: true,
        message: `Great job! Focus session completed (${session.actualMinutes} minutes recorded).`,
        session
      };
    }

    case 'getFocusStats': {
      const stats = await service.getFocusStats(uid);
      return { success: true, stats };
    }

    // ── WEEKLY REVIEW & AUTO-RESCHEDULE ──
    case 'generateWeeklyReview': {
      const review = await service.generateWeeklyReview(uid);
      return { success: true, review };
    }

    case 'suggestReschedule': {
      const targetDate = args.targetDate || new Date().toISOString().slice(0, 10);
      const allTasks = await service.getTasks(uid, { status: 'pending' });
      const nowStr = new Date().toISOString().slice(0, 10);
      const overdueTasks = allTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) < nowStr);
      const freeSlots = await service.getAvailableSlots(uid, { date: targetDate });

      const suggestions = overdueTasks.map((t, idx) => {
        const slot = freeSlots[idx % Math.max(1, freeSlots.length)];
        return {
          taskId: t.id,
          taskTitle: t.title,
          originalDueDate: t.dueDate ? t.dueDate.slice(0, 10) : 'Overdue',
          suggestedDate: targetDate,
          suggestedTime: slot ? slot.startTime : '17:00'
        };
      });

      return {
        success: true,
        requiresConfirmation: true,
        action: 'approveRescheduleProposal',
        targetDate,
        overdueCount: overdueTasks.length,
        suggestions,
        message: `I found ${overdueTasks.length} incomplete/overdue tasks. Here is my proposed schedule for ${targetDate} based on your open time slots. Please approve to apply:`
      };
    }

    default:
      return { success: false, error: `Unknown NeoCalender tool: ${toolName}` };
  }
}

/**
 * Checks if user message expresses productivity, task management, or scheduling intent.
 */
export function detectNeoCalenderIntent(message) {
  if (!message || typeof message !== 'string') return false;
  const lower = message.toLowerCase();

  const triggers = [
    'task', 'tasks', 'todo', 'to-do', 'schedule', 'calendar', 'routine', 'routines',
    'plan my day', 'plan my entire day', 'plan my study', 'study routine', 'morning routine',
    'pending task', 'pending tasks', 'incomplete task', 'completed task',
    'remind', 'reminder', 'reminders', 'remind me', 'set reminder', 'set a reminder',
    'add to my schedule', 'reschedule', 'deadline', 'deadlines', 'my day',
    'agenda', 'what do i have planned', 'what is planned',
    'what do i have tomorrow', 'tomorrow schedule', 'today schedule',
    'neocalender', 'productivity', 'how many tasks',
    'habit', 'habits', 'streak', 'streaks', 'habit tracker',
    'goal', 'goals', 'milestone', 'milestones', 'target',
    'focus mode', 'focus session', 'pomodoro', 'deep work',
    'time block', 'time blocking', 'free slots', 'available time',
    'weekly review', 'productivity review', 'review my week',
    'rearrange my schedule', 'reschedule my tasks'
  ];

  return triggers.some(t => lower.includes(t));
}

/**
 * Process a natural language request using Gemini with NeoCalender tools.
 */
export async function processNeoCalenderAIRequest(uid, { message, history = [] }, geminiApiKey, options = {}) {
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required to process AI requests');
  }

  const aiUsageRequest = options.aiUsageRequest || null;
  const model = getRoutineTextModel();
  const currentDate = new Date().toISOString();
  const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const systemPrompt = `You are NeoCalender AI, the intelligent productivity and personal time management assistant for NeoBranium by AEVORIN.
Current date/time: ${currentDate} (${currentDay}).

Your mission is to help students and learners plan their day, organize academic assignments, manage study schedules, set deadlines, and track real productivity.

RULES & ARCHITECTURE:
1. Always use real user data and actions via the provided tools (createTask, getTasks, getUpcomingTasks, getDailySchedule, updateTask, deleteTask, createHabit, getHabits, toggleHabitCompletion, createRoutine, getRoutines, convertRoutineToTasks, createGoal, getGoals, createMilestone, createTimeBlock, getAvailableSlots, detectScheduleConflicts, startFocusSession, completeFocusSession, getFocusStats, generateWeeklyReview, suggestReschedule).
2. Never invent fake tasks, fabricated progress numbers, or claim actions occurred without tool execution.
3. When creating a task:
   - Understand relative dates like "tomorrow", "this Friday", "next Monday", "at 5 PM" accurately based on current date: ${currentDate}.
   - Auto-assign meaningful categories (e.g., "Study & Academics" for math, chemistry, physics, chapters, homework, revision; "Personal" for daily habits).
   - If user asks to break down a chapter or subject, generate helpful subtasks!
4. When planning a day, scheduling, or rescheduling:
   - Call getDailySchedule or getTasks to inspect existing commitments.
   - Detect conflicts and respect available hours.
   - Never overwrite user schedules automatically; present reschedule suggestions as proposals for user approval.
5. In Focus Mode: encourage healthy focus intervals (e.g. 25-50 min) with appropriate breaks. Never equate productivity to personal worth or promote unhealthy burnout.
6. Tone: Encouraging, structured, intelligent, and respectful. Use clear markdown formatting.`;

  // Format history for Gemini contents
  const contents = [];
  (history || []).slice(-6).forEach(h => {
    contents.push({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    });
  });
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: [{
      functionDeclarations: NEOCALENDER_TOOL_DECLARATIONS
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2000
    }
  };

  let response;
  try {
    response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );
  } catch (err) {
    if (aiUsageRequest) {
      aiUsageRequest.recordAttempt({ provider: 'gemini', model, status: 'failed', errorCategory: 'network_error' });
      aiUsageRequest.finalize({ status: 'failed', errorCategory: 'network_error' });
    }
    throw err;
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (aiUsageRequest) {
      aiUsageRequest.recordAttempt({
        provider: 'gemini',
        model,
        status: 'failed',
        errorCategory: response.status === 429 ? 'rate_limited' : (response.status >= 500 ? 'server_error' : 'request_rejected')
      });
      aiUsageRequest.finalize({ status: 'failed', errorCategory: 'provider_error' });
    }
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (aiUsageRequest) {
    aiUsageRequest.recordAttempt({
      provider: 'gemini',
      model,
      usage: normalizeGeminiUsage(data),
      status: 'success'
    });
  }

  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  // Check if Gemini invoked a function call
  const functionCallPart = parts.find(p => p.functionCall);
  if (functionCallPart) {
    const { name, args } = functionCallPart.functionCall;
    // Execute tool securely
    const toolResult = await executeNeoCalenderTool(uid, name, args || {});

    // Now call Gemini back with the function result so it generates a helpful, natural language summary
    const followUpContents = [
      ...contents,
      { role: 'model', parts: [{ functionCall: functionCallPart.functionCall }] },
      {
        role: 'function',
        parts: [{
          functionResponse: {
            name,
            response: toolResult
          }
        }]
      }
    ];

    let followUpResponse;
    try {
      followUpResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: followUpContents,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1500
            }
          })
        }
      );
    } catch (followUpErr) {
      if (aiUsageRequest) {
        aiUsageRequest.finalize({ status: 'success' }); // Initial call succeeded
      }
      return {
        reply: toolResult.message || 'Action executed successfully.',
        toolExecuted: name,
        toolResult
      };
    }

    let reply = '';
    if (followUpResponse.ok) {
      const followUpData = await followUpResponse.json();
      if (aiUsageRequest) {
        aiUsageRequest.recordAttempt({
          provider: 'gemini',
          model,
          usage: normalizeGeminiUsage(followUpData),
          status: 'success'
        });
      }
      const followUpText = followUpData.candidates?.[0]?.content?.parts?.[0]?.text;
      reply = followUpText || toolResult.message || 'Operation executed successfully.';
    } else {
      reply = toolResult.message || 'Action executed successfully.';
    }

    if (aiUsageRequest) {
      aiUsageRequest.finalize({ status: 'success' });
    }

    return {
      reply,
      toolExecuted: name,
      toolResult
    };
  }

  // Plain text response without tool call
  const replyText = parts.map(p => p.text).filter(Boolean).join('\n') ||
    "I'm here to help with your NeoCalender tasks and schedule! How can I assist you today?";

  if (aiUsageRequest) {
    aiUsageRequest.finalize({ status: 'success' });
  }

  return {
    reply: replyText,
    toolExecuted: null,
    toolResult: null
  };
}
