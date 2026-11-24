import { mocked } from "storybook/test";
import { gardenReadThisSession } from "../src/hooks/work/gardenWorkListQuery";

type MockableHook = (...args: never[]) => unknown;

/**
 * Hooks mocked with `sb.mock(..., { spy: true })` keep a story's overrides between stories:
 * Storybook only clears their call history. A story that overrides hooks in `beforeEach` returns
 * this cleanup, so every later story, in any package, gets the real hooks back.
 */
export function resetHookMocks(...hooks: MockableHook[]): () => void {
  return () => {
    for (const hook of hooks) mocked(hook).mockReset();
  };
}

/**
 * A story that seeds a garden's work list stands for this session's own read of it. A seed skips
 * the read, which alone records it, so without this the list counts as restored or written and
 * every status in it as unread. Returns the cleanup for `beforeEach`.
 */
export function markGardenWorkReadThisSession(): () => void {
  mocked(gardenReadThisSession).mockReturnValue(true);
  return resetHookMocks(gardenReadThisSession);
}
