/**
 * NeoBranium Constants & Configuration
 *
 * Fix: Added boardContainer and modeSwitcher DOM references used by board/ui modules.
 * Fix: API_BASE_URL detection is more robust.
 */
export const CONFIG = {
    GOOGLE_TTS_KEY: '',
    SCAN_INTERVAL: 12000,
    IDLE_THRESHOLD: 4000,
    COOLDOWN_MS: 2000,
    MAX_HISTORY: 80,          // Increased slightly; structuredClone makes this cheaper
    AI_PEN_COLOR: '#00f2fe',
    AI_PEN_WIDTH: 2.5,
    USER_PEN_COLOR: '#ffffff',
    USER_PEN_WIDTH: 3,
    USER_PEN_GLOW: 'rgba(255, 255, 255, 0.4)',
    AI_FONT: 'bold 20px "Outfit", sans-serif',
    MARGIN: 80,
    LINE_HEIGHT: 50,
    API_BASE_URL: (() => {
        const host = window.location.hostname;
        // Local development
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        // Use current origin for production hosting
        return window.location.origin;
    })()
};

export const STATE = {
    currentTopic: "",
    detectedEquation: "",
    learningLevel: "intermediate",
    mode: "hinglish",
    conversationHistory: [],
    isProcessingVoice: false,
    isListening: false,
    isDrawing: false,
    lastDrawTime: Date.now(),
    showAIWriting: true,
    lastCaptureRect: null,
    scrollX: 0,
    scrollY: 0,
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    isWritingAI: false
};

export const DOM = {
    get canvas()           { return document.getElementById('writingBoard'); },
    get boardContainer()   { return document.getElementById('boardContainer'); },
    get clearBtn()         { return document.getElementById('clearBtn'); },
    get undoBtn()          { return document.getElementById('undoBtn'); },
    get redoBtn()          { return document.getElementById('redoBtn'); },
    get aiScanBtn()        { return document.getElementById('aiScanBtn'); },
    get micBtn()           { return document.getElementById('micBtn'); },
    get aiWriteToggle()    { return document.getElementById('aiWriteToggle'); },
    get responseModal()    { return document.getElementById('responseModal'); },
    get closeModal()       { return document.getElementById('closeModal'); },
    get minimizeModal()    { return document.getElementById('minimizeModal'); },
    get expandModal()      { return document.getElementById('expandModal'); },
    get modeSwitcher()     { return document.getElementById('modeSwitcher'); },
    get modeBtns()         { return document.querySelectorAll('.mode-btn'); },
    get aiResponseContent(){ return document.getElementById('aiResponseContent'); },
    get loadingOverlay()   { return document.getElementById('loadingOverlay'); },
    get speakBtn()         { return document.getElementById('speakBtn'); },
    get stopSpeakBtn()     { return document.getElementById('stopSpeakBtn'); },
    get speakingIndicator(){ return document.getElementById('speakingIndicator'); },
    get hintPopup()        { return document.getElementById('hintPopup'); },
    get hintContent()      { return document.getElementById('hintContent'); },
    get closeHint()        { return document.getElementById('closeHint'); },
    get confidenceMeter()  { return document.getElementById('confidenceMeter'); },
    get confidenceValue()  { return document.getElementById('confidenceValue'); },
};