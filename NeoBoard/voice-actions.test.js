import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVoiceObjects } from './voice-actions.js';

test('voice action validator accepts bounded editable board objects', () => {
  const result = validateVoiceObjects([{type:'text',text:'Label'},{type:'graph',a:1,b:0,c:-4}]);
  assert.equal(result[0].text,'Label');
  assert.equal(result[0].width,360);
  assert.equal(result[1].title,'y = 1x² + 0x - 4');
});

test('voice action validator rejects unsupported types, unbounded batches, and malformed values', () => {
  assert.throws(() => validateVoiceObjects([{type:'script',text:'run'}]), /not supported/);
  assert.throws(() => validateVoiceObjects(Array(9).fill({type:'rect'})), /between 1 and 8/);
  assert.throws(() => validateVoiceObjects([{type:'text',text:'x'.repeat(1001)}]), /1–1000/);
  assert.throws(() => validateVoiceObjects([{type:'graph',a:NaN,b:0,c:0}]), /finite/);
  assert.throws(() => validateVoiceObjects([{type:'graph',a:100001,b:0,c:0}]), /finite/);
});
