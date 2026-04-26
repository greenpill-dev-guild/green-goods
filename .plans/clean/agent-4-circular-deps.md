# Agent 4 — Circular Dependency Resolution

## Summary
- Total cycles found: 3
- Resolved (HIGH-confidence): 3
- Remaining (MEDIUM/LOW): 0
- Build: SKIPPED (env-gated; .env absent in worktree, contracts lib/ submodule absent)
- Tests: SKIPPED (env-gated; node_modules incomplete in worktree, identical failures at baseline)
- Madge re-run: PASS (zero cycles)
- TypeScript: PASS for client; shared has pre-existing `xstate`/workflow errors unrelated to this change

## Resolved cycles

### Cycle 1 (and Cycle 2 — share the same edge)

**Original cycles reported by madge:**
1. `client/src/components/Cards/Action/ActionCard.tsx` → `client/src/components/Display/index.ts` → `client/src/components/Display/Accordion/Faq.tsx` → `client/src/components/Cards/index.ts` → (back to `ActionCard.tsx`)
2. Same path, terminating at `client/src/components/Cards/Action/ActionCardSkeleton.tsx` (also re-exported from `Cards/index.ts`)

**Root cause:**
- `Faq.tsx` imported `FlexCard` from the `Cards/index.ts` barrel
- `Cards/index.ts` re-exports `ActionCard` (and `ActionCardSkeleton`)
- `ActionCard.tsx` imports `ImageWithFallback` from the `Display/index.ts` barrel
- `Display/index.ts` re-exports `Faq` — closing the loop

**Strategy:** Replace barrel import with direct file import in `Faq.tsx`. `FlexCard` is a runtime value (a React component), not a type, so `import type` does not apply. Both cycles resolve via this single edge cut.

**Files changed:**
- `packages/client/src/components/Display/Accordion/Faq.tsx`: `import { FlexCard } from "../../Cards"` → `import { FlexCard } from "../../Cards/Base/Card"`

**Risk:** Low. `FlexCard` is exported from `Card.tsx` (line 97). Direct relative imports are an established in-pattern in `packages/client/src/`. The `barrel-only` rule (Rule 11 in `typescript.md`) applies to cross-package imports from `@green-goods/shared`, not intra-package relatives.

**Why not edit `ActionCard.tsx` instead:** Both ends would have worked, but `Faq.tsx`'s barrel import was the more incidental coupling — `Faq` only needs `FlexCard` from the barrel, while `ActionCard` is genuinely a Cards-domain component sitting under the same barrel. Cutting at `Faq` keeps the Display→Cards directionality intuitive (display primitives can wrap cards without re-entering the Cards barrel).

### Cycle 3

**Original cycle reported by madge:**
- `shared/src/__mocks__/server/index.ts` (self-import)

**Root cause:** `shared/src/__mocks__/server/index.ts` contained `export * from "./index"` — a literal self-reference, almost certainly an autocomplete error from when the file was authored.

**Strategy:** Delete the self-referencing line.

**Files changed:**
- `packages/shared/src/__mocks__/server/index.ts`: removed `export * from "./index";`

**Risk:** Low. The line was a no-op at best and a recursion hazard at worst. The remaining `export * from "./server"` and `export * from "./viem"` cover all real exports.

## Verification

```
$ npx madge --circular --extensions ts,tsx packages/
Processed 1044 files (9.5s) (216 warnings)
✔ No circular dependency found!
```

(The 216 warnings are unrelated dependency-resolution noise, unchanged from before.)

## Build / test notes

- `bun run build` fails on `build:contracts` because `packages/contracts/lib/` (Foundry submodules) and `node_modules/@ethereum-attestation-service` are not present in this worktree. Per the agent rules, `packages/contracts/lib/` is off-limits and per `feedback_codex_worktree_env.md` env-gated steps stay env-gated.
- `bun run build:shared` passes (shared has no build step).
- `bun run build:client` fails to load `vite.config.ts` because the root `.env` is absent in the worktree (varlock requirement).
- `cd packages/client && bunx tsc --noEmit` PASSES — confirms my barrel→direct import change preserves types.
- `cd packages/shared && bunx tsc --noEmit` reports pre-existing errors in `src/workflows/{createAssessment,createGarden,mintHypercert}.ts` (missing `xstate` module, implicit `any`s). None of these are in files I touched, none reference `__mocks__/server/`.
- `cd packages/client && bun run test` fails identically before and after my changes (verified with `git stash` at HEAD baseline). All 21 test failures are vite resolution errors for `@remixicon/react`, an environmental gap in the worktree's node_modules — not caused by my edits.

## Remaining cycles

None.
