import { mocked } from "storybook/test";
import { useChainClockReader } from "../src/hooks/commitment-pooling/useExpiryClock";

/**
 * Pins the chain clock a steward's act reads before it sends, so a story's dialog decides on the
 * story's own time instead of a live chain. `useExpiryClock` is module-mocked in spy mode in
 * `preview.tsx`; pair this with `resetHookMocks(useChainClockReader)` in the story's `beforeEach`.
 */
export function pinChainClock(seconds: number): void {
  mocked(useChainClockReader).mockReturnValue(async () => BigInt(seconds));
}

export { useChainClockReader };
