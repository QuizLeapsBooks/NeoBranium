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
    const count = parseInt(localStorage.getItem(config.KEYS.COUNT)) || 0;
    const startTime = parseInt(localStorage.getItem(config.KEYS.START_TIME));
    const now = Date.now();

    if (!startTime) {
        return true;
    }

    if (now - startTime >= config.WINDOW_MS) {
        // Reset limit if window has passed
        localStorage.setItem(config.KEYS.COUNT, '0');
        localStorage.setItem(config.KEYS.START_TIME, now.toString());
        return true;
    }

    if (count >= config.MAX) {
        alert(config.ALERT);
        return false;
    }

    return true;
}

/**
 * Generic increment function for usage limits.
 * @param {Object} config - The limit configuration from LIMITS.
 */
function incrementCount(config) {
    let count = parseInt(localStorage.getItem(config.KEYS.COUNT)) || 0;
    let startTime = localStorage.getItem(config.KEYS.START_TIME);
    const now = Date.now();

    if (!startTime) {
        localStorage.setItem(config.KEYS.START_TIME, now.toString());
    }

    localStorage.setItem(config.KEYS.COUNT, (count + 1).toString());
}

// Exported functions for Chat
export const canSendMessage = () => checkLimit(LIMITS.CHAT);
export const incrementChatCount = () => incrementCount(LIMITS.CHAT);

// Exported functions for Paper Generation
export const canGeneratePaper = () => checkLimit(LIMITS.PAPER);
export const incrementPaperCount = () => incrementCount(LIMITS.PAPER);
