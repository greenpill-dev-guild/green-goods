/**
 * Where an arrow, Home, or End key moves focus in a speed dial, or null for
 * any other key. Every action is reachable, disabled ones included: a disabled
 * action stays focusable so a keyboard reaches the reason it gives. The admin
 * fork of the speed dial keeps the same rule in `FabButton`.
 */
export function nextSpeedDialActionId(
  actionIds: readonly string[],
  currentId: string | null,
  key: string
): string | null {
  const count = actionIds.length;
  if (count === 0) return null;
  const current = currentId === null ? -1 : actionIds.indexOf(currentId);
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return actionIds[(current + 1) % count] ?? null;
    case "ArrowUp":
    case "ArrowLeft":
      return actionIds[current === -1 ? count - 1 : (current - 1 + count) % count] ?? null;
    case "Home":
      return actionIds[0] ?? null;
    case "End":
      return actionIds[count - 1] ?? null;
    default:
      return null;
  }
}
