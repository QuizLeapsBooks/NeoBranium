/**
 * NeoCalender/neocalender-routes.js
 *
 * REST API router for NeoCalender.
 * Mounted at /api/neocalender in server.js.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireAccountAuth } from '../middleware/requireAuth.js';
import * as service from './neocalender-service.js';
import { processNeoCalenderAIRequest, executeNeoCalenderTool } from './neocalender-ai-tools.js';
import { createAiUsageMiddleware, AI_FEATURES } from '../services/aiUsageTracker.js';
import { neocalenderQuota } from '../middleware/quotaByUID.js';
import { getRoutineTextModel } from '../gemini-models.js';

export const neocalenderRouter = express.Router();

const neocalenderAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.uid || req.ip,
  message: { success: false, error: 'Too many NeoCalender AI requests. Please slow down.' }
});

// Apply auth to all /api/neocalender endpoints
neocalenderRouter.use(requireAuth, requireAccountAuth);

// ── TASKS ─────────────────────────────────────────────────────────────────

// GET /api/neocalender/tasks
neocalenderRouter.get('/tasks', async (req, res) => {
  try {
    const { status, listId, priority, search, date, startDate, endDate, sortBy, sortDir, limit } = req.query;
    const tasks = await service.getTasks(req.uid, {
      status,
      listId,
      priority,
      search,
      date,
      startDate,
      endDate,
      sortBy,
      sortDir,
      limit: limit ? Number(limit) : undefined
    });
    res.json({ success: true, tasks });
  } catch (err) {
    console.error('[NeoCalender] getTasks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/tasks
neocalenderRouter.post('/tasks', async (req, res) => {
  try {
    const task = await service.createTask(req.uid, req.body || {});
    res.status(201).json({ success: true, task });
  } catch (err) {
    console.error('[NeoCalender] createTask error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/neocalender/tasks/:taskId
neocalenderRouter.get('/tasks/:taskId', async (req, res) => {
  try {
    const task = await service.getTask(req.uid, req.params.taskId);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, task });
  } catch (err) {
    console.error('[NeoCalender] getTask error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/neocalender/tasks/:taskId
neocalenderRouter.put('/tasks/:taskId', async (req, res) => {
  try {
    const task = await service.updateTask(req.uid, req.params.taskId, req.body || {});
    res.json({ success: true, task });
  } catch (err) {
    console.error('[NeoCalender] updateTask error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/neocalender/tasks/:taskId
neocalenderRouter.delete('/tasks/:taskId', async (req, res) => {
  try {
    const result = await service.deleteTask(req.uid, req.params.taskId);
    res.json(result);
  } catch (err) {
    console.error('[NeoCalender] deleteTask error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/tasks/:taskId/toggle
neocalenderRouter.post('/tasks/:taskId/toggle', async (req, res) => {
  try {
    const task = await service.toggleTask(req.uid, req.params.taskId);
    res.json({ success: true, task });
  } catch (err) {
    console.error('[NeoCalender] toggleTask error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── LISTS ─────────────────────────────────────────────────────────────────

// GET /api/neocalender/lists
neocalenderRouter.get('/lists', async (req, res) => {
  try {
    const lists = await service.getLists(req.uid);
    res.json({ success: true, lists });
  } catch (err) {
    console.error('[NeoCalender] getLists error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/lists
neocalenderRouter.post('/lists', async (req, res) => {
  try {
    const list = await service.createList(req.uid, req.body || {});
    res.status(201).json({ success: true, list });
  } catch (err) {
    console.error('[NeoCalender] createList error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/neocalender/lists/:listId
neocalenderRouter.put('/lists/:listId', async (req, res) => {
  try {
    const list = await service.updateList(req.uid, req.params.listId, req.body || {});
    res.json({ success: true, list });
  } catch (err) {
    console.error('[NeoCalender] updateList error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/neocalender/lists/:listId
neocalenderRouter.delete('/lists/:listId', async (req, res) => {
  try {
    const result = await service.deleteList(req.uid, req.params.listId);
    res.json(result);
  } catch (err) {
    console.error('[NeoCalender] deleteList error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── SETTINGS ──────────────────────────────────────────────────────────────

// GET /api/neocalender/settings
neocalenderRouter.get('/settings', async (req, res) => {
  try {
    const settings = await service.getSettings(req.uid);
    res.json({ success: true, settings });
  } catch (err) {
    console.error('[NeoCalender] getSettings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/neocalender/settings
neocalenderRouter.put('/settings', async (req, res) => {
  try {
    const settings = await service.updateSettings(req.uid, req.body || {});
    res.json({ success: true, settings });
  } catch (err) {
    console.error('[NeoCalender] updateSettings error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── STATS & SCHEDULE ──────────────────────────────────────────────────────

// GET /api/neocalender/stats
neocalenderRouter.get('/stats', async (req, res) => {
  try {
    const stats = await service.getProductivityStats(req.uid);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('[NeoCalender] getStats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/neocalender/schedule
neocalenderRouter.get('/schedule', async (req, res) => {
  try {
    const { date } = req.query;
    const schedule = await service.getDailySchedule(req.uid, date);
    res.json({ success: true, schedule });
  } catch (err) {
    console.error('[NeoCalender] getSchedule error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/reschedule-incomplete
neocalenderRouter.post('/reschedule-incomplete', async (req, res) => {
  try {
    const { targetDate } = req.body || {};
    const result = await service.rescheduleIncompleteTasks(req.uid, targetDate);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[NeoCalender] rescheduleIncomplete error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── HABITS & STREAKS ──────────────────────────────────────────────────────

// GET /api/neocalender/habits
neocalenderRouter.get('/habits', async (req, res) => {
  try {
    const habits = await service.getHabits(req.uid, req.query);
    res.json({ success: true, habits });
  } catch (err) {
    console.error('[NeoCalender] getHabits error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/neocalender/habits/stats
neocalenderRouter.get('/habits/stats', async (req, res) => {
  try {
    const stats = await service.getHabitStats(req.uid);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('[NeoCalender] getHabitStats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/habits
neocalenderRouter.post('/habits', async (req, res) => {
  try {
    const habit = await service.createHabit(req.uid, req.body || {});
    res.status(201).json({ success: true, habit });
  } catch (err) {
    console.error('[NeoCalender] createHabit error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/neocalender/habits/:id
neocalenderRouter.put('/habits/:id', async (req, res) => {
  try {
    const habit = await service.updateHabit(req.uid, req.params.id, req.body || {});
    res.json({ success: true, habit });
  } catch (err) {
    console.error('[NeoCalender] updateHabit error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/habits/:id/toggle
neocalenderRouter.post('/habits/:id/toggle', async (req, res) => {
  try {
    const result = await service.toggleHabitCompletion(req.uid, req.params.id, req.body?.date);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[NeoCalender] toggleHabit error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/neocalender/habits/:id
neocalenderRouter.delete('/habits/:id', async (req, res) => {
  try {
    const result = await service.deleteHabit(req.uid, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[NeoCalender] deleteHabit error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── ROUTINES ──────────────────────────────────────────────────────────────

// GET /api/neocalender/routines
neocalenderRouter.get('/routines', async (req, res) => {
  try {
    const routines = await service.getRoutines(req.uid);
    res.json({ success: true, routines });
  } catch (err) {
    console.error('[NeoCalender] getRoutines error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/routines
neocalenderRouter.post('/routines', async (req, res) => {
  try {
    const routine = await service.createRoutine(req.uid, req.body || {});
    res.status(201).json({ success: true, routine });
  } catch (err) {
    console.error('[NeoCalender] createRoutine error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/neocalender/routines/:id
neocalenderRouter.put('/routines/:id', async (req, res) => {
  try {
    const routine = await service.updateRoutine(req.uid, req.params.id, req.body || {});
    res.json({ success: true, routine });
  } catch (err) {
    console.error('[NeoCalender] updateRoutine error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/neocalender/routines/:id
neocalenderRouter.delete('/routines/:id', async (req, res) => {
  try {
    const result = await service.deleteRoutine(req.uid, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[NeoCalender] deleteRoutine error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/routines/:id/convert-to-tasks
neocalenderRouter.post('/routines/:id/convert-to-tasks', async (req, res) => {
  try {
    const result = await service.convertRoutineToTasks(req.uid, req.params.id, req.body?.targetDate);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[NeoCalender] convertRoutineToTasks error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── GOALS & MILESTONES ────────────────────────────────────────────────────

// GET /api/neocalender/goals
neocalenderRouter.get('/goals', async (req, res) => {
  try {
    const goals = await service.getGoals(req.uid, req.query);
    res.json({ success: true, goals });
  } catch (err) {
    console.error('[NeoCalender] getGoals error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/neocalender/goals/:id
neocalenderRouter.get('/goals/:id', async (req, res) => {
  try {
    const goal = await service.getGoal(req.uid, req.params.id);
    if (!goal) return res.status(404).json({ success: false, error: 'Goal not found' });
    const milestones = await service.getMilestonesByGoal(req.uid, req.params.id);
    res.json({ success: true, goal, milestones });
  } catch (err) {
    console.error('[NeoCalender] getGoal error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/goals
neocalenderRouter.post('/goals', async (req, res) => {
  try {
    const goal = await service.createGoal(req.uid, req.body || {});
    res.status(201).json({ success: true, goal });
  } catch (err) {
    console.error('[NeoCalender] createGoal error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/neocalender/goals/:id
neocalenderRouter.put('/goals/:id', async (req, res) => {
  try {
    const goal = await service.updateGoal(req.uid, req.params.id, req.body || {});
    res.json({ success: true, goal });
  } catch (err) {
    console.error('[NeoCalender] updateGoal error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/neocalender/goals/:id
neocalenderRouter.delete('/goals/:id', async (req, res) => {
  try {
    const result = await service.deleteGoal(req.uid, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[NeoCalender] deleteGoal error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/neocalender/goals/:id/milestones
neocalenderRouter.get('/goals/:id/milestones', async (req, res) => {
  try {
    const milestones = await service.getMilestonesByGoal(req.uid, req.params.id);
    res.json({ success: true, milestones });
  } catch (err) {
    console.error('[NeoCalender] getMilestones error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/milestones
neocalenderRouter.post('/milestones', async (req, res) => {
  try {
    const milestone = await service.createMilestone(req.uid, req.body || {});
    res.status(201).json({ success: true, milestone });
  } catch (err) {
    console.error('[NeoCalender] createMilestone error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/neocalender/milestones/:id
neocalenderRouter.put('/milestones/:id', async (req, res) => {
  try {
    const milestone = await service.updateMilestone(req.uid, req.params.id, req.body || {});
    res.json({ success: true, milestone });
  } catch (err) {
    console.error('[NeoCalender] updateMilestone error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/neocalender/milestones/:id
neocalenderRouter.delete('/milestones/:id', async (req, res) => {
  try {
    const result = await service.deleteMilestone(req.uid, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[NeoCalender] deleteMilestone error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── FOCUS MODE ────────────────────────────────────────────────────────────

// GET /api/neocalender/focus/sessions
neocalenderRouter.get('/focus/sessions', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const sessions = await service.getFocusSessions(req.uid, { limit });
    res.json({ success: true, sessions });
  } catch (err) {
    console.error('[NeoCalender] getFocusSessions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/neocalender/focus/stats
neocalenderRouter.get('/focus/stats', async (req, res) => {
  try {
    const stats = await service.getFocusStats(req.uid);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('[NeoCalender] getFocusStats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/focus/start
neocalenderRouter.post('/focus/start', async (req, res) => {
  try {
    const session = await service.startFocusSession(req.uid, req.body || {});
    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error('[NeoCalender] startFocus error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/focus/complete/:id
neocalenderRouter.post('/focus/complete/:id', async (req, res) => {
  try {
    const session = await service.completeFocusSession(req.uid, req.params.id, req.body || {});
    res.json({ success: true, session });
  } catch (err) {
    console.error('[NeoCalender] completeFocus error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── TIME BLOCKING ─────────────────────────────────────────────────────────

// GET /api/neocalender/time-blocks
neocalenderRouter.get('/time-blocks', async (req, res) => {
  try {
    const blocks = await service.getTimeBlocks(req.uid, req.query);
    res.json({ success: true, blocks });
  } catch (err) {
    console.error('[NeoCalender] getTimeBlocks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/time-blocks
neocalenderRouter.post('/time-blocks', async (req, res) => {
  try {
    const block = await service.createTimeBlock(req.uid, req.body || {});
    res.status(201).json({ success: true, block });
  } catch (err) {
    console.error('[NeoCalender] createTimeBlock error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/neocalender/time-blocks/:id
neocalenderRouter.put('/time-blocks/:id', async (req, res) => {
  try {
    const block = await service.updateTimeBlock(req.uid, req.params.id, req.body || {});
    res.json({ success: true, block });
  } catch (err) {
    console.error('[NeoCalender] updateTimeBlock error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/neocalender/time-blocks/:id
neocalenderRouter.delete('/time-blocks/:id', async (req, res) => {
  try {
    const result = await service.deleteTimeBlock(req.uid, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[NeoCalender] deleteTimeBlock error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/neocalender/time-blocks/available-slots
neocalenderRouter.get('/time-blocks/available-slots', async (req, res) => {
  try {
    const { date, minDuration } = req.query;
    const slots = await service.getAvailableSlots(req.uid, {
      date,
      minDurationMinutes: minDuration ? Number(minDuration) : 30
    });
    res.json({ success: true, slots });
  } catch (err) {
    console.error('[NeoCalender] getAvailableSlots error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/neocalender/time-blocks/detect-conflicts
neocalenderRouter.post('/time-blocks/detect-conflicts', async (req, res) => {
  try {
    const { date, startTime, endTime, excludeId } = req.body || {};
    const conflicts = await service.detectConflicts(req.uid, { date, startTime, endTime, excludeId });
    res.json({ success: true, hasConflicts: conflicts.length > 0, conflicts });
  } catch (err) {
    console.error('[NeoCalender] detectConflicts error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── WEEKLY REVIEW ─────────────────────────────────────────────────────────

// GET /api/neocalender/weekly-review
neocalenderRouter.get('/weekly-review', async (req, res) => {
  try {
    const review = await service.generateWeeklyReview(req.uid);
    res.json({ success: true, review });
  } catch (err) {
    console.error('[NeoCalender] weeklyReview error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── AI ASSISTANT ──────────────────────────────────────────────────────────

// POST /api/neocalender/ai
neocalenderRouter.post('/ai', neocalenderAiLimiter, createAiUsageMiddleware({
  feature: AI_FEATURES.NEOCALENDER,
  route: '/api/neocalender/ai',
  provider: 'gemini',
  model: () => getRoutineTextModel()
}), neocalenderQuota, async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      if (req.aiUsageRequest) {
        req.aiUsageRequest.finalize({ status: 'failed', errorCategory: 'server_error' });
      }
      return res.status(503).json({
        success: false,
        reply: 'AI Assistant temporarily unavailable. GEMINI_API_KEY is not configured.'
      });
    }

    const result = await processNeoCalenderAIRequest(req.uid, { message, history }, geminiApiKey, {
      aiUsageRequest: req.aiUsageRequest
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[NeoCalender] AI endpoint error:', err);
    if (req.aiUsageRequest) {
      req.aiUsageRequest.finalize({ status: 'failed', errorCategory: 'server_error' });
    }
    res.status(500).json({ success: false, error: 'Failed to process AI request.', reply: 'Failed to process AI request. Please try again.' });
  }
});

// POST /api/neocalender/ai/execute-tool
neocalenderRouter.post('/ai/execute-tool', neocalenderAiLimiter, async (req, res) => {
  try {
    const { toolName, args } = req.body || {};
    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({ success: false, error: 'toolName is required' });
    }
    const result = await executeNeoCalenderTool(req.uid, toolName, args || {});
    res.json(result);
  } catch (err) {
    console.error('[NeoCalender] execute-tool error:', err);
    res.status(500).json({ success: false, error: 'Failed to execute calendar tool.' });
  }
});
