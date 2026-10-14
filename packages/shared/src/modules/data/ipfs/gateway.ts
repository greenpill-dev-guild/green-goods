export interface IpfsReadOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface IpfsGateway {
  readFile(identifier: string, options?: IpfsReadOptions): Promise<{ data: Blob | string }>;
  readJson<T = unknown>(identifier: string, options?: IpfsReadOptions): Promise<T>;
}

type GatewayOperation<T> = (gateway: IpfsGateway, options: IpfsReadOptions) => Promise<T>;

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function runGatewayChain<T>(
  gateways: readonly IpfsGateway[],
  options: IpfsReadOptions,
  operation: GatewayOperation<T>
): Promise<T> {
  const { signal, timeoutMs = 30_000 } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;
  const abortFromUpstream = () => controller.abort(signal?.reason);

  if (signal?.aborted) {
    controller.abort(signal.reason);
  } else {
    signal?.addEventListener("abort", abortFromUpstream, { once: true });
  }

  let lastError: Error | null = null;
  try {
    for (const gateway of gateways) {
      try {
        return await operation(gateway, { signal: controller.signal, timeoutMs: 0 });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          if (timedOut) throw new Error(`IPFS request timed out after ${timeoutMs}ms`);
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromUpstream);
  }

  throw lastError ?? new Error("No IPFS gateways are configured");
}

export function createGatewayChain(gateways: readonly IpfsGateway[]): IpfsGateway {
  return {
    readFile: (identifier, options = {}) =>
      runGatewayChain(gateways, options, (gateway, attemptOptions) =>
        gateway.readFile(identifier, attemptOptions)
      ),
    readJson: <T>(identifier: string, options: IpfsReadOptions = {}) =>
      runGatewayChain(gateways, options, (gateway, attemptOptions) =>
        gateway.readJson<T>(identifier, attemptOptions)
      ),
  };
}
