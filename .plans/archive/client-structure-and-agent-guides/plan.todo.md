# Client Structure Cleanup + Agent Guide Consolidation Plan

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

**Feature Slug**: `client-structure-and-agent-guides`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-08-19`
**Last Updated**: `2026-08-24`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Phase 1 ships as **one PR**, not three | Maintainer call. Config fixes land as the first commit so the error list is reviewable before the fixes pile on. |
| 2 | Storybook folds into `tsconfig.test.json`; no separate stories project | Maintainer call. Stories are test-adjacent; a fourth project earns nothing. |
| 3 | `webmcp` goes to `src/webmcp.ts`, not `src/runtime/webmcp.ts` | Maintainer call — do not create a folder to hold one file. Its test moves to `src/__tests__/` to match the package's 86-file convention. |
| 4 | PascalCase for component files, camelCase for module files; no hyphens | Maintainer accepted the split over all-PascalCase. Preserves the "PascalCase means renderable" signal `routes/` already uses, at 8 renames instead of 22. |
| 5 | Naming rule is **client-scoped** for now | `packages/shared` leans kebab-case across a much larger surface. Repo-wide adoption is a separate decision. |
| 6 | `src/content/` stays, no rename to `editorial/` | Maintainer call. Load-bearing: `publicCuration` has 10 consumers, `publicSocialPreviews` is consumed at build time by `vite/social-preview.ts`. |
| 7 | `packages/client/scripts/` stays | Wired into `build` via `check:pwa-precache`; reads `dist/sw.js`, so package-local is correct. |
| 8 | Staged components stay in place, gain a machine-readable marker + a story, and stay in the typecheck | Maintainer call. They share `vaultCheckoutShell` with live siblings, so locality matters. Staged code that cannot compile is abandoned, not staged. |
| 9 | Genuinely dead exports are removed; client's `buttonVariants` is renamed | Maintainer call. |
| 10 | Stories stay colocated with their components; no `src/stories/` folder | Maintainer call. The three loose `views/*.stories.tsx` have no single owning component, so they stay put with the convention written down. |
| 11 | Drawers stay under `views/Home/` | Maintainer call — they are reached from Home, so the nesting reflects navigation. |
| 12 | `views/Landing/` stays as a one-file folder | Maintainer call. |
| 13 | `AGENTS.md` becomes the agent-neutral repo contract; `CLAUDE.md` keeps only harness-specific content | Maintainer call. Extends the existing `.claude/context/*.md` canonical-source pattern rather than inventing one. |
| 14 | Enforcement extends `check-source-structure.js` rather than adding a new gate | It is already wired into every package CI workflow and already uses a frozen-allowlist pattern that works. |
| 15 | Client assessment screens migrate to canonical `GardenAssessment` v2 semantics | Maintainer call on 2026-08-21. The client stops reading legacy metrics, capitals, tags, report-document, evidence-media, and impact-attestation fields; it presents the canonical domain, strategy kernel, reporting period, SDGs, and attachments instead. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror (`.claude/context/*.md` canonical-source; `check-source-structure.js` frozen allowlist)
- [x] List human judgment points before implementation (`spec.md` § Human Judgment Points)
- [x] Define what is out of scope (`brief.md` § Scope Notes)
- [x] Choose the lightest honest validation commands (see `eval.md`)

## Open Decisions — resolve before the phase that needs them

| # | Question | Blocks |
|---|---|---|
| A | **Resolved:** the client stops reading the dropped legacy fields and migrates both assessment screens to canonical v2 semantics. | Step 1.5 unblocked |
| B | **Resolved:** remove the override and use TypeScript's package-export resolution. The app, node, and test projects now type-check with `resolvePackageJsonExports: true`. | Step 1.3 complete |
| C | `views/Garden/` (work capture) vs `views/Home/Garden/` (garden detail) — rename one? | Step 2.9 (optional) |
| D | **Resolved:** use the exact `STAGED_MODULES` manifest plus the existing machine-checked marker | `check-staged-modules.mjs` already owns the canonical staged set and marker; Phase 4 reuses it instead of creating another convention. |
| E | **Resolved:** use `tsc -b` for each consumer's app, node, and test projects. Keep Shared's typecheck as its own package gate instead of a consumer project reference; importing Shared source through declared aliases still type-checks the code each consumer reaches without forcing declaration-portability errors across the entire Shared package. | Steps 1.4 and 1.9 complete |

---

## Phase 1 — Restore the typecheck (lane: `state_api`, one PR)

Config first, then errors by cluster, then flip the command last.

- [x] **1.0** Record the baseline before touching anything: current `bun run test` and `bun run build` result for client and admin, and a re-measured error count per project (see the freshness caveat in `spec.md` — a wagmi v2→v3 upgrade landed mid-review). Without this, "still green" in AC-6 is unprovable.
- [x] **1.1** `packages/client/tsconfig.node.json`: drop the non-existent `"api"` include, fix `../../indexer/schema.graphql` → `../indexer/schema.graphql`, add `vite/**/*` so `social-preview.ts` is checked.
- [x] **1.2** `packages/client/tsconfig.test.json`: narrow `include` to test + story globs only (currently claims all of `src`, overlapping `tsconfig.app.json`), add the `@green-goods/shared*` path aliases, remove `baseUrl` **first** — TS 7.0.2 rejects it with `TS5102` before type-checking starts, so the test project cannot be measured until it is gone. Add Storybook types per decision 2. Expect ~79 previously-unchecked errors in `src/__tests__/**` to appear at this point.
- [x] **1.3** `packages/client/tsconfig.app.json`: exclude `**/*.stories.tsx`, raise `target`/`lib` to ES2022, resolve open decision B.
- [x] **1.4** `packages/shared/tsconfig.json`: add `composite: true` (required for build mode). Add `packages/admin/tsconfig.test.json` mirroring 1.2, **and add it to `packages/admin/tsconfig.json` references**. Shared remains an independently checked package rather than a consumer project reference, per decision E.
- [x] **1.5** Fix the `GardenAssessment` cluster — 46 of client's 80 errors, in `views/Home/Garden/Assessment.tsx` (27) and `components/Features/Garden/Assessments.tsx` (19). Resolve open decision A first, then enumerate the shared type's consumers across admin and indexer before editing.
- [x] **1.6** Fix the `Address` cluster — ~30 sites using `string` where `` `0x${string}` `` is required. This is the root `AGENTS.md` `Address` invariant.
- [x] **1.7** Fix the remaining client errors (~4 files, single-digit counts each).
- [x] **1.8** Fix admin's 52 real errors.
- [x] **1.8b** Fix the test-project errors surfaced by 1.2 and 1.4. Client and admin app, node, and test projects now report zero errors.
- [x] **1.9** Flip both build scripts: `tsc --noEmit` → `tsc -b` in `packages/client/package.json` and `packages/admin/package.json`.
- [x] **1.10** Re-run the probe: append a deliberate type error to a client and admin source file, confirm each package build **fails**, then remove both probes. This is the acceptance proof for the whole phase.

## Phase 2 — Client layout (lane: `ui`, after Phase 1)

Lands after Phase 1 so the restored typecheck catches every broken import.

- [x] **2.1** Move `src/modules/webmcp/public-tools.ts` → `src/webmcp.ts`; move its test → `src/__tests__/webmcp.test.ts`; update `main.tsx:14`; delete `src/modules/`.
- [x] **2.2** Resolve the `config.ts` / `config/` ambiguity: move `src/config.ts` → `src/config/ipfs.ts`, add `src/config/index.ts` that re-exports and runs the side effect, update `main.tsx:17`.
- [x] **2.2b** Move the root router config to `src/config/routes.tsx` and update its consumers and documentation reference.
- [x] **2.3** Rename the selected kebab-case modules to camelCase. `garden-return-focus.ts` was also renamed to `gardenReturnFocus.ts` so the enforced naming rule and neighboring modules agree.
- [x] **2.4** Dedupe the identical scroll constant into client-local `components/Pwa/drawerScrollStyles.ts`; no class string moved into Shared.
- [x] **2.5** Placement fixes (documented per maintainer request):
  - `styles/pwaDrawerStyles.ts` + `styles/pwaStatusStyles.ts` — TS modules in an otherwise-CSS folder.
  - `views/Garden/mediaAnalytics.ts` — analytics in a view folder; all other analytics lives in `shared/src/modules/app/analytics-events.ts`.
  - `components/Public/vaultCheckoutShell.tsx` — camelCase `.tsx` among PascalCase siblings, exporting both constants and components.
  - `components/WalletConnectButton.tsx` — the only loose component at `components/` root.
  - `components/Public/` — 33 flat files while every other category is grouped; the six `Vault*` files are the obvious first subfolder.
  - `components/Cards/Base/Card.tsx` — three directory levels for one file.
- [x] **2.6** Remove dead exports: `WorkCard`, `WorkCardProps`, `WorkCardItem` from `components/Cards/Work/WorkCard.tsx` (keep `MinimalWorkCard`, which is live), plus the `Cards` barrel entries and the dead half of `__tests__/components/WorkCard.test.tsx`. Remove `AvatarRootProps` and `AvatarVariantProps`.
- [x] **2.7** Rename client's `buttonVariants` in `components/Actions/Button/Base.tsx` to end the name collision with shared's exported `buttonVariants`.
- [x] **2.8** Apply the canonical staged marker and manifest to the three staged Vault components and their helper; add one real-render Storybook story per component; keep the full staged set inside the test project typecheck.
- [ ] **2.9** *(optional, gated on open decision C)* Rename `views/Garden/` to reflect that it is the work-capture flow, distinct from `views/Home/Garden/`.

## Phase 3 — Agent guide (lane: `docs`)

- [x] **3.0** Update the existing CI guidance checker and the guide headings in the same change.
- [x] **3.1** Keep root and package guides agent-neutral; reduce `CLAUDE.md` to Claude-specific entrypoints, tools, and dispatch behavior.
- [x] **3.2** Collapse root validation policy into one concise section and make `.claude/context/validation-pipeline.md` canonical for the full ladder and commands.
- [x] **3.3** Remove near-verbatim shared policy from `CLAUDE.md`; keep shared rules in `AGENTS.md` or `.claude/context/*.md`.
- [x] **3.4** Add only durable entry routers: common commands, criticality, package guides, PostHog routing, architecture, and validation. Link service operations and changing reference inventories instead of copying ports and documentation maps into root guidance.
- [x] **3.5** Move the Package Guides index near the top and retire the parked "Test Suite Speed Follow-Up" section.
- [x] **3.6** Give every package the same compact validation shape: targeted QA, package loop, conditional proof, and broader-impact escalation. Replace repeated Brave policy with a root link and retain package-specific security/domain material.
- [x] **3.7** Extend `scripts/quality/check-codex-docs.js` with tested near-verbatim policy detection between `AGENTS.md` and `CLAUDE.md`.

### Phase 3 implementation note — 2026-08-24

The accepted implementation deliberately avoids copying Git, service-port, environment, and
documentation inventories into another root section. Existing root invariants and canonical links
remain authoritative. Package leveling applies to the development/validation contract; it does not
flatten the Contracts guide's legitimate security and deployment detail merely to match line counts.

## Phase 4 — Enforcement (lane: `docs`)

Extends `scripts/quality/check-source-structure.js`, already wired into every package CI workflow.

- [x] **4.1** Placement: allowed top-level directories per package; no loose source files at `src/` root outside a declared set.
- [x] **4.2** Naming: client component files use PascalCase, other client TypeScript files use camelCase, and filenames use no hyphens. Reuse the exact decision-D manifest and marker so staged files are not flagged.
- [x] **4.3** Layering: no new `useX` hook definitions outside `packages/shared`; no imports of `@green-goods/shared/src/**` or undeclared Shared subpaths.
- [x] **4.4** Changed-file dead-export scan that skips barrels, stories, tests, and the exact staged-module set.
- [x] **4.5** Run the extended gate across the whole tree before wiring it to fail. The initial exact baseline contains 22 pre-enforcement placement, naming, and hook-location violations; machine enforcement rejects baseline growth and requires stale entries to be removed as Phase 2 clears them.
- [x] **4.6** Add the enforced rules to `AGENTS.md` § Key Patterns so the gate and guide agree.

### Phase 4 implementation note — 2026-08-24

The maintainer requested Phase 4 before Phase 2. Enforcement therefore landed as a strict ratchet
instead of pretending the existing client layout was already compliant. The checker scans the whole
tree, permits only the 22 exact pre-enforcement IDs, rejects baseline growth, and fails when a fixed
violation leaves a stale entry. Phase 2 must delete matching baseline entries as it moves or renames
the affected files. Dead exports are checked only on changed implementation files to avoid
grandfathering heuristic false positives across untouched code.

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| `tsc -b` replaces `tsc --noEmit`, projects correctly scoped | `state_api` | 1.1–1.4, 1.9 | ✅ Phase 1 |
| All 132 real type errors fixed, not suppressed | `state_api` | 1.5–1.8 | ✅ Phase 1 |
| No `modules/` dir, no kebab-case filenames in client | `ui` | 2.1, 2.3 | ✅ Phase 2 |
| Staged components carry a marker and a story | `ui` | 2.8 | ✅ Phase 2 |
| Dead exports removed; `buttonVariants` collision resolved | `ui` | 2.6, 2.7 | ✅ Phase 2 |
| `AGENTS.md` agent-neutral, deduped, complete | `docs` | 3.1–3.7 | ✅ Phase 3 |
| Structure gate enforces placement, naming, layering | `docs` | 4.1–4.6 | ✅ Phase 4 |

## TDD / Proof Order

- [x] Phase 1's behavior boundary is the build gate itself. RED = the probe passing under the former no-op build; GREEN = step 1.10, the same probe failing both package builds with `TS2322` and `TS6133`.
- [x] Phase 2 is a refactor with no behavior change — proof is the restored typecheck plus the existing client suite staying green. The lane retains machine-readable `not_applicable` mode with that note.
- [x] Phase 3 prose is documentation; the new duplicate-policy guard used RED/GREEN fixture proof recorded in the docs handoff.
- [x] Phase 4 adds a gate; RED = the fixture import failing before the checker exported the policy API, GREEN = nine policy fixtures plus the whole-tree gate passing with the exact shrinking baseline.
- [x] Record machine-readable Phase 1 proof with `node scripts/harness/plan-hub.mjs record-tdd`

## Lane Checklists

### State / API (Phase 1)

- [x] Resolve open decisions A and B before editing types
- [x] Enumerate `GardenAssessment` consumers across admin and indexer before changing the shared type
- [x] Keep hooks in shared
- [x] Record RED/GREEN proof (the probe) before marking the lane complete
- [x] Write `handoffs/codex-state-api.md`

### UI (Phase 2)

- [x] Preserve rename identity for every move. This environment denied `.git/index.lock`, so files were moved in the working tree and are presented as delete/add until the maintainer stages them; Git can detect the renames at commit time.
- [x] No live user-facing string changed; the only added copy is Storybook fixture metadata, and `lint:vocab` passes.
- [x] Tailwind class-scanning is unaffected: the shared drawer class stays under `packages/client/src/`.
- [x] Retain `not_applicable` TDD mode with a concrete refactor note.
- [x] Write `handoffs/claude-ui.md`

### Docs (Phases 3–4)

- [x] `AGENTS.md` and `scripts/quality/**` are security-sensitive surfaces — call them out in the PR summary
- [x] Run the extended gate tree-wide before wiring it to fail
- [x] Write `handoffs/claude-docs.md` for the completed Phases 3 and 4; keep the broader feature open for the remaining lanes

### QA Pass 1

- [x] Verify acceptance criteria from `eval.md`
- [x] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2

- [x] Review regressions and implementation edges
- [x] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [x] `bun format && bun lint`
- [x] `bun run test`
- [x] `VITE_CHAIN_ID=11155111 bun run build`
- [x] `bun run check:source-structure`
- [x] `node scripts/quality/check-codex-docs.js`
