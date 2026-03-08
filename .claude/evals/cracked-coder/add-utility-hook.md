# Eval Task: Create `useInterval` Utility Hook

## Brief

Create a `useInterval` hook in `packages/shared/src/hooks/utils/` following the established `useTimeout.ts` pattern. This hook provides a safe wrapper around `setInterval` with automatic cleanup.

## Requirements

1. Create `useInterval` in `packages/shared/src/hooks/utils/useInterval.ts`
2. Follow the `useTimeout.ts` pattern:
   - Return `{ set, clear, isActive }` interface
   - Use `useRef` for interval ID and mounted state tracking
   - Clean up on unmount via `useEffect`
   - Guard callbacks with `isMountedRef`
   - Use `useCallback` for stable function references
3. `set(callback, delay)` — starts the interval, clears any existing one first
4. `clear()` — stops the current interval
5. `isActive()` — returns whether an interval is currently running
6. Export from the shared barrel (`packages/shared/src/hooks/index.ts`)
7. Write tests in `packages/shared/src/hooks/utils/__tests__/useInterval.test.ts`

## Constraints Under Test

- **Pattern Conformity**: Must follow `useTimeout.ts` structure (Cathedral Check)
- **Cleanup on Unmount**: Interval must be cleared when component unmounts
- **Ref-Based Guards**: Must use `isMountedRef` to prevent executing after unmount
- **Barrel Export**: Must update `packages/shared/src/hooks/index.ts`
- **Test Coverage**: Must test: set/clear lifecycle, cleanup on unmount, callback not called after clear
- **TDD**: Failing test written before implementation

## Reference File

`packages/shared/src/hooks/utils/useTimeout.ts` — the canonical pattern to follow.

## Expected Artifacts

- `packages/shared/src/hooks/utils/useInterval.ts`
- `packages/shared/src/hooks/utils/__tests__/useInterval.test.ts`
- Updated `packages/shared/src/hooks/index.ts` (barrel export)
