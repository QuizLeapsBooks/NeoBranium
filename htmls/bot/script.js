import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { canSendMessage, incrementChatCount } from '../../js/usage-limits.js';
import { isGuestUser } from '../../js/auth.js';

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

        // Guest restriction check
        if (isGuestUser()) {
            this.chatInput.disabled = true;
            this.chatInput.placeholder = "Sign in to use AI Assistant";
            this.chatInput.style.transition = "all 0.5s ease-in-out";
            this.chatInput.style.opacity = "0.6";
            this.chatInput.classList.add("cursor-not-allowed");
            
            this.sendButton.disabled = true;
            this.sendButton.style.transition = "all 0.5s ease-in-out";
            this.sendButton.style.opacity = "0.5";
            this.sendButton.classList.add("cursor-not-allowed");
            return; // Don't proceed to auto-resize or history load
        }

        // Check input state
        this.toggleSendButton();

        // Load chat history from session
        this.loadSessionHistory();
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
        this.sendButton.disabled = !hasText || this.isProcessing;
    }

    async handleSend() {
        if (this.isProcessing) return;

        // Hardened Guest Check: Prevent bypass via DevTools
        if (isGuestUser()) {
            alert("You're in guest mode. Sign in to use the AI Assistant.");
            return;
        }

        // Check chat limit before sending
        if (!canSendMessage()) {
            return;
        }

        const userText = this.chatInput.value.trim();
        if (!userText) return;

        // Add user message
        this.addMessage(this.escapeHtml(userText), 'user');

        // Clear input
        this.chatInput.value = '';
        this.autoResizeTextarea();
        this.toggleSendButton();

        // Get AI response
        await this.getAIResponse(userText);
        
        // Increment chat count after successful send
        incrementChatCount();
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
            const response = await fetch(`${this.API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    message: userText,
                    history: this.chatHistory.slice(-10), // Last 10 messages for context
                    userId: this.userId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Remove thinking message
            thinkingMsg.remove();

            // Add AI response
            if (data.reply) {
                const formattedResponse = marked.parse(data.reply);
                this.addMessage(formattedResponse, 'ai', false, data.reply);
            } else {
                this.addMessage('Sorry, I received an empty response.', 'ai');
            }

        } catch (error) {
            console.error('API Error:', error);

            // Remove thinking message
            thinkingMsg.remove();

            // Show error message
            const errorMessage = `
                <div class="message-content error-message">
                    <p>⚠️ <strong>Connection Error</strong></p>
                    <p>I'm having trouble connecting to the server. Please:</p>
                    <ul>
                        <li>Check your internet connection</li>
                        <li>Try refreshing the page</li>
                        <li>Try again in a few moments</li>
                    </ul>
                </div>
            `;
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ChatAssistant();
});