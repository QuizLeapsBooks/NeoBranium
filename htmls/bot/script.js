import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { auth } from '../../js/auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';
import { AiHistorySDK } from '/js/ai-history-sdk.js';

// Configure marked for better code highlighting
marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function (code, lang) {
        return code;
    }
});

class ChatAssistant {
    constructor() {
        this.chatHistory = [];
        this.userId = this.generateUserId();
        this.API_BASE_URL = this.getApiBaseUrl();
        this.genAI = null;
        this.isProcessing = false;
        this.aiHistory = null;
        this.serverWakeRequested = false;

        // DOM Elements
        this.chatInput = document.querySelector('#chat-input');
        this.sendButton = document.querySelector('#send-btn');
        this.chatContainer = document.querySelector('#chat-body');

        this.init();
    }

    init() {
        // Add welcome message
        this.addWelcomeMessage();

        // Setup event listeners
        this.setupEventListeners();

        this.chatInput.disabled = true;
        this.chatInput.placeholder = 'Checking your sign-in...';
        onAuthStateChanged(auth, user => {
            const canUseAssistant = Boolean(user && !user.isAnonymous);
            this.chatInput.disabled = !canUseAssistant;
            this.chatInput.placeholder = canUseAssistant
                ? 'Ask about science, math, or coding...'
                : 'Sign in to use AI Assistant';
            this.toggleSendButton();
            if (!canUseAssistant) return;

            if (!this.serverWakeRequested) {
                this.serverWakeRequested = true;
                void this.wakeUpServer();
            }
            this.loadSessionHistory();
            if (this.aiHistory) return;
            this.aiHistory = new AiHistorySDK({
                feature: 'ai_assistant',
                getAuthToken: () => auth.currentUser?.getIdToken(),
                onOpen: messages => {
                    this.chatHistory = [];
                    this.chatContainer.replaceChildren();
                    messages.forEach(message => {
                        if (message.role === 'user') {
                            this.addMessage(this.escapeHtml(message.text), 'user', false, message.text);
                        } else if (message.role === 'assistant') {
                            this.addMessage(marked.parse(message.text), 'ai', false, message.text);
                        }
                    });
                },
                onNew: () => {
                    this.chatHistory = [];
                    sessionStorage.removeItem('chatHistory');
                    this.chatContainer.replaceChildren();
                    this.addWelcomeMessage();
                },
                onError: () => this.showHistoryError()
            });
            this.aiHistory.mountUI(document.body);
        });

        // Check input state
        this.toggleSendButton();
    }

    getApiBaseUrl() {
        if (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1'
        ) {
            return 'http://localhost:3000/api';
        }

        return 'https://neobranium.onrender.com/api';
    }

    // Ping server to wake it up (Render free tier goes to sleep)
    async wakeUpServer() {
        try {
            await fetch(`${this.API_BASE_URL}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
        } catch (_) {
            // Ignore - just a wake-up ping
        }
    }

    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    addWelcomeMessage() {
        const welcomeMessage = `
            <div class="message-content">
                <p>✨ <strong>Welcome to NS-x AI Learning Assistant!</strong></p>
                <p>I'm here to help you explore:</p>
                <ul>
                    <li>📐 Mathematics concepts</li>
                    <li>🔬 Science explanations</li>
                    <li>💻 Programming tutorials</li>
                    <li>📚 Study tips & techniques</li>
                </ul>
                <p><em>What would you like to learn today?</em></p>
            </div>
        `;
        this.addMessage(welcomeMessage, 'ai');
    }

    setupEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => this.handleSend());

        // Input events
        this.chatInput.addEventListener('input', () => {
            this.toggleSendButton();
            this.autoResizeTextarea();
        });

        // Enter key (with Shift for new line)
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
    }

    autoResizeTextarea() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 150) + 'px';
    }

    toggleSendButton() {
        const hasText = this.chatInput.value.trim().length > 0;
        const accountRequired = !auth.currentUser || auth.currentUser.isAnonymous;
        this.sendButton.disabled = !hasText || this.isProcessing || accountRequired;
    }

    async handleSend() {
        if (this.isProcessing) return;

        // Hardened Guest Check: Prevent bypass via DevTools
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            alert("You're in guest mode. Sign in to use the AI Assistant.");
            return;
        }

        const userText = this.chatInput.value.trim();
        if (!userText) return;

        // Add user message
        this.addMessage(this.escapeHtml(userText), 'user');
        if (this.aiHistory) {
            this.aiHistory.saveMessage({ role: 'user', text: userText })
                .catch(() => this.showHistoryError());
        }

        // Clear input
        this.chatInput.value = '';
        this.autoResizeTextarea();
        this.toggleSendButton();

        // Get AI response
        await this.getAIResponse(userText);
        
    }

    addMessage(content, type, isThinking = false, rawContent = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message ${isThinking ? 'thinking-message' : ''}`;

        if (isThinking) {
            messageDiv.innerHTML = '<span>Thinking</span>';
        } else {
            // Sanitize and render markdown
            const cleanContent = DOMPurify.sanitize(content);
            messageDiv.innerHTML = `<div class="message-content">${cleanContent}</div>`;
        }

        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();

        // Store in history
        if (!isThinking) {
            this.chatHistory.push({
                role: type === 'user' ? 'user' : 'assistant',
                content: rawContent || content
            });
            this.saveSessionHistory();
        }

        return messageDiv;
    }

    async getAIResponse(userText) {
        this.isProcessing = true;
        this.toggleSendButton();

        // Show thinking indicator
        const thinkingMsg = this.addMessage('', 'ai', true);

        try {
            const user = auth.currentUser;
            if (!user || user.isAnonymous) {
                throw new Error('Sign in to a full account to use the AI Assistant.');
            }
            const response = await fetch(`${this.API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(auth.currentUser ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({
                    message: userText,
                       history: this.chatHistory.slice(-11, -1), // The current question is already in chatHistory; send only prior messages.
                    userId: this.userId
                })
            });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || data.reply || `The AI Assistant returned HTTP ${response.status}.`);
                }

            // Remove thinking message
            thinkingMsg.remove();

            // Add AI response
            if (data.reply) {
                const formattedResponse = marked.parse(data.reply);
                this.addMessage(formattedResponse, 'ai', false, data.reply);
                if (this.aiHistory) {
                    this.aiHistory.saveMessage({ role: 'assistant', text: data.reply })
                        .catch(() => this.showHistoryError());
                }
            } else {
                this.addMessage('Sorry, I received an empty response. Please try again.', 'ai');
            }

        } catch (error) {
            console.error('API Error:', error);

            // Remove thinking message
            thinkingMsg.remove();

            this.chatInput.value = userText;
            this.autoResizeTextarea();
            const errorText = this.escapeHtml(
                error?.message || 'The AI Assistant could not complete your request.'
            );
            const errorMessage = `<div class="message-content error-message">
                <p>⚠️ <strong>AI Assistant could not respond.</strong></p>
                <p>${errorText}</p>
                <p>Your question is still in the input box. You can try again when the service is available.</p>
            </div>`;
            this.addMessage(errorMessage, 'ai');
        } finally {
            this.isProcessing = false;
            this.toggleSendButton();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.chatContainer.scrollTo({
            top: this.chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    saveSessionHistory() {
        sessionStorage.setItem('chatHistory', JSON.stringify(this.chatHistory));
    }

    loadSessionHistory() {
        const saved = sessionStorage.getItem('chatHistory');
        if (saved) {
            try {
                this.chatHistory = JSON.parse(saved);
                // Optionally restore messages to UI
            } catch (e) {
                console.warn('Failed to load chat history');
            }
        }
    }

    showHistoryError() {
        this.showToast('Conversation history could not be synced. Your current answer is still available.');
    }

    showToast(message) {
        let toast = document.getElementById('ai-history-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ai-history-toast';
            toast.setAttribute('role', 'status');
            toast.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9100;padding:10px 16px;border-radius:8px;background:#28213d;color:#fff;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,.3)';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(this.historyToastTimer);
        this.historyToastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ChatAssistant();
});
