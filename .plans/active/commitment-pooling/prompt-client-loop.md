# Complete the Commitment Pooling client PWA: close the member loop (D1), then Offer over time (D2)

Dispatch prompt for a fresh Claude Code session. Written 2026-08-21 from the build review in
`reports/build-review-2026-08-21.md`; refreshed the same evening after the worktree below was
prepared and the dev stack was started from it. Read it whole; the facts under "Present state" were
verified that day and should be re-verified cheaply before they are trusted.

You are working in the Green Goods monorepo. Read `CLAUDE.md` and `AGENTS.md` first; they bind
you. This repo runs concurrent Claude/Codex sessions on the same tree: stay inside the paths named
below, treat any working-tree change you did not make as another agent's work (stash, never
revert), never `git add -A`, never switch the primary tree's branch except as instructed here.

## Worktree

You are in the worktree `/Users/afo/Code/greenpill/green-goods/.claude/worktrees/client-loop` on
`feature/commitment-pooling-client-loop`, created from `origin/develop` at `bcf6adfc2`. The primary
checkout at `/Users/afo/Code/greenpill/green-goods` and every other `.claude/worktrees/*` directory
belong to other sessions: never read their uncommitted files, never symlink, copy, install into, or
clean them, never run `git` against them. Do not remove this worktree at the end; Afo does.

Prepared on 2026-08-21, so none of this is yours to redo:

- Dependencies were installed with `bun run setup:isolated` (frozen lockfile, 6,768 packages). Do
  not run any other install.
- `.env` is an absolute symlink to the primary repo's `.env`; treat it as read-only. If a
  secret-backed step fails, report it env-gated rather than editing env. The command guard denies
  any shell command that names `.env`, even `ln` or `ls`; do not route around it.
- `mise trust` is done and the pinned toolchain (Node 22.22.1, Bun 1.3.14, Foundry 1.7.1) is
  installed. mise is **not** activated in Claude Code tool shells: a bare `node` resolves to v18 and
  `bun` to 1.3.10 there, and the husky hook then dies with a misleading `toSorted` error. Prefix
  every repo command with `mise exec --` (`mise exec -- bun run test`, `mise exec -- bun format`),
  or check that `node --version` prints `v22.22.1` before trusting a result.
- The branch has no upstream on purpose (`worktree add` had pointed it at `origin/develop`).
  Publish with `git push -u origin feature/commitment-pooling-client-loop`.
- At session start this worktree has no uncommitted changes; the branch's first commit is this
  refreshed prompt (`docs(plans): refresh the client loop prompt for the prepared worktree`). Any
  uncommitted change you find is another session's work: leave it alone and report it.
- Never `git add -A`: stage explicit paths. Before each commit, `git status --short` from the
  worktree root and confirm no `node_modules`, `.env`, `tmp/`, or `.generated` stray is staged.
- The second branch, `feature/commitment-pooling-client-over-time`, is created from this worktree
  with `git switch -c` off the updated `develop` only after the D1 PR has merged; do not create a
  second worktree and do not open D2 against `develop` while D1 is still open.

### The dev stack already runs from this worktree

`bun run dev` (Anvil Arbitrum fork, client, admin, docs, Storybook, agent, Docker indexer, tunnel)
was started from this worktree on 2026-08-21, so `https://localhost:3001/` serves the code you
edit, with HMR. Facts that matter:

- PM2 is one daemon for the machine and app names are shared. `scripts/dev/stack.js` deletes the
  same-named apps before starting, so **any** `bun run dev` from another checkout silently takes the
  stack back (it happened twice while this worktree was being prepared). Before browser QA, prove
  ownership: `lsof -a -p "$(lsof -nP -iTCP:3001 -sTCP:LISTEN -t | head -1)" -d cwd -Fn | grep '^n'`
  must print this worktree's path. If it prints the primary checkout, stop and tell Afo which
  session owns it; do not start a takeover loop.
- `bun run dev:doctor` cannot see the live stack: its port probe binds `127.0.0.1`, which succeeds
  against Vite's wildcard bind on macOS, so it reports 3001/3002/3004 "available" while they are
  being served. Use `npx pm2 list` and `lsof -nP -iTCP:<port> -sTCP:LISTEN` instead; `bun run
  dev:health` and `bun run dev:smoke:full` stay valid once the stack is up.
- `stack.js` never returns: it tails PM2 logs and **deletes every app on SIGINT/SIGTERM**. Never run
  `bun run dev` as a foreground tool call (the timeout kills the stack) or as a harness-tracked
  background task (session teardown does the same). If Afo asks you to restart it, launch it
  detached from the worktree root with the log outside the repo, then wait on the ports:
  `( nohup mise exec -- bun run dev > "$TMPDIR/gg-stack.log" 2>&1 < /dev/null & )`, then
  `npx wait-port -t 240000 localhost:3001`. The indexer leg is a Docker image rebuild and can need
  more than the probe's 180 s; `npx wait-port -t 300000 localhost:3006` covers it.
  `bun run dev:stop` stops the stack wherever it was started.
- The local Envio builds from this worktree and mirrors live Arbitrum (18 pools registered); writes
  go to the Anvil fork, which is in-memory and resets on every stack restart. `dev:web` serves the UI
  against the hosted indexer named in `.env`, which has no pooling schema yet, so pooling queries
  land in read-error states there; stay on the full stack.
- Do not expect live local pooling data yet. On 2026-08-21 the local index for chain 42161 sat at
  block 435,619,882 while the Arbitrum head and the pool registrations were near 497,000,000, and
  Envio HyperSync rate-limited the catch-up to zero progress (68 `rate-limited` warnings in two
  minutes of `docker logs indexer-indexer-1`). `bun run dev:smoke:full` then fails exactly one
  check, `local-indexer-lag`, by design. Until that check passes, authenticated pooling reads
  against the local stack return nothing even after the local ledger flip: build and test against
  fixtures, and run the smoke before claiming any live local proof. Raising the Envio plan limit is
  Afo's call; do not change indexer config, compose, or env to work around it.
- The tunnel app publishes `trycloudflare.com` URLs for the client and admin
  (`npx pm2 logs tunnel --nostream --lines 40 | grep -i ready`); use them for the real-device pass,
  and remember they change on every restart.
- Host-side `envio codegen` works in this worktree under `mise exec -- bun run --cwd
  packages/indexer codegen` (run on 2026-08-21; `bun run dev:health` is green), so the indexer
  legs of `bun run test` / `bun run build` are expected to pass here. If one fails on codegen
  anyway, prove it pre-existing with a stash and report that leg as env-gated. Everything else in
  the Ship Gate must actually pass here. Repo-root `bun build` invokes Bun's bundler, not the package script;
  always `bun run build`. Capture a stage's exit code before piping to `tail`.

If the worktree is ever missing, Afo recreates it (absolute paths on the `ln`, because a relative
one once landed a stray symlink inside `hifi/screens/`; the `.env` link before `setup:isolated`, or
setup writes its non-secret baseline where the link should go; `mise trust` before anything that
runs Node):

```bash
git -C /Users/afo/Code/greenpill/green-goods fetch origin develop
git -C /Users/afo/Code/greenpill/green-goods worktree add /Users/afo/Code/greenpill/green-goods/.claude/worktrees/client-loop -b feature/commitment-pooling-client-loop origin/develop
ln -s /Users/afo/Code/greenpill/green-goods/.env /Users/afo/Code/greenpill/green-goods/.claude/worktrees/client-loop/.env
mise trust && GG_SETUP_ENV_MODE=skip mise exec -- bun run setup:isolated && git branch --unset-upstream
```

## Dispatch gate (check before anything else)

The hub still records the product-UI lane as manually blocked: `status.json` has
`lanes.ui.manual_blocked: true` and `execution_sub_lanes.ui_client.status: "blocked"`, and
`handoffs/claude-ui-client.md` names verified live indexer read-back and the admin-foundation
cleanup as unblock evidence. PR #740 was dispatched under the narrowed option without that
transition being recorded, which is how its scope went unrecorded. Do not repeat that.

Start only when both are true. Afo's dispatch of this prompt is the human authorization; you record
it yourself, as your first action:

1. The scope-lock is recorded in the hub on this branch, as the first commit of your session (the
   branch already carries the prompt-refresh commit ahead of it):
   `node scripts/harness/plan-hub.mjs set-lane --feature commitment-pooling --lane ui --status in_progress --actor human --branch feature/commitment-pooling-client-loop --note "Narrowed client dispatch: Phase 0 + D1 + D2 of prompt-client-loop.md, built against fixtures and the local stack before hosted read-back; rendered live proof deferred to the hosted Envio deployment"`,
   then a hand edit of the `execution_sub_lanes.ui_client` entry to match (`status`
   `"in_progress"`, `manual_blocked` `false`, `branch` this branch, `blocked_reason` replaced by the
   same note; the harness has no sub-lane command; replace `lanes.ui.blocked_reason` with the
   same note as well, since `set-lane` leaves it untouched), then `bunx biome format --write` on
   `status.json` (the plan-hub command rewrites it with raw `JSON.stringify`), then
   `node scripts/harness/plan-hub.mjs validate` green. Commit as
   `docs(plans): open the client loop lane` with exactly `status.json` staged.
2. `git log -1 -- .plans/active/commitment-pooling/status.json` on this branch shows that commit.

If the transition cannot be recorded (the harness command fails, `validate` rejects the edit, or
`status.json` no longer matches the state described above), stop and report "dispatch gate not
recorded"; do not edit product code. The ledger flip and the hosted Envio deployment stay outside
this lane regardless.

## Objective

Make the client PWA able to run one real commitment end to end for a member: create (service
**or** garden-work), claim, add proof, link approved work, send for confirmation, confirm or say
"Not yet", and find all of it from the commitments sheet. Then (D2) make "Offer over time" usable:
saved Offers, an ongoing Offer with finite places, its Story, rest/resume/retire.

Deliver as **two PRs to `develop`**: D1 from `feature/commitment-pooling-client-loop`; D2 from
`feature/commitment-pooling-client-over-time`, opened only after the D1 PR has merged and the D2
branch is rebased onto the updated `develop` (a stacked PR against `develop` would carry the whole
D1 diff and trips this repo's CI Gate base-branch filter). Each PR body links exactly one issue
for resolution: `Refs PRD-724` (partial work), plus `Relates to PRD-650` for context only. Do not
change any Linear state or create Linear records; Afo does that.

## Present state (verified 2026-08-21; re-verify cheaply before trusting)

- `develop` is at `bcf6adfc2`, this branch's base (it includes #744 contracts peer wiring, #746,
  and #747). PR #740 (`173a2a627`) shipped the client slice:
  `packages/client/src/views/Home/CommitmentsDrawer/*` (W5 sheet), `views/Home/Garden/Pool/*`
  (W1), `views/Home/Garden/Commitment/*` (W2 + withdraw), `views/Home/Garden/Compose/*` (W3,
  service-only), `components/Features/Commitments/*`, routes `commitments/new` and
  `commitments/:commitmentId` in `packages/client/src/router.config.tsx:215-222`, 225
  `app.(commitments|commitment|pool|compose).*` keys mirrored in
  `packages/shared/src/i18n/{en,es,pt}.json`. 12 client test files / 104 tests pass.
- PR #745 and #746 merged the public editorial readers (`usePublicGardenPool`,
  `usePublicCommitmentImpact`, `cycle-metadata.ts`) into `develop`, so cycle-name resolution is
  available to the client.
- The shared layer supports everything below, with three gaps this prompt closes in Phase 0 and
  Phase 1 (membership preflight coverage, offline evidence payload, pool pause/readiness fields):
  hooks exported from
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
  re-arms the act (`GardenCommitment.tsx:76`) — note that queue-level deduplication for
  claim/evidence/confirmation already exists (`commitmentJobIdentity` in
  `modules/job-queue/queue-policy.ts:27-48`, enforced by `addJob` at `modules/job-queue/index.ts:147-158`),
  so the detail-bar problem is the re-armed button, not a missing identity; the membership preflight
  in `modules/commitment-pooling/job-executor.ts:84-87` runs only when a payload carries
  `gardenAddress`, which `ClaimJobPayload`, `EvidenceJobPayload`, `WorkLinkJobPayload`, and the
  confirmation payload do not (`job-types.ts`), so those four jobs skip the waiting-for-membership
  path and spend retries on a revert instead; `tap-target` is not a defined utility (only `.tap-target-lg`
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
5. Design rules: `packages/client/DESIGN.pwa.md`,
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
   the pool tab from `commitmentNeedsSeat` (`acts.ts:153`, which excludes the elective withdraw /
   take-up / ask-to-take-up / offer-again acts) with the viewer's seat from `selectCommitmentSeat`,
   not from `selectCommitmentActKind`, which would badge rows nobody is waiting on.
4. Queue truth on the detail bar: consume `isUnavailable`, `pendingCommitmentIds`, and
   `failedCommitmentIds` from `useCommitmentQueueState`; an unreadable queue disables the act with
   the existing `app.commitments.*` queue-unreadable copy rather than offering it. Do not add new
   identity fields to the claim or confirmation payloads: `commitmentJobIdentity`
   (`queue-policy.ts`) already derives claim identity from commitment + kind + garden context and
   confirmation identity from action + commitment, and `addJob` returns the existing non-terminal
   job or throws `offline_job_identity_conflict`. Add regression coverage for that existing policy
   in `packages/shared/src/__tests__/commitment-jobs.test.ts` (second enqueue of the same claim /
   confirm returns the existing job id; a differing payload conflicts) and only add an identity
   dimension if a concrete missing one is demonstrated.
5. Membership preflight for every membership-gated job: add `gardenAddress` to
   `ClaimJobPayload`, `EvidenceJobPayload`, `WorkLinkJobPayload`, and the confirmation payload (or
   resolve it inside `job-executor.ts` from `readCommitment` → pool → garden before the send) so
   the preflight at `job-executor.ts:84-87` returns `waiting` / `membership-unavailable` instead
   of spending retries on a revert. RED tests in `commitment-jobs.test.ts` and
   `modules/job-queue.commitment-policy.test.ts` for each kind; persisted payload shape changes
   need a read-compatibility test for jobs queued before the change.
6. Small fixes: replace `tap-target` with `tap-target-lg` (or define it) at the five sites; hide
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
3. **Proof composer (W2a).** Shared first: `EvidenceJobPayload` is `{ commitmentId, cid,
   creditedContributors }` and its executor calls `attachEvidence` immediately
   (`job-executors.ts:203-206`), so today nothing can be queued offline without a CID already in
   hand. Extend the payload with the raw evidence document (note, links, details) and persist the
   media the way the work job does (`jobQueueDB.getImagesForJob` → upload at execution,
   `executeWorkJob`, `job-executors.ts:33-45`); the executor publishes the document and media at
   sync, writes the resulting `cid` back onto the job, then attaches. Keep `cid` optional at
   enqueue and required at send; RED tests for queue-offline → restart → upload → attach, and for
   upload failure leaving the job `waiting`, not terminal. Then the screen: new route
   `commitments/:commitmentId/proof`; states `media, media-preview, details, review,
   review-request, review-support, review-captured, queued, failed`; enqueue
   `{ act: "evidence", payload }` with `creditedContributors` carried durably; reuse the Submit Work
   media / `FormProgress` rhythm. "Add proof" on W2 opens it instead of navigating away;
   `band.provider.active.b` copy must describe what the screen actually shows.
4. **Link work (WFLOW).** The Work model has no `meta.commitmentId` (zero readers in shared or
   client), and the indexer's `CommitmentWorkAttribution` is read only commitment → work
   (`data-commitments.ts:143`). Add a shared reader that returns attributions by `workUID` (same
   entity, `where: { workUID }`, plus a query key under `queryKeys.commitmentPooling.*`) and a
   hook over it; that is the data source for the read-only "Fulfills" row on the Work Review view
   (`WFLOW@review`), navigable both ways, never editable. From W2, a "Link work" act opens a
   picker of the viewer's approved Work in this garden (`link-picker`) and enqueues
   `{ act: "workLink", payload }`. Persisting a commitment reference on Work *submitted from* a
   commitment deep link (the handoff's `meta.commitmentId` path) touches the work metadata schema
   outside this lane's paths; treat it as decision 6 below and do not build it unasked. Remove the
   linked-work promise from copy if you cannot render it.
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
7. **Pool readiness and pause (W1).** Shared first: `CommitmentPoolRecord` and
   `getCommitmentPoolDetail` omit the indexer's `pauseReasonCID` / `pauseReasonBlockNumber`
   (`schema.graphql:731-733`) and carry no qualifying-Baseline fact, so the states below have no
   data source yet. Extend the pool read model and query with the pause-reason fields (resolve the
   CID through the metadata helper, em dash when unresolvable), and source the Baseline from the
   existing garden assessment reads (the same preflight the admin handoff calls "the app-preflight
   Baseline"; if no shared selector exists for it, render the checklist without the Baseline row
   and record that as not built rather than inventing one). Then: `not-ready` renders the
   readiness checklist (charter, qualifying baseline, provider open-commitment cap); `paused`
   shows the resolved reason; `queued` / `sync-failed` rows from queue state;
   `waiting-membership`. Keep lifecycle notices as they are.
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
- Types: the client `build` script's `tsc --noEmit` runs against a solution-style `tsconfig.json`
  with `"files": []`, so it checks zero files and passes regardless of type errors (known repo
  defect; `bun run build` is therefore green today and stays satisfiable). That is why you run the
  real project check by hand:
  `cd packages/client && node ../../scripts/dev/node-cli.js tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "views/Home/(Garden|CommitmentsDrawer)|Features/Commitments"`
  and leave zero errors in files you touched; do not try to clear the ~80 pre-existing ones, and
  do not treat them as a Ship Gate failure, because the gate does not see them.
- Design: `bun run check:design-tokens` green; a `*.stories.tsx` for `CommitmentRow`,
  `CommitmentStateLadder`, `CycleRail`, the proof composer, and the confirmation sheet alongside
  the 20 existing client stories; the prototype build still passes.
- Rendered proof: the stack already runs from this worktree (§ Worktree: run the ownership check
  first, never restart it unasked), then
  `https://localhost:3001/home?mockAuth=user&presentation=pwa` (and `operator` for steward paths)
  through the authenticated Brave QA profile via the Claude-in-Chrome extension. If the
  authenticated profile is unavailable, report browser QA as BLOCKED; do not substitute an isolated
  Playwright/Browser-pane profile as proof.
- Offline proof must be real. A synthetic `window.dispatchEvent(new Event("offline"))` only flips
  the `useOffline` listener; the queue itself reads `navigator.onLine` before processing
  (`modules/job-queue/index.ts:124,255`, `providers/JobQueue.tsx:321,375`), so jobs would sync
  immediately and prove nothing. Use an actual offline network state (Brave DevTools → Network →
  Offline, or the OS network off), enqueue, reload the PWA while still offline, confirm the job
  and its media survived the restart, then restore the network and watch it send. The handoff's
  real-device pass (installed PWA, airplane mode, relaunch) is part of D1's evidence, not
  optional; if no device is available, record it as BLOCKED.
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
6. Whether Work submitted from a commitment deep link should persist a commitment reference in
   its metadata (the handoff's `meta.commitmentId`), which touches the work metadata schema
   outside this lane's paths, or whether the indexer attribution is the only source.

## Stop conditions

- Complete: both PRs open against `develop` with green Ship Gate, the built/not-built table
  attached, rendered proof or an explicit BLOCKED line, and no change outside the allowed paths.
- Blocked: a required shared API is missing in a way that needs a contract or indexer change, the
  authenticated Brave profile is unavailable, another checkout has taken the dev stack (the
  ownership check prints the primary path), or a decision above is unanswered. Finish everything
  not dependent on it, then report with the exact file and line.
- Out of scope: anything listed under Boundaries. Report it; do not build it.
