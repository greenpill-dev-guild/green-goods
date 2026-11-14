import { getEventListeners } from "node:events";
import { describe, expect, it } from "vitest";

import { withCombinedAbortSignal } from "../../utils/abort-signals";
import { withoutAbortSignalAny } from "../test-utils/abort-signal-any";

type Browser = <T>(run: () => T | Promise<T>) => Promise<T>;
const withAbortSignalAny: Browser = async (run) => run();
const browsers: [string, Browser][] = [
  ["AbortSignal.any", withAbortSignalAny],
  ["the hand-built signal", withoutAbortSignalAny],
];

const listenerCounts = (...signals: AbortSignal[]) =>
  signals.map((signal) => getEventListeners(signal, "abort").length);

describe("withCombinedAbortSignal", () => {
  describe.each(browsers)("with %s", (_name, inBrowser) => {
    it("aborts with the reason of the first signal to abort", async () => {
      const caller = new AbortController();
      const timeout = new AbortController();
      const deadline = new Error("garden deadline");

      const reason = await inBrowser(() =>
        withCombinedAbortSignal([caller.signal, timeout.signal], async (signal) => {
          timeout.abort(deadline);
          caller.abort(new Error("caller left"));
          return signal.reason;
        })
      );

      expect(reason).toBe(deadline);
    });

    it("starts aborted, with that reason, when a signal has already aborted", async () => {
      const caller = new AbortController();
      const deadline = new Error("snapshot deadline");

      await inBrowser(() =>
        withCombinedAbortSignal([caller.signal, AbortSignal.abort(deadline)], async (signal) => {
          expect(signal.aborted).toBe(true);
          expect(signal.reason).toBe(deadline);
          expect(listenerCounts(caller.signal)).toEqual([0]);
        })
      );
    });
  });

  // Without a caller's signal the three readers keep their own signal, as before.
  it("passes a lone signal through unchanged", async () => {
    const own = new AbortController().signal;
    expect(await withCombinedAbortSignal([own, undefined], async (signal) => signal)).toBe(own);
  });

  describe("without AbortSignal.any", () => {
    it("takes its listeners off every signal once one aborts", async () => {
      const caller = new AbortController();
      const timeout = new AbortController();

      await withoutAbortSignalAny(() =>
        withCombinedAbortSignal([caller.signal, timeout.signal], async () => {
          expect(listenerCounts(caller.signal, timeout.signal)).toEqual([1, 1]);
          caller.abort();
          expect(listenerCounts(caller.signal, timeout.signal)).toEqual([0, 0]);
        })
      );
    });

    it("takes its listeners off every signal when the read finishes or fails", async () => {
      const caller = new AbortController();
      const timeout = new AbortController();
      const signals = [caller.signal, timeout.signal];
      const outage = new Error("price service unavailable");

      await withoutAbortSignalAny(async () => {
        const during = withCombinedAbortSignal(signals, async () => listenerCounts(...signals));
        await expect(during).resolves.toEqual([1, 1]);
        expect(listenerCounts(...signals)).toEqual([0, 0]);

        const failed = withCombinedAbortSignal(signals, async () => Promise.reject(outage));
        await expect(failed).rejects.toBe(outage);
        expect(listenerCounts(...signals)).toEqual([0, 0]);
      });
    });
  });
});
