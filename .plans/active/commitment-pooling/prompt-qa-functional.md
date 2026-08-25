# Run the commitment pooling functional QA wave (QA Pass 1 · Wave 1)

Dispatch prompt for a fresh agent session (Claude Code / Fable, or Codex with its own browser
path). Written 2026-08-24 from `develop@cc8722a7e` after PRs #745/#746/#748 (editorial),
#749 (client loop), and #752 (steward console) merged, from `status.json`
(updated 2026-08-23), and from the three build/readiness reports named under Authoritative
inputs. Read this file whole before acting. Every claim under Present state was verified on
2026-08-24; re-verify cheaply before trusting it.

`CLAUDE.md` and `AGENTS.md` bind you. This repository runs multiple concurrent agent sessions
on one checkout: working-tree changes you did not make are another agent's work in progress —
never revert, stash only with a named message if you must move something, and prefer not
touching them at all. Never restart a PM2 stack another session owns.

**Dispatch parameters (Afo fills these when dispatching; defaults apply otherwise):**

- Target: `origin/develop` head (record the SHA you actually ran against).
- Mode: **A** (fixture & regression) unless the dispatch names Mode B. Mode B is the
  co-piloted production run and requires Afo present to sign (§ Co-pilot signing protocol).
- Report commit: **no** — leave the report/evidence files in the working tree and list them in
  your final summary, unless the dispatch says "commit the report".

## Why this wave exists

QA Pass 1 (PRD-729, lane `qa_pass_1`) is split into two waves, recorded in
`handoffs/claude-qa-pass-1.md § Wave structure`:

- **Wave 1 (this prompt, agent-run): functionality.** Does every reachable screen, state,
  act, and copy rule behave as the specs say — proven with the strongest honest tier of
  evidence available per item, and with defects routed, not fixed.
- **Wave 2 (Afo, human): experience.** Design patterns, user flows, UX judgment, locale tone,
  and the real-device PWA pass. Wave 2 starts only after Wave 1's defect list is
  dispositioned, so human QA time lands on a build already known to work.

This wave does **not** clear the QA Pass 1 manual gate and never claims the lane GREEN. Its
report is gate evidence. `lanes.qa_pass_1` in `status.json` is manually blocked pending
settlement exit-proof evidence (or a written proof-limit note) and Afo's D2 finish-or-cut
decision; Afo's dispatch of this prompt authorizes Wave 1 evidence-gathering only.

Your first action: create the report file (see § Report) and record the dispatch — date, mode,
target SHA, browser channel available, and the dispatch wording.

## Objective

Functionally verify commitment pooling across the client PWA, the steward console, and the
editorial/public surfaces at the target SHA, in the dispatched mode. Produce:

1. A **coverage table** in which every in-scope acceptance anchor carries a proof-tier label.
2. A **severity-ordered defect list**, each defect routed to its suspected owning lane.
3. **Wave 2 handoff notes**: judgment items you observed but must not decide.

You fix nothing. You write no Linear records. You do not modify `status.json`.

## Modes

**Mode A — fixture & regression (default; runnable today).** Drives the demo fixture world
(`?mockPooling=1`), the local fork read side (registered pools, no cycles or commitments),
seeded Storybook states,
and the package suites. No availability-ledger flip; no on-chain writes.

**Mode B — co-piloted live loop on production Arbitrum (explicit dispatch, Afo present).**
Real transactions in the two sanctioned test gardens — GG Community Garden
`0xf401f34378384713222d1d21f63359cc4E8a858a` (root garden; poolId 1, PROTOCOL) and Aiyeloja
Family Garden `0xF7b892886998DAe960D64a9db488336684F137A0` (poolId 2, GARDEN) — driven through
the local surfaces over the production mirror stack, in Afo's default authenticated Brave (via
the extension path; never a fresh instance or isolated profile). Adds the temporary
availability-ledger flip (§ Environment; revert mandatory, never committed). **The agent never
signs**: every wallet confirmation and every passkey ceremony is Afo's, under § Co-pilot
signing protocol. Decided 2026-08-24 in chat; this replaces the earlier fork-fixture Mode B —
the local-fork steward fixture is no longer a Wave 1 dependency.

**In neither mode (record once each as external blockers, then move on):**

- Staging identity flows — staging (`staging.greengoods.app` / `staging-admin.greengoods.app`)
  runs a separate passkey namespace, so staging sign-ins produce throwaway smart accounts with
  no hats or history until the PRD-832 rollout lands (PR #763 revised the spec; the switch is
  not flipped).
- Hosted-indexer read-back — hosted Envio introspection at 2026-08-23T01:57:01.622Z had no
  `CommitmentPool` type (readiness review P1). Every "hosted read-back" and "authenticated
  production runtime" acceptance row stays BLOCKED until that deployment happens.
- Live settlement lifecycle — authorization-gated (value caps at zero, executor paused). The
  settlement copy states are proven via Storybook and suites only; Dispatched or
  executed/acknowledgment-pending is never reported as arrived.
- Real-device installed-PWA passes — Wave 2 (human).

## Present state (verified 2026-08-24; re-verify cheaply before trusting)

**What is merged and where QA runs.** All three D1 surfaces are on `develop`. The reviewed
release candidate is the #752 merge commit `2cd115a1d`. QA drives `develop` on the local
stack; no feature branches remain.

**Live chain ground state (read via RPC 2026-08-24; re-read at preflight).** Pooling module
`0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a` is unpaused on Arbitrum One. GG Community Garden
holds poolId 1 (**PROTOCOL** — it is the root garden); Aiyeloja Family Garden holds poolId 2
(**GARDEN**). Both pools: state READY, empty charterCID, no cycles, zero commitments — so the
remaining setup (charter → open → seed cycle → open cycle) is itself Mode B's first stage, and
the already-READY start means the admin first-run wizard must resume mid-sequence from chain
reads, an acceptance case in its own right. `SettlementModule`
`0x15c8F6CF25abA2161cc04719b4C4a93c4146935D` and the Celo executor `0xB8a7…a84F` are both
paused with `authorityEnabled: false` — settlement stays observe-only and this QA needs zero
Celo transactions. The family garden sits on the public visibility filter
(`packages/shared/src/config/garden-visibility.ts:50-54`, "carries test work"): editorial live
checks use GG Community, and the family garden being absent from public surfaces is expected,
not a defect. Client login supports both passkey and wallet
(`packages/client/src/views/Login/index.tsx`), and passkey signing has **no session-key
layer** — the smart account's owner is `toWebAuthnAccount({ credential })`
(`packages/shared/src/workflows/auth-passkey-adapters.ts:97-100`), so every passkey-side
transaction is its own biometric ceremony.

**Availability is a build-time ledger, and it is off everywhere.**
`packages/shared/src/ontology/green-goods-projections.json:198-238` holds
`entity:commitment-pool` chain `42161` at `integration: partial, availability:
deployed-not-available` (and `11155111` at `not-deployed`; every other chain id is
`unknown-chain`). `selectCommitmentPoolingAvailability`
(`packages/shared/src/modules/commitment-pooling/selectors.ts:10-27`) therefore disables
every gated query on the local stack (also chain 42161) and in production. Consequences you
must not misread as defects:

- The garden **Pool tab does not render at all** without `?mockPooling=1`
  (`packages/client/src/views/Home/Garden/gardenTabs.tsx:20-28` via `hasPool` at
  `views/Home/Garden/index.tsx:309`). Absent tab ≠ empty tab.
- Pooling mutations throw "unavailable on this chain"
  (`packages/shared/src/hooks/commitment-pooling/useCommitmentMutations.ts:216`).

**The demo fixture world (`?mockPooling=1`) and its exact reach.** DEV-only
(`packages/shared/src/modules/commitment-pooling/demo/demo-mode.ts:22,50-69`; persists in
`sessionStorage["greengoods_dev_mock_pooling"]`; flipping either way evicts all
`["greengoods","commitment-pooling",…]` queries). It forces availability to `available`
(`selectors.ts:16`) and seeds 3 pools / 2 cycles / 21 commitments (ids 1001–1021) / 4 claim
requests / 17 contributor rows (`demo/demo-builders.ts:22-54`): garden
`0xf401f34378384713222d1d21f63359cc4e8a858a` (GG Community Garden, pool 101 OPEN), the
protocol garden (TAS HUB, protocol pool 1), and a paused garden (pool 102 PAUSED). The
fixture viewer is keyed off `mockAuth` (`demo/demo-mode.ts:76-85`), so `mockAuth=user` and
`mockAuth=deployer` see different seats.

- **Wrapped readers (fixtures work):** the 8 in
  `modules/commitment-pooling/data.ts:28-55` — `getCommitments`, `getCommitmentDetail`,
  `getCommitmentClaimRequests`, `getCommitmentWorkAttributionsByWork`, `getCommitmentPools`,
  `getCommitmentPoolDetail`, `getCommitmentCycles`, `getCommitmentCycleDetail` — plus
  documents via `demoDocumentFor` (`demo/demo-gate.ts:34-38`).
- **Unwrapped (fixtures do NOT reach; empty under the flag is expected, not a defect):**
  `getCommitmentActivity`, `getPoolMemberHistory`, `getPoolClaimRequests`,
  `getFallbackConfirmationCandidates` (`data.ts:56-63`), the two To-confirm readers
  (`hooks/commitment-pooling/useCommitmentsToConfirm.ts:268,280` — so the drawer's
  **To confirm tab stays absent** under the flag), everything in `data-settlement.ts`, and
  **both editorial reader families** (`data-public-pools.ts:216`,
  `data-public-impact.ts:107`) — `/gardens/:id` and `/impact` always read the live indexer.
  `useProtocolPool` (`hooks/commitment-pooling/useProtocolPool.ts:17`) reads the chain
  directly via wagmi, so the `/community/pools` protocol card reflects the fork, not
  fixtures.
- **Writes are deliberately blocked in demo mode** and must stay visibly queued:
  `useCommitmentMutations.ts:210-212`, `useCommitmentPoolMutations.ts:101-103` throw a demo
  notice; queued jobs return `{status:"waiting", reason:"demo-mode"}`
  (`modules/job-queue/job-executors.ts:260-262`). A send that *succeeds* under the flag is a
  release-blocker finding.
- **`canManage` is NOT demo-gated** (`packages/admin/src/views/Garden/Pool/index.tsx:91`,
  from `useGardenRoles` against the real indexer). The mock operator address is
  `0x04D60647836bcA09c37B379550038BdaaFD82503`
  (`packages/shared/src/providers/DevAuthProvider.tsx:30`). Whether that address stewards
  the demo garden in your local indexer decides whether the steward console shows the live
  console or only its fallback casts — probe it in Phase 0, branch accordingly, and record
  which branch ran.
- **Admin leaks demo fixtures into IndexedDB.** The client guards its persisted cache
  (`packages/client/src/App.tsx:112-127`); admin has no such guard, so demo pooling reads
  persist to `gg-admin-react-query` and outlive the flag. Clear admin IndexedDB/site data
  between flag states, and note this as a standing dev-only trap (decision 5 for Afo).

**Local data reality (Mode A).** The Anvil fork (port 3009, chain 42161) mirrors real
Arbitrum One state at its fork block — as of 2026-08-24 mainnet holds the registered pools
(READY, no cycles, zero commitments), so a fresh fork shows the same; re-read at preflight
rather than trusting any snapshot. There is **no local pooling seeder**
(`scripts/dev/seed-test-data.ts` seeds gardens/actions/work only; `backfill-pools.ts` is a
gated mainnet release op — do not repurpose it). Live populated states come only from Mode B
UI-driven creation or the future hosted deployment.

**Auth and presentation flags.** `?mockAuth=deployer|operator|user|disconnected`
(`DevAuthProvider.tsx:22-32`; DEV-only; identity only — roles still resolve from real
indexer/contract data). `?presentation=pwa|website|auto`
(`packages/shared/src/utils/app/pwa.ts:17-18,190-243`) — use `pwa` for app flows, `website`
for editorial.

**Known open items this wave must re-verify or measure (regression set):**

1. React Compiler vs `form.watch()` — composer chips/cards/action rows were inert in the
   running app while 21 jsdom tests passed; fixed with `useWatch` (`ee073089f`). jsdom runs
   without the compiler, so this class is invisible to suites: **interaction proof in this
   wave means clicking and typing in the browser, never DOM-presence alone.**
2. Lowercase pool garden address vs checksummed gardens list → "Garden not found"
   (`d8e7edb35`).
3. Stewards wrongly seated as ordinary confirmers in To confirm (`8a832021c`).
4. Paused pool with no commitments hid the stewards' pause reason (`d8e7edb35`).
5. Commitment row titles truncated to ~3 characters beside the state chip on a phone
   (`4395dfd14`).
6. "promises" vocabulary violation on the readiness row (`30d8a6338`).
7. Deferred, still open (confirm still-open, do not fix): the composer draft is captured once
   at mount and not reloaded when its key changes; linked Work navigates under the Work's
   garden instead of the commitment's pool garden (`WorkFulfills`).
8. From the 50-thread PR #749 feedback ledger, probe the fix classes: cycle-less option
   rewritten to first open cycle; `clientOperationId` minted per tap (double-tap must not
   produce `WorkAlreadyLinked`); protocol-pool creation doors hidden from ordinary members;
   roster cap 40 / 41st Work-link rejection; deep link into a paused pool; demo query
   eviction before write re-enable.
9. Admin: `AdminTabRail` does not scroll the active tab into view; at 465px the Garden rail
   overflows by 31px with Pool added and Hub's Confirm tab sits off-screen. Re-measure and
   report; judgment goes to Wave 2.
10. Admin a11y knowns: validation errors not linked via `aria-describedby`; `AdminButton
    size="sm"` row acts (59 uses) under the 44px touch target; light mode proven only through
    the Storybook build. Measure and report; do not fix.
11. `bun run check:design-generated` is red on a stale
    `docs/docs/builders/packages/client-pwa-token-audit.generated.md` from #749. Pre-existing;
    record, don't chase.
12. 23 unresolved review threads remain across the merged PRs (#748: 5, #749: 10, #752: 8).
    Skim them once; where a thread names testable behavior, fold it into your checks; list
    the rest for Afo (decision 4).

## Authoritative inputs (read in this order)

1. `handoffs/claude-qa-pass-1.md` — the lane contract and the two-wave structure this prompt
   implements. Its acceptance bullets bind the whole lane; § Wave structure maps which wave
   proves what.
2. `acceptance-matrix.md` — cite rows by section + leftmost cell + line: §1 state/copy matrix
   (`:8-45`), §3 public claim / forbidden-wording matrix (`:164-181`), §4 role/route/state
   journeys (`:182-196`). §2 is mostly suite-proven; consult its UI-assertion column only
   where a row names a rendered surface.
3. `handoffs/commitment-view-state-reference.md` — the generated 82-state cast/seat/phase
   contract for the commitment detail screen. Phase decides affordances, seat decides person;
   a seat with no act gets **no** bar, not a disabled one. Never hand-edit it.
4. `packages/shared/src/modules/commitment-pooling/demo/{demo-world,demo-builders,demo-commitments}.ts`
   — the fixture inventory you will walk.
5. `uiux-spec.md` §4 state tables and §6 admin subsections — consult per screen; do not read
   whole.
6. Precedent evidence bars and their reports: `prompt-client-loop.md`,
   `prompt-admin-console.md`, `reports/client-loop-2026-08-21.md`,
   `reports/admin-console-2026-08-21.md`, `reports/client-loop-pr-feedback-2026-08-22.md`.
7. `reports/production-readiness-review-2026-08-22.md` — the environment blockers and the two
   QA-owned BLOCKED rows this wave inherits.

## Environment

**Stack — Mode A (fixture & regression).** Use the repo-native stack; never raw dev servers.

```bash
npx pm2 list                     # is a stack already up? whose? reuse it, never restart it
bun run dev:doctor -- --profile full
bun run dev                      # only if nothing is up
bun run dev:health && bun run dev:smoke:full
```

Client `https://localhost:3001` · admin `https://localhost:3002` · Storybook
`http://localhost:3004` · Hasura GraphQL `http://localhost:3006/v1/graphql` (local admin
secret `testing`) · Anvil fork `http://127.0.0.1:3009` (chain 42161). Indexer requires
Docker; `ENVIO_API_TOKEN` must be set or HyperSync 429s. Tool shells may not have mise active
— a bare `node` can be v18; prefer `bun` and the repo scripts.

**Stack — Mode B (production mirror).**

```bash
npx pm2 list                     # never restart a stack another session owns
bun run dev:prod:mirror:health
bun run dev:prod:mirror          # local surfaces + local Envio indexing live Arbitrum One
```

The mirror is what makes real writes readable: the hosted indexer has no pooling schema, so a
local Docker Envio indexes Arbitrum One directly and the surfaces read it. Docker and
`ENVIO_API_TOKEN` are required, and the mirror must be at (or within a few blocks of) chain
head before any read-back claim. Writes here are **real Arbitrum One transactions** — only
the two sanctioned test gardens are in scope, and only Afo signs. `mockAuth` and
`mockPooling` must be absent (clear sessionStorage on both origins); the availability-ledger
flip below is what turns the real surfaces on.

**Browser channel.** Visible-UI claims follow the repo rule: authenticated Brave through the
Claude-in-Chrome extension path (Codex: its extension path per `AGENTS.md`). Preflight it:
the extension must show a connected browser before the run starts (Brave open, extension
signed in), and the computer-use allowlist is granted per session — request Brave Browser
access once at C0 (it arrives read-tier: screenshots for verifying wallet prompts and
extension-unreachable states, never a driving path). If the extension channel is unavailable,
functional findings you can still gather remain valid findings, but label every
rendered-proof acceptance row **BLOCKED (authenticated browser unavailable)** — never
substitute an isolated Playwright/Browser-pane profile as authenticated proof.

**Entry URLs.**

- Mode A client fixture world:
  `https://localhost:3001/home?mockAuth=user&presentation=pwa&mockPooling=1`
  (repeat key walks with `mockAuth=deployer`; `mockPooling=0` to leave).
- Mode A admin: `https://localhost:3002/garden/pool?mockAuth=operator&mockPooling=1` (and
  `mockAuth=deployer`); clear admin IndexedDB between flag states.
- Editorial (both modes): `https://localhost:3001/gardens/<gardenAddress>?presentation=website`
  and `/impact` — no auth, no fixtures; these read the live local indexer.
- Mode B client: `https://localhost:3001/home?presentation=pwa` (no mock params — real
  passkey/wallet auth). Mode B admin: `https://localhost:3002/garden/pool` (wallet connect).

**Mode B only — availability-ledger flip.** Exactly the procedure the build prompts used:
flip chain 42161 `entity:commitment-pool` to `integration: integrated, availability:
available` and regenerate (`bun run ontology:generate`), QA, then **revert both**
`packages/shared/src/ontology/green-goods-projections.json` and
`packages/shared/src/ontology/agent-manifest.generated.json` before finishing. Never commit
the flip; your final `git status` must not contain it. After reverting, evict caches (client
and admin IndexedDB) and re-verify the Pool tab is absent again.

## Co-pilot signing protocol (Mode B)

Afo signs everything; the agent drives everything else — navigation, forms, uploads, state
verification, mirror checks, evidence capture. The run concentrates his presence into a few
windows instead of an hour of interruptions.

- **Announce each phase** before it starts: what is coming and roughly how many signatures it
  needs ("W1: pool setup + seeding, ~12 wallet confirmations").
- **One prompt at a time.** Tee up a single transaction, then say exactly what is about to be
  signed: step name, expected signer (wallet or passkey), expected call. Never stack pending
  wallet popups.
- **Verify before asking.** Before requesting a signature, confirm the teed-up transaction is
  what the plan expects: target is the pooling module (or another known repo contract), chain
  42161, zero native value, no token approvals. Where computer-use screenshot access is
  granted, read the wallet prompt itself as part of this check — under the computer-use MCP,
  browsers are **read-tier** (visible in screenshots, never clickable), so the popup can be
  inspected but not touched, which enforces the no-agent-signing rule by construction. On any
  mismatch, do not ask Afo to sign — stop, show the decoded request, and wait for his call.
- **Friendly window, then park.** Once the prompt is up, wait patiently: poll the UI/chain
  outcome every 10–15 seconds for up to **3 minutes**. On success, verify the landed state and
  continue. If the window lapses: send one friendly nudge, leave the run parked at that step
  (never skip it, never re-fire the transaction blind), and spend the wait on non-dependent
  verification work. Parked longer than ~30 minutes: checkpoint progress into the report with
  a resume note and end the session gracefully — a lapsed window is a pause, not a failure.
- **Rejections are also his.** The trigger sweep asks Afo to reject each prompt; the agent
  verifies the rejection-recovery state afterward.
- **Never** click a wallet confirmation, complete a WebAuthn ceremony, or enter a wallet
  password. Wallet unlocks at phase starts are Afo's (extensions re-lock after idle — expect
  ~3 unlocks across the run).
- Cost notes: each passkey-side transaction is one biometric touch (no session keys) and its
  userOp spends the production Pimlico sponsorship budget; wallet-side transactions spend
  normal gas from Afo's EOA.

## Method

Work the phases in order. End each phase by appending its coverage rows and defects to the
report before starting the next, so an interrupted session still leaves a usable record.

**Phase 0 — preflight and suite baseline (Tier SUITE).**

1. Record target SHA, stack ownership, doctor/health/smoke results.
2. Probe steward capability — it has two gates: `canManage` resolves from the indexer
   (`useGardenRoles`; read the hook for the real field names, then query local Hasura) and
   `isPoolSteward` resolves from an on-chain `GardenAccountABI` read against the fork. Probe
   both for `mockAuth=operator` and `mockAuth=deployer` on the demo garden and one fork
   garden (the admin session found `deployer` the more capable mock on the local mirror).
   Record the result; it selects the Phase 2 branch.
3. Run and record the suite baseline (these already prove the ~70 suite-tier acceptance rows;
   you do not re-prove them by hand):
   `bun run --filter @green-goods/shared test`,
   `bun run --filter @green-goods/client test`,
   `bun run --filter @green-goods/admin test`,
   `bun run --filter @green-goods/indexer test`, and `bun run lint:vocab`.
   The contracts suite is Mode B / dispatch-optional: the readiness review re-ran its live
   checks against the deployed candidate on 2026-08-22.
4. Confirm Storybook serves the pooling stories (`http://localhost:3004`).

**Phase 1 — client PWA fixture walk (Tier FIXTURE).**

1. Under `mockAuth=user … mockPooling=1`: from `/home`, open the demo garden's Pool tab. Walk
   the cycle rail, direction chips, and every fixture commitment 1001–1021. For each: open
   the detail, and check chip, **rendered sentence** (the §1/§3 copy rules — member-facing
   copy never shows the internal state noun; "Support on its way", not `Queued`), seat/phase
   affordances against the state reference (bar present only when this seat has an act), and
   history/provenance rows where the fixture provides them (fallback provenance: actor, path,
   and reason distinct).
2. Exercise the composer both directions (`/home/<garden>/commitments/new?direction=offer`
   then `request`) through every beat to Review and submit: the act must **visibly queue and
   never send** (demo-mode wait state). Click and type through every chip/card/action row —
   interaction proof, not DOM presence (regression 1). Repeat the submit tap twice where the
   UI permits (regression 8 idempotency).
3. Proof composer beats (`…/commitments/<id>/proof`): media → details → review, queued
   outcome, `NotYours` guard via a commitment the viewer does not own.
4. Confirm/withdraw/claim overlays where fixture seats allow: ConfirmSheet variants, NotYet
   with reason, withdraw pre-acceptance.
5. CommitmentsDrawer: Live and Over time tabs group correctly; **To confirm absent under
   fixtures is expected** — note it as a reachability gap, not a defect.
6. Switch to `mockAuth=deployer` and re-walk the seat-sensitive screens (different viewer,
   different person in the sentences).
7. Availability-off run (`mockPooling=0`): Pool tab absent (not empty), zero pooling network
   traffic, `/home` otherwise healthy.
8. Mechanical accessibility + locale presence per major screen: labels/accessible names,
   focus order and Escape behavior on sheets/dialogs, keyboard reachability, touch-target
   measurements, reduced-motion toggle honored, and an `es` + `pt` render of the same screens
   (missing-key or overflow breakage only; tone judgment is Wave 2). Console must be free of
   uncaught errors on every route visited — record any.

**Phase 2 — steward console (Tier FIXTURE where reachable, STORYBOOK elsewhere).**

1. `/garden/pool` with fixtures: if the Phase 0 probe gave the mock operator steward rights,
   walk the pool status card, cycles card, commitments card (claims card reads an unwrapped
   reader — empty is expected); otherwise verify the five `PoolStatusCasts` fallbacks render
   correctly and continue in Storybook.
2. `/community/pools`: garden pool card from fixtures; protocol pool card reads the fork —
   verify it renders fork truth (the registered-pools world; protocol pool present).
3. `/hub/confirm`: live empty state; seeded queue states via the `Admin/Hub/HubConfirmQueue`
   component stories (Queue/Empty/Loading/ReadError) — the route story is deliberately
   shell-only.
4. Setup and seeding flows via their stories (`Admin/Pool/PoolSetupFlow` FirstRun / NewSeason
   / Campaign / OpenPreparedSeason, `SetupFailure`, `SeedCommitmentDialog` and the four Seed
   steps): every step, failure, and footer state renders and its copy matches §1. The six
   ordered setup writes are exercised for real only in Mode B.
5. Commitment inspector states via `Admin/Pool/CommitmentDialogStates` and companion stories
   (facts, timeline, claims, actions, alerts, recovery, resolve/reason dialogs).
6. Re-measure regressions 9–10 (tab rail at 465px, `size="sm"` touch targets,
   `aria-describedby` absence) and record numbers.

**Phase 3 — editorial / public (Tier LIVE for gate states, STORYBOOK for populated states).**

1. `/gardens/<fork-garden>` § 02 Commitments: the honest pre-launch cast ("preparing its
   pool") against a fork garden whose pool has no open season; read-failure copy only if it
   occurs naturally (do
   not kill the indexer to force it — the ReadError story covers it).
2. `/impact`: the commitments band in its live unavailable/nothing-yet cast.
3. Populated, threshold, and lifecycle states via stories:
   `Client/Public/GardenDetail/CommitmentsSection` (Record, CountsOnly, BetweenSeasons,
   Paused, Closed, Composted, PreLaunch, Ready, EmptyPool, EmptyOpenSeason, ReadError,
   MissingCycleName) and `Client/Public/PublicCommitmentsBand` (Live, CountsOnly, NothingYet,
   PartialRead, Unavailable). The kept-rate suppression logic (≥5 due and ≥3 distinct
   providers) is suite-proven in `commitment-editorial.test.tsx`; verify the rendered wording
   only.
4. Forbidden-wording sweep (§3) across every editorial pooling surface rendered, plus a
   privacy spot-check: no provider addresses, no provider-level outcomes, no
   cancelled+disputed counts on public pages.

**Phase 4 — cross-surface vocabulary and state-noun discipline.**

For each state family in §1, confirm the three surfaces disagree only in the sanctioned ways:
internal nouns may appear in steward-facing admin chips, never in member sentences, never in
public claims; "commitment" never "promise"; the on-chain `operator` role renders as
"steward" in admin copy. In Mode A the fixture worlds differ per surface, so this is a copy
consistency check, not a data consistency check — say so in the report.

**Phase 5 — Mode B: the co-piloted production live loop (only if dispatched, Afo present).**

Run the identity relay below under § Co-pilot signing protocol. Client (`:3001`) and admin
(`:3002`) are separate origins, so the passkey and the wallet stay signed in simultaneously;
only the client tab switches identity, twice. Per-act classification: **COMPLETE** (Afo
confirms; the state advance is needed downstream) · **TRIGGER** (reach the wallet sheet,
verify the decoded request, Afo rejects, verify recovery) · **OBSERVE** (no transaction).

**C0 — Identities (~3 signatures, ~5 min).** Flip the ledger (§ Environment), bring up the
mirror stack, clear both origins' storage. Afo creates a fresh localhost passkey in the client
(production-origin passkeys cannot work on localhost — WebAuthn is origin-bound) and connects
his wallet in admin. Record the passkey smart-account address. Preflight re-reads: both pool
states on-chain, mirror at head, roles for both identities.

**W1 — Steward setup, admin tab (~12 confirmations, all COMPLETE).** Family pool:
`setPoolCharter` (real charter pin) → provider cap if unset → `openPool` → `seedCycle`
(Season) → `openCycle`. Protocol pool (GG Community): charter → `openPool` → seed + open a
**Campaign**. Add the C0 passkey address as a **Family Garden gardener**. Seed **3 claimable
Offers** via the admin seed dialog. The pools start READY, so the first-run wizard must resume
mid-sequence — record how it judges already-done steps. Commitment wording must read as real
records, never "test test" (protocol-pool records become publicly visible once the hosted
indexer ships).

**P1 — Gardener, client tab as passkey (~9 touches, all COMPLETE).** Claim seeded Offers A
and B; compose Offer #1 and Request #1; compose one short-deadline Offer (expiry fixture) and
one throwaway Offer then withdraw it (reason-pinning check); submit evidence with real media
on Offer A and send it for confirmation. Then the **real offline proof**: network actually off
(DevTools → Network → Offline, or OS-level), enqueue a commitment act plus a proof with media,
reload while offline, confirm job and media survive, restore network, and let the queue drain
— the drain fires Afo's biometric prompts one by one, which is itself the queue acceptance.
Synthetic `window.dispatchEvent(new Event("offline"))` is **not** valid — the queue's
`isOnline` dependency reads `navigator.onLine`
(`packages/shared/src/modules/job-queue/default-dependencies.ts:80`).

**W2 — Member-EOA + steward decisions (~14 confirmations + 5 rejections).** Client tab
switches: passkey signs out, wallet signs in (client supports wallet login). Client side as
EOA: claim Offer #1, take up Request #1, submit its evidence, send for confirmation. Admin
side: **accept** claim A, **decline** claim B (supersession observed), Hub-Confirm Offer A to
Fulfilled (receiver-confirms — the Offer direction rule), one **NotYet with reason**, one
**dispute → resolve** on a dedicated commitment, **pause** the Family pool → agent verifies
paused states across client/admin/editorial → **resume**. Then the **trigger sweep** (all
TRIGGER, Afo rejects each): work approval (the canonical case), charter edit, provider-cap
change, cancel-cycle, and the admin expire act. Also verify settlement is **unreachable**
(rail disabled by design), not triggerable.

**P2 — Finale, client tab back to passkey (~2 touches).** Creator-confirms Request #1 (the
Request direction rule, proven on the opposite identity from W2's receiver-confirm). Agent
verifies Fulfilled, Story/provenance, and the drawer's Over-time grouping.

**A — Autonomous read-back (0 signatures).** For every transition: chain → mirror →
client/admin/editorial agreement. `/gardens/<gg-community>` § 02 live with real counts and the
kept rate correctly suppressed below thresholds; `/impact` band; the family garden **absent**
from public surfaces (visibility filter — expected); the short-deadline Offer has Expired and
admin past-due handling shows it; To-confirm behavior per identity; protocol-pool creation
doors hidden from the non-steward; double-tap idempotency and paused-pool deep-link probes;
locale spot-checks; console clean. Then revert the ledger flip, clear both origins'
IndexedDB, verify the Pool tab is absent again, and confirm `git status` carries no ledger
change.

Work linkage inside the loop: link an **already-approved** Work to a commitment (COMPLETE —
the gardens carry real approved work); fresh work approval stays TRIGGER, so DomainImpact
requirement counters advance only if the operator `syncApprovedWork` path is surfaced in
admin (then COMPLETE) — otherwise DomainImpact readiness is proven at partial states and
recorded as such.

Out of scope in Mode B, recorded not attempted: Offer-over-time/series and team/roster
(client D2), cycle close/compost/recognition (admin D2), settlement lifecycle and member G$
delivery (paused, `authorityEnabled: false` on both chains), hosted-indexer read-back,
staging identities, real-device passes (Wave 2). Expected totals: ~30 Afo-confirmed
transactions, ~5 deliberate rejections, zero Celo transactions.

## Report

Write `reports/qa-functional-wave-1-<YYYY-MM-DD>.md` with exactly these sections:

1. **Dispatch record** — date, mode, target SHA, browser channel, dispatch wording.
2. **What ran** — commands with pass/fail and counts; stack ownership; probe results.
3. **Coverage table** — one row per acceptance anchor you were in scope for: the
   acceptance-matrix row (section + leftmost cell + line), the state-reference id and/or
   fixture commitment id where applicable, and a proof tier:
   `LIVE` (driven against the running app) · `FIXTURE` (demo world) · `STORYBOOK` (seeded
   story) · `SUITE` (named test file) · `BLOCKED (exact missing capability)` ·
   `NOT-RUN (deferred | out-of-scope | needs-Mode-B)`. No row may pass by omission, and a
   lower tier is never reported as a higher one: fixture is not live, Storybook is not
   authenticated, suites are cited, not re-proven.
4. **Defects** — severity-ordered (`release-blocker` / `defect` / `polish`), each with
   surface, route, seat/state, expected-with-anchor, observed, evidence path, and suspected
   owning lane. Copy-vs-docs mismatches route to the PRD-727 docs-polish lane; product
   defects to their implementation lane. You fix nothing.
5. **External blockers** — the exact unavailable evidence, once each (hosted Envio schema,
   staging passkey namespace, settlement authorization, steward fixture, real device,
   browser channel if it was missing).
6. **Wave 2 handoff notes** — judgment items observed but not judged: layout/feel
   observations, locale tone questions, motion/dark-mode impressions, anything where you
   measured but the call is a design call.

Evidence files go in `reports/evidence/qa-wave-1/` named
`<surface>-<route-or-story>-<state>.png`. **Privacy rule: this repository is public and
`.plans/` ships in it.** Screenshots of the fixture world (synthetic actors) and Storybook
may be committed; any screenshot rendering real mainnet records — forked or Mode B live
captures with real garden names and member addresses — stays outside the repo: save those
under the session scratch directory and reference them by path in the report with a note that
the pixels are local-only. Mode B additionally records a **transaction ledger** in § What
ran: one row per COMPLETE act — relay phase, step, signer (wallet or passkey), transaction or
userOp hash, landed state. Hashes are public chain data and safe to commit.

When the report is complete, append a dated summary block (mode, coverage counts by tier,
defect counts by severity, blockers) under `## Wave 1 runs` in
`handoffs/claude-qa-pass-1.md` — append-only, never rewrite earlier entries.

## Boundaries

- Fix nothing, refactor nothing, and write no product code. Your only writes:
  `reports/qa-functional-wave-1-<date>.md`, `reports/evidence/qa-wave-1/**`, the append-only
  handoff block, and (Mode B, uncommitted, reverted) the two ontology ledger files.
- No Linear reads are needed and no Linear writes are permitted; Afo files issues.
- No `status.json` edits; no branch creation; no commits unless the dispatch authorized the
  report commit; never `git add -A` — stage named paths only.
- No dependency installs, no `.env` edits, no `.github` or config changes. Bun wrappers only;
  never raw `forge`.
- On-chain writes exist only in Mode B, only in the two sanctioned test gardens, and only
  through Afo's signatures. The agent never clicks a wallet confirmation, never completes a
  WebAuthn ceremony, never enters a wallet password, and stops the run on any prompt carrying
  native value or a token approval.
- Do not restart or stop a PM2 stack you did not start; do not touch other sessions'
  worktrees or diffs.
- Time budgets never justify skipping a gate: an unreachable check is `BLOCKED` with its
  reason, not silently dropped, and user cancellation is terminal — stop, report what you
  have.

## Decisions that return to Afo (record, do not guess)

1. **Resolved 2026-08-24 — Mode B posture.** Afo signs every wallet and passkey prompt
   himself (the reject-only and burner-steward autonomous postures were offered and
   declined), with the friendly-window protocol above. The fork steward fixture
   (`operations/local-fork-steward-fixture/`, decision 5 of the admin session) is superseded
   as a Wave 1 dependency; it stays a future option for unattended live runs.
2. **D2 finish-or-cut** for `ui_client` / `ui_admin` — the QA Pass 1 gate cannot clear while
   the lanes are `in_progress` with D2 unstarted. Meanwhile: this wave QAs what is merged.
3. **Settlement proof-limit note** — the manual gate wants exit-proof evidence or an explicit
   proof-limit record; drafting that record is Afo's call. Meanwhile: settlement states carry
   `STORYBOOK`/`SUITE` tiers and an external-blocker line.
4. **The 23 unresolved PR threads** — sweep them as their own pass (`/resolve-pr-comments`)
   or accept this wave's fold-in. Meanwhile: testable ones are folded in, the rest listed.
5. **Admin demo-fixture IndexedDB persistence** — mirror the client's persisted-cache guard
   or accept as a dev-only trap. Meanwhile: documented in § Present state and the report.
6. **Hosted Envio deployment timing** — outside QA control; unlocks live editorial, hosted
   read-back, and the two BLOCKED readiness rows.

## Stop conditions

- **Complete**: every coverage row in the dispatched mode's scope carries a tier label; the
  defect list and Wave 2 notes are written; the handoff append landed; (Mode B) the ledger
  flip is reverted and cache-evicted. Say what remains BLOCKED and why.
- **Blocked**: a named capability is missing (Docker, authenticated browser channel, steward
  fixture, demo-garden role). Finish everything not dependent on it, then report with the
  exact missing piece.
- **Out of scope**: anything that would mean fixing product code, broadcasting, writing
  Linear, or changing lane status. Record it as a decision or defect and continue.
