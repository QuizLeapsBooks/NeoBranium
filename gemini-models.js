// Model defaults are split by workload so a Live or image-generation setting
// cannot accidentally be sent to a text-generation endpoint.
const TEXT_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-omni-1.1-flash'
]);
const LIVE_MODELS = new Set([
  'gemini-3.8-live',
  'gemini-3.8-live-extended-thinking',
  'gemini-3.1-flash-live-preview'
]);

function chooseModel(keys, allowed, fallback) {
  for (const key of keys) {
    const candidate = process.env[key]?.trim();
    if (candidate && allowed.has(candidate)) return candidate;
  }
  return fallback;
}

export function getRoutineTextModel() {
  return chooseModel(['GEMINI_ROUTINE_MODEL', 'GEMINI_MODEL'], TEXT_MODELS, 'gemini-3.5-flash-lite');
}

export function getVisionModel() {
  return chooseModel(['GEMINI_VISION_MODEL', 'GEMINI_MODEL'], TEXT_MODELS, 'gemini-3.8-flash');
}

export function getHandwritingModel() {
  return chooseModel(['GEMINI_HANDWRITING_MODEL', 'GEMINI_VISION_MODEL', 'GEMINI_MODEL'], TEXT_MODELS, 'gemini-3.8-flash');
}

export function getLiveModel() {
  return chooseModel(['GEMINI_LIVE_MODEL', 'GEMINI_MODEL'], LIVE_MODELS, 'gemini-3.8-live');
}

export function getPaperModel() {
  return chooseModel(['GEMINI_PAPER_MODEL', 'GEMINI_ROUTINE_MODEL', 'GEMINI_MODEL'], TEXT_MODELS, 'gemini-3.5-flash-lite');
}

export const GEMINI_MODEL_DEFAULTS = Object.freeze({
  routine: 'gemini-3.5-flash-lite',
  vision: 'gemini-3.8-flash',
  handwriting: 'gemini-3.8-flash',
  live: 'gemini-3.8-live',
  paper: 'gemini-3.5-flash-lite'
});
