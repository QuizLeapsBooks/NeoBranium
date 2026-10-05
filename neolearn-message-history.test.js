import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addEarlierMessagePage,
  mergeConversationMessages,
  sortPeersByLatestMessage
} from './js/neolearn-message-history.js';

test('peer list sorts conversations by latest message while keeping empty chats last', () => {
  const peers = [{ userId: 'first' }, { userId: 'empty' }, { userId: 'latest' }];
  const conversations = new Map([
    ['first', { message: { createdAt: 10 } }],
    ['latest', { message: { createdAt: 30 } }]
  ]);

  assert.deepEqual(sortPeersByLatestMessage(peers, conversations).map((peer) => peer.userId), ['latest', 'first', 'empty']);
});

test('conversation messages merge older pages with the live window in chronological order', () => {
  const messages = mergeConversationMessages(
    { older: { text: 'earlier', createdAt: 1 }, overlap: { text: 'old copy', createdAt: 2 } },
    { overlap: { text: 'live copy', createdAt: 2 }, latest: { text: 'later', createdAt: 3 } }
  );

  assert.deepEqual(messages.map(([id]) => id), ['older', 'overlap', 'latest']);
  assert.equal(messages[1][1].text, 'live copy');
});

test('earlier pages deduplicate the cursor and report when more history is available', () => {
  const current = { latest: { text: 'latest', createdAt: 3 } };
  const page = {
    first: { text: 'first', createdAt: 1 },
    middle: { text: 'middle', createdAt: 2 },
    latest: { text: 'cursor', createdAt: 3 }
  };

  const result = addEarlierMessagePage({}, current, page, 1);

  assert.deepEqual(Object.keys(result.olderMessages), ['middle']);
  assert.equal(result.hasMore, true);
});

test('earlier pages report completion when the remaining history fits one page', () => {
  const result = addEarlierMessagePage(
    {},
    { latest: { text: 'latest', createdAt: 3 } },
    { first: { text: 'first', createdAt: 1 }, latest: { text: 'cursor', createdAt: 3 } },
    2
  );

  assert.deepEqual(Object.keys(result.olderMessages), ['first']);
  assert.equal(result.hasMore, false);
});