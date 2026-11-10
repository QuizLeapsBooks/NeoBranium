import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRepresentativeChunks, validateQuizConfig } from './services/neobookQuizService.js';

test('quiz configuration accepts only supported difficulty and question counts', () => {
  assert.deepEqual(validateQuizConfig({ difficulty: 'HARD', questionCount: 20 }), { difficulty: 'hard', questionCount: 20 });
  assert.deepEqual(validateQuizConfig({ difficulty: 'unknown', questionCount: 7 }), { difficulty: 'medium', questionCount: 5 });
});

test('representative chunk selection honours active sources and distributes coverage', () => {
  const chunks = [
    { sourceId: 'a', text: 'a1' }, { sourceId: 'a', text: 'a2' },
    { sourceId: 'b', text: 'b1' }, { sourceId: 'b', text: 'b2' }
  ];
  assert.deepEqual(selectRepresentativeChunks(chunks, ['b'], 5), chunks.slice(2));
  assert.deepEqual(selectRepresentativeChunks(chunks, null, 2).map(chunk => chunk.sourceId), ['a', 'b']);
});
