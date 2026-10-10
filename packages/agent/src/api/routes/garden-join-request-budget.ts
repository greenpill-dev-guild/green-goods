// Leave response/transit margin inside the client's ten-second deadline.
const PRE_WRITE_BUDGET_MS = 8_000;

export function createGardenJoinRequestBudget(now: () => number, signal: AbortSignal) {
  const deadline = now() + PRE_WRITE_BUDGET_MS;
  function assertRemaining() {
    if (signal.aborted || now() >= deadline)
      throw new Error("Join request pre-write deadline exceeded");
  }
  return {
    assertRemaining,
    async run<T>(operation: () => Promise<T>): Promise<T> {
      assertRemaining();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      try {
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => {
            onAbort = () => reject(new Error("Join request aborted before persistence"));
            signal.addEventListener("abort", onAbort, { once: true });
            timer = setTimeout(
              () => reject(new Error("Join request pre-write deadline exceeded")),
              Math.max(0, deadline - now())
            );
          }),
        ]);
        assertRemaining();
        return result;
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (onAbort) signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
