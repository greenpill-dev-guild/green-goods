/**
 * Work the worker started on its own: tail downloads, photo copies, policy
 * writes. An update hand-over waits for it to settle and refuses new work in
 * the meantime, so the next worker never activates over a half-written cache.
 */
export class BackgroundWork {
  private accepting = true;
  private readonly inFlight = new Set<Promise<unknown>>();

  get isAccepting(): boolean {
    return this.accepting;
  }

  /** Follow a promise until it settles so a hand-over can wait for it. */
  track<T>(promise: Promise<T>): Promise<T> {
    const tracked: Promise<T> = promise.finally(() => this.inFlight.delete(tracked));
    this.inFlight.add(tracked);
    return tracked;
  }

  /** Stop accepting new work, pause what can pause, and wait for the rest. */
  async quiet(pause: () => void): Promise<void> {
    this.accepting = false;
    pause();
    await Promise.allSettled([...this.inFlight]);
  }

  resume(): void {
    this.accepting = true;
  }
}
