/**
 * Mock for @walletconnect/utils
 *
 * Prevents loading the actual module which has dependency issues with uint8arrays.
 * Tests that need WalletConnect functionality should mock specific functions.
 */

export const formatJsonRpcResult = (id: number, result: unknown) => ({
  id,
  jsonrpc: "2.0",
  result,
});

export const formatJsonRpcError = (id: number, error: unknown) => ({
  id,
  jsonrpc: "2.0",
  error,
});

export const parseUri = (uri: string) => ({
  protocol: "wc",
  version: 2,
  topic: "mock-topic",
  symKey: "mock-symkey",
  relay: { protocol: "irn" },
});

export const getSdkError = (type: string) => ({
  message: `Mock SDK Error: ${type}`,
  code: 5000,
});

export const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const calcExpiry = (ttl: number) => Math.floor(Date.now() / 1000) + ttl;

export const createDelayedPromise = () => {
  let resolve: () => void;
  let reject: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
};

export const getInternalError = (type: string) => ({
  message: `Internal error: ${type}`,
  code: 5000,
});

export const hashKey = (key: string) => key;
export const hashMessage = (message: string) => message;
