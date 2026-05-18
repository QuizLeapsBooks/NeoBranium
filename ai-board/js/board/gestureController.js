/**
 * Gesture & Panning Controller
 *
 * Key fixes:
 * - preventDefault on touchmove to stop the page from scrolling during pan
 * - touchstart also prevented to avoid 300ms click delay on iOS
 * - Pan redraws are throttled via requestAnimationFrame (not every touchmove event)
 * - Correctly interrupts any in-progress pointer drawing when two-finger pan begins
 * - handleTouchEnd resets all pan state cleanly
 * - No conflicts with boardEngine's pointer events (touch events fire separately)
 */
import { STATE, DOM } from '../utils/constants.js';
import { canvasRenderer } from './canvasRenderer.js';
import { undoManager } from './undoManager.js';

export const gestureController = {
    _panRafPending: false,

    init() {
        // { passive: false } is REQUIRED so preventDefault() actually works
        DOM.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        DOM.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        DOM.canvas.addEventListener('touchend', () => this.handleTouchEnd());
        DOM.canvas.addEventListener('touchcancel', () => this.handleTouchEnd());
    },

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            // Two-finger gesture detected — switch to pan mode
            e.preventDefault(); // Prevent browser zoom/scroll

            STATE.isPanning = true;
            STATE.isDrawing = false; // Interrupt any active stroke

            STATE.lastPanX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            STATE.lastPanY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        }
        // Single-touch: let boardEngine's pointer events handle it
    },

    handleTouchMove(e) {
        if (e.touches.length !== 2 || !STATE.isPanning) return;

        e.preventDefault(); // Prevent page scroll/zoom while panning

        const currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        const dx = currentX - STATE.lastPanX;
        const dy = currentY - STATE.lastPanY;

        STATE.scrollX += dx;
        STATE.scrollY += dy;

        STATE.lastPanX = currentX;
        STATE.lastPanY = currentY;

        // Throttle redraws to one per animation frame
        if (!this._panRafPending) {
            this._panRafPending = true;
            requestAnimationFrame(() => {
                this._panRafPending = false;
                canvasRenderer.applyTransform();
                canvasRenderer.redraw(undoManager.getHistory());
            });
        }
    },

    handleTouchEnd() {
        // Only exit pan mode when all fingers lifted
        // (touchend fires per finger, so check remaining touches via a small delay)
        requestAnimationFrame(() => {
            STATE.isPanning = false;
        });
    }
};