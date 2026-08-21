# Complete the Commitment Pooling client PWA: close the member loop (D1), then Offer over time (D2)

Dispatch prompt for a fresh Claude Code session. Written 2026-08-21 from the build review in
`reports/build-review-2026-08-21.md`. Paste it whole; the facts under "Present state" were verified
that day and should be re-verified cheaply before they are trusted.

You are working in the Green Goods monorepo. Read `CLAUDE.md` and `AGENTS.md` first; they bind
you. This repo runs concurrent Claude/Codex sessions on the same tree: stay inside the paths named
below, treat any working-tree change you did not make as another agent's work (stash, never
revert), never `git add -A`, never switch the primary tree's branch except as instructed here.

## Worktree

You are in the worktree `/Users/afo/Code/greenpill/green-goods/.claude/worktrees/client-loop` on
`feature/commitment-pooling-client-loop`, branched from `origin/develop`. The primary checkout at
`/Users/afo/Code/greenpill/green-goods` and every other `.claude/worktrees/*` directory belong to
other sessions: never read their uncommitted files, never symlink, copy, install into, or clean
them, never run `git` against them. Do not remove this worktree at the end; Afo does.

- `.env` here is a symlink to the primary repo's `.env`; treat it as read-only. If a secret-backed
  step fails, report it env-gated rather than editing env.
- Dependencies were installed with `bun run setup:isolated` (frozen lockfile). Do not run any other
  install.
- Run the dev stack **from this worktree** (`bun run dev`, or `bun run dev:web` if Docker is not
  needed) so the browser serves the code you are editing. PM2 is one daemon for the machine and
  `scripts/dev/stack.js` deletes same-named apps before starting, so starting here takes over
  ports 3001–3009 from any other checkout. If `bun run dev:doctor -- --profile web` reports ports
  in use, stop and tell Afo which tree holds them instead of killing anything. `bun run dev:stop`
  stops the stack wherever it was started.
- `dev:web` serves the UI against the indexer named in `.env`, which has no pooling schema yet, so
  pooling queries land in read-error states. For real pooling data use `bun run dev` (Docker): the
  local Envio builds from this worktree and mirrors live Arbitrum, where 18 pools are registered;
  writes go to the Anvil fork.
- The indexer legs of `bun run test` / `bun run build` may fail on `envio codegen` in a fresh
  worktree; prove it pre-existing with a stash and report that leg as env-gated. Everything else in
  the Ship Gate must actually pass here.
- Repo-root `bun build` invokes Bun's bundler, not the package script; always `bun run build`.
  Capture a stage's exit code before piping to `tail`.
- Never `git add -A`: stage explicit paths. Before each commit, `git status --short` from the
  worktree root and confirm no `node_modules`, `.env`, or `.generated` stray is staged.
- The second branch, `feature/commitment-pooling-client-over-time`, is created from this worktree
  with `git switch -c` only after the D1 PR is open; do not create a second worktree.

Worktree creation (Afo runs this before the session starts):

```bash
git -C /Users/afo/Code/greenpill/green-goods fetch origin develop
git -C /Users/afo/Code/greenpill/green-goods worktree add /Users/afo/Code/greenpill/green-goods/.claude/worktrees/client-loop -b feature/commitment-pooling-client-loop origin/develop
ln -s /Users/afo/Code/greenpill/green-goods/.env /Users/afo/Code/greenpill/green-goods/.claude/worktrees/client-loop/.env
cd /Users/afo/Code/greenpill/green-goods/.claude/worktrees/client-loop && mise trust && bun run setup:isolated
```

Absolute paths on the `ln` (a relative one once landed a stray symlink inside `hifi/screens/`); the
`.env` link is a brand-new path and must come before `setup:isolated` so setup does not write its
non-secret baseline over it; `mise trust` first or Node falls back to v18 and the husky hook dies
with a misleading `toSorted` error.

## Objective

Make the client PWA able to run one real commitment end to end for a member: create (service
**or** garden-work), claim, add proof, link approved work, send for confirmation, confirm or say
"Not yet", and find all of it from the commitments sheet. Then (D2) make "Offer over time" usable:
saved Offers, an ongoing Offer with finite places, its Story, rest/resume/retire.

Deliver as **two PRs to `develop`**: D1 from `feature/commitment-pooling-client-loop`, D2 from
`feature/commitment-pooling-client-over-time` (a branch off D1 created in this worktree after the
D1 PR is open). PR bodies use `Refs PRD-724` and `Refs PRD-650`. Do not change any Linear state or
create Linear records; Afo does that.

## Present state (verified 2026-08-21; re-verify cheaply before trusting)

- `develop` is at or past `67a32ae41`. PR #740 (`173a2a627`) shipped the client slice:
  `packages/client/src/views/Home/CommitmentsDrawer/*` (W5 sheet), `views/Home/Garden/Pool/*`
  (W1), `views/Home/Garden/Commitment/*` (W2 + withdraw), `views/Home/Garden/Compose/*` (W3,
  service-only), `components/Features/Commitments/*`, routes `commitments/new` and
  `commitments/:commitmentId` in `packages/client/src/router.config.tsx:215-222`, 225
  `app.(commitments|commitment|pool|compose).*` keys mirrored in
  `packages/shared/src/i18n/{en,es,pt}.json`. 12 client test files / 104 tests pass.
- PR #745 and #746 merged the public editorial readers (`usePublicGardenPool`,
  `usePublicCommitmentImpact`, `cycle-metadata.ts`) into `develop`, so cycle-name resolution is
  available to the client.
- The shared layer is complete and the backend supports everything below: hooks exported from
  `packages/shared/src/hooks/commitment-pooling/index.ts` (`useCommitment`, `useCommitmentPool(s)`,
  `useCommitmentCycle(s)`, `useCommitmentClaimRequests`, `useCommitmentSeries`,
  `useCommitmentSeriesDetail`, `useCommitmentsInbox`, `useCommitmentJobs`,
  `useCommitmentQueueState`, `useCommitmentMutation`, `useCommitmentComposerForm`,
  `useCommitmentMetadata(For)`, `useSavedOffers` / `useSavedOffer` / `useSavedOfferPersistence`,
  `useCommitmentPoolingAvailability`), offline job kinds in
  `packages/shared/src/modules/commitment-pooling/job-types.ts` (`commitmentSeries, commitment,
  claim, evidence, workLink, confirmation`), act selector `selectCommitmentActKind` in
  `modules/commitment-pooling/acts.ts`, identity keys in `modules/commitment-pooling/job-identity.ts`,
  IPFS pinning via `uploadJSONToIPFS` in `packages/shared/src/modules/data/ipfs/upload.ts` (the
  create job pins metadata in `modules/job-queue/job-executors.ts`, around lines 300–330).
- `useCommitmentJobs` accepts
  `{act: "claim"|"evidence"|"workLink"|"sendForConfirmation"|"confirm"|"create"}`
  (`useCommitmentJobs.ts:33-40`). There is **no act for `commitmentSeries`** yet; D2 must add one
  (shared change, allowed).
- Availability is a build-time ledger: `packages/shared/src/ontology/agent-manifest.generated.json`
  → `entity:commitment-pool` chain 42161 = `deployed-not-available`, so `addJob` throws for every
  commitment kind and every authenticated pooling query is disabled, in production **and** in the
  local stack (the local stack also runs chain 42161). The hosted Envio does not yet serve the
  pooling schema. This is release work owned elsewhere; do not make it your problem beyond the QA
  rule below.
- Known defects in the shipped slice (fix these first, see Phase 0): deep links render "not found"
  whenever availability is not `available` (`GardenCommitment.tsx:91` runs before the availability
  branch at `:103`); the withdraw reason is sent raw as `reasonCID` (`WithdrawDialog.tsx:62` →
  `GardenCommitment.tsx:285-291` → `useCommitmentMutations.ts:103-105` →
  `cancelCommitment(uint256,string reasonCID)`); sheet rows have no `onOpen`
  (`LiveTab.tsx:152-161`, `OverTimeTab.tsx:160-168`) and `needsYou` is hard-coded `false`
  (`GardenPool.tsx:75`); the detail bar reads only `pendingCommitmentIds` so a failed queue read
  re-arms the act (`GardenCommitment.tsx:76`) and `claim`/`confirmation` jobs carry no identity
  key (`job-identity.ts:90-130`); `tap-target` is not a defined utility (only `.tap-target-lg`
  exists in `packages/client/src/styles/utilities.css:30-39`; sites `LiveTab.tsx:121`,
  `GardenPool.tsx:125-126`, `ComposeTerms.tsx:46-47`); the bottom nav stays under the
  detail/composer action bars (`AppBar.tsx:22,35` hides it only for `/work/`;
  `isCommitmentsDrawerOpen` missing from `isAnyDrawerOpen` at `:32-33`); the Live tab's unplaced
  heading is English in es/pt (`grouping.ts:21` default, `LiveTab.tsx:54` omits the label);
  `app.garden.pool` is "Pool" in es/pt; progress bars have no accessible name
  (`CommitmentProgress.tsx:67-73`); the detail heading renders twice
  (`GardenCommitment.tsx:243,319`); requirement rows read "Requirement N" instead of the action
  (`CommitmentProgress.tsx:55-58`); `CycleRail.tsx:58-77` omits names and dates the record carries
  (`types-core.ts:154-156`).

## Authoritative inputs (read in this order, before editing)

1. `.plans/active/commitment-pooling/handoffs/claude-ui-client.md` — the lane contract. Note
   line 37: the shipped PR took the "narrowed dispatch option" (W1–W5); you are completing that
   scope and the member loop, not the settlement slices.
2. `.plans/active/commitment-pooling/uiux-spec.md` §5 (Client PWA) and Appendix F (Offer once /
   over time). Binding rule at `uiux-spec.md:685-687`: direction is fixed by the entry CTA and
   never renders as an in-form Direction control.
3. `.plans/active/commitment-pooling/handoffs/commitment-view-state-reference.md` — generated
   per-state contract for the commitment detail screen (cast, seat, phase, act). Never hand-edit
   it.
4. Prototype source of truth: `.plans/active/commitment-pooling/hifi/screens/client.ts` (W1, W2,
   W2a, W2b, W3, W4, W25, WFLOW), `hifi/screens/client-wallet.ts` (W5, W32, W34, W35),
   `hifi/journeys.ts` (flows; sb1/sb42 confirm, sb5/sb47 Not yet, sb13/sb46 garden claim,
   sb33/sb45 team), `prototypes-coverage.md` § Screen registry (state ids per screen). Build the
   click-through locally to look at screens:
   `bun .plans/active/commitment-pooling/prototypes-artifact.build.ts` (or
   `OUT=/path/out.html bun …`); the build fails on any broken state/journey ref, which is the
   validator you want.
5. Design rules: `.claude/skills/design/quick-reference.md`,
   `.claude/skills/design/client-prompt-contract.md` § Canonical Component Palette,
   `.claude/skills/design/review-checklist.md` (apply Lenses 1 + 4 per PR; all four for the two
   new screens), `.claude/rules/react-patterns.md`, `.claude/rules/frontend-design.md`,
   `.claude/context/client.md` (presentation mode). Reuse shipping client rhythms (`ModalDrawer`,
   `EmptyState`, `FormProgress`, the Submit Work media composer, `DialogShell`, `Alert`,
   `StatusBadge`); do not invent parallel patterns. Tokens only (`--spring-*`, `--color-*`,
   `--radius-*`); no raw easings, durations, colors, or `--m3-*`. Tailwind v4 does not scan
   `packages/shared/src/**` from the client build: any layout utility a shared component needs
   goes on the client wrapper or inline.
6. `packages/contracts/src/interfaces/ICommitmentPoolingModule.sol` for the exact Series, dispute,
   claim, evidence, and work-link functions;
   `packages/shared/src/modules/commitment-pooling/{types-core,job-types,acts,job-identity,metadata}.ts`
   for payload shapes; `.plans/active/commitment-pooling/contract-spec.md` (grep `reasonCID` and
   `metadataCID`) for the reason/metadata CID shape before pinning anything.
7. Prior adversarial rounds so you do not reopen closed findings:
   `.plans/active/commitment-pooling/review-prompt-client-ui-round{2,3,4,5}.md` and fix commits
   `dd12817ab 694a20316 f5e86ae37 c984ec5ef 5f0f99dee d651dca49`.

## Boundaries

- Hooks live only in `@green-goods/shared`; client gets components and views. Import only declared
  `@green-goods/shared` export paths.
- Allowed write paths: `packages/client/src/**`,
  `packages/shared/src/{hooks/commitment-pooling,modules/commitment-pooling,modules/job-queue,types,i18n,stores}/**`
  and their tests, `.plans/active/commitment-pooling/handoffs/claude-ui-client.md` (append only:
  the built/not-built table), and a new `.plans/active/commitment-pooling/reports/client-loop-<date>.md`.
  No contract, indexer, ontology, `.github`, `package.json`, lockfile, or `.env*` changes. Do not
  install dependencies.
- Never commit a change to this worktree's `packages/shared/src/ontology/green-goods-projections.json`
  or the generated manifest. For rendered QA only, you may flip chain 42161 `entity:commitment-pool`
  to `integration: integrated, availability: available` locally, regenerate
  (`bun run ontology:generate`), QA, then revert both files before staging. State in the PR that
  live authenticated proof is pending the hosted Envio deployment.
- Every user-facing string lands in `en.json`, `es.json`, and `pt.json` in the same change; public
  copy says "commitment", never "promise" (`promiseKeptRate` is a code identifier only). No score,
  rank, reputation, reliability, leaderboard, or inferred participant copy anywhere.
- No settlement slices (W23 G$ wallet, consideration-status rows on W2, W36 member-funded claim,
  online `transfer`), no exchange pairs or templates (W28–W31), no declared value / "in exchange
  for", no admin or editorial work, no Linear writes. If you believe one of these is needed to
  finish an item, stop and report it as a decision.
- Offline-first is the top priority in every trade-off: every field act enqueues through
  `useCommitmentJobs` and survives restart; online-only acts (`raiseDispute`, rest/resume/retire,
  saved-Offer remote save) say so in copy and degrade honestly offline.

## Method

### Phase 0 — fix the shipped slice (one commit per item, tests first)

1. Availability before not-found: in `GardenCommitment.tsx` test
   `availability.status !== "available"` before the not-found branch; rewrite the test at
   `GardenCommitment.test.tsx:231-239` so its fixture returns `detail: null` when unavailable (the
   real hook never returns a populated `detail` while unavailable). Apply the same ordering to
   `GardenPool.tsx` and the sheet if they share the shape.
2. Reasons are CIDs: add a shared helper that pins a versioned reason document (follow the CID
   shape the spec names) with `uploadJSONToIPFS`, and make withdraw pin before `cancelCommitment`;
   on pin failure, keep the dialog open with a retry, never submit raw text. `raiseDispute` (D1)
   and `resolveDispute` use the same helper.
3. The sheet opens things: pass `onOpen` from both tabs to `CommitmentRow`, navigating to
   `/home/:gardenId/commitments/:commitmentId` (series rows in D2 go to W34). Derive `needsYou` on
   the pool tab from `selectCommitmentActKind` for the viewer's seat instead of `false`.
4. Queue truth on the detail bar: consume `isUnavailable`, `pendingCommitmentIds`, and
   `failedCommitmentIds` from `useCommitmentQueueState`; an unreadable queue disables the act with
   the existing `app.commitments.*` queue-unreadable copy rather than offering it. Add
   deterministic identity keys for `claim` and `confirmation` jobs in `job-identity.ts` /
   `prepareCommitmentJobPayload`, with a RED test in
   `packages/shared/src/__tests__/commitment-jobs.test.ts` proving a second enqueue of the same act
   is rejected or deduplicated.
5. Small fixes: replace `tap-target` with `tap-target-lg` (or define it) at the five sites; hide
   the bottom nav on `/home/:id/commitments/*` and add the commitments drawer to
   `isAnyDrawerOpen`; pass the translated unplaced label in `LiveTab`; translate `app.garden.pool`
   in es/pt; `aria-label` on progress bars; single heading on detail; requirement rows show the
   action title via `useCommitmentMetadataFor` / the action registry; `CycleRail` shows start/end
   dates and the versioned cycle name via `cycle-metadata.ts` (merged in #745).

### Phase 1 — D1, close the loop (each item: RED test → implementation → targeted proof)

Build in this order; each item names the prototype states it must render (ids from
`prototypes-coverage.md` § Screen registry) and the shared API it consumes.

1. **Two-door entry (W1 → W3).** Replace the single "compose" button and the in-form direction
   beat (`Compose/ComposeKind.tsx`) with two one-word doors on the pool tab that fix direction by
   route (`commitments/new?direction=offer|request`), per `uiux-spec.md:685-687` and
   `hifi/screens/client.ts` (around line 522). Visible change; call it out in the PR.
2. **Garden-work commitments (W3).** Add the kind choice (`step-what`: garden work vs service) and
   DomainImpact requirement rows `{ actionUID, requiredCount }` (1..`MAX_REQUIREMENTS`, same-domain
   actions allowed, derived domain tags shown read-only), with the ordered payload surviving
   restart/retry. Extend `commitmentComposerSchema` / `buildCommitmentCreationPayload` in shared;
   states `step-what, step-howmuch, step-details, details-preview, step-review, step-review-read,
   request-work-*`, `validation`, `draft-resume`. `step-advanced` (confirmers, protocol-fallback
   opt-out) is required only if the shared composer form already models confirmers; otherwise
   record it as not built.
3. **Proof composer (W2a).** New route `commitments/:commitmentId/proof`; states `media,
   media-preview, details, review, review-request, review-support, review-captured, queued,
   failed`; enqueue `{ act: "evidence", payload }` with `creditedContributors` carried durably;
   reuse the Submit Work media / `FormProgress` rhythm. "Add proof" on W2 opens it instead of
   navigating away; `band.provider.active.b` copy must describe what the screen actually shows.
4. **Link work (WFLOW).** From W2, a "Link work" act opens a picker of the viewer's approved Work
   in this garden (`link-picker`) and enqueues `{ act: "workLink", payload }`; the Work Review view
   gains a read-only "Fulfills" row from `meta.commitmentId` (`WFLOW@review`), navigable both
   ways, never editable. Remove the linked-work promise from copy if you cannot render it.
5. **Confirmation sheet (W4).** Replace the bare bar button with the sheet: `confirm-domain,
   confirm-support, confirm-request, confirm-request-work, confirm-campaign-request,
   confirm-captured`, evidence preview read-only, direction-aware seat (Offer receiver / Request
   creator), named-group option only when the confirmer rule names one, `PoolFallback` /
   `ProtocolFallback` provenance when the indexed record says so, `confirmed-pending*` (queued
   offline) and `confirmed*`. "Not yet" → `not-yet*` states → online `raiseDispute` via
   `useCommitmentMutation` with a pinned reason; offline it explains it needs a connection and
   keeps the draft reason locally; `not-yet-failed*` on revert.
6. **Claims (W1 + W25).** Claim-request panels from `useCommitmentClaimRequests`: `claim-pending,
   claim-declined, claim-superseded, claim-accepted`, a fresh re-request after decline, canonical
   claimant vs `requestedBy` shown when they differ. For protocol-pool claims, the
   `W25@context-chooser` (`card, context-chooser, pending, accepted`): Personal by default; Garden
   only for eligible stewards, binding `claimant = GardenAccount`, `requestedBy = steward`,
   `gardenContext`; the choice is resolved before the claim job is enqueued and never rewritten
   after.
7. **Pool readiness and pause (W1).** `not-ready` renders the readiness checklist (charter,
   qualifying baseline, provider open-commitment cap) from `useCommitmentPool`; `paused` shows the
   reason; `queued` / `sync-failed` rows from queue state; `waiting-membership`. Keep lifecycle
   notices as they are.
8. **Team (W2b, read side only).** Render the roster (lead + contributors, requirement assignment
   where present) from the read model: `setup, forming, open-member, frozen, recognition`. Roster
   *mutations* are online-only and steward-gated; build the "join" path only if
   `useCommitmentMutation` already exposes it, else record as not built.
9. **"To confirm" tab (W5).** `toconfirm, toconfirm-empty, toconfirm-loading,
   toconfirm-read-error` from `useCommitmentsInbox`, routing to W4.

Checkpoint after Phase 1: `node scripts/dev/ci-local.js --quick`, then the built/not-built table
(below), then open the D1 PR.

### Phase 2 — D2, Offer over time (branch off D1)

1. **Series job act.** Add `{ act: "series", payload }` (or the name the spec uses) to
   `useCommitmentJobs` over the existing `commitmentSeries` job kind and
   `createSeriesCreationRequestKey`; RED test in `commitment-jobs-hook.test.tsx`.
2. **Things I can offer (W32).** `compose, choose-path, draft-unsaved, saving, save-failed,
   offline-local, version-conflict, persistence` over `useSavedOffers` /
   `useSavedOfferPersistence` / `useSavedOffer`; private by default; every persistence state named
   truthfully (`LOCAL_DRAFT, SAVING_REMOTE, SAVED_REMOTE, SAVE_FAILED, …` per the handoff
   acceptance).
3. **Offer once / over time in the composer (W3).** `saved-offer-edit, saved-offer-review,
   saved-offer-queued, support-howmuch-ongoing, support-details-ongoing, support-review-ongoing`:
   the ongoing path chooses a garden pool, creates or reuses its series, adds finite
   capacity-backed places, and explains "Ask me again next cycle" as the default.
4. **Ongoing Offer detail (W34, 24 states)** over `useCommitmentSeriesDetail`: `active-two,
   active-none, active-one, places-queued, places-partial, places-partial-failed, story,
   participation, ask-again, claimant-view, pool-ready/paused/closed/composted, edit-active*,
   edit-stopped, stopped*, stop-confirm, preview, loading, read-error`. Claiming accepts an
   existing place (one pre-created instance) and never creates one. Rest / resume / retire are
   holder-only online mutations with reason where the ABI requires it; Story is exact linked
   history with counts, no rate, rank, or inferred participants.
5. **Places composer (W35)** `compose, queued, mixed-queued, mixed-failed`, and the W5
   `overtime-ready / overtime-queued / overtime-queued-waiting` states routing to W34.

Checkpoint after Phase 2 as above, then the D2 PR.

## Evidence required in each PR

- Targeted tests for every touched view and hook:
  `cd packages/client && bun run test -- Commitment GardenPool Compose Proof Confirm Series`
  (adjust the filter to your files) and `cd packages/shared && bun run test -- commitment i18n`.
  Tests assert rendered DOM and enqueued payloads; when you mock a shared hook, the fixture must
  match a shape the real hook can return (the unavailable/not-found bug survived because a fixture
  could not).
- Locale: `packages/shared/src/__tests__/i18n/locale-coverage.test.ts` green; `bun run lint:vocab`
  green.
- Types: the client build does not type-check (solution tsconfig, known repo defect). Run
  `cd packages/client && node ../../scripts/dev/node-cli.js tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "views/Home/(Garden|CommitmentsDrawer)|Features/Commitments"`
  and leave zero errors in files you touched; do not try to clear the ~80 pre-existing ones.
- Design: `bun run check:design-tokens` green; a `*.stories.tsx` for `CommitmentRow`,
  `CommitmentStateLadder`, `CycleRail`, the proof composer, and the confirmation sheet alongside
  the 20 existing client stories; the prototype build still passes.
- Rendered proof: `bun run dev` from this worktree, then
  `https://localhost:3001/home?mockAuth=user&presentation=pwa` (and `operator` for steward paths)
  through the authenticated Brave QA profile via the Claude-in-Chrome extension. Offline states:
  dispatch `window.dispatchEvent(new Event("offline"))` while the target view is mounted. If the
  authenticated profile is unavailable, report browser QA as BLOCKED; do not substitute an isolated
  Playwright/Browser-pane profile as proof.
- Before each PR, the Ship Gate: `bun format && bun lint && bun run test && bun run build`. Re-run
  Biome on touched files before staging (the PostToolUse formatter may reformat with the wrong
  style).
- The PR body carries a **built / not built** table keyed to every state id named above and to the
  acceptance bullets in `claude-ui-client.md`, with one line per "not built" saying why (deferred,
  blocked, decision). Append the same table to `claude-ui-client.md` under a dated heading and
  write the session report to `.plans/active/commitment-pooling/reports/client-loop-<date>.md`.
  This table is the deliverable that was missing from PR #740; a PR without it is not done.

## Decisions that return to Afo (do not guess)

1. Reopen PRD-724 or open a successor issue for this work; you link `Refs PRD-724` either way.
2. Confirm the two-door entry change (it replaces the shipped in-form direction control).
3. Whether `step-advanced` (named confirmers, protocol-fallback opt-out) is in D1 if the shared
   form does not model it yet.
4. Roster join/leave mutations (steward-gated, online-only) in D1 or deferred.
5. The local ledger flip for rendered QA, if you need it longer than one QA session.

## Stop conditions

- Complete: both PRs open against `develop` with green Ship Gate, the built/not-built table
  attached, rendered proof or an explicit BLOCKED line, and no change outside the allowed paths.
- Blocked: a required shared API is missing in a way that needs a contract or indexer change, the
  authenticated Brave profile is unavailable, or a decision above is unanswered. Finish everything
  not dependent on it, then report with the exact file and line.
- Out of scope: anything listed under Boundaries. Report it; do not build it.
