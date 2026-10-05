export const NEOLEARN_MESSAGE_PAGE_SIZE = 50;

function compareMessageEntries(first, second) {
  const timeDifference = (first[1]?.createdAt || 0) - (second[1]?.createdAt || 0);
  return timeDifference || first[0].localeCompare(second[0]);
}

export function mergeConversationMessages(olderMessages = {}, latestMessages = {}) {
  return [...new Map([
    ...Object.entries(olderMessages),
    ...Object.entries(latestMessages)
  ]).entries()].sort(compareMessageEntries);
}

export function sortPeersByLatestMessage(peers, conversations) {
  const latestTimestamp = (peerId) => Object.values(conversations.get(peerId) || {})
    .reduce((latest, message) => Number.isFinite(message?.createdAt) ? Math.max(latest, message.createdAt) : latest, Number.NEGATIVE_INFINITY);
  return [...peers].sort((first, second) => latestTimestamp(second.userId) - latestTimestamp(first.userId));
}

export function addEarlierMessagePage(olderMessages, latestMessages, page, pageSize = NEOLEARN_MESSAGE_PAGE_SIZE) {
  const knownIds = new Set([...Object.keys(olderMessages), ...Object.keys(latestMessages)]);
  const unseenEntries = Object.entries(page || {})
    .filter(([messageId, message]) => !knownIds.has(messageId) && typeof message?.text === 'string')
    .sort(compareMessageEntries);
  const hasMore = unseenEntries.length > pageSize;
  const selectedEntries = unseenEntries.slice(-pageSize);

  return {
    olderMessages: Object.fromEntries([...Object.entries(olderMessages), ...selectedEntries]),
    hasMore
  };
}