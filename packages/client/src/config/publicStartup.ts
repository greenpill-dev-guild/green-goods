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
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    waiting.delete(start);
    window.clearTimeout(timer);
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      timer = window.setTimeout(task, 0);
    });
  };
  if (contentReady) start();
  else {
    waiting.add(start);
    // A failed root or shell may never announce readiness. Keep telemetry
    // available for recovery without competing with a normal first paint.
    timer = window.setTimeout(start, 15_000);
  }
  return () => {
    waiting.delete(start);
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timer);
  };
}
