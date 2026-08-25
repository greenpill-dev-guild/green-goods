# Address the experience-audit findings (fix pass 1)

Dispatch prompt for a fresh agent session. **This is a build pass**: it implements the decided
findings from `reports/qa-experience-audit-2026-08-25.md` (both halves + Afo's § 10 Wave 2
intake), proves each fix, and opens PRs. Written 2026-08-25 from `develop@fc27a5b00`.

`CLAUDE.md` and `AGENTS.md` bind you. Concurrent agent sessions share this checkout: working-tree
changes you did not make are another agent's work — never revert, stash, or commit them (at
dispatch time the tree also carried another session's `reports/qa-functional-focused-2026-08-25*`
files; leave them alone). Never restart a PM2 stack another session owns; reuse what is up.
Stage **named paths only** — never `git add -A` (symlinked node_modules and other sessions'
files bypass dir-only gitignore rules). Re-check `git branch --show-current` before every
commit — branches move under concurrent sessions.

**Model note:** Group C is judgment-heavy visual/editorial work — run this pass on Fable/Claude.
Do not dispatch Group C to Codex (repo-recorded: strong plan-follower, weak visual designer).

**Dispatch parameters (Afo fills; defaults apply):**

- Base: current `origin/develop` head (record the SHA).
- Autonomy: **scope-locked** (default) — complete Phase 0, present the verified scope table, and
  wait for Afo's go before building. If the dispatch says "pre-approved", build Groups A–C
  without pausing; Group D is never built without an explicit go.
- PRs: **two independent branches off develop** (never stacked — the CI Gate workflow filters
  on the base branch, so a stacked PR's gate never fires): `fix/pooling-experience-pass-1`
  (Groups A+B) and
  `feat/editorial-record-and-cycle` (Group C). Open both against `develop`. Afo merges
  (`--merge`, never squash). If the audit report + evidence
  (`reports/qa-experience-audit-2026-08-25.md`, `reports/evidence/qa-experience-audit/**`,
  the handoff block) are still uncommitted when you branch, commit them first on the fixes
  branch as their own `docs(commitment-pooling)` commit — named paths.

## Authoritative inputs (read in this order)

1. `reports/qa-experience-audit-2026-08-25.md` — the findings, § 10 addendum (AD-1…AD-11 with
   Afo's decisions and the **drafted 4-step cycle copy**), the 31-row backlog, § 8 functional
   observations, § 9 lead dispositions. This prompt's scope tables cite its numbering.
2. `reports/evidence/qa-experience-audit/` — before-captures + `mechanical-measurements.json`
   (the numbers your fixes must move: palette 362→158 px drift, 32 px targets, es/pt clips).
3. `.claude/skills/design/` — load the `design` skill; for admin work `interaction-patterns.md`
   + `admin-ux-brief.md` are mandatory; `review-checklist.md` Lenses 1–5 gate every change.
4. Surface dialects: `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`,
   `packages/admin/DESIGN.md`, root `DESIGN.md`.
5. `acceptance-matrix.md` §1 (state/copy) + §3 (public claims) — every copy change must
   re-clear them; `handoffs/commitment-view-state-reference.md` for anything touching the
   commitment detail (phase decides affordances, seat decides person, no act → no bar).
6. `uiux-spec.md` — append-only dated addenda; Group C records its supersessions there.

**Re-verify before fixing.** develop moves under concurrent sessions (the audit itself found
several of its seeded leads already fixed at head by `1e34e39e2`). For every item below, confirm
it still reproduces at your base SHA before writing code; a finding fixed under you is recorded
`already-fixed`, never re-implemented.

## Scope

### Group A — small fixes (client / admin / shared), pre-approved

| Backlog | Item | Anchor |
|---|---|---|
| 3 | Wrap the row-level **"Expire now"** in `AdminConfirmDialog` naming the blast radius (supersedes pending claims, releases the reservation, terminal). The contract stores **no expiry reason** — do not invent a reason field. | `PoolCommitmentsCard.tsx:290` |
| 11 | Replace `SeedStepProof`'s native checkbox with `AdminCheckbox` (also removes the fifth tone use). | `SeedStepProof.tsx:78-88` |
| 18 | Associate `AllocationEditor`'s group-level invalid-sum error (`role="alert"` + `aria-describedby` on the group). | `AllocationEditor` stories InvalidSum |
| 17 | Hub queue affirmative "Confirm" → **"Confirm kept"** (en/es/pt). | `HubConfirmQueue` |
| 9 | Garden tab rail announces selection to AT. Prefer the light compliant path (`aria-current` on the active tab + an accessible group name) over a half-adopted `role="tab"` pattern; if you adopt tabs semantics, adopt the full keyboard pattern. | `StandardTabs.tsx:86` |
| 7 | es/pt at 320: composer **Next** must never clip glyphs (wrap/shrink/pad); the cycle select value must not truncate mid-phrase (layout first; shorter *translations* are a tone call — flag, don't decide); garden tab labels may 2-line or shrink. No new horizontal overflow. | measurements JSON + `client-composer-offer-step1-user-es-light-320.png` |
| 20 | Proof-composer back control 32→40 px, matching the detail shell. | `ProofComposer.tsx` |
| 2 | **Name the asker** on pre-acceptance requests (band or People card: "«Name» is asking" via `AddressDisplay`; labels tell the direction's story — "Asked by / Confirms it"). Verify what the read model exposes pre-acceptance; if the creator truly isn't readable client-side, record that as the blocker instead of faking it. | `CommitmentPeople.tsx`, `statusBand.ts` |
| 5 | **Liveness scope on the pool list**: default to live rows; settled/terminal fold behind the existing chip grammar (mirror the drawer's Live / Over-time split and admin's scope chips). | `GardenPool.tsx` |
| 8 | **Evidence strip on the commitment detail, every seat** — reuse the ConfirmSheet's evidence list (`EvidencePreview`); closes both "provider's proof vanishes" and "judge before you look" (pair with a bar/act label check). | `GardenCommitment.tsx`, `ConfirmSheet.tsx` |
| 13 | Done screen names the thing made + who acts next ("'«title»' is on its way. Neighbours can take it up once it lands."), en/es/pt. | `ComposeCommitment.tsx` done state |
| 10 | Drawer's pending-creation banner drops the warning register — same calm wording/tone family as the pool's dashed row. | `CommitmentsDrawer`, `app.commitments.pendingCreate` |
| 14 | Row stutter: drop the direction meta when the chip says the same word; phase-aware progress copy (no "moves this forward" on terminal states); chip icons meaningful per family or removed. | `CommitmentRow.tsx`, `presentation.ts`, `app.commitment.progress.*` |
| 19 | CycleRail collapses same-day ranges ("Apr 12, 2026", not "Apr 12 – Apr 12, 202…"). | `CycleRail.tsx` |
| 21 | Add the required authenticated-browser QA phrases to `packages/{admin,client,shared}/AGENTS.md` so `check:browser-verification-policy` — and with it `agentic:check` — goes green. Copy the exact phrases the checker demands. | `scripts/check-browser-verification-policy.mjs` |
| F1 | Fix the `CommitmentDialogPanel` Detail story crash (`useNavigate` outside `<Router>`, `CommitmentDialogStates.tsx:148`) — router decorator; check the NotFound variant too. | story file |
| F5 | Resolve the ConfirmSheet proof-count contradiction (detail team-credit counts vs sheet `evidenceAttributions`) — find which number is true and make both surfaces agree. | Wave 1 defect, still live |
| F10 | Composer review "1 hours" → `formatCommitmentUnits` (rows were fixed in `1e34e39e2`; the review line was not). | `ComposeReview.tsx` |

### Group B — decided IA changes (admin), pre-approved with care notes

| Backlog | Item | Care notes |
|---|---|---|
| 24 | Hub stages: **remove History**, reorder to **Confirm · Work · Assess · Certify** (`PIPELINE_STAGE_CONFIG`, `hub.utils.ts:123-155`). | History is wired beyond the config — `admin-routes.ts`, `useHubWorkbenchController`, `sheetRegistry`, `workspaceNavigation`, `toHistoryContentId`, route stories, the fixed-action comment ("Submit work … across Work, Assess, Certify, and History"). Map every usage first; decide where history *content* (history-detail deep links) lands — a redirect beats a 404. Present that mapping at scope-lock. |
| 25 | Retire **Community ▸ Pools**; pooling elements move into **Coordination** (`Community/index.tsx:101-133`). | Keep W12's two invariants verbatim: exactly protocol pool + current garden, never another garden's pool; and the privacy banner sentence. `CommunityTab` type, `admin-routes.ts:16`, stories, tests move together. Note Coordination's existing count already reads `community.pools.length` — reconcile deliberately. |
| 26 | Command palette: **top-anchored, fixed-height panel**; results scroll inside; the input must not move while typing. | Prove with numbers: re-run the before-measurement (input Y at "", "com", "commitment") and show Y constant. Before: 362→158 px height, y 219→321. |
| 23 | Shrink the admin route-header title role — component (`PageHeader.tsx:108-115`) **and** `packages/admin/DESIGN.md` typography table in the same commit (audit: currently spec-conformant `title-lg` 22/28, so the spec moves too). Suggest `title-md` 16/24 weight 600; confirm visual balance with eyebrow + description at 1280 and 465. | Rule 18 invariants untouched. |
| 27 | Rewrite the availability cast copy: the gate is the app's ledger, not the chain — "Commitment pooling isn't switched on in this app yet" framing (en/es/pt), sweep the whole `cockpit.garden.pool.unavailable.*` family + the `CommitmentDialogStates` unavailable cast. The ledger flip itself is a release decision — **do not flip it**. | §1 row "Pool NotReady"; keep planned/readiness discipline. |
| 4 (admin half) | Admin pooling rows adopt `AddressDisplay` (ENS) + a worded relationship ("«who» for «whom»", not "→") in `PoolCommitmentsCard` rows and the inspector's facts. | The Green Goods-name resolution layer itself is Group D. |
| 6 | 44 px hit targets for `AdminButton size="sm"` + `AdminFilterChip` via the M3 pattern — expanded touch target (pseudo-element hit area) with the 32 px **visual** kept. | Primitive-level, many consumers: verify no layout shift in the stories sweep; re-measure targets after. |
| 22 (rename half) | Drawer tab "Over time" → a label that reads as history ("History" / "Record" — pick one, keep en/es/pt parity, flag the choice in the PR body). | The per-commitment timeline is Group D. |

### Group C — editorial redesign (own branch)

All four are Afo-decided directions; design them with the `design` skill loaded and
`DESIGN.browser.md` as the dialect. Record supersessions as dated addenda in `uiux-spec.md`.

- **28 · § 02 leaves the panel.** On `/gardens/:id` and the `/impact` band the record composes
  **directly on the canvas** in the page's own grammar (headers on linen, hairline dividers,
  § 01-style stat rows) — supersedes the #748 `EditorialPanel` choice. Every §1/§3 copy rule and
  honest state survives: em-dash-not-zero, kept-rate threshold + definitional sentence, absence
  copy, no providers/addresses/rankings. All 13 `CommitmentsSection` states + 6 band states
  redrawn in their stories, light + dark (dark: no panel means the panel-darker-than-canvas
  deviation retires — note that in the addendum).
- **29 · The cycle becomes four steps** using the **drafted copy in report § 10 AD-9 verbatim as
  the starting text**: Needs · Commitment · Work · Learnings, heading "From need to learning,
  season after season.", loop-line as a full-width footer. Four equal columns level at every
  width; descriptions in one length band (~25–30 words); number chips baseline-aligned; fix the
  title-underline collision. New i18n keys en/es/pt (translate fresh; do not add new "el pool"
  instances — that noun is an open Wave 2 call). "Learnings" + the loop-line are Afo's naming to
  confirm at PR review — say so in the PR body. "Impact Certificate" survives inside step 4's
  body and the deep page, not as a stage name.
- **30 · Remove the image hover-zoom** (`group-hover:scale-[1.03]`) at all four sites:
  `PublicGardenCard.tsx:71`, `PublicActionCard.tsx:47`, `PublicEvidenceCard.tsx:132`,
  `PublicGardenRow.tsx:103` — and clean the now-dead transition classes (GardenRow's tokenless
  transition included).
- **31 · Empty/error sections hold their space.** Minimum body height / breathing room for the
  empty and error casts of the garden-page sections (§ 01–§ 04) and `/impact` — absence reads
  as a kept place in the record, not a footnote.

### Group D — propose only, never build in this pass

Write each as a short proposal in the fixes report (what, where, cost) for Afo's go/no-go:

- **1 · The arrival surface** (pooling notifications: taken up / confirmed kept / not-yet
  resolved + first-view treatment of a freshly kept commitment) — the audit's top change.
- **22 (timeline half)** · Per-commitment timeline on the client detail (admin has one; client
  has band + provenance only; `getCommitmentActivity` is unwrapped under fixtures).
- **4 (names half)** · Green Goods-name resolution inside `AddressDisplay` (coverage question).
- **12 · Garden-hero collapse on scroll** (feel call), **15 · count-card grammar**, **16 ·
  casing side** — all awaiting Wave 2 answers; skip unless the dispatch answers them.

## Method

Work item-by-item: **re-verify → fix → prove → record**. Group related items into conventional
commits (one concern per commit; `fix(admin): …`, `feat(client): …`, `refactor(editorial): …`).
For every copy change: en + es + pt in the same commit (the locale gate is 4-part); run
`bun run lint:vocab` after. For every touched component: update its stories (states you changed
must be drawn), keep `check:stories` / `check:story-quality` green.

**Proof per item** goes into `reports/evidence/qa-experience-fixes/` (same naming convention) —
an after-capture or after-measurement matching the audit's before. Minimum re-measurements:
palette input-Y stability; touch-target scan on the same stories (expect ≥44 effective); es/pt
composer + tab labels at 320 (no glyph clipping); pipeline at 1280 (four level columns); hub tab
order; expire-confirm dialog capture. Fixture-world verification uses
`https://localhost:3001/...?mockAuth=user&presentation=pwa&mockPooling=1`; Storybook `:3004`;
never flip the availability ledger, never sign anything.

**Gates before each push** (the Ship Gate absorbs these; run per branch):
targeted package tests for what you touched, then `bun run test:fast`, `bun run lint`,
`bun run format:check`, `typecheck:source` variants, `bun run check:design-tokens`,
`bun run lint:vocab`, `bun run --filter @green-goods/shared check:stories check:story-quality`,
`bun run agentic:check` (expected **green** once backlog 21 lands), package builds. Fix what you
break; a red gate never ships.

## Report

Write `reports/qa-experience-fixes-<YYYY-MM-DD>.md`:

1. **Dispatch record** — date, base SHA, branches, autonomy mode.
2. **Outcome table** — one row per scoped item: backlog #, `fixed` / `already-fixed` /
   `blocked (why)` / `deferred (why)`, commit SHA, proof path.
3. **Group D proposals** — the four write-ups for Afo.
4. **Flagged calls** — anything you had to choose that Afo may want to reverse (drawer tab
   label, translation wording, history-content landing).
5. **Gate results** per branch.

Append a dated summary block under `## Experience audit runs` in
`handoffs/claude-qa-pass-1.md` (append-only): counts fixed/deferred, PR links, gates. Do not
edit `qa-experience-audit-2026-08-25.md` itself — outcomes live in the fixes report.

## Boundaries

- No availability-ledger flip, no on-chain writes, no signatures, no Linear writes, no
  `status.json` edits, no dependency or `.env` changes, no `.github` changes.
- Never touch another session's working-tree files; stage named paths only.
- PRs target `develop`; never open a PR whose **head** is `main` (a back-merge PR with head
  `main` deletes `main` on merge — standing repo hazard). Afo merges. If a push reports
  `* [new branch]` on an existing PR branch, stop and re-check the PR state before pushing
  again.
- Group C never lands mixed into the fixes branch; if either PR balloons, split further rather
  than growing it.
- Undecided Wave 2 items (Group D + shortlist) are proposals only — building one uninvited is
  out of scope even if small.

## Stop conditions

- **Complete**: every Group A–C item carries an outcome + proof, both PRs are open with green
  gates, the fixes report + handoff block are written, Group D proposals delivered.
- **Blocked**: a named capability is missing or an item's fix demands a decision reserved for
  Afo — record it in the outcome table and continue with the rest.
- **Scope-locked** (default): after Phase 0 verification, stop and present the scope table
  before any product-code commit.
