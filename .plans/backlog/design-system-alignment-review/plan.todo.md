# Design System Alignment Review Plan

**Feature Slug**: `design-system-alignment-review`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-25`
**Last Updated**: `2026-08-29`
**Linear Issue**: PRD-644
**Linear Source**: source:plans

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Delete the old implementation plan; keep this as a review plan | The old sweep had completed code/token enforcement and manual QA moved elsewhere. |
| 2 | Start read-only | Design-system fixes can touch shared tokens, stories, docs, and agent guidance; the review should prove drift before editing. |
| 3 | Use the Claude-owned protocol | `AGENTS.md` names `.claude/skills/design/system-alignment-review.md` as the single source for this review shape. |
| 4 | Treat validators as proof boundaries | Passing validators narrow what can honestly be called drift. |
| 5 | Round 1 ran admin-first (2026-08-29) | Afo asked for an admin-console audit; the protocol + validator set were applied to `packages/admin` only. Client PWA/browser, docs, and agent-guidance surfaces stay open as later rounds. |
| 6 | Fix pass accepted; tracked in this hub with a parent-only Linear mirror (PRD-644) | Afo chose one tracking issue over many and one canonical plan over a second implementation surface. This answers the spec's human judgment point: confirmed drift is batched here, not fixed inline during review rounds. |

## Research / Plan Gate

- [x] Read `.claude/skills/design/system-alignment-review.md`. *(Round 1, 2026-08-29)*
- [x] Record exact source-of-truth order in the review notes. *(In the round-1 report)*
- [ ] Run or explicitly block each validator in `spec.md`. *(Round 1 ran 4/5 — `lint:vocab` not run; vocabulary was out of the admin round's scope. Run it in the next round.)*
- [x] Record file:line evidence for every confirmed drift. *(reports/2026-08-29-admin-cockpit-audit.md)*
- [x] Keep fix recommendations separate from implementation. *(Audit was read-only; accepted actions listed below.)*

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Run the design alignment protocol read-only | `ui` | Step 1 | 🔄 admin done 2026-08-29; client/docs/guidance rounds open |
| Verify generated/token/vocab/story validators before claiming drift | `ui` | Step 2 | 🔄 4/5 green 2026-08-29 (`lint:vocab` pending) |
| Produce bounded findings with evidence and rejected false positives | `ui` | Step 3 | 🔄 admin round delivered (7 confirmed clusters, 6 watchlist, 5 rejected) |
| Avoid state/API and contract work | `state_api` / `contracts` | n/a | ✅ |

## Lane Checklists

### UI (`claude/ui/design-system-alignment-review`)

- [x] Read the required protocol. *(Round 1)*
- [x] Run the validator set from `spec.md`. *(Round 1: 4/5 — `lint:vocab` outstanding)*
- [ ] Review DesignMD sources, runtime tokens, Storybook, admin, client, docs, and agent guidance. *(Admin done — reports/2026-08-29-admin-cockpit-audit.md; remaining surfaces open)*
- [x] Write findings in the protocol format. *(Round 1: confirmed drift / watchlist / rejected / state of health)*
- [ ] Write `handoffs/claude-ui.md`. *(Round-1 findings live in the dated report; write the handoff when the lane closes)*

### Round 2 — Accepted Follow-Through (added 2026-08-29, source: admin audit)

The fix pass Afo accepted from the round-1 audit. Order matters: the guard work (2) locks the line while the migrations (1, 3) land.

- [x] Retire the parallel shadow ladder (`packages/admin/src/index.css:404-449`); migrate its 11 consumers to `--m3-elevation-*` / `AdminCard`.
  **Receipt**: commit `99ef12b11`, 2026-08-29T21:0xZ. Ladder block deleted; 11 consumer lines migrated (resting cards → `shadow-[var(--m3-elevation-1)]`, GardenMetadata hover step → elevation-2, DistributionChart tooltip → elevation-2, sticky PageHeader off `shadow-regular-sm` → elevation-1); `.shadow-*` CSS-definition reappearance guard added and RED-proven; 11 stale baseline entries burned (guard demanded exactly those, no more). Dist proof: `admin-*.css` carries zero `.shadow-<name>` classes and all three elevation arbitraries; `--admin-chrome-shadow` intact; no test assertions referenced the old classes. AdminCard *folding* of the card clones deliberately deferred to the inventory item below — this step swapped tokens surgically to stay independently verifiable.
- [x] Add the four blind-spot guards to `scripts/design/check-tokens.sh` (bare `shadow-*`; hover/active/group-hover scale+translate; semantic-alias focus rings; `text-*-base`) over the existing TSV baseline + expiry mechanism.
  **Receipt**: commit `14eef2880`, 2026-08-29T20:55Z. Admin-scoped `collect_admin_invariant_hits` merged into the audited-baseline diff; 85 existing hit lines baselined (expiry 2026-12-31; fixing a line forces its entry's deletion via the stale check). RED: synthetic violation file failed `bun run check:design-tokens` with the cockpit-invariant message. GREEN: clean tree passes with the new "admin cockpit invariant sweep passed" line. Client scope untouched by design (lift/press physics are client canon).
- [x] Keyboard-focus pass: visible indicator on `AdminCheckbox`; focus-within ring on `AdminSearchToolbar`; migrate the 12 raw-alias rings to `--tone-focus-ring`; converge `AdminInlineField`/`AdminTextField` on the canonical ring role; CommandPalette combobox wiring + result focus.
  **Receipt**: commit `f66a13113`, 2026-08-29T21:58Z (TDD proof recorded via `record-tdd`). New `AdminFocusRing.guard.test.tsx` 4/4 RED → 4/4 GREEN; components suite 463/463; typecheck clean. AdminCheckbox gets the canonical focus-visible ring (was keyboard-invisible); AdminSearchToolbar pill rings via `has-[input:focus-visible]` (dist-verified compiling to `:has(:is(input:focus-visible))`); all 13 alias-ring lines migrated and their baseline entries burned (admin debt 61 → 48); AdminInlineField/AdminTextField off `--tone-on-surface-accent` (label/caret keep it — that's the accent-text role); generic input `--focus-ring` re-pointed from shared blue onto `--tone-focus-ring` at both `.admin-m3` and `[data-tone]` scopes (portal-safe; minifier merges the twin blocks); Assessment native controls swap `text-primary-base` → `accent-primary-base`; CookieJar inputs drop border-as-focus for the global rule; DistributionConfig's override deleted so AdminButton's base ring applies; CommandPalette gains combobox semantics (`role="combobox"` + `aria-activedescendant`/ids/tabIndex −1 — one scoped `.oxlintrc.json` override documents oxlint's self-contradictory implicit-role mapping). Out of scope, left open: CommandPalette `tone` prop (tone-budget item), FabButton's onFocus-driven speed-dial focus (has a visible state), non-cockpit surfaces outside `.admin-m3`/`[data-tone]` keep shared blue.
- [x] Re-true the component canon in one doc PR: `packages/admin/DESIGN.md` § Admin Component Pattern (count, wrapper claim, WorkbenchCard provenance, AdminFab integration line), `docs/docs/builders/packages/admin.mdx` list, `AdminDialog`/`AdminFab` JSDoc.
  **Receipt**: commits `34ba94ddb` (docs) + `830a7239f` (JSDoc), 2026-08-29T22:2xZ — kept separate per AGENTS.md standards/code separation. Wrapper list now 22 (adds AdminConfirmDialog + AdminReasonDialog); the all-Admin*-wrappers claim replaced with the real family map (Shell forks / Canvas* / Account* / ActionFlow* / named singletons); WorkbenchCard labeled shared; navigation names `Shell/FabButton` as the shipped dock FAB; AdminDialog tone JSDoc says `home` not green; AdminFab JSDoc drops the banned 28dp + elevation-3/4 claims. `check:design-generated` + `check:design-tokens` green.
- [x] **Living design-system reference page** (added 2026-08-29 on Afo's request, v2 same day): [Cockpit Design System](https://claude.ai/code/artifact/7d1f5e6f-fccb-4eb7-b829-546f52475871) — tokens + a theme-aware static component gallery with key states, deep-linking every block to its Storybook story (base URL configurable in-page; defaults to local :3004). Every value extracted from shipped CSS at `830a7239f`. A projection only; repo stays canon; regenerate on request at the same URL.

### Open decisions — both resolved 2026-08-29

- [x] **Dark filled-action fills → LOCKED tonal (DL-009)**. Afo locked the M3-dark convention: −200 fills carrying −900 ink, hover one step lighter (−100). Implemented `790f8c762` (five dark tone blocks re-pointed; measured AA fill 4.58–11.74, hover 4.70–13.93, community tightest) and codified `b82fd591c` (language.md § Dark Mode Palette rewritten, DL-009 appended, token_version 2.6.0 → 2.7.0). `check:design-tokens` + `check:guidance-links` green. Hover direction deliberately flips lighter in dark (higher = lighter).
- [x] **Storybook hosting → already deployed at design.greengoods.app**. The earlier "not hosted" claim was wrong (workflow grep missed it); verified behaviorally — `?path=/story/admin-primitives-adminbutton--filled` resolves on the live deployment. The reference page's links now default to it.
- [x] Settle dead/duplicated inventory: decide `AdminBadge`/`AdminFab`/`AdminListItem`; delete dead `WorkCard`/`WorkSubmissionsView`; fold hand-rolled card clones into `AdminCard` and status pills into `StatusBadge` as files are touched; add a multiline `AdminTextField` variant.
  **Receipt**: commits `3496c5cc2` (code) + `fbf5f9927` (canon docs), 2026-08-29T23:0xZ. Afo decided DELETE for the trio — AdminBadge/AdminFab/AdminListItem removed with stories (zero consumers re-verified by grep before rm; dock FAB is `Shell/FabButton`); dead `WorkCard`/`WorkSubmissionsView` pair deleted with stories, its test, and barrel exports (one dead text-base baseline entry burned — admin debt 47). `AdminTextArea` added in AdminTextField.tsx (shared base refactor, precise per-control typing, RHF-compatible ref) with RED→GREEN tests, and AdminReasonDialog migrated off its hand-rolled label+textarea (Rule 15). Palette is now 20 wrappers; DESIGN.md + admin.mdx updated. Proof: components 464/464, views 139/139, workflows 6/6, typecheck, admin build, story contract 255/255, all token guards green. Card-clone → AdminCard and pill → StatusBadge folding stays the as-files-are-touched policy (recorded, not exhausted).

**Round 2 complete (2026-08-29):** all five accepted audit actions landed — guards, shadow ladder, focus pass, canon re-true, inventory — plus DL-009 and the living reference page. Remaining admin-side nit: CommandPalette `tone` prop (tone-budget note).

### Round 3 — Remaining Review Surfaces

- [x] Client PWA + public browser surfaces against the protocol (include `lint:vocab`).
- [x] Docs UI + Storybook + agent-guidance surfaces.
  **Receipt (both)**: 2026-08-29T23:5xZ — full validator set green first (`lint:vocab` run for the first time this cycle: clean), then two parallel evidence sweeps pinned to HEAD (foreign in-flight PwaRuntime/service-worker files excluded). Findings: **7 confirmed drift clusters, 5 risks, 4 missing-proof** in [reports/2026-08-29-round-3-client-docs-storybook.md](reports/2026-08-29-round-3-client-docs-storybook.md) — read-only, awaiting Afo's triage. Headline: client *behavior* held everywhere (chrome separation, receipt-token safety, editorial grammar exact); the drift is the descriptive layer (undocumented `/vaults`, 8th homepage section, stale overlay roster) + guidance rosters missed by the Round-2 sweep + dead Storybook viewport API (27 stories) + four small code regressions (footer nav gap, Manage Endowments capsule, docs Prism surfaces, FAB spec-vs-code).
- [x] Sibling living reference pages for the client PWA and the editorial browser site (Afo, 2026-08-29).
  **Receipt**: published 2026-08-29 — [Field Tool Design System](https://claude.ai/code/artifact/13bcde21-f35d-48e8-873f-e9a38c2c59bb) (installed PWA: chrome rules incl. the shipped third AppBar hide-route, bright-green rhythm, full Warm Earth shape/material/motion, Inter-only type) and [Living Record Design System](https://claude.ai/code/artifact/05a6d12b-1479-40c7-8aa4-09f634f5602c) (public browser: SiteHeader contract, shipped 8-section homepage with the undocumented § 05 flagged, Fraunces/Inter rules, editorial linen/walnut + domain palette, the real overlay roster, honesty + receipt-token rules). Both document SHIPPED truth, flag the open Round-3 findings inline, and deep-link into design.greengoods.app. Stable URLs; projections only — repo stays canon.

### Round 3 findings — triaged: Afo locked "fix everything" (2026-08-29)

Seven confirmed clusters in [reports/2026-08-29-round-3-client-docs-storybook.md](reports/2026-08-29-round-3-client-docs-storybook.md): (1) guidance rosters still describe the pre-deletion admin library (Round-2 sweep gap — one guidance commit); (2) browser/PWA briefs lag shipped truth (/vaults, overlay roster, AppBar hide-routes — spec updates); (3) homepage 8-vs-7 sections (document-or-remove + order test); (4) below-the-fold wayfinding gap (footer nav links — decision); (5) dead Storybook viewport API ×27 (codemod); (6) FAB-large 16px spec vs shipped capsule (decision + token_version); (7) two one-liners (Manage Endowments capsule, docs Prism surfaces). Decision calls on the three open ones: (3) document as § 5 + order test, (4) add the footer nav links, (6) strike the spec clause (→ DL-010).

### Round 3 — Fix pass (all seven clusters)

- [x] Clusters 3/4/7 + FabButton tag — shipped-code fixes.
  **Receipt**: 2026-08-30T00:02Z, commits `c4b98f6d4` + `439196599` (the footer half was briefly parked in a concurrent session's temporary stash during its PRD-856 push and recovered intact). RED→GREEN on the footer wayfinding test (1 failed → 4/4); home order test pins the eight sections (characterization — code already correct, no RED possible); `/fund` Manage Endowments is now `EditorialGhostButton variant="warm"`; docs Prism themes project the DesignMD code-surface (`#F5F5F5`/`#292929`) at `docusaurus.config.ts`; `Shell/FabButton` carries `data-component="FabButton"`. i18n locale-coverage 27/27; client 15/15 + admin 13/13 affected tests; `typecheck:source` clean both packages. Footer Contact `mailto:` deliberately deferred — no verifiable general inbox exists in the repo (only `security@greengoods.app`); needs Afo's address.
- [x] Cluster 5 — Storybook viewport codemod.
  **Receipt**: 2026-08-30T00:02Z, commit `be50446ca`. 31 occurrences across 22 story files migrated `parameters.viewport.defaultViewport` → `globals: { viewport: { value } }` (API verified against the installed storybook@10.4.6 dist: `parameters.viewport` now accepts only `{disable, options}`); the three 390×844 geometry stories keep exact size via `parameters.viewport.options` + matching `value`. Proof: `bun run test:stories:ci` **193/193** play tests in headless chromium (playwright chromium installed for this run), `check:stories` PASS, `check:story-quality` 227 files PASS.
- [x] Clusters 1/2/6 + docs teaching — guidance sync, one commit.
  **Receipt**: 2026-08-30T00:02Z, commit `0d656b780` (15 files). Rosters now carry the true 20-wrappers/18-files truth (prompt-contract, design ARCHITECTURE.md, root AGENTS.md); FabButton named in admin DESIGN.md:34/:81, qa-triage codex-prompt, glossary-community; defect-grammar selectors all resolvable; **DL-010 locked/codified** (FAB is a capsule at both sizes; clause struck in 4 files; token_version **2.8.0**); DESIGN.browser.md gains `/vaults` (route table + section), the eight-section homepage canon (§ 5 `PublicWhoTendsAGarden`), and a truthful overlay roster; DESIGN.pwa.md documents all three AppBar hide families + drawer-open; storybook.mdx teaches the new viewport API. Gates: `check:design-md` ✅ · `check:design-generated` ✅ (client-pwa-token-audit regenerated) · `check:design-tokens` ✅ (2.8.0) · `check:guidance-links` 65 ✅ · `check:skill-behavior` 15 ✅ · `lint:vocab` ✅. Post-sweep: zero `AdminFab|AdminBadge|AdminListItem` references left in living guidance.
  Still open from the round-3 report (not in the seven clusters): the 5 inferred risks + 4 missing-proof items (WhoTends story/test parity, `/vaults` shipped-path stories, tokens-gallery lag, componentNamespaces manifest coverage, AppShell 69px reserve).

### State / API (`codex/state-api/design-system-alignment-review`)

- [x] Mark this lane `n/a`.

### Contracts (`codex/contracts/design-system-alignment-review`)

- [x] Mark this lane `n/a`.

### QA Pass 1 (`claude/qa-pass-1/design-system-alignment-review`)

- [ ] Confirm findings are evidence-backed and do not include speculative fixes.
- [ ] Confirm considered-and-rejected items are present.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/design-system-alignment-review`)

- [ ] Re-run any validator that was used as a proof boundary.
- [ ] Check that status/history matches the actual review outcome.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

Round 1 (2026-08-29, develop): `check:design-generated` ✅ · `check:design-tokens` ✅ · `check:stories` ✅ (260/260) · `check:story-quality` ✅ · `lint:vocab` not run. Receipts in `reports/2026-08-29-admin-cockpit-audit.md`.

- [ ] `bun run check:design-generated`
- [ ] `bun run check:design-tokens`
- [ ] `bun run lint:vocab`
- [ ] `cd packages/shared && bun run check:stories`
- [ ] `cd packages/shared && bun run check:story-quality`
- [ ] `node scripts/harness/plan-hub.mjs validate`

*(Checkboxes above are for the next full round; round-1 results are recorded in the line + report and are not carried forward as current proof.)*
