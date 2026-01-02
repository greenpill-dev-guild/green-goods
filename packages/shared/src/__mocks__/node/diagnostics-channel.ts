/**
 * Mock for Node.js diagnostics_channel
 * Required for pino compatibility in test environment
 */

export const channel = () => ({
  subscribe: () => {},
  unsubscribe: () => {},
  hasSubscribers: false,
});

export const tracingChannel = () => ({
  subscribe: () => {},
  unsubscribe: () => {},
  hasSubscribers: false,
});
