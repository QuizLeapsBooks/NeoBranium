/**
 * NeoCalender/neocalender-api.js
 *
 * Client-side API client for NeoCalender.
 * Connects to /api/neocalender with Firebase Auth ID tokens.
 */

import { auth } from '../js/auth.js';

class NeoCalenderApi {
  constructor() {
    this.baseUrl = this.resolveBaseUrl();
  }

  resolveBaseUrl() {
    const host = window.location.hostname;
    // Local development: always point to Node server on port 3000
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return 'http://localhost:3000/api/neocalender';
    }
    // Production: read the backend-url meta tag (same pattern as all other pages),
    // falling back to the Render backend URL.
    const metaBackend =
      document.querySelector('meta[name="backend-url"]')?.content?.trim() ||
      'https://neobranium.onrender.com';
    return `${metaBackend}/api/neocalender`;
  }

  async getAuthHeaders() {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Please sign in to access your NeoCalender tasks and schedule.');
    }
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async request(path, options = {}) {
    const headers = await this.getAuthHeaders();
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {})
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `NeoCalender request failed (${res.status})`);
    }
    return data;
  }

  // ── TASKS ───────────────────────────────────────────────────────────────

  async getTasks(params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        qs.append(k, v);
      }
    }
    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    const res = await this.request(`/tasks${queryStr}`);
    return res.tasks || [];
  }

  async createTask(taskData) {
    const res = await this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
    return res.task;
  }

  async updateTask(taskId, updates) {
    const res = await this.request(`/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return res.task;
  }

  async deleteTask(taskId) {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE'
    });
  }

  async toggleTask(taskId) {
    const res = await this.request(`/tasks/${encodeURIComponent(taskId)}/toggle`, {
      method: 'POST'
    });
    return res.task;
  }

  // ── LISTS ───────────────────────────────────────────────────────────────

  async getLists() {
    const res = await this.request('/lists');
    return res.lists || [];
  }

  async createList(listData) {
    const res = await this.request('/lists', {
      method: 'POST',
      body: JSON.stringify(listData)
    });
    return res.list;
  }

  async updateList(listId, updates) {
    const res = await this.request(`/lists/${encodeURIComponent(listId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return res.list;
  }

  async deleteList(listId) {
    return this.request(`/lists/${encodeURIComponent(listId)}`, {
      method: 'DELETE'
    });
  }

  // ── SETTINGS ────────────────────────────────────────────────────────────

  async getSettings() {
    const res = await this.request('/settings');
    return res.settings || {};
  }

  async updateSettings(settings) {
    const res = await this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
    return res.settings;
  }

  // ── STATS & SCHEDULE ────────────────────────────────────────────────────

  async getStats() {
    const res = await this.request('/stats');
    return res.stats || {};
  }

  async getSchedule(dateStr = null) {
    const q = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '';
    const res = await this.request(`/schedule${q}`);
    return res.schedule || {};
  }

  async rescheduleIncomplete(targetDate = null) {
    return this.request('/reschedule-incomplete', {
      method: 'POST',
      body: JSON.stringify({ targetDate })
    });
  }

  // ── HABITS & STREAKS ────────────────────────────────────────────────────

  async getHabits(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await this.request(`/habits${q ? '?' + q : ''}`);
    return res.habits || [];
  }

  async getHabitStats() {
    const res = await this.request('/habits/stats');
    return res.stats || {};
  }

  async createHabit(data) {
    const res = await this.request('/habits', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.habit;
  }

  async updateHabit(habitId, data) {
    const res = await this.request(`/habits/${encodeURIComponent(habitId)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.habit;
  }

  async toggleHabit(habitId, dateStr = null) {
    return this.request(`/habits/${encodeURIComponent(habitId)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ date: dateStr })
    });
  }

  async deleteHabit(habitId) {
    return this.request(`/habits/${encodeURIComponent(habitId)}`, {
      method: 'DELETE'
    });
  }

  // ── ROUTINES ────────────────────────────────────────────────────────────

  async getRoutines() {
    const res = await this.request('/routines');
    return res.routines || [];
  }

  async createRoutine(data) {
    const res = await this.request('/routines', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.routine;
  }

  async updateRoutine(routineId, data) {
    const res = await this.request(`/routines/${encodeURIComponent(routineId)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.routine;
  }

  async deleteRoutine(routineId) {
    return this.request(`/routines/${encodeURIComponent(routineId)}`, {
      method: 'DELETE'
    });
  }

  async convertRoutineToTasks(routineId, targetDate = null) {
    return this.request(`/routines/${encodeURIComponent(routineId)}/convert-to-tasks`, {
      method: 'POST',
      body: JSON.stringify({ targetDate })
    });
  }

  // ── GOALS & MILESTONES ──────────────────────────────────────────────────

  async getGoals(params = {}) {
    const q = new URLSearchParams(params).toString();
    const res = await this.request(`/goals${q ? '?' + q : ''}`);
    return res.goals || [];
  }

  async getGoal(goalId) {
    return this.request(`/goals/${encodeURIComponent(goalId)}`);
  }

  async createGoal(data) {
    const res = await this.request('/goals', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.goal;
  }

  async updateGoal(goalId, data) {
    const res = await this.request(`/goals/${encodeURIComponent(goalId)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.goal;
  }

  async deleteGoal(goalId) {
    return this.request(`/goals/${encodeURIComponent(goalId)}`, {
      method: 'DELETE'
    });
  }

  async getMilestones(goalId) {
    const res = await this.request(`/goals/${encodeURIComponent(goalId)}/milestones`);
    return res.milestones || [];
  }

  async createMilestone(data) {
    const res = await this.request('/milestones', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.milestone;
  }

  async updateMilestone(milestoneId, data) {
    const res = await this.request(`/milestones/${encodeURIComponent(milestoneId)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.milestone;
  }

  async deleteMilestone(milestoneId) {
    return this.request(`/milestones/${encodeURIComponent(milestoneId)}`, {
      method: 'DELETE'
    });
  }

  // ── FOCUS MODE ──────────────────────────────────────────────────────────

  async getFocusSessions(limit = 20) {
    const res = await this.request(`/focus/sessions?limit=${limit}`);
    return res.sessions || [];
  }

  async getFocusStats() {
    const res = await this.request('/focus/stats');
    return res.stats || {};
  }

  async startFocusSession(data) {
    const res = await this.request('/focus/start', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.session;
  }

  async completeFocusSession(sessionId, data = {}) {
    const res = await this.request(`/focus/complete/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.session;
  }

  // ── TIME BLOCKING ───────────────────────────────────────────────────────

  async getTimeBlocks(dateStr = null) {
    const q = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '';
    const res = await this.request(`/time-blocks${q}`);
    return res.blocks || [];
  }

  async createTimeBlock(data) {
    const res = await this.request('/time-blocks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.block;
  }

  async updateTimeBlock(blockId, data) {
    const res = await this.request(`/time-blocks/${encodeURIComponent(blockId)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.block;
  }

  async deleteTimeBlock(blockId) {
    return this.request(`/time-blocks/${encodeURIComponent(blockId)}`, {
      method: 'DELETE'
    });
  }

  async getAvailableSlots(dateStr = null, minDuration = 30) {
    const params = new URLSearchParams();
    if (dateStr) params.append('date', dateStr);
    if (minDuration) params.append('minDuration', minDuration);
    const res = await this.request(`/time-blocks/available-slots?${params.toString()}`);
    return res.slots || [];
  }

  async detectConflicts(data) {
    return this.request('/time-blocks/detect-conflicts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // ── WEEKLY REVIEW ───────────────────────────────────────────────────────

  async getWeeklyReview() {
    const res = await this.request('/weekly-review');
    return res.review || {};
  }

  // ── AI ASSISTANT ────────────────────────────────────────────────────────

  async askAI(message, history = []) {
    return this.request('/ai', {
      method: 'POST',
      body: JSON.stringify({ message, history })
    });
  }

  async executeAITool(toolName, args = {}) {
    return this.request('/ai/execute-tool', {
      method: 'POST',
      body: JSON.stringify({ toolName, args })
    });
  }
}

export const neocalenderApi = new NeoCalenderApi();
