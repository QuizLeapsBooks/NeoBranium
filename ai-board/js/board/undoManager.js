/**
 * Vector-based Undo/Redo System
 *
 * Key fixes:
 * - Use structuredClone() instead of JSON.parse(JSON.stringify()) for ~3-5x faster deep cloning
 *   (structuredClone is available in all modern browsers)
 * - Falls back to JSON method for environments without structuredClone
 * - History cap enforced to prevent unbounded memory growth
 * - Redo stack cleared on new stroke (correct undo tree behaviour)
 */
import { CONFIG } from '../utils/constants.js';

const deepClone = typeof structuredClone === 'function'
    ? (obj) => structuredClone(obj)
    : (obj) => JSON.parse(JSON.stringify(obj));

class UndoManager {
    constructor() {
        this.history = [];
        this.redoStack = [];
    }

    saveStroke(stroke) {
        this.history.push(deepClone(stroke));

        // Trim oldest strokes if over the limit
        if (this.history.length > CONFIG.MAX_HISTORY) {
            this.history.shift();
        }

        // New stroke invalidates any redo branch
        this.redoStack = [];
    }

    undo() {
        if (this.history.length === 0) return null;
        const stroke = this.history.pop();
        this.redoStack.push(stroke);
        return this.history; // Caller can redraw from this
    }

    redo() {
        if (this.redoStack.length === 0) return null;
        const stroke = this.redoStack.pop();
        this.history.push(stroke);
        return this.history;
    }

    clear() {
        this.history = [];
        this.redoStack = [];
    }

    getHistory() {
        return this.history;
    }
}

export const undoManager = new UndoManager();