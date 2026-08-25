# Client Structure Cleanup + Agent Guide Consolidation Spec

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

## Summary

Restore real type-checking to the client and admin builds, fix the 132 type errors that the
dead gate has been hiding, bring `packages/client` source layout to a statable rule, give
deliberately staged code a machine-readable marker, rewrite `AGENTS.md` as an agent-neutral
repo contract, and extend the existing `check-source-structure.js` gate so the layout rules
hold going forward.

## Users

- Primary: maintainers and coding agents working in `packages/client`.
- Secondary: anyone reading `AGENTS.md` as their entry contract for the repo.

## Functional Requirements

1. `tsc -b` replaces `tsc --noEmit` in the client and admin build scripts, and the projects it
   walks are correctly scoped.
2. All 132 real type errors are fixed (not suppressed, not excluded).
3. `packages/client/src` has no `modules/` directory and no kebab-case source filenames.
4. Staged-but-unwired components carry a machine-readable marker and a Storybook story.
5. Genuinely dead exports are removed; the `buttonVariants` name collision with shared is resolved.
6. `AGENTS.md` is agent-neutral, deduped against `CLAUDE.md`, and contains the commands table
   and git conventions it currently lacks.
7. `check-source-structure.js` enforces placement, naming, and layering in addition to length.

## Research Evidence

All measurements taken 2026-08-19 on `feature/commitment-pooling-client-ui`.

**Freshness caveat**: during this review another session landed a **wagmi v2 → v3 major upgrade** in
`packages/client/package.json` (plus commitment-pooling view edits) on this same branch. wagmi types
flow directly into the `` `0x${string}` `` cluster counted below. Re-measure every count in this
section before executing Phase 1 — these numbers predate that upgrade.

### The typecheck is dead — proof

- `cd packages/client && tsc --noEmit --listFiles` → 0 lines. Same for `packages/admin`.
- Probe test: appended a deliberate type error to `src/views/Public/Glossary.tsx`, ran the exact
  build command (`APP_ENV=production tsc --noEmit`) → **exit 0**. Probe removed; tree left clean.
- Cause: `tsconfig.json` in both packages is solution-style (`"files": []` + `references`).
  `tsc --noEmit -p <solution>` compiles nothing. Build mode (`tsc -b`) is required to follow
  project references.
- Not affected: shared (761 files), agent (70), contracts (88), indexer (78), docs (29) — each uses a
  plain tsconfig with a real `include`, and each type-checks. Verified by `--listFiles` counts.

**Two ways to close the hole**, and they are not equivalent:

| Option | Covers | Cost |
|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | app only — 234 files today | Smallest change. No `composite` needed. Leaves `vite/` and all 86 test files unchecked. |
| `tsc -b` | app + node + test + shared | Thorough. Requires `composite: true` on shared, and pulls in the 79 test errors above. |

`tsc -b` is the stronger gate and the plan assumes it, but the choice is a maintainer call because it
changes the size of Phase 1 materially. See open decision E.

### Error surface once the projects are checked

Measured with `tsc --noEmit -p tsconfig.app.json` in each package:

| Bucket | Client | Admin | Cause |
|---|---:|---:|---|
| `.stories.tsx` | 76 | 417 | `tsconfig.app.json` excludes tests but not stories; `@storybook/react` types unresolvable there |
| `node_modules` (`permissionless`, `ox`) | 57 | 57 | `"resolvePackageJsonExports": false` resolves to raw `.ts` source; `skipLibCheck` only skips `.d.ts` |
| `Error.cause` (TS2550) | 11 | ~11 | client/admin `lib: ES2020` applied to shared source that targets ES2022 |
| **Real errors in app src** | **80** | **52** | genuine |
| Totals | 256 | 569 | |

**The app project is not the whole surface.** `tsc -b` walks the test and node projects too.
Measured separately on 2026-08-19:

| Project | Client | Note |
|---|---:|---|
| `tsconfig.node.json` (vite.config.ts) | **0** | clean today |
| `tsconfig.test.json` — `src/__tests__/**` | **79** | never type-checked before |
| `tsconfig.test.json` — `.stories.tsx` | 76 | same story errors as the app project |
| Admin test project | **unmeasured** | admin has no test tsconfig; step 1.4 creates one |

So the honest total for a `tsc -b` approach is **80 + 52 + 79 + (admin test surface, unknown)**,
not 132. The 132 figure covers app projects only.

**`baseUrl` blocks measurement.** `tsconfig.test.json` sets `baseUrl`, which TS 7.0.2 rejects with
`TS5102` *before* type-checking begins — so the test project reports exactly 1 error until that line
is removed. The 79 above was measured by stripping `baseUrl` into a scratch config. Removing it is a
precondition for counting, not just a cleanup.

Client's 80 real errors by file (top 5):

| File | Errors |
|---|---:|
| `src/views/Home/Garden/Assessment.tsx` | 27 |
| `src/components/Features/Garden/Assessments.tsx` | 19 |
| `src/components/Cards/Work/WorkCard.tsx` | 6 |
| `src/views/Home/WorkDashboard/index.tsx` | 4 |
| `src/views/Garden/index.tsx` | 3 |

46 of 80 share one root cause: `GardenAssessment` does not declare `metrics`, `startDate`,
`endDate`, `tags`, `capitals`, or `reportDocuments`, which client code reads. Roughly 30 more
are `string` vs `` `0x${string}` `` — the `Address` invariant in `CLAUDE.md`, violated silently.

### Additional tsconfig defects

- `packages/client/tsconfig.node.json` includes `"api"` — no such directory exists.
- Same file includes `"../../indexer/schema.graphql"`, which resolves to repo-root `/indexer/`.
  Real path is `../indexer/schema.graphql`.
- `packages/client/vite/social-preview.ts` (~490 lines, runs at build time to generate social
  cards) is in **no** tsconfig `include` — never type-checked.
- `packages/client/tsconfig.test.json` includes `src/**/*.ts` and `src/**/*.tsx` — the entire
  app — fully overlapping `tsconfig.app.json`. Two projects claiming the same files is invalid
  under project references.
- Same file declares only the `@/*` path, none of the `@green-goods/shared*` aliases.
- Same file sets `baseUrl`, which **TypeScript 7.0.2 has removed** — this is already an error today
  (`TS5102`).
- `packages/shared/tsconfig.json` lacks `composite: true`, which `tsc -b` requires of a referenced
  project.
- `packages/admin` has no test tsconfig at all.

### Client layout findings

- `src/modules/` was the 2024 integration-clients folder (`eas.ts`, `graphql.ts`, `greengoods.ts`,
  `pinata.ts`, `react-query.ts`, `urql.ts` at `b29ca509d`). All migrated to shared; the empty shell
  remained and `webmcp/` was added into it in 2026. Sole occupant today:
  `modules/webmcp/public-tools.ts`, one consumer (`main.tsx:14`).
- `src/config.ts` (side-effect IPFS init) sits beside `src/config/` (2 files). `@/config` resolves
  to the file, `@/config/pwa-routing` to the directory. There is no `config/index.ts`.
- Multi-word module filenames: 9 kebab-case vs 7 camelCase, no rule. Framework-mandated lowercase
  files (`main.tsx`, `router.tsx`, `router.config.tsx`, `config.ts`) are excluded from that count.
- `views/Home/CommitmentsDrawer/classnames.ts` and `views/Home/WalletDrawer/classnames.ts` export
  the identical value `"min-h-0 flex-1 overflow-y-auto"` under two different constant names.
- Client test convention is `src/__tests__/` (86 files). `modules/webmcp/public-tools.test.ts` is
  the only colocated test in the package.

### Staged vs dead components

All three carry a header reading *"Staged — not yet wired into the live checkout … Do not remove as
'dead code'"*, with an unpark condition and a reference to
`.plans/archive/nyc-vault-crowdfunding/brief.md`.

| File | Lines | Reachable from a route |
|---|---:|---|
| `components/Public/VaultCheckoutDialog.tsx` | 1174 | Yes — `views/Public/Vaults.tsx` |
| `components/Public/VaultManagePositionsPanel.tsx` | 928 | Yes — `views/Public/Vaults.tsx` |
| `components/Public/vaultCheckoutShell.tsx` | 490 | Yes (helper for 4 files) |
| `components/Public/VaultCardEndowFlow.tsx` | 1509 | No — staged |
| `components/Public/VaultCardPaymentPanel.tsx` | 709 | No — staged (only EndowFlow) |
| `components/Public/VaultCardWalletManage.tsx` | 726 | No — staged |

The marker is prose only: `grep` across `scripts/quality/` finds no gate that understands it.
`VaultCardWalletManage.tsx` also holds a `FROZEN_ALLOWLIST` entry (726) in
`check-source-structure.js`. The staged files carry 4 of the 80 real type errors, so they are
already drifting.

### Genuinely dead (no staged marker, no consumer)

- `WorkCard` + `WorkCardProps` + `WorkCardItem` in `components/Cards/Work/WorkCard.tsx` — referenced
  only by the `Cards` barrel and its own test. It is a thin wrapper over shared's
  `WorkCardComponent`. `MinimalWorkCard` in the same file is live (2 consumers).
- `AvatarRootProps`, `AvatarVariantProps` in `components/Display/Avatar/Avatar.tsx`.
- Not dead but colliding: client defines its own `buttonVariants` in
  `components/Actions/Button/Base.tsx`, sharing a name with shared's exported `buttonVariants`
  (different shapes — client's returns `{root, icon}` slots).

### Views

- The three loose `views/*.stories.tsx` files have no single owning component.
  `HeroMoments.stories.tsx` imports nothing from the app at all (pure showcase);
  `PwaProtectedSurfaces.stories.tsx` composes four separate components;
  `PublicBrowserSurfaces.stories.tsx` imports from `routes/`, not `views/`.
  Colocation does not apply to them — 17 component stories are already colocated correctly.
- `views/Home/` holds 56 files. Retained by decision: the drawers are reached from Home.
- `views/Garden/` (work-capture flow) and `views/Home/Garden/` (garden detail) are two different
  things both called Garden. **Open decision.**

### AGENTS.md

- 285 lines / 30 KB / 24 top-level sections. Titled "Green Goods — Codex Guide"; every package
  guide is titled "<Package> — Codex Guide"; sections named "Codex Workflow", "Codex Notes".
- Three overlapping validation sections: "Validation Selection Contract" (L116), "Validation
  Intent Ladder" (L138), "Validation Ladder" (L218).
- ~60% duplicates `CLAUDE.md` near-verbatim: Multi-Agent Repo Safety, Verify Before Claiming
  Success, Known Gotchas (Tailwind), Scripts, Supply-chain, Design Language, Agentic Modern Web
  Standard, User-Observed UI Regression Debugging. `scripts/quality/check-codex-docs.js` validates
  that referenced commands exist — not that the two guides agree.
- Absent from AGENTS.md but present in CLAUDE.md: the commands table, Git Workflow (branch naming,
  conventional-commit scopes), Key Patterns (hook boundary, `Address` type, query keys, indexer
  boundary), Criticality Matrix, Environment / chain selection, local service ports, PostHog project
  routing, Documentation map.
- Preamble says "read the nearest AGENTS.md for the package you are editing"; the Package Guides
  index is at line 238 of 285.
- "Test Suite Speed Follow-Up" is a parked TODO, not runtime guidance.
- Package guides are uneven: contracts 605 lines, indexer 43. `packages/client/AGENTS.md`
  duplicates two long Brave-QA paragraphs verbatim from root.

### Existing enforcement

`scripts/quality/check-source-structure.js` is wired into every package CI workflow
(`admin.yml`, `agent.yml`, `client.yml`, `contracts.yml`, …). It enforces exactly two things:
file-length caps (350 new / 500 modified / a 63-entry frozen allowlist) and no `.js`/`.jsx` in
package source. Nothing about placement, naming, or layering.

## Human Judgment Points

- **Naming scope**: the camelCase-for-modules rule is written here as client-scoped. `packages/shared`
  leans kebab (`analytics-events.ts`, `contract-errors.ts`, `vault-crowdfunding.ts`). Applying it
  repo-wide is a separate, larger decision — flagged, not assumed.
- **`GardenAssessment`**: the 46-error cluster is a shared domain-type question. Either the type gains
  the six fields or the client stops reading them. Needs a call on which is correct before Phase 1
  can finish.
- **`resolvePackageJsonExports: false`**: presumably added deliberately. If it can be removed, 57
  errors go with it; if not, those paths need excluding instead. Establish why it is there first.
- **Garden naming collision**: `views/Garden/` vs `views/Home/Garden/` — undecided.
- **Staged marker syntax**: JSDoc tag vs a manifest file. Affects how `check-source-structure.js`
  and any future dead-export scan read it.

## Non-Functional Constraints

- Package boundaries: hooks stay in shared; no new client-side hook may be introduced by this work.
- Offline / sync: no runtime behavior changes anywhere in this plan.
- Localization: no user-facing strings change; `lint:vocab` unaffected.
- Security: `AGENTS.md` and `scripts/quality/**` are security-sensitive surfaces per `CLAUDE.md`
  and must be called out in the PR summary.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Typecheck restoration + 132 type errors | `state_api` | Phase 1. Single PR per decision D1. |
| Client layout, naming, staged marker, dead code | `ui` | Phase 2 |
| AGENTS.md rewrite | `docs` | Phase 3 |
| Enforcement gate | `docs` | Phase 4. Lands after Phase 2 so the rules describe reality. |
| Contracts | `contracts` | `n/a` — no Solidity in scope |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential |

## Risks

- **Risk**: Phase 1 as one PR mixes config changes with 132 error fixes across 19+ files, including
  a shared domain type. Large review surface.
  **Mitigation**: land config corrections as the first commit in the PR so the error list is
  reviewable on its own, then fix by cluster (GardenAssessment, then Address, then the tail).
- **Risk**: fixing `GardenAssessment` in shared could ripple into admin and indexer consumers.
  **Mitigation**: enumerate consumers before editing the type; admin's own 52 errors are in the
  same PR, so ripple lands visibly rather than later.
- **Risk**: renaming files breaks imports silently in a package whose typecheck is currently dead.
  **Mitigation**: Phase 2 lands after Phase 1, so the restored `tsc -b` catches every broken import.
- **Risk**: the new enforcement rules flag existing files not covered by this plan.
  **Mitigation**: Phase 4 runs the gate across the tree before wiring it to fail, and uses the same
  frozen-allowlist pattern already proven for file length.
