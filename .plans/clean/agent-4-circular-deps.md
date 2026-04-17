# Circular Dependency Analysis

**Date**: 2026-04-16
**Tool**: `npx madge --circular --extensions ts,tsx`

## Summary

| Package  | Cycles | Status |
|----------|--------|--------|
| shared   | 1      | Self-referencing mock barrel |
| client   | 2      | Cards <-> Display barrel cross-import |
| admin    | 0      | Clean |
| indexer  | 0      | Clean |
| agent    | 0      | Clean |
| Cross-package | 0 | Clean (no upward deps) |

## Findings

### HIGH-CONFIDENCE (safe to fix)

#### 1. shared/__mocks__/server/index.ts — Self-reference
- **Cycle**: `index.ts -> index.ts`
- **Root cause**: Line 2 is `export * from "./index"` — the file re-exports itself
- **Fix**: Remove the self-referencing `export * from "./index"` line
- **Risk**: None. This is a clear typo/mistake.

#### 2. client/Cards <-> Display — Barrel cross-import
- **Cycle**: `ActionCard.tsx -> Display/index.ts -> Faq.tsx -> Cards/index.ts -> ActionCard.tsx`
- **Also**: `ActionCard.tsx -> Display/index.ts -> Faq.tsx -> Cards/index.ts -> ActionCardSkeleton.tsx -> ActionCard.tsx`
- **Root cause**: `ActionCard.tsx` imports `ImageWithFallback` from `../../Display` (barrel), which also re-exports `Faq.tsx`, which imports `FlexCard` from `../../Cards` (barrel). The barrels create a cross-dependency.
- **Fix**: `ActionCard.tsx` should import `ImageWithFallback` directly from `../../Display/Image/ImageWithFallback` instead of through the Display barrel. This breaks the cycle because ActionCard no longer triggers Faq.tsx to load.
- **Risk**: Low. Direct import is more explicit and still within the same package.

### MEDIUM — None found

### LOW — None found

## Resolution Plan

1. Remove self-referencing line in shared mock barrel
2. Use direct import in ActionCard.tsx instead of Display barrel

Both fixes are mechanical and preserve all existing functionality.
