import type { QuietReport } from "@green-goods/shared/modules/app/service-worker-protocol";

/** The responses this worker answers itself, as a stalled hand-over names them. */
export type ResponseKind = "share" | "asset" | "probe" | "media" | "image" | "api";

/**
 * How long a hand-over may keep this worker quiet. The page gives up after
 * seven seconds and says so, but a page that closed mid-hand-over never does.
 * Without a limit this worker would go on refusing background work, and
 * leaving photos to the network, until the browser stopped it.
 */
const QUIET_LEASE_MS = 15_000;

/**
 * What this worker has in hand: the work it started on its own (tail
 * downloads, photo copies, policy writes) and the responses it owes pages. A
 * waiting worker cannot activate while any of it is open, so an update
 * hand-over settles what it can, refuses new work in the meantime, and reports
 * the rest. The next worker never activates over a half-written cache.
 */
export class BackgroundWork {
  private accepting = true;
  private quietUntil = 0;
  private readonly inFlight = new Set<Promise<unknown>>();
  private readonly cancellers = new Set<AbortController>();
  private readonly owed = new Map<ResponseKind, number>();

  get isAccepting(): boolean {
    return this.accepting || Date.now() >= this.quietUntil;
  }

  /** Follow a promise until it settles so a hand-over can wait for it. */
  track<T>(promise: Promise<T>): Promise<T> {
    const tracked: Promise<T> = promise.finally(() => this.inFlight.delete(tracked));
    this.inFlight.add(tracked);
    return tracked;
  }

  /** Count a response a page is waiting on, so a stalled hand-over can name it. */
  answering<T>(kind: ResponseKind, response: Promise<T>): Promise<T> {
    this.owed.set(kind, (this.owed.get(kind) ?? 0) + 1);
    const settled = () => this.owed.set(kind, (this.owed.get(kind) ?? 1) - 1);
    response.then(settled, settled);
    return response;
  }

  /**
   * A signal for one network read that a hand-over can cancel. The browser does
   * not tell the worker when a page gives up on a request: in Chromium the
   * request's own signal never fires here. A gateway that never answers
   * therefore holds its fetch event open whatever the page does, and the page's
   * own abort is still forwarded for the browsers that do report it.
   */
  canceller(request: Request): { signal: AbortSignal; done: () => void } {
    const controller = new AbortController();
    const forward = () => controller.abort();
    if (request.signal.aborted) controller.abort();
    else request.signal.addEventListener("abort", forward, { once: true });
    this.cancellers.add(controller);
    return {
      signal: controller.signal,
      done: () => {
        this.cancellers.delete(controller);
        request.signal.removeEventListener("abort", forward);
      },
    };
  }

  /** Stop accepting new work, cancel and pause what can stop, and wait for the rest. */
  async quiet(pause: () => void): Promise<QuietReport> {
    this.accepting = false;
    this.quietUntil = Date.now() + QUIET_LEASE_MS;
    pause();
    const trackedWork = this.inFlight.size;
    const cancelledFetches = this.cancellers.size;
    for (const canceller of [...this.cancellers]) canceller.abort();
    await Promise.allSettled([...this.inFlight]);
    // A cancelled read rejects on a later turn; count what is owed once it has.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pendingResponses = Object.fromEntries([...this.owed].filter(([, count]) => count > 0));
    return { trackedWork, cancelledFetches, pendingResponses };
  }

  resume(): void {
    this.accepting = true;
  }
}
