import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGeneratedChildren,
  normalizeGeneratedMindMap
} from './neobookMindMapService.js';

const references = new Map([
  ['R1', { sourceId: 'source-1', title: 'Cell Biology', type: 'text', pageNum: 2 }],
  ['R2', { sourceId: 'source-2', title: 'Lecture Video', type: 'youtube', timestamp: '01:20' }]
]);

test('normalizes a nested mind map and resolves only known source references', () => {
  const map = normalizeGeneratedMindMap({
    title: 'Cell Biology',
    summary: 'Overview based on the provided source passages.',
    references: ['R1', 'R_UNKNOWN'],
    branches: [
      {
        title: 'Cell Structure',
        summary: 'Parts of a cell described in the text.',
        references: ['R1'],
        children: [{
          title: 'Nucleus',
          summary: 'Stores genetic material.',
          references: ['R1']
        }]
      },
      {
        title: 'Cell Processes',
        summary: 'Processes discussed in the lecture.',
        references: ['R2'],
        children: []
      },
      {
        title: 'Cell Function',
        summary: 'Functions mentioned in the source notes.',
        references: ['R1'],
        children: []
      }
    ]
  }, references);

  assert.equal(map.root.citations.length, 1);
  assert.equal(map.root.citations[0].sourceId, 'source-1');
  assert.equal(map.children[0].children[0].citations[0].pageNum, 2);
  assert.deepEqual(map.children[1].citations[0].timestamp, '01:20');
});

test('rejects nodes without source-grounded citations', () => {
  assert.throws(() => normalizeGeneratedMindMap({
    title: 'Unsupported map',
    summary: 'No valid source references.',
    references: ['R_FAKE'],
    branches: [
      { title: 'A', summary: 'Unsupported', references: ['R_FAKE'], children: [] },
      { title: 'B', summary: 'Unsupported', references: ['R_FAKE'], children: [] }
    ]
  }, references), /incomplete mind map/i);
});

test('limits generated branches and children to bounded tree sizes', () => {
  const branch = index => ({
    title: `Branch ${index}`,
    summary: 'Source-supported branch.',
    references: ['R1'],
    children: Array.from({ length: 8 }, (_, childIndex) => ({
      title: `Topic ${childIndex}`,
      summary: 'Source-supported subtopic.',
      references: ['R1']
    }))
  });
  const map = normalizeGeneratedMindMap({
    title: 'Bounded map',
    summary: 'A map with bounded branches.',
    references: ['R1'],
    branches: Array.from({ length: 20 }, (_, index) => branch(index))
  }, references);

  assert.equal(map.children.length, 7);
  assert.equal(map.children[0].children.length, 5);
});

test('rejects an expansion when all model references are unknown', () => {
  assert.throws(() => normalizeGeneratedChildren({
    children: [{ title: 'Unsupported', summary: 'No citation.', references: ['R99'] }]
  }, references), /no source-supported subtopics/i);
});
