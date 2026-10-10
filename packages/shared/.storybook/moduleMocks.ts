import { mocked } from "storybook/test";

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
