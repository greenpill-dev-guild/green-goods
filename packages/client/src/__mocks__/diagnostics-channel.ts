export function tracingChannel() {
  return {
    subscribe: () => undefined,
    unsubscribe: () => undefined,
    hasSubscribers: false,
  };
}
