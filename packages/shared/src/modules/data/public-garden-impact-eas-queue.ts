/** One queue per public reader instance, shared by every garden it serves. */
export class PublicGardenImpactEasQueue {
  private readonly chains = new Map<
    number,
    {
      active: number;
      waiting: Array<() => void>;
    }
  >();

  async run<T>(
    chainId: number,
    signal: AbortSignal | undefined,
    read: () => Promise<T>
  ): Promise<T> {
    signal?.throwIfAborted();
    const state = this.chains.get(chainId) ?? { active: 0, waiting: [] };
    this.chains.set(chainId, state);
    if (state.active < 2) {
      state.active += 1;
    } else {
      await new Promise<void>((resolve, reject) => {
        const start = () => {
          signal?.removeEventListener("abort", cancel);
          resolve();
        };
        const cancel = () => {
          const index = state.waiting.indexOf(start);
          if (index >= 0) state.waiting.splice(index, 1);
          reject(signal?.reason);
        };
        state.waiting.push(start);
        signal?.addEventListener("abort", cancel, { once: true });
      });
    }
    try {
      signal?.throwIfAborted();
      return await read();
    } finally {
      const next = state.waiting.shift();
      if (next) next();
      else if (--state.active === 0) this.chains.delete(chainId);
    }
  }
}
