/**
 * Usage Limit System Utility
 * Handles various usage limits using localStorage.
 */

const LIMITS = {
    CHAT: {
        MAX: 5,
        WINDOW_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
        KEYS: {
            COUNT: 'chatCount',
            START_TIME: 'chatStartTime'
        },
        ALERT: "Weekly chat limit reached"
    },
    PAPER: {
        MAX: 2,
        WINDOW_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
        KEYS: {
            COUNT: 'paperCount',
            START_TIME: 'paperStartTime'
        },
        ALERT: "Monthly limit reached"
    }
};

/**
 * Generic check function for usage limits.
 * @param {Object} config - The limit configuration from LIMITS.
 * @returns {boolean} True if allowed, false otherwise.
 */
function checkLimit(config) {
    return true; // Limits are now handled server-side via Firebase/middleware
}

function incrementCount(config) {
    // Handled server-side
}

// Exported functions for Chat
export const canSendMessage = () => checkLimit(LIMITS.CHAT);
export const incrementChatCount = () => incrementCount(LIMITS.CHAT);

// Exported functions for Paper Generation
export const canGeneratePaper = () => checkLimit(LIMITS.PAPER);
export const incrementPaperCount = () => incrementCount(LIMITS.PAPER);
