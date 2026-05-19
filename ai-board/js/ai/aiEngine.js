/**
 * Core AI Engine
 *
 * Fix: extractSpeechText() walks the blocks[] array to build clean speech text,
 * instead of relying on the now-absent result.explanation field.
 * This is the ONLY change — all API calls, streaming, and modal logic are untouched.
 */
import { CONFIG, STATE, DOM } from '../utils/constants.js';
import { uiManager } from '../ui/uiManager.js';
import { speechEngine } from '../speech/speechEngine.js';
import { streamHandler } from './streamHandler.js';
import { aiWritingEngine } from './aiWritingEngine.js';
import { boardEngine } from '../board/boardEngine.js';

/**
 * Converts a blocks[] array from the AI response into a single clean string
 * suitable for speech synthesis. Skips equation blocks (LaTeX is unreadable aloud).
 * Falls back to legacy result.explanation if blocks are absent.
 */
function extractSpeechText(result) {
    // Legacy format
    if (result.explanation) return result.explanation;

    // New block format
    if (!result.blocks || result.blocks.length === 0) return '';

    const parts = [];
    for (const block of result.blocks) {
        switch (block.type) {
            case 'text':
            case 'heading':
            case 'warning':
            case 'final_answer':
                if (block.content) parts.push(block.content);
                break;
            case 'step':
                if (block.content) {
                    const prefix = block.number ? `Step ${block.number}. ` : '';
                    parts.push(prefix + block.content);
                }
                break;
            case 'bullet_list':
                if (Array.isArray(block.items)) {
                    parts.push(...block.items);
                }
                break;
            case 'equation':
                // Skip — LaTeX spoken aloud is noise
                break;
            default:
                if (block.content) parts.push(block.content);
        }
    }

    return parts.join(' ');
}

/**
 * Converts blocks[] to a plain markdown/text string for the AI writing engine.
 * The writing engine expects a flat text string to animate onto the canvas.
 */
function extractWritingText(result) {
    if (result.explanation) return result.explanation;
    if (!result.blocks) return '';

    return result.blocks
        .filter(b => b.type !== 'equation') // skip raw LaTeX
        .map(b => b.content || (Array.isArray(b.items) ? b.items.join(', ') : ''))
        .filter(Boolean)
        .join(' ');
}

export const aiEngine = {
    async analyzeBoard(isAutoScan = false) {
        if (STATE.isProcessingVoice) return;

        const base64 = boardEngine.getDrawingDataURL();
        if (!base64) return;

        if (!isAutoScan) uiManager.setLoading(true);

        try {
            const resp = await fetch(`${CONFIG.API_BASE_URL}/api/analyze-board`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ base64, mimeType: 'image/jpeg', mode: STATE.mode, isAutoScan })
            });
            const data = await resp.json();

            if (resp.status === 202 && data.status === 'queued') {
                uiManager.setLoading(false);
                const { clientQueueManager } = await import('../ui/clientQueueManager.js');
                clientQueueManager.handleQueuedResponse(data);
                return;
            }

            if (resp.status === 429 && data.status === 'limit_reached') {
                uiManager.setLoading(false);
                uiManager.showError(data.message);
                return;
            }

            if (!resp.ok) throw new Error(data.error);

            const result = data.result;

            if (isAutoScan) {
                // Hint popup uses first meaningful text block
                const hintText = result.explanation
                    || result.blocks?.find(b => b.type === 'text' || b.type === 'step')?.content
                    || '';
                uiManager.showHint(hintText);
            } else {
                uiManager.displayFullResponse(result);

                // ✅ Fixed: extract clean speech text from blocks
                const speechText = extractSpeechText(result);
                const writingText = extractWritingText(result);

                speechEngine.speakText(speechText);
                aiWritingEngine.writeExplanation(writingText);
            }

            if (result.commands) aiWritingEngine.processCommands(result.commands);

        } catch (e) {
            if (!isAutoScan) uiManager.showError("AI Analysis failed. Try again.");
        } finally {
            uiManager.setLoading(false);
        }
    },

    async sendVoiceQuery(transcript) {
        STATE.isProcessingVoice = true;
        speechEngine.updateMicUI();

        uiManager.showModal(true);
        uiManager.appendUserMessage(transcript);
        STATE.conversationHistory.push({ role: 'user', content: transcript });

        try {
            const resp = await fetch(`${CONFIG.API_BASE_URL}/api/chat-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: transcript, history: STATE.conversationHistory, mode: STATE.mode })
            });
            if (!resp.ok) throw new Error();

            const streamBlock = uiManager.createStreamingBlock();
            await streamHandler.handleStream(resp,
                (content) => uiManager.updateStreamingBlock(streamBlock, content),
                (full) => {
                    STATE.conversationHistory.push({ role: 'assistant', content: full });
                    speechEngine.speakText(full);
                    aiWritingEngine.writeExplanation(full);
                }
            );
        } catch (e) {
            uiManager.showError("Chat failed.");
        } finally {
            STATE.isProcessingVoice = false;
            speechEngine.updateMicUI();
        }
    }
};

export const sendVoiceQuery = (t) => aiEngine.sendVoiceQuery(t);