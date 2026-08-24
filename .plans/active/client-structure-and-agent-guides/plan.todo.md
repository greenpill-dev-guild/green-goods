# Client Structure Cleanup + Agent Guide Consolidation Plan

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
| B | Why is `"resolvePackageJsonExports": false` set? If removable, 57 errors go with it; if not, those paths need excluding. | Step 1.3 |
| C | `views/Garden/` (work capture) vs `views/Home/Garden/` (garden detail) — rename one? | Step 2.9 (optional) |
| D | Staged marker syntax: JSDoc `@staged` tag vs a manifest file | Step 2.8, Step 4.2 |
| E | `tsc -b` (app + node + test + shared, but adds 79 client test errors) vs `tsc --noEmit -p tsconfig.app.json` (app only, 234 files, much smaller change)? Plan assumes `-b`. | Steps 1.4, 1.9 — sets the size of Phase 1 |

---

## Phase 1 — Restore the typecheck (lane: `state_api`, one PR)

Config first, then errors by cluster, then flip the command last.

- [ ] **1.0** Record the baseline before touching anything: current `bun run test` and `bun run build` result for client and admin, and a re-measured error count per project (see the freshness caveat in `spec.md` — a wagmi v2→v3 upgrade landed mid-review). Without this, "still green" in AC-6 is unprovable.
- [ ] **1.1** `packages/client/tsconfig.node.json`: drop the non-existent `"api"` include, fix `../../indexer/schema.graphql` → `../indexer/schema.graphql`, add `vite/**/*` so `social-preview.ts` is checked.
- [ ] **1.2** `packages/client/tsconfig.test.json`: narrow `include` to test + story globs only (currently claims all of `src`, overlapping `tsconfig.app.json`), add the `@green-goods/shared*` path aliases, remove `baseUrl` **first** — TS 7.0.2 rejects it with `TS5102` before type-checking starts, so the test project cannot be measured until it is gone. Add Storybook types per decision 2. Expect ~79 previously-unchecked errors in `src/__tests__/**` to appear at this point.
- [ ] **1.3** `packages/client/tsconfig.app.json`: exclude `**/*.stories.tsx`, raise `target`/`lib` to ES2022, resolve open decision B.
- [ ] **1.4** `packages/shared/tsconfig.json`: add `composite: true` (required for `tsc -b` to reference it). Add `packages/admin/tsconfig.test.json` mirroring 1.2, **and add it to `packages/admin/tsconfig.json` references** (that file currently lists only app + node, so a new project is invisible to `tsc -b` without the entry). Admin's test error surface is unmeasured — expect it to appear here.
- [x] **1.5** Fix the `GardenAssessment` cluster — 46 of client's 80 errors, in `views/Home/Garden/Assessment.tsx` (27) and `components/Features/Garden/Assessments.tsx` (19). Resolve open decision A first, then enumerate the shared type's consumers across admin and indexer before editing.
- [ ] **1.6** Fix the `Address` cluster — ~30 sites using `string` where `` `0x${string}` `` is required. This is the root `AGENTS.md` `Address` invariant.
- [ ] **1.7** Fix the remaining client errors (~4 files, single-digit counts each).
- [ ] **1.8** Fix admin's 52 real errors.
- [ ] **1.8b** Fix the test-project errors surfaced by 1.2 and 1.4 — ~79 in client `src/__tests__/**`, admin count unknown. These have never been type-checked. Gated on decision E: this step disappears entirely if `-p tsconfig.app.json` is chosen.
- [ ] **1.9** Flip both build scripts: `tsc --noEmit` → `tsc -b` in `packages/client/package.json` and `packages/admin/package.json`.
- [ ] **1.10** Re-run the probe: append a deliberate type error to a client source file, confirm `bun run build` **fails**, remove it. This is the acceptance proof for the whole phase.

## Phase 2 — Client layout (lane: `ui`, after Phase 1)

Lands after Phase 1 so the restored typecheck catches every broken import.

- [ ] **2.1** Move `src/modules/webmcp/public-tools.ts` → `src/webmcp.ts`; move its test → `src/__tests__/webmcp.test.ts`; update `main.tsx:14`; delete `src/modules/`.
- [ ] **2.2** Resolve the `config.ts` / `config/` ambiguity: move `src/config.ts` → `src/config/ipfs.ts`, add `src/config/index.ts` that re-exports and runs the side effect, update `main.tsx:17`.
- [ ] **2.2b** Finish the original "all configs in the config folder" ask: `src/router.config.tsx` is a 9 KB file literally named `.config` sitting at `src/` root, with `src/router.tsx` (384 bytes) as a thin wrapper that only does `import { appRoutes } from "./router.config"`. Either move it to `src/config/routes.tsx`, or fold the 384-byte wrapper into it and keep one file. Consumers to update: `router.tsx`, `views/PublicBrowserSurfaces.stories.tsx`, and a doc reference in `components/Errors/RouteErrorBoundary.tsx`.
- [ ] **2.3** Rename 8 kebab-case modules to camelCase: `config/pwa-routing` → `pwaRouting`, `config/pwa-manifest` → `pwaManifest`, `routes/presentation-mode` → `presentationMode`, `routes/receipt-token` → `receiptToken`, `routes/toast-variant` → `toastVariant`, `views/Home/arrival-toast` → `arrivalToast`, `views/Home/WorkDashboard/work-dashboard-utils` → `workDashboardUtils`, `views/Public/garden-query-resolution` → `gardenQueryResolution`. Use `git mv` so history follows.
- [ ] **2.4** Dedupe the identical scroll constant: `views/Home/CommitmentsDrawer/classnames.ts` and `views/Home/WalletDrawer/classnames.ts` both export `"min-h-0 flex-1 overflow-y-auto"`. Collapse to one constant — **client-local** (e.g. `src/styles/`), *not* `@green-goods/shared`. Tailwind v4 does not scan `packages/shared/src/` from the client build, so a class string moved there may not generate (see the gotcha in root `AGENTS.md`). Low risk in this specific case — `min-h-0`, `flex-1`, and `overflow-y-auto` each appear in 12 / 50 / 26 other client files — but the rule holds regardless.
- [ ] **2.5** Placement fixes (documented per maintainer request):
  - `styles/pwaDrawerStyles.ts` + `styles/pwaStatusStyles.ts` — TS modules in an otherwise-CSS folder.
  - `views/Garden/mediaAnalytics.ts` — analytics in a view folder; all other analytics lives in `shared/src/modules/app/analytics-events.ts`.
  - `components/Public/vaultCheckoutShell.tsx` — camelCase `.tsx` among PascalCase siblings, exporting both constants and components.
  - `components/WalletConnectButton.tsx` — the only loose component at `components/` root.
  - `components/Public/` — 33 flat files while every other category is grouped; the six `Vault*` files are the obvious first subfolder.
  - `components/Cards/Base/Card.tsx` — three directory levels for one file.
- [ ] **2.6** Remove dead exports: `WorkCard`, `WorkCardProps`, `WorkCardItem` from `components/Cards/Work/WorkCard.tsx` (keep `MinimalWorkCard`, which is live), plus the `Cards` barrel entries and the dead half of `__tests__/components/WorkCard.test.tsx`. Remove `AvatarRootProps` and `AvatarVariantProps`.
- [ ] **2.7** Rename client's `buttonVariants` in `components/Actions/Button/Base.tsx` to end the name collision with shared's exported `buttonVariants`.
- [ ] **2.8** Staged-code marker: apply the decision-D syntax to `VaultCardEndowFlow.tsx`, `VaultCardPaymentPanel.tsx`, `VaultCardWalletManage.tsx`; add a Storybook story per component so decay is visible; keep all three inside the typecheck.
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

## Phase 4 — Enforcement (lane: `docs`, after Phase 2)

Extends `scripts/quality/check-source-structure.js`, already wired into every package CI workflow.

- [ ] **4.1** Placement: allowed top-level directories per package; no loose source files at `src/` root outside a declared set (`App.tsx`, `main.tsx`, `router.tsx`, `index.css`, `vite-env.d.ts`).
- [ ] **4.2** Naming: PascalCase for files whose primary export is a component, camelCase otherwise, no hyphens. Honor the decision-D staged marker so staged files are not flagged.
- [ ] **4.3** Layering: no `useX` hook definitions outside `packages/shared`; no imports of `@green-goods/shared/src/**` or any undeclared internal subpath.
- [ ] **4.4** Dead-export scan that skips barrels, stories, tests, and anything carrying the staged marker.
- [ ] **4.5** Run the extended gate across the whole tree before wiring it to fail; use the existing frozen-allowlist pattern for anything out of scope here. Note: `VaultCardWalletManage.tsx` currently holds a 726-line allowlist entry.
- [ ] **4.6** Add the layout rules to `AGENTS.md` § Key Patterns so the gate and the guide agree.

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| `tsc -b` replaces `tsc --noEmit`, projects correctly scoped | `state_api` | 1.1–1.4, 1.9 | ⏳ |
| All 132 real type errors fixed, not suppressed | `state_api` | 1.5–1.8 | ⏳ |
| No `modules/` dir, no kebab-case filenames in client | `ui` | 2.1, 2.3 | ⏳ |
| Staged components carry a marker and a story | `ui` | 2.8 | ⏳ |
| Dead exports removed; `buttonVariants` collision resolved | `ui` | 2.6, 2.7 | ⏳ |
| `AGENTS.md` agent-neutral, deduped, complete | `docs` | 3.1–3.7 | ✅ Phase 3 |
| Structure gate enforces placement, naming, layering | `docs` | 4.1–4.6 | ⏳ |

## TDD / Proof Order

- [ ] Phase 1's behavior boundary is the build gate itself. RED = the probe passing today (already captured in `spec.md`); GREEN = step 1.10, the same probe failing the build.
- [ ] Phase 2 is a refactor with no behavior change — proof is the restored typecheck plus the existing client suite staying green. Record lane TDD mode as `not_applicable` with that note.
- [x] Phase 3 prose is documentation; the new duplicate-policy guard used RED/GREEN fixture proof recorded in the docs handoff.
- [ ] Phase 4 adds a gate; RED = the new rule failing on a deliberately misnamed/misplaced fixture, GREEN = the tree passing.
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`

## Lane Checklists

### State / API (Phase 1)

- [ ] Resolve open decisions A and B before editing types (A resolved; B remains open)
- [x] Enumerate `GardenAssessment` consumers across admin and indexer before changing the shared type
- [ ] Keep hooks in shared
- [ ] Record RED/GREEN proof (the probe) before marking the lane complete
- [ ] Write `handoffs/codex-state-api.md`

### UI (Phase 2)

- [ ] Use `git mv` for every rename so history follows
- [ ] No user-facing strings change — confirm `lint:vocab` is untouched
- [ ] Confirm Tailwind class-scanning is unaffected by any file move (see the shared-scan gotcha in root `AGENTS.md`)
- [ ] Record `not_applicable` TDD mode with a concrete note
- [ ] Write `handoffs/claude-ui.md`

### Docs (Phases 3–4)

- [x] `AGENTS.md` and `scripts/quality/**` are security-sensitive surfaces — call them out in the PR summary
- [ ] Run the extended gate tree-wide before wiring it to fail
- [x] Write `handoffs/claude-docs.md` for the completed Phase 3 slice; keep the lane open for Phase 4

### QA Pass 1

- [ ] Verify acceptance criteria from `eval.md`
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2

- [ ] Review regressions and implementation edges
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
- [ ] `bun run check:source-structure`
- [ ] `node scripts/quality/check-codex-docs.js`
