/**
 * NeoBranium - Main Entry Point
 */
import { DOM } from './utils/constants.js';
import { boardEngine } from './board/boardEngine.js';
import { gestureController } from './board/gestureController.js';
import { uiManager } from './ui/uiManager.js';
import { speechEngine } from './speech/speechEngine.js';
import { aiEngine, sendVoiceQuery } from './ai/aiEngine.js';
import { CONFIG } from './utils/constants.js';
import { clientQueueManager } from './ui/clientQueueManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modular engines
    boardEngine.init();
    gestureController.init();
    uiManager.init();
    speechEngine.init();
    speechEngine.setSendVoiceQuery(sendVoiceQuery);
    
    clientQueueManager.init(CONFIG.API_BASE_URL);
    window.addEventListener('nb-queue-ready', () => {
      aiEngine.analyzeBoard();
    });
    
    // Wire up final global actions
    DOM.aiScanBtn?.addEventListener('click', () => aiEngine.analyzeBoard());

    console.log("🚀 NeoBranium AI Board Initialized");
});
