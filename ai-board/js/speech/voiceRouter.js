export const voiceRouter = {
  detect(text) {
    if (!text || text.trim().length < 15) return 'english';
    const devanagari = (text.match(/[\u0900-\u097F]/g) || []).length;
    const total = text.replace(/\s/g, '').length;
    if (total === 0) return 'english';
    const ratio = devanagari / total;
    if (ratio > 0.40) return 'hindi';
    if (ratio > 0.06) return 'hinglish';
    return 'english';
  },
  shouldSwitch(prevLang, newLang, textLen) {
    if (!prevLang) return true;
    if (prevLang === newLang) return false;
    return textLen > 40;
  }
};
