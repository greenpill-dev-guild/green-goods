/** The five reviewed Community Garden rehearsals, not a garden-wide filter. */
export function communityRehearsals() {
  return [4, 5, 6, 15, 16].map((id) => ({
    id: `42161-${id}`,
    cycleId: "1",
    direction: "REQUEST",
    state: id < 6 ? "FULFILLED" : id === 6 ? "CANCELLED" : "REQUESTED",
    acceptanceSeen: id < 6,
    countedLifecycleStates:
      id < 6 ? ["READY_FOR_CONFIRMATION", "FULFILLED"] : id === 6 ? ["CANCELLED"] : [],
    unitLabel: id === 4 ? "surveys" : id === 5 ? "phones" : "hours",
    targetUnits: id === 5 ? "3" : "1",
    approvedUnits: "0",
  }));
}
