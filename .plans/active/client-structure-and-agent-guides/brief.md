# Client Structure Cleanup + Agent Guide Consolidation

**Slug**: `client-structure-and-agent-guides`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-08-19`

## Problem

Two problems, found during a structure review of `packages/client` on 2026-08-19.

**The build's typecheck is a no-op.** `packages/client` and `packages/admin` both run
`tsc --noEmit` against a solution-style `tsconfig.json` (`"files": []` + `references`).
That form compiles nothing — it needs `tsc -b` to follow references. Proven by appending
`const __TYPE_PROBE__: number = "definitely not a number"` to a real client source file
and running the exact build command: exit 0. `tsc --noEmit --listFiles` prints zero files
for both packages. Every other package (shared, agent, indexer, contracts, docs) uses a
plain single tsconfig and does type-check for real.

Behind that dead gate sit **132 real type errors** — including client code reading six
fields off `GardenAssessment` that the shared domain type does not declare, and ~30 sites
using `string` where the repo's own `Address` invariant requires `` `0x${string}` ``.

**Structure has drifted and nothing enforces it.** `src/modules/` is a 2024 shell left over
after its contents migrated to shared. Multi-word module filenames split roughly evenly
between kebab-case and camelCase with no rule. Two files export a byte-identical constant
under different names. Three deliberately staged components (2,944 lines) are marked only by
a prose comment, so every dead-code scan flags them and every reviewer re-litigates them.
`check-source-structure.js` is already wired into every package CI workflow but enforces only
file length and no-JS-in-src — nothing about placement, naming, or layering.

Separately, `AGENTS.md` is titled "Codex Guide", duplicates roughly 60% of `CLAUDE.md`
near-verbatim, carries three overlapping validation sections, and omits the commands table
and git conventions that any agent needs.

## Desired Outcome

- The build cannot silently pass with type errors again.
- Client source layout is predictable enough to state as a rule and check in CI.
- Staged-but-unwired code is distinguishable from rot by tooling, not by reading comments.
- One agent guide that is agent-neutral, deduped, and coherent — usable by Claude, Codex, or
  anything else.
- Unchanged: `src/content/` stays (load-bearing, build-time consumer), the package-local
  `scripts/` folder stays, drawers stay under `views/Home/`, `views/Landing/` stays.

## Scope Notes

- In scope: `packages/client` layout, `packages/client` + `packages/admin` tsconfig wiring and
  the type errors it exposes, root + package `AGENTS.md`, `scripts/quality/check-source-structure.js`.
- Out of scope: `packages/shared` internal layout (its own `profile-avatar` duplication at two
  levels is noted but not addressed here), admin view layout, any runtime behavior change.

## Success Signal

A deliberate type error in any client or admin source file fails `bun run build`.
