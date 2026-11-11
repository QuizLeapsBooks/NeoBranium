export function createResponseAbortSignal(req, res) {
  const controller = new AbortController();
  const onRequestAborted = () => controller.abort();
  const onResponseClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  req.once?.('aborted', onRequestAborted);
  res.once?.('close', onResponseClose);

  return {
    signal: controller.signal,
    dispose() {
      req.off?.('aborted', onRequestAborted);
      res.off?.('close', onResponseClose);
    }
  };
}
