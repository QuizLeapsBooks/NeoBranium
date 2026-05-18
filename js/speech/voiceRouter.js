// Compile regex ONCE at module level
const DEVANAGARI_REGEX = /[\u0900-\u097F]/g;
const SPACE_REGEX = /\s/g;

export const voiceRouter = {
  /**
   * Detects the language of the text.
   * @param {string} text 
   * @returns {'hindi' | 'hinglish' | 'english'}
   */
  detect(text) {
    if (!text || text.trim().length < 15) {
      return 'english';
    }
    
    // Reset regex lastIndex before use (good practice with /g flag)
    DEVANAGARI_REGEX.lastIndex = 0;
    SPACE_REGEX.lastIndex = 0;
    
    const matches = text.match(DEVANAGARI_REGEX);
    const devanagariCount = matches ? matches.length : 0;
    
    const totalNonSpace = text.replace(SPACE_REGEX, '').length;
    
    if (totalNonSpace === 0) {
      return 'english';
    }
    
    const ratio = devanagariCount / totalNonSpace;
    
    if (ratio > 0.40) {
      return 'hindi';
    }
    if (ratio > 0.06) {
      return 'hinglish';
    }
    return 'english';
  },

  /**
   * Determines whether to switch the TTS engine.
   * @param {string|null} previousLang 
   * @param {string} newLang 
   * @param {number} textLength 
   * @returns {boolean}
   */
  shouldSwitch(previousLang, newLang, textLength) {
    if (previousLang === null) {
      return true; // First time, always switch
    }
    if (previousLang === newLang) {
      return false; // No change needed
    }
    if (textLength < 40) {
      return false; // Too short, unreliable detection
    }
    return true; // Long enough, different lang detected — switch
  }
};
