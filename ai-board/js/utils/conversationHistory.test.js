import assert from 'node:assert/strict';
import test from 'node:test';
import {
    appendBoundedHistory,
    MAX_AI_BOARD_CONVERSATION_MESSAGES,
    MAX_AI_BOARD_HISTORY_MESSAGE_CHARS
} from './conversationHistory.js';

test('AI Board conversation history remains within the backend message limit', () => {
    let history = [];
    for (let index = 0; index < MAX_AI_BOARD_CONVERSATION_MESSAGES * 3; index += 1) {
        history = appendBoundedHistory(history, { role: 'user', content: String(index) });
    }
    assert.equal(history.length, MAX_AI_BOARD_CONVERSATION_MESSAGES);
    assert.equal(history[0].content, String(MAX_AI_BOARD_CONVERSATION_MESSAGES * 2));
    assert.equal(history.at(-1).content, String(MAX_AI_BOARD_CONVERSATION_MESSAGES * 3 - 1));
});

test('AI Board history caps the size of each stored message', () => {
    const history = appendBoundedHistory([], {
        role: 'assistant',
        content: 'x'.repeat(MAX_AI_BOARD_HISTORY_MESSAGE_CHARS + 100)
    });
    assert.equal(history[0].content.length, MAX_AI_BOARD_HISTORY_MESSAGE_CHARS);
});
