/**
 * High-level Board Engine
 *
 * Key fixes:
 * - requestAnimationFrame loop for smooth real-time drawing (no lag under load)
 * - setPointerCapture so strokes don't break when pointer leaves canvas
 * - pointercancel handler to prevent stuck isDrawing state
 * - Correct coordinate translation: scrollX/Y are subtracted BEFORE transform is applied
 * - drawStroke called on full currentStroke during move (not just last 3 points)
 *   using a "dirty" flag + RAF to avoid over-rendering
 * - Debounced resize
 * - Bounds tracking accounts for scroll offset correctly
 */
import { CONFIG, STATE, DOM } from '../utils/constants.js';
import { canvasRenderer } from './canvasRenderer.js';
import { undoManager } from './undoManager.js';

export const boardEngine = {
    currentStroke: null,
    currentBounds: null,   // Logical (world) coords, not screen coords
    lastActionTime: 0,

    // RAF state
    _rafId: null,
    _needsRedraw: false,
    _resizeTimer: null,

    init() {
        if (!DOM.canvas) {
            console.error('[BoardEngine] Canvas not found — check HTML id="writingBoard"');
            return;
        }

        canvasRenderer.init();

        // Debounced resize — prevents repeated expensive redraws during drag-resize
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                canvasRenderer.resize();
                canvasRenderer.redraw(undoManager.getHistory());
            }, 120);
        });

        // Use pointer events for unified mouse/touch/stylus handling
        // passive: false needed on move so we can call preventDefault if required
        DOM.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        DOM.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
        DOM.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
        DOM.canvas.addEventListener('pointercancel', (e) => this.onPointerCancel(e));

        DOM.clearBtn?.addEventListener('click', () => this.clearBoard());
        DOM.undoBtn?.addEventListener('click', () => this.handleUndo());
        DOM.redoBtn?.addEventListener('click', () => this.handleRedo());

        // AI writing toggle
        const toggle = DOM.aiWriteToggle;
        if (toggle) {
            toggle.addEventListener('change', () => {
                STATE.showAIWriting = toggle.checked;
            });
        }

        // Start the RAF loop
        this._startLoop();
    },

    // ─── Coordinate helpers ──────────────────────────────────────────────────

    /**
     * Convert a pointer event's client coordinates into logical board space.
     * Logical space = the world coordinate where strokes are stored.
     * scrollX/Y shift the viewport; we subtract them to get world coords.
     */
    _clientToWorld(e) {
        const rect = DOM.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left - STATE.scrollX,
            y: e.clientY - rect.top - STATE.scrollY,
        };
    },

    // ─── Pointer handlers ────────────────────────────────────────────────────

    onPointerDown(e) {
        if (!DOM.canvas) return;

        // Ignore multi-touch (gestureController handles two-finger pan)
        if (e.isPrimary === false) return;
        if (STATE.isPanning) return;

        // Capture pointer so pointermove/up fire even outside canvas
        try { DOM.canvas.setPointerCapture(e.pointerId); } catch(err) {}

        STATE.isDrawing = true;
        STATE.lastDrawTime = Date.now();

        const pt = this._clientToWorld(e);

        this.currentStroke = {
            points: [pt],
            color: CONFIG.USER_PEN_COLOR,
            width: CONFIG.USER_PEN_WIDTH,
        };

        this._updateBounds(pt.x, pt.y);
    },

    onPointerMove(e) {
        if (!STATE.isDrawing || STATE.isPanning) return;
        if (e.isPrimary === false) return;

        const pt = this._clientToWorld(e);
        this.currentStroke.points.push(pt);
        this._updateBounds(pt.x, pt.y);

        // Signal RAF loop to render; don't render directly here (decouples event rate from render rate)
        this._needsRedraw = true;
    },

    onPointerUp(e) {
        if (!STATE.isDrawing || !this.currentStroke) return;

        undoManager.saveStroke(this.currentStroke);
        STATE.isDrawing = false;
        this.currentStroke = null;

        // Final authoritative redraw from history
        canvasRenderer.redraw(undoManager.getHistory());
        this._needsRedraw = false;
    },

    onPointerCancel(e) {
        // Discard the in-progress stroke; don't save it
        STATE.isDrawing = false;
        this.currentStroke = null;
        this._needsRedraw = false;

        // Redraw from clean history
        canvasRenderer.redraw(undoManager.getHistory());
    },

    // ─── RAF render loop ─────────────────────────────────────────────────────

    _startLoop() {
        const loop = () => {
            if (this._needsRedraw && STATE.isDrawing && this.currentStroke) {
                this._needsRedraw = false;
                this._renderCurrentStroke();
            }
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    },

    /**
     * Paint the committed history + the live in-progress stroke.
     * Called only from the RAF loop, at most once per frame.
     */
    _renderCurrentStroke() {
        // Redraw committed history first (this also clears and re-applies transform)
        canvasRenderer.redraw(undoManager.getHistory());
        // Then paint the current live stroke on top
        if (this.currentStroke && this.currentStroke.points.length >= 2) {
            canvasRenderer.drawStroke(
                this.currentStroke.points,
                this.currentStroke.color,
                this.currentStroke.width
            );
        }
    },

    // ─── Bounds tracking ─────────────────────────────────────────────────────

    _updateBounds(x, y) {
        if (!this.currentBounds) {
            this.currentBounds = { minX: x, maxX: x, minY: y, maxY: y };
        } else {
            if (x < this.currentBounds.minX) this.currentBounds.minX = x;
            if (x > this.currentBounds.maxX) this.currentBounds.maxX = x;
            if (y < this.currentBounds.minY) this.currentBounds.minY = y;
            if (y > this.currentBounds.maxY) this.currentBounds.maxY = y;
        }
    },

    // Keep legacy API intact so aiWritingEngine can call updateBounds externally
    updateBounds(x, y) {
        this._updateBounds(x, y);
    },

    // ─── Board actions ───────────────────────────────────────────────────────

    clearBoard() {
        undoManager.clear();
        canvasRenderer.clear();
        this.currentBounds = null;
    },

    handleUndo() {
        const history = undoManager.undo();
        if (history !== null) {
            canvasRenderer.redraw(history);
        }
    },

    handleRedo() {
        const history = undoManager.redo();
        if (history !== null) {
            canvasRenderer.redraw(history);
        }
    },

    // ─── AI scan image export ────────────────────────────────────────────────

    /**
     * Export the drawn content as a JPEG data URL for AI analysis.
     * Correctly accounts for scroll offset so bounds reflect actual content position.
     */
    getDrawingDataURL(padding = 20) {
        const history = undoManager.getHistory();
        if (!history || history.length === 0) return null;

        // Recompute bounds from full history (currentBounds may be stale after undo)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const stroke of history) {
            for (const pt of stroke.points) {
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
            }
        }

        if (!isFinite(minX)) return null;

        const sx = minX - padding;
        const sy = minY - padding;
        const sw = Math.max(maxX - minX + padding * 2, 1);
        const sh = Math.max(maxY - minY + padding * 2, 1);
        const dpr = canvasRenderer.dpr;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.floor(sw * dpr);
        tempCanvas.height = Math.floor(sh * dpr);
        const tempCtx = tempCanvas.getContext('2d');

        // Background
        tempCtx.fillStyle = '#0b0f19';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Scale for DPR then translate so content region starts at origin
        tempCtx.scale(dpr, dpr);
        tempCtx.translate(-sx, -sy);

        // Replay all strokes
        tempCtx.lineCap = 'round';
        tempCtx.lineJoin = 'round';

        for (const stroke of history) {
            if (stroke.points.length < 2) continue;
            tempCtx.beginPath();
            tempCtx.strokeStyle = stroke.color;
            tempCtx.lineWidth = stroke.width;

            tempCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length - 1; i++) {
                const mx = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
                const my = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
                tempCtx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, mx, my);
            }
            const last = stroke.points[stroke.points.length - 1];
            tempCtx.lineTo(last.x, last.y);
            tempCtx.stroke();
        }

        return tempCanvas.toDataURL('image/jpeg', 0.8);
    }
};