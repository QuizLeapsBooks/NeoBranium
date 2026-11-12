export async function readBlobWithLimit(response, maxBytes) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError('maxBytes must be a positive integer');
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel();
    throw new Error('The image exceeds the local cache size limit.');
  }

  if (!response.body?.getReader) {
    const blob = await response.blob();
    if (blob.size > maxBytes) throw new Error('The image exceeds the local cache size limit.');
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error('The image exceeds the local cache size limit.');
      }
      chunks.push(value);
    }
    return new Blob(chunks, { type: response.headers.get('content-type') || '' });
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
