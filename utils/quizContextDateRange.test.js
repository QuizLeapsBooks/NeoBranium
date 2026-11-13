import assert from 'node:assert/strict';
import test from 'node:test';
import { getQuizContextDateRange } from './quizContextDateRange.js';

test('quiz context covers exactly 30 UTC calendar dates including today', () => {
    const range = getQuizContextDateRange(new Date('2026-03-01T00:15:00.000Z'));

    assert.deepEqual(range, { from: '2026-01-31', to: '2026-03-01' });
    const days = (Date.parse(`${range.to}T00:00:00.000Z`) -
        Date.parse(`${range.from}T00:00:00.000Z`)) / 86_400_000 + 1;
    assert.equal(days, 30);
});

test('quiz context dates are UTC calendar keys regardless of the input time', () => {
    assert.deepEqual(
        getQuizContextDateRange(new Date('2026-01-01T23:59:59.999Z')),
        { from: '2025-12-03', to: '2026-01-01' }
    );
});
