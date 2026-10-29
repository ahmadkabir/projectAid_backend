/**
 * Send an in-memory buffer as a streamed response.
 *
 * Vercel Functions cap buffered request/response bodies at 4.5 MB, but streamed
 * responses are not subject to that limit. `res.send(buffer)` writes one large
 * frame and can fail with FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE, so generated
 * PDFs are written in chunks instead.
 *
 * `Content-Length` must be set by the caller only when the caller does not want
 * chunked transfer encoding. For large payloads, leave it unset.
 */
export const streamBuffer = async (res, buffer, { chunkSize = 256 * 1024 } = {}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('streamBuffer expects a Buffer');
  }

  const size = Math.max(1, Number(chunkSize) || 256 * 1024);

  for (let offset = 0; offset < buffer.length; offset += size) {
    const chunk = buffer.subarray(offset, offset + size);
    if (!res.write(chunk)) {
      // Wait for the socket to drain before queueing the next chunk.
      await new Promise((resolve, reject) => {
        const onDrain = () => {
          res.off('error', onError);
          resolve();
        };
        const onError = (error) => {
          res.off('drain', onDrain);
          reject(error);
        };
        res.once('drain', onDrain);
        res.once('error', onError);
      });
    } else {
      // Yield to the event loop so the runtime starts flushing the response.
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  res.end();
};

export default { streamBuffer };
