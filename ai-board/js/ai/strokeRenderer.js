/**
 * AI Character Renderer
 *
 * Fixes:
 * 1. measureText() was called with the DPR-scaled transform active, returning
 *    values multiplied by dpr. Now uses an off-screen measuring context that
 *    always works in CSS pixel space, matching the logical coordinates used
 *    for drawing.
 *
 * 2. Font must be set on ctx BEFORE translate/rotate so the ctx.save/restore
 *    cycle keeps the font active during fillText.
 *
 * 3. Increased jitter and rotation range slightly for a more handwritten feel.
 *
 * 4. aiHighlightSystem.circle() no longer used for coordinate mapping —
 *    that is now handled in aiWritingEngine.processCommands() which scales
 *    Gemini's 0-1000 coords to actual canvas world coords before calling here.
 */
import { CONFIG } from '../utils/constants.js';
import { canvasRenderer } from '../board/canvasRenderer.js';

// ─── Off-screen measuring context ────────────────────────────────────────────
// This context is NEVER transformed — always identity — so measureText() returns
// true CSS-pixel widths regardless of the main canvas's DPR transform.
const _measureCanvas = document.createElement('canvas');
const _measureCtx = _measureCanvas.getContext('2d');

const FONT_NORMAL = 'bold 20px "Outfit", sans-serif';
const FONT_SMALL = 'bold 14px "Outfit", sans-serif';

/**
 * Measure a string's width in CSS pixels (independent of canvas transform).
 */
export function measureText(text, small = false) {
    _measureCtx.font = small ? FONT_SMALL : FONT_NORMAL;
    return _measureCtx.measureText(text).width;
}

// ─── Stroke / character renderer ─────────────────────────────────────────────

export const strokeRenderer = {
    /**
     * Draw a single character at world-space (x, y) with handwriting jitter.
     * Returns the character's CSS-pixel advance width so the caller can move
     * the cursor correctly.
     *
     * The canvas transform is already set to (dpr, 0, 0, dpr, scrollX*dpr, scrollY*dpr)
     * so drawing at logical (x, y) places the char at the right screen position.
     */
    drawChar(char, x, y, isSub = false, isSup = false) {
        const ctx = canvasRenderer.ctx;

        // Mild handwriting jitter
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;
        const rotate = (Math.random() - 0.5) * 0.08; // ±~4.6°

        const isSmall = isSub || isSup;
        const fontSize = isSmall ? 14 : 20;
        const font = isSmall ? FONT_SMALL : FONT_NORMAL;

        let renderY = y + jitterY;
        if (isSub) renderY += 8;
        if (isSup) renderY -= 8;

        ctx.save();

        // Set font BEFORE translate so it's active during fillText
        ctx.font = font;
        ctx.fillStyle = CONFIG.AI_PEN_COLOR;
        ctx.shadowBlur = 4;
        ctx.shadowColor = CONFIG.AI_PEN_COLOR;
        ctx.globalAlpha = 1;

        ctx.translate(x + jitterX, renderY);
        ctx.rotate(rotate);

        ctx.fillText(char, 0, 0);

        // Occasional faint double-stroke for ink depth effect
        if (Math.random() > 0.75) {
            ctx.globalAlpha = 0.35;
            ctx.fillText(char, 0.4, 0.4);
        }

        ctx.restore();

        // Return CSS-pixel advance width measured without any transform
        return measureText(char, isSmall);
    }
};

// ─── AI Highlight System ──────────────────────────────────────────────────────

export const aiHighlightSystem = {
    /**
     * Animate a series of connected line segments with the AI pen color.
     * Points are in logical (world) coordinates.
     */
    async animateStroke(points) {
        for (let i = 1; i < points.length; i++) {
            canvasRenderer.drawStroke(
                points.slice(i - 1, i + 1),
                CONFIG.AI_PEN_COLOR,
                CONFIG.AI_PEN_WIDTH
            );
            // Yield to the browser every 2 segments to stay smooth
            if (i % 2 === 0) await new Promise(r => requestAnimationFrame(r));
        }
    },

    /**
     * Draw an animated circle at logical canvas coords (x, y) with given radius.
     * All args are already in canvas world-space — coordinate mapping is done
     * upstream in processCommands().
     */
    async circle(x, y, radius) {
        const pts = [];
        const steps = 48; // smoother than 40
        for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            pts.push({
                x: x + Math.cos(a) * radius,
                y: y + Math.sin(a) * radius
            });
        }
        await this.animateStroke(pts);
    },

    /**
     * Draw an animated underline from (x, y) extending `width` pixels right.
     */
    async underline(x, y, width) {
        await this.animateStroke([
            { x, y: y + 4 },
            { x: x + width, y: y + 4 }
        ]);
    },

    /**
     * Draw an animated arrow from (x1,y1) to (x2,y2).
     */
    async arrow(x1, y1, x2, y2) {
        // Shaft
        await this.animateStroke([{ x: x1, y: y1 }, { x: x2, y: y2 }]);

        // Arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const len = 14;
        const spread = 0.45; // radians
        await this.animateStroke([
            { x: x2, y: y2 },
            { x: x2 - len * Math.cos(angle - spread), y: y2 - len * Math.sin(angle - spread) }
        ]);
        await this.animateStroke([
            { x: x2, y: y2 },
            { x: x2 - len * Math.cos(angle + spread), y: y2 - len * Math.sin(angle + spread) }
        ]);
    }
};