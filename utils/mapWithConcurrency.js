function cancellationError(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  return Object.assign(new Error('The operation was cancelled.'), { name: 'AbortError' });
}

export async function mapWithConcurrency(items, maxConcurrent, mapper, signal) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new RangeError('maxConcurrent must be a positive integer');
  }
  if (typeof mapper !== 'function') throw new TypeError('mapper must be a function');
  if (signal?.aborted) throw cancellationError(signal);

  const results = new Array(items.length);
  let nextIndex = 0;
  let failed = false;
  let failure;
  const worker = async () => {
    while (nextIndex < items.length && !failed && !signal?.aborted) {
      const index = nextIndex++;
      try {
        results[index] = await mapper(items[index], index, signal);
      } catch (error) {
        failed = true;
        failure = error;
      }
    }
  };
  const workers = Array.from({ length: Math.min(maxConcurrent, items.length) }, worker);
  await Promise.all(workers);
  if (failed) throw failure;
  if (signal?.aborted) throw cancellationError(signal);
  return results;
}
