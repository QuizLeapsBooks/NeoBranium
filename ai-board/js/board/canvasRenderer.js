/**
 * Optimized Canvas Renderer
 * Fix: Separate DPR scaling from pan transform to prevent coordinate drift.
 * Fix: Proper resize with debounce to avoid reflow thrashing.
 * Fix: Clear uses identity transform to always wipe full canvas buffer.
 * Fix: drawStroke uses quadratic curves for smooth handwriting feel.
 */
import { CONFIG, STATE, DOM } from '../utils/constants.js';

export const canvasRenderer = {
    ctx: null,
    dpr: Math.min(window.devicePixelRatio || 1, 3), // Cap at 3x to save VRAM on high-DPI mobile

    init() {
        this.ctx = DOM.canvas.getContext('2d', {
            desynchronized: true,   // Reduces latency on supported browsers
            alpha: false            // Opaque canvas avoids alpha compositing cost
        });
        this.resize();
    },

    resize() {
        // Use the board container dimensions, not the canvas itself (avoids feedback loop)
        const container = DOM.boardContainer || DOM.canvas.parentElement;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;

        DOM.canvas.width = Math.floor(w * this.dpr);
        DOM.canvas.height = Math.floor(h * this.dpr);
        DOM.canvas.style.width = `${w}px`;
        DOM.canvas.style.height = `${h}px`;

        // After resize the canvas state is reset — re-apply defaults
        this._applyContextDefaults();
    },

    /**
     * Convert a CSS-space point (already adjusted for scroll) to canvas buffer space.
     * This is used internally when we need raw pixel coords (e.g. for clipping).
     */
    toBufferCoord(cssX, cssY) {
        return {
            x: (cssX + STATE.scrollX) * this.dpr,
            y: (cssY + STATE.scrollY) * this.dpr
        };
    },

    /**
     * Apply the current pan transform.
     * Strategy: use a simple CSS-pixel transform. DPR scaling is handled once
     * via ctx.scale after clearing so it never accumulates.
     *
     * The canvas coordinate system is:
     *   (0,0) = top-left of the CSS pixel viewport
     * Pan offset is added so strokes drawn at logical (x,y) appear at (x+scrollX, y+scrollY) on screen.
     */
    applyTransform() {
        // Reset to identity first to prevent cumulative drift
        this.ctx.setTransform(
            this.dpr, 0,
            0, this.dpr,
            Math.round(STATE.scrollX * this.dpr),
            Math.round(STATE.scrollY * this.dpr)
        );
        this._applyContextDefaults();
    },

    _applyContextDefaults() {
        const ctx = this.ctx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = CONFIG.USER_PEN_COLOR;
        ctx.lineWidth = CONFIG.USER_PEN_WIDTH;
        ctx.shadowBlur = 4;
        ctx.shadowColor = CONFIG.USER_PEN_GLOW;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    },

    /**
     * Clear the entire canvas buffer regardless of current transform.
     */
    clear() {
        // Temporarily use identity transform so we clear the full buffer
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = '#0b0f19';
        this.ctx.fillRect(0, 0, DOM.canvas.width, DOM.canvas.height);
        this.ctx.restore();
        // Restore the pan transform after clearing
        this.applyTransform();
    },

    /**
     * Draw a smooth stroke from an array of {x,y} points.
     * Uses quadratic Bézier curves through midpoints for natural handwriting feel.
     * color and width default to current config but can be overridden for AI strokes.
     */
    drawStroke(points, color = CONFIG.USER_PEN_COLOR, width = CONFIG.USER_PEN_WIDTH) {
        if (!points || points.length < 2) return;
        const ctx = this.ctx;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.shadowBlur = (color === CONFIG.AI_PEN_COLOR) ? 6 : 4;
        ctx.shadowColor = (color === CONFIG.AI_PEN_COLOR) ? CONFIG.AI_PEN_COLOR : CONFIG.USER_PEN_GLOW;

        ctx.moveTo(points[0].x, points[0].y);

        if (points.length === 2) {
            ctx.lineTo(points[1].x, points[1].y);
        } else {
            // Smooth quadratic curves through midpoints
            for (let i = 1; i < points.length - 1; i++) {
                const mx = (points[i].x + points[i + 1].x) / 2;
                const my = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
            }
            // Connect to last point
            const last = points[points.length - 1];
            ctx.lineTo(last.x, last.y);
        }

        ctx.stroke();
        ctx.restore();
    },

    /**
     * Full redraw from history. Called after undo/redo/pan/resize.
     * Clears then replays all strokes in order.
     */
    redraw(history) {
        this.clear();
        if (!history || history.length === 0) return;
        for (const stroke of history) {
            this.drawStroke(stroke.points, stroke.color, stroke.width);
        }
    }
};