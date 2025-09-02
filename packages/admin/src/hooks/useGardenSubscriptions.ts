// Simplified subscriptions - will be enhanced with proper WebSocket setup later
export function useGardenSubscriptions() {
  // Placeholder for real-time subscriptions
  // TODO: Implement proper GraphQL subscriptions with WebSocket transport
  
  return {
    subscriptionStates: {
      gardenCreated: { data: null, fetching: false, error: null },
      operatorAdded: { data: null, fetching: false, error: null },
      gardenerAdded: { data: null, fetching: false, error: null },
    },
  };
}