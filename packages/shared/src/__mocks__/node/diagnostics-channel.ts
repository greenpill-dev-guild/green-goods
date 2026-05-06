/**
 * Mock for Node.js diagnostics_channel
 * Required for pino compatibility in test environment
 */

export const channel = () => ({
  subscribe: () => {},
  unsubscribe: () => {},
  publish: () => {},
  hasSubscribers: false,
});

const tracingSubChannel = () => ({
  subscribe: () => {},
  unsubscribe: () => {},
  publish: () => {},
  hasSubscribers: false,
});

export const tracingChannel = () => ({
  subscribe: () => {},
  unsubscribe: () => {},
  start: tracingSubChannel(),
  end: tracingSubChannel(),
  asyncStart: tracingSubChannel(),
  asyncEnd: tracingSubChannel(),
  error: tracingSubChannel(),
  hasSubscribers: false,
});
