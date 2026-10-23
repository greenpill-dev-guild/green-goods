let contentReady = false;
const waiting = new Set<() => void>();

/** The public shell calls this after committing its route content. */
export function markPublicContentReady(): void {
  contentReady = true;
  for (const start of waiting) start();
  waiting.clear();
}

/** Optional runtimes wait for a painted public route, rather than the earlier
 * document load event. Callers retain ownership of their idle/load scheduling. */
export function afterPublicContentPaint(task: () => void): () => void {
  let frame = 0;
  let timer = 0;
  const start = () => {
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      timer = window.setTimeout(task, 0);
    });
  };
  if (contentReady) start();
  else waiting.add(start);
  return () => {
    waiting.delete(start);
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timer);
  };
}
