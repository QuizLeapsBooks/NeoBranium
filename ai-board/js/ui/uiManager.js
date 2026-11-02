/**
 * UI & Modal Manager
 */
import { STATE, DOM } from '../utils/constants.js';
import { utils } from '../utils/helpers.js';
import { speechEngine } from '../speech/speechEngine.js';

export const uiManager = {
    init() {
        DOM.closeModal.addEventListener('click', () => this.showModal(false));
        DOM.minimizeModal.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.responseModal.classList.add('minimized');
            DOM.responseModal.classList.remove('active');
        });
        DOM.expandModal.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.responseModal.classList.remove('minimized');
            DOM.responseModal.classList.add('active');
        });
        DOM.responseModal.addEventListener('click', () => {
            if (DOM.responseModal.classList.contains('minimized')) {
                DOM.responseModal.classList.remove('minimized');
                DOM.responseModal.classList.add('active');
            }
        });
        DOM.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                STATE.mode = e.target.dataset.mode;
                DOM.modeBtns.forEach(b => b.classList.toggle('active', b === e.target));
            });
        });
    },

    showModal(val) {
        DOM.responseModal.classList.toggle('active', val);
        if (!val) speechEngine.stopSpeaking();
    },

    setLoading(val) {
        DOM.loadingOverlay.classList.toggle('active', val);
    },

    showError(msg) {
        const html = `<div class="ai-error-card"><p>${msg}</p></div>`;
        DOM.aiResponseContent.insertAdjacentHTML('beforeend', html);
        this.showModal(true);
    },

    appendUserMessage(text, attachments = []) {
        const div = document.createElement('div');
        div.className = 'chat-message user';
        const content = document.createElement('div');
        content.textContent = text;
        div.appendChild(content);
        for (const attachment of attachments) {
            if (typeof attachment?.url !== 'string') continue;
            const image = document.createElement('img');
            image.src = attachment.url;
            image.alt = attachment.name || 'Saved conversation image';
            image.loading = 'lazy';
            image.referrerPolicy = 'no-referrer';
            image.style.cssText = 'display:block;max-width:min(100%,360px);max-height:280px;margin-top:8px;border-radius:8px';
            div.appendChild(image);
        }
        DOM.aiResponseContent.appendChild(div);
        this.scrollToBottom();
    },

    displayFullResponse(result) {
        DOM.aiResponseContent.innerHTML = '';
        this.appendFullResponse(result);
    },

    appendFullResponse(result) {
        const div = document.createElement('div');
        div.className = 'chat-message assistant';
        if (Array.isArray(result.blocks)) {
            result.blocks.forEach(block => {
                const content = block.content || (Array.isArray(block.items) ? block.items.join('\n') : '');
                if (content) div.innerHTML += utils.markdownToHtml(content);
            });
        } else {
            div.innerHTML = utils.markdownToHtml(result.explanation || "");
        }
        DOM.aiResponseContent.appendChild(div);
        utils.renderMath(div);
        this.scrollToBottom();
    },

    appendSavedAssistantMessage(text) {
        const div = document.createElement('div');
        div.className = 'chat-message assistant';
        div.innerHTML = utils.markdownToHtml(text);
        DOM.aiResponseContent.appendChild(div);
        utils.renderMath(div);
        this.scrollToBottom();
    },

    createStreamingBlock() {
        const div = document.createElement('div');
        div.className = 'chat-message assistant';
        div.innerHTML = '<span class="stream-content"></span><span class="streaming-cursor"></span>';
        DOM.aiResponseContent.appendChild(div);
        return div.querySelector('.stream-content');
    },

    updateStreamingBlock(el, content) {
        el.innerHTML = utils.markdownToHtml(content);
        this.scrollToBottom();
    },

    showHint(text) {
        if (!text) return;
        DOM.hintContent.innerHTML = utils.markdownToHtml(text);
        DOM.hintPopup.classList.remove('hidden');
        utils.renderMath(DOM.hintContent);
        setTimeout(() => DOM.hintPopup.classList.add('hidden'), 10000);
    },

    scrollToBottom() {
        DOM.aiResponseContent.scrollTop = DOM.aiResponseContent.scrollHeight;
    }
};
