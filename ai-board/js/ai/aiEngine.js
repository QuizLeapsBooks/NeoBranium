/**
 * Core AI Engine
 *
 * Extracts readable AI text for board output, speech, and conversation history.
 */
import { CONFIG, STATE, DOM } from '../utils/constants.js';
import { uiManager } from '../ui/uiManager.js';
import { speechEngine } from '../speech/speechEngine.js';
import { streamHandler } from './streamHandler.js';
import { aiWritingEngine } from './aiWritingEngine.js';
import { boardEngine } from '../board/boardEngine.js';
import { auth } from '/js/auth.js';
import { AiHistorySDK } from '/js/ai-history-sdk.js';

let aiHistory = null;

async function getSignedInUser() {
    if (!auth.currentUser) await auth.authStateReady();
    return auth.currentUser;
}

async function getAuthHeaders() {
    const user = await getSignedInUser();
    if (!user) throw new Error('Sign in to use AI Board.');
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`
    };
}

async function getAiHistory() {
    const user = await getSignedInUser();
    if (!user) return null;
    if (!aiHistory) {
        aiHistory = new AiHistorySDK({
            feature: 'ai_board',
            getAuthToken: () => auth.currentUser?.getIdToken(),
            onOpen: messages => {
                STATE.conversationHistory = messages
                    .filter(message => ['user', 'assistant'].includes(message.role))
                    .map(message => {
                        let content = message.text;
                        if (message.role === 'assistant' && message.metadata?.flow === 'board_analysis') {
                            try {
                                content = extractWritingText(JSON.parse(message.text)) || message.text;
                            } catch {
                                content = message.text;
                            }
                        }
                        return { role: message.role, content };
                    });
                DOM.aiResponseContent.replaceChildren();
                uiManager.showModal(true);
                for (const message of messages) {
                    if (message.role === 'user') {
                        uiManager.appendUserMessage(message.text, message.attachments);
                    } else if (message.metadata?.flow === 'board_analysis') {
                        try {
                            uiManager.appendFullResponse(JSON.parse(message.text));
                        } catch {
                            uiManager.appendSavedAssistantMessage(message.text);
                        }
                    } else {
                        uiManager.appendSavedAssistantMessage(message.text);
                    }
                }
            },
            onNew: () => {
                STATE.conversationHistory = [];
                DOM.aiResponseContent.replaceChildren();
            },
            onError: () => uiManager.showError('Your AI response is ready, but conversation history could not be synced.')
        });
        aiHistory.mountUI(document.body);
    }
    return aiHistory;
}

function makeBoardImageFile(dataUrl) {
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) throw new Error('The board image could not be prepared for history.');
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], 'ai-board.jpg', { type: match[1] });
}

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
        if (STATE.isProcessingVoice || STATE.isAnalyzing) return;

        const base64 = boardEngine.getDrawingDataURL();
        if (!base64) return;

        STATE.isAnalyzing = true;
        if (!isAutoScan) uiManager.setLoading(true);

        try {
            const resp = await fetch(`${CONFIG.API_BASE_URL}/api/analyze-board`, {
                method: 'POST',
                headers: await getAuthHeaders(),
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

            if (!resp.ok) {
                const error = new Error(data.error || data.message || `Request failed (${resp.status})`);
                error.status = resp.status;
                throw error;
            }

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

                if (!isAutoScan) {
                    const historySave = (async () => {
                        const history = await getAiHistory();
                        if (!history) return null;
                        await history.startConversation({ title: 'AI Board analysis' });
                        const conversationId = history.conversationId;
                        let attachments = [];
                        try {
                            attachments = [await history.uploadImage(makeBoardImageFile(base64))];
                        } catch (error) {
                            console.warn('[AI Board] Board image history upload failed:', error.message);
                            uiManager.showError('Your analysis is ready, but its board image could not be saved to history.');
                        }
                        await history.saveMessage({
                            conversationId,
                            role: 'user',
                            text: 'Analyze my AI Board writing.',
                            attachments,
                            messageType: attachments.length ? 'image' : 'text',
                            metadata: { flow: 'board_analysis' }
                        });
                        await history.saveMessage({
                            conversationId,
                            role: 'assistant',
                            text: JSON.stringify(result),
                            metadata: { flow: 'board_analysis' }
                        });
                    })();
                    historySave.catch(error => {
                        console.warn('[AI Board] Conversation history save failed:', error.message);
                        uiManager.showError('Your analysis is ready, but conversation history could not be synced.');
                    });
                }
            }

            if (result.commands) aiWritingEngine.processCommands(result.commands);

        } catch (e) {
            if (!isAutoScan) {
                const message = e.status === 429
                    ? 'AI usage limit reached. Please try again later.'
                    : e.status >= 500
                        ? 'The AI service is temporarily unavailable. Please try again.'
                        : e.message || 'AI Analysis failed. Try again.';
                uiManager.showError(message);
            }
        } finally {
            STATE.isAnalyzing = false;
            uiManager.setLoading(false);
        }
    },

    async sendVoiceQuery(transcript) {
        STATE.isProcessingVoice = true;
        speechEngine.updateMicUI();

        uiManager.showModal(true);
        uiManager.appendUserMessage(transcript);
        STATE.conversationHistory.push({ role: 'user', content: transcript });
        const historySave = (async () => {
            const history = await getAiHistory();
            if (!history) return null;
            await history.startConversation({ title: transcript.slice(0, 45) || 'AI Board conversation' });
            const conversationId = history.conversationId;
            await history.saveMessage({
                conversationId,
                role: 'user',
                text: transcript,
                metadata: { flow: 'voice' }
            });
            return { history, conversationId };
        })().catch(error => {
            console.warn('[AI Board] User message history save failed:', error.message);
            return null;
        });

        try {
            const resp = await fetch(`${CONFIG.API_BASE_URL}/api/chat-stream`, {
                method: 'POST',
                headers: await getAuthHeaders(),
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
                    historySave.then(saved => {
                        if (!saved) return;
                        return saved.history.saveMessage({
                            conversationId: saved.conversationId,
                            role: 'assistant',
                            text: full,
                            metadata: { flow: 'voice' }
                        });
                    }).catch(error => {
                        console.warn('[AI Board] Assistant message history save failed:', error.message);
                        uiManager.showError('Your answer is ready, but conversation history could not be synced.');
                    });
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