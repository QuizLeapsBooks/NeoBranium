/**
 * NeoCalender/neocalender-ai.js
 *
 * Dedicated AI Assistant Controller for NeoCalender:
 * - Natural language task creation & schedule planning
 * - Quick action prompt chips
 * - Confirmation gates for destructive or bulk actions
 * - Seamless sync with the main calendar & task views
 */

import { neocalenderApi } from './neocalender-api.js';

export class NeoCalenderAI {
  constructor(elements, options = {}) {
    this.messagesContainer = elements.messagesContainer;
    this.input = elements.input;
    this.sendBtn = elements.sendBtn;
    this.chipsContainer = elements.chipsContainer;
    this.history = [];
    this.isProcessing = false;
    this.onTasksChanged = options.onTasksChanged || (() => {});

    this.init();
  }

  init() {
    this.addWelcomeMessage();
    this.bindEvents();
  }

  bindEvents() {
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.handleSend());
    }
    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSend();
        }
      });
    }

    if (this.chipsContainer) {
      this.chipsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.nc-ai-chip');
        if (chip && chip.dataset.prompt) {
          if (this.input) {
            this.input.value = chip.dataset.prompt;
            this.handleSend();
          }
        }
      });
    }
  }

  addWelcomeMessage() {
    this.addMessage({
      role: 'assistant',
      text: "👋 Hi! I'm **NeoCalender AI**. I can help you organize your study schedule, create tasks, plan your day, and analyze your productivity.\n\nTry asking:\n* *\"Create a task to complete Chemistry Chapter 3 tomorrow at 5 PM\"*\n* *\"Plan my entire day\"*\n* *\"What tasks are pending?\"*\n* *\"Reschedule my incomplete tasks\"*"
    });
  }

  async handleSend() {
    if (this.isProcessing || !this.input) return;
    const text = this.input.value.trim();
    if (!text) return;

    this.input.value = '';
    this.addMessage({ role: 'user', text });

    this.isProcessing = true;
    this.setLoading(true);

    try {
      const res = await neocalenderApi.askAI(text, this.history);
      this.setLoading(false);

      if (res.reply) {
        this.addMessage({
          role: 'assistant',
          text: res.reply,
          toolExecuted: res.toolExecuted,
          toolResult: res.toolResult
        });

        // If a task was created, updated, or deleted, notify parent view to reload
        if (res.toolExecuted && ['createTask', 'updateTask', 'deleteTask', 'rescheduleIncompleteTasks'].includes(res.toolExecuted)) {
          this.onTasksChanged();
        }
      } else {
        this.addMessage({
          role: 'assistant',
          text: "I couldn't process that request right now. Please try again."
        });
      }
    } catch (err) {
      this.setLoading(false);
      console.error('NeoCalender AI error:', err);
      this.addMessage({
        role: 'assistant',
        text: `⚠️ **Error:** ${err.message || 'Failed to communicate with AI Assistant.'}`
      });
    } finally {
      this.isProcessing = false;
    }
  }

  addMessage({ role, text, toolExecuted = null, toolResult = null }) {
    if (!this.messagesContainer) return;

    this.history.push({ role, content: text });

    const msgDiv = document.createElement('div');
    msgDiv.className = `nc-ai-msg nc-ai-msg-${role}`;

    const formattedText = this.renderMarkdown(text);

    let toolBadgeHtml = '';
    if (toolExecuted) {
      toolBadgeHtml = `
        <div class="nc-ai-tool-pill">
          <i class="bi bi-gear-fill me-1"></i> Executed action: <strong>${this.escapeHtml(toolExecuted)}</strong>
        </div>
      `;
    }

    // Interactive confirmation card if confirmation is needed
    let confirmHtml = '';
    if (toolResult && toolResult.requiresConfirmation) {
      const confirmActionId = `confirm_${Date.now()}`;
      confirmHtml = `
        <div class="nc-ai-confirm-card mt-2">
          <p class="mb-2 text-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i> Confirmation Required</p>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-primary nc-confirm-btn" data-action="${toolResult.action}" data-target-id="${toolResult.taskId || ''}">
              <i class="bi bi-check-lg me-1"></i> Confirm & Proceed
            </button>
            <button class="btn btn-sm btn-outline-secondary nc-cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="nc-ai-avatar">
        ${role === 'assistant' ? '<i class="bi bi-robot"></i>' : '<i class="bi bi-person"></i>'}
      </div>
      <div class="nc-ai-body">
        <div class="nc-ai-bubble">
          ${toolBadgeHtml}
          ${formattedText}
          ${confirmHtml}
        </div>
      </div>
    `;

    // Bind confirmation handlers if card exists
    const confirmBtn = msgDiv.querySelector('.nc-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const action = confirmBtn.dataset.action;
        const targetId = confirmBtn.dataset.targetId;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing...';
        try {
          let executeRes;
          if (action === 'deleteTask') {
            executeRes = await neocalenderApi.executeAITool('deleteTask', { taskId: targetId, confirmed: true });
          } else if (action === 'rescheduleIncompleteTasks') {
            executeRes = await neocalenderApi.executeAITool('rescheduleIncompleteTasks', { confirmed: true });
          }

          msgDiv.querySelector('.nc-ai-confirm-card').innerHTML = `
            <p class="text-success mb-0"><i class="bi bi-check-circle-fill me-1"></i> ${executeRes?.message || 'Action executed successfully.'}</p>
          `;
          this.onTasksChanged();
        } catch (execErr) {
          msgDiv.querySelector('.nc-ai-confirm-card').innerHTML = `
            <p class="text-danger mb-0"><i class="bi bi-x-circle-fill me-1"></i> ${execErr.message}</p>
          `;
        }
      });
    }

    const cancelBtn = msgDiv.querySelector('.nc-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        msgDiv.querySelector('.nc-ai-confirm-card').innerHTML = `
          <p class="text-muted mb-0"><i class="bi bi-dash-circle me-1"></i> Action cancelled.</p>
        `;
      });
    }

    this.messagesContainer.appendChild(msgDiv);
    this.scrollToBottom();
  }

  setLoading(isLoading) {
    let loader = this.messagesContainer.querySelector('.nc-ai-loading');
    if (isLoading) {
      if (!loader) {
        loader = document.createElement('div');
        loader.className = 'nc-ai-msg nc-ai-msg-assistant nc-ai-loading';
        loader.innerHTML = `
          <div class="nc-ai-avatar"><i class="bi bi-robot"></i></div>
          <div class="nc-ai-body">
            <div class="nc-ai-bubble">
              <span class="nc-typing-dots"><span></span><span></span><span></span></span>
              Thinking and checking schedule...
            </div>
          </div>
        `;
        this.messagesContainer.appendChild(loader);
        this.scrollToBottom();
      }
    } else {
      if (loader) loader.remove();
    }
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  renderMarkdown(text) {
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(text);
    }
    // Fallback basic formatter
    return text
      .replace(/\n\n/g, '<br><br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
