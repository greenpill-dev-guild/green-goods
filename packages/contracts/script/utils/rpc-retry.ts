export async function retryRpcAvailability<T>(
  read: () => Promise<T | undefined>,
  options: {
    attempts?: number;
    wait?: (milliseconds: number) => Promise<void>;
    onRetry?: (attempt: number, error?: unknown) => void;
    unavailableMessage?: string;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 6;
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error("RPC retry requires an attempt");
  const wait =
    options.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await read();
      if (result !== undefined) return result;
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    if (attempt === attempts) break;
    options.onRetry?.(attempt, lastError);
    await wait(2_000);
  }
  if (lastError) throw lastError;
  throw new Error(options.unavailableMessage ?? "RPC result remained unavailable after the bounded retry window");
}
