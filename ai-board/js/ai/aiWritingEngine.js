/**
 * AI Writing Orchestrator
 *
 * Fixes:
 *
 * 1. WORD OVERLAP / TEXT CRAMMING
 *    Root cause: canvasRenderer.ctx.measureText() was called while the canvas
 *    had a DPR-scaled transform active (setTransform with dpr scaling), so it
 *    returned values in device pixels (~2x on Retina). The word-wrap check and
 *    cursor advance both used these inflated values, causing words to either
 *    vastly overlap (advance too small) or all collapse to one line (check fires
 *    too early because "wordWidth" was already 2x the logical width).
 *
 *    Fix: use the exported measureText() from strokeRenderer which always uses
 *    an identity-transform off-screen context → true CSS-pixel widths.
 *
 * 2. AI CIRCLES / COMMANDS IN WRONG POSITION
 *    Root cause: Gemini returns x,y in 0–1000 space relative to the exported
 *    image (which is a cropped, padded snapshot of just the drawn content).
 *    processCommands() passed these raw values directly to aiHighlightSystem
 *    which drew them as canvas world-coordinates → completely wrong position.
 *
 *    Fix: processCommands() now maps Gemini's 0-1000 coords back to world space
 *    using the same bounding box that getDrawingDataURL() used to crop the image.
 *
 * 3. WORD SPACING
 *    Space between words is now measured as a real space character width instead
 *    of a hardcoded 20px, so it scales correctly with font size.
 *
 * Nothing else changed — AI writing toggle, writeWord, char-by-char animation
 * are all preserved.
 */
import { CONFIG, STATE, DOM } from '../utils/constants.js';
import { strokeRenderer, aiHighlightSystem, measureText } from './strokeRenderer.js';
import { canvasRenderer } from '../board/canvasRenderer.js';
import { boardEngine } from '../board/boardEngine.js';
import { undoManager } from '../board/undoManager.js';

// Space width in logical CSS pixels (measured once, reused)
const SPACE_WIDTH = measureText(' ', false) + 4; // +4 for a natural inter-word gap

export const aiWritingEngine = {

    async writeExplanation(text) {
        if (!STATE.showAIWriting) return;

        // Cancel any previous AI writing session
        STATE.isWritingAI = false;
        await new Promise(r => setTimeout(r, 120));
        STATE.isWritingAI = true;

        const margin = CONFIG.MARGIN;

        // Start below the lowest drawn content, with a comfortable gap
        const startX = margin;
        const startY = this._getContentBottom() + 70;
        let curX = startX;
        let curY = startY;

        // Logical canvas width (CSS pixels, not device pixels)
        const logicalWidth = DOM.canvas.width / canvasRenderer.dpr;

        const words = text.split(/\s+/).filter(Boolean);

        for (const word of words) {
            if (!STATE.isWritingAI) break;

            // Use the off-screen measure context (no DPR transform contamination)
            const wordWidth = measureText(word, false);

            // Wrap to next line if this word doesn't fit
            if (curX + wordWidth > logicalWidth - margin) {
                curX = startX;
                curY += CONFIG.LINE_HEIGHT;
            }

            await this._writeWord(word, curX, curY);
            curX += wordWidth + SPACE_WIDTH;

            // Keep bounds updated so AI scan picks up the written area
            boardEngine.updateBounds(curX, curY + CONFIG.LINE_HEIGHT);

            // Brief pause between words for natural pacing
            await new Promise(r => setTimeout(r, 25 + Math.random() * 20));
        }
    },

    async _writeWord(word, x, y) {
        let isSub = false;
        let isSup = false;

        for (let i = 0; i < word.length; i++) {
            if (!STATE.isWritingAI) break;

            const char = word[i];

            // Subscript / superscript markers (e.g. H_2O, x^2)
            if (char === '_' && i + 1 < word.length) { isSub = true; continue; }
            if (char === '^' && i + 1 < word.length) { isSup = true; continue; }

            // drawChar returns the CSS-pixel advance width
            const advance = strokeRenderer.drawChar(char, x, y, isSub, isSup);
            x += advance;
            isSub = false;
            isSup = false;

            // Per-character delay for typewriter handwriting effect
            await new Promise(r => setTimeout(r, 18 + Math.random() * 28));
        }
    },

    /**
     * Map Gemini's 0-1000 command coordinates back to canvas world-space and
     * execute the annotation.
     *
     * Gemini receives a JPEG that was cropped from the user's drawing using
     * getDrawingDataURL(padding=20). Its 0-1000 coords are relative to that
     * cropped image. We reverse the crop transform to get real world coords.
     */
    async processCommands(commands) {
        if (!commands || commands.length === 0) return;

        // Recompute the same bounding box that getDrawingDataURL() used
        const PADDING = 20;
        const history = undoManager.getHistory();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const stroke of history) {
            for (const pt of stroke.points) {
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
            }
        }

        if (!isFinite(minX)) return; // nothing drawn

        // Image origin in world space (top-left corner of the exported image)
        const imgOriginX = minX - PADDING;
        const imgOriginY = minY - PADDING;
        const imgW = maxX - minX + PADDING * 2;
        const imgH = maxY - minY + PADDING * 2;

        /**
         * Convert a Gemini 0-1000 coord pair to canvas world-space.
         * Gemini's coordinate space is 0-1000 in both axes regardless of aspect ratio.
         */
        const toWorld = (gx, gy) => ({
            x: imgOriginX + (gx / 1000) * imgW,
            y: imgOriginY + (gy / 1000) * imgH
        });

        for (const cmd of commands) {
            if (!cmd || !cmd.type) continue;

            switch (cmd.type) {
                case 'circle': {
                    const pos = toWorld(cmd.x ?? 500, cmd.y ?? 500);
                    // radius is also in Gemini's 0-1000 space; scale relative to image width
                    const radius = ((cmd.radius ?? 50) / 1000) * imgW;
                    await aiHighlightSystem.circle(pos.x, pos.y, Math.max(radius, 20));
                    break;
                }
                case 'underline': {
                    const pos = toWorld(cmd.x ?? 0, cmd.y ?? 500);
                    const width = ((cmd.width ?? 100) / 1000) * imgW;
                    await aiHighlightSystem.underline(pos.x, pos.y, Math.max(width, 30));
                    break;
                }
                case 'arrow': {
                    const p1 = toWorld(cmd.x1 ?? 0, cmd.y1 ?? 0);
                    const p2 = toWorld(cmd.x2 ?? 100, cmd.y2 ?? 100);
                    await aiHighlightSystem.arrow(p1.x, p1.y, p2.x, p2.y);
                    break;
                }
                case 'write': {
                    // Draw a short text label at the given position
                    const pos = toWorld(cmd.x ?? 500, cmd.y ?? 500);
                    if (cmd.text) {
                        await this._writeWord(cmd.text, pos.x, pos.y);
                    }
                    break;
                }
                default:
                    break;
            }

            // Small pause between commands so animations don't pile up
            await new Promise(r => setTimeout(r, 400));
        }
    },

    /**
     * Find the Y coordinate of the lowest drawn content on the board.
     * Used to position AI text below the student's work.
     */
    _getContentBottom() {
        const history = undoManager.getHistory();
        let maxY = 0;
        for (const stroke of history) {
            for (const pt of stroke.points) {
                if (pt.y > maxY) maxY = pt.y;
            }
        }
        return maxY || 100;
    }
};