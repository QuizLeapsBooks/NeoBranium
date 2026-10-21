import test from 'node:test';
import assert from 'node:assert/strict';
import { getHandwritingModel, getLiveModel, getPaperModel, getRoutineTextModel, getVisionModel } from './gemini-models.js';

const modelEnvKeys = ['GEMINI_MODEL', 'GEMINI_ROUTINE_MODEL', 'GEMINI_VISION_MODEL', 'GEMINI_HANDWRITING_MODEL', 'GEMINI_LIVE_MODEL', 'GEMINI_PAPER_MODEL'];

test('workload defaults choose listed, cost-appropriate Gemini models', () => {
  const previous = Object.fromEntries(modelEnvKeys.map(key => [key, process.env[key]]));
  try {
    for (const key of modelEnvKeys) delete process.env[key];
    assert.equal(getRoutineTextModel(), 'gemini-3.5-flash-lite');
    assert.equal(getPaperModel(), 'gemini-3.5-flash-lite');
    assert.equal(getVisionModel(), 'gemini-3.8-flash');
    assert.equal(getHandwritingModel(), 'gemini-3.8-flash');
    assert.equal(getLiveModel(), 'gemini-3.8-live');
  } finally {
    for (const key of modelEnvKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test('legacy and task-specific model settings cannot cross workload families', () => {
  const previous = Object.fromEntries(modelEnvKeys.map(key => [key, process.env[key]]));
  try {
    process.env.GEMINI_MODEL = 'gemini-3.8-live';
    process.env.GEMINI_ROUTINE_MODEL = 'gemini-2.5-flash';
    process.env.GEMINI_VISION_MODEL = 'gemini-3.1-flash-image';
    process.env.GEMINI_HANDWRITING_MODEL = 'gemini-3.6-flash';
    process.env.GEMINI_PAPER_MODEL = 'gemini-3.1-pro-preview';
    assert.equal(getRoutineTextModel(), 'gemini-3.5-flash-lite');
    assert.equal(getVisionModel(), 'gemini-3.8-flash');
    assert.equal(getHandwritingModel(), 'gemini-3.6-flash');
    assert.equal(getPaperModel(), 'gemini-3.1-pro-preview');
    assert.equal(getLiveModel(), 'gemini-3.8-live');
  } finally {
    for (const key of modelEnvKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
