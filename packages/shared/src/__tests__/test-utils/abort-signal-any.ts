/**
 * Runs `run` the way the oldest supported browsers would: Chrome 111–115 and iOS Safari
 * 16.4–17.3 have no `AbortSignal.any`. Puts the native method back afterwards.
 */
export async function withoutAbortSignalAny<T>(run: () => T | Promise<T>): Promise<T> {
  const own = Object.getOwnPropertyDescriptor(AbortSignal, "any");
  // An own property also hides the method that happy-dom's AbortSignal inherits.
  Object.defineProperty(AbortSignal, "any", {
    configurable: true,
    writable: true,
    value: undefined,
  });
  try {
    return await run();
  } finally {
    if (own) Object.defineProperty(AbortSignal, "any", own);
    else Reflect.deleteProperty(AbortSignal, "any");
  }
}
