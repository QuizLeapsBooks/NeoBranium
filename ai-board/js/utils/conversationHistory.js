export const MAX_AI_BOARD_CONVERSATION_MESSAGES = 10;
export const MAX_AI_BOARD_HISTORY_MESSAGE_CHARS = 2000;

export function appendBoundedHistory(history, message, maxEntries = MAX_AI_BOARD_CONVERSATION_MESSAGES) {
    const capacity = Number.isInteger(maxEntries) && maxEntries > 0
        ? maxEntries
        : MAX_AI_BOARD_CONVERSATION_MESSAGES;
    const boundedMessage = typeof message?.content === 'string'
        ? { ...message, content: message.content.slice(0, MAX_AI_BOARD_HISTORY_MESSAGE_CHARS) }
        : message;
    return [...history, boundedMessage].slice(-capacity);
}
