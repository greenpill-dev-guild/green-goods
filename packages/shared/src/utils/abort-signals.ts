/**
 * Runs `read` with a signal that aborts when the first of `signals` aborts, with that signal's
 * reason. Missing signals are skipped, and a lone signal is passed through unchanged.
 *
 * Chrome 116, Safari 17.4 and Firefox 124 added `AbortSignal.any`, which this uses where it
 * exists. The supported Chrome 111–115 and iOS Safari 16.4–17.3 lack it, so there the combined
 * signal is built by hand. Its listeners come off every source once one source aborts or `read`
 * settles, because a source such as a paged read's deadline can outlive many reads.
 */
export async function withCombinedAbortSignal<T>(
  signals: readonly (AbortSignal | undefined)[],
  read: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const sources = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (sources.length === 1) return read(sources[0]);
  if (typeof AbortSignal.any === "function") return read(AbortSignal.any(sources));

  const combined = new AbortController();
  const alreadyAborted = sources.find((source) => source.aborted);
  if (alreadyAborted) {
    combined.abort(alreadyAborted.reason);
    return read(combined.signal);
  }
  const detachers = sources.map((source) => {
    const forward = () => combined.abort(source.reason);
    source.addEventListener("abort", forward, { once: true });
    return () => source.removeEventListener("abort", forward);
  });
  const release = () => {
    for (const detach of detachers) detach();
  };
  combined.signal.addEventListener("abort", release, { once: true });
  try {
    return await read(combined.signal);
  } finally {
    release();
  }
}
