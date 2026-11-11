export function retainBoundedObjectUrl(cache, key, url, maxEntries, revoke) {
  const previous = cache.get(key);
  if (previous && previous !== url) revoke(previous);
  cache.delete(key);
  cache.set(key, url);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    revoke(cache.get(oldestKey));
    cache.delete(oldestKey);
  }
}
