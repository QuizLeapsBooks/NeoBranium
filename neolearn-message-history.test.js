import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addEarlierMessagePage,
  mergeConversationMessages,
  sortPeersByLatestMessage
  sortPeersByLatestMessage,
  extractFirstUrl,
  URL_REGEX
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

test('extractFirstUrl extracts https URL and strips sentence punctuation', () => {
  const info = extractFirstUrl('Hey, check this article: https://en.wikipedia.org/wiki/Physics!');
  assert.ok(info);
  assert.equal(info.rawUrl, 'https://en.wikipedia.org/wiki/Physics');
  assert.equal(info.fullUrl, 'https://en.wikipedia.org/wiki/Physics');
  assert.equal(info.parsed.hostname, 'en.wikipedia.org');
});

test('extractFirstUrl handles www. URLs by prepending https protocol', () => {
  const info = extractFirstUrl('Visit www.khanacademy.org/science for study materials.');
  assert.ok(info);
  assert.equal(info.fullUrl, 'https://www.khanacademy.org/science');
  assert.equal(info.parsed.hostname, 'www.khanacademy.org');
});

test('extractFirstUrl identifies NeoLearn deep links', () => {
  const info = extractFirstUrl('Look at this post: https://neobranium.com/htmls/neolearn/index.html?postId=post-1234');
  assert.ok(info);
  assert.equal(info.parsed.searchParams.get('postId'), 'post-1234');
});

test('extractFirstUrl returns null for non-URL text or empty inputs', () => {
  assert.equal(extractFirstUrl('Hello there, how are you?'), null);
  assert.equal(extractFirstUrl(''), null);
  assert.equal(extractFirstUrl(null), null);
});