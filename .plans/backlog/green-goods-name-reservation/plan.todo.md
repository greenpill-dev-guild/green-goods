# Green Goods Name Reservation at Sign-Up Plan

**Feature Slug**: `green-goods-name-reservation`
**Stage**: `backlog`
**Status**: `BLOCKED` — awaiting founder decisions 1, 2, and 3 in [`spec.md` § Human Judgment Points](./spec.md#human-judgment-points)
**Created**: `2026-09-22T00:26:22Z`
**Last Updated**: `2026-09-22`

## Decision Log

Locked by evidence in [`spec.md` § Research Evidence](./spec.md#research-evidence). Everything the
founder still owns is in [`spec.md` § Human Judgment Points](./spec.md#human-judgment-points) and
is **not** listed here.

| # | Decision | Rationale |
|---|---|---|
| 1 | A reservation is a hold on a name for one account, not ownership of it | The contracts have no reservation concept: `_cacheRegistration` writes final ownership synchronously (`ENS.sol:286-303`), and the only mappings are `slugOwner`, `slugNameType`, `ownerToSlug`, `slugReleasedAt` (`:48-51`) |
| 2 | Registration stays exactly as it is: membership-gated, sponsored for passkey accounts, cross-chain | `claimName` and `claimNameSponsored` both revert `NotProtocolMember` (`ENS.sol:118`, `:128`). Reserving before membership is the whole point; registering before it stays impossible |
| 3 | The slug rules are the naming rules; the sign-up field adopts them | They are what the contract enforces (`_validateSlug`). A name that cannot be a slug cannot become a Green Goods name, so accepting it at sign-up only defers the failure |
| 4 | Sign-up calls the existing `validateSlug` and `suggestSlug`; no new rule text | The rules are already duplicated in four places and documented as needing to stay in sync (`ens.ts:28-30`). A fifth copy is a defect waiting to happen |
| 5 | The availability check never blocks account creation | Sign-up is the first thing a new gardener does and `isSlugAvailableAcrossChains` fails closed on RPC error (`useSlugAvailability.ts:49-50`). The reservation is what fails, not the account |
| 6 | One reservation per account, no transfer between accounts | Mirrors the contract's one-name-per-address invariant (`ownerToSlug`, `AlreadyHasName`, `ENS.sol:296`) so the off-chain and on-chain models cannot disagree |
| 7 | If the reservation is off-chain, it reuses the garden join-request shape | Signed, expiring, revisioned, keyed by account address, already built and reviewed in `packages/agent/src/api/routes/garden-join-request-*.ts`. A second bespoke pattern earns nothing |
| 8 | Existing usernames are never invalidated or rewritten | The username's real job is finding a credential on another device (`views/Login/index.tsx:113-117`); it is not bound to the account address (`auth-passkey-adapters.ts:132-138`). Rewriting it risks recovery for no domain gain |
| 9 | Migration is lazy, at next sign-in, never a batch | Usernames live in `localStorage` and the passkey server; slug mappings are not enumerable on-chain. There is no list to iterate |
| 10 | A wallet with a mainnet ENS name is already named; that is a display rule, not a registration | A `*.greengoods.eth` subname is minted to the receiver contract (`ENSReceiver._setENSRecords`); a mainnet name cannot move into it, and registering a matching slug would give one account two names |
| 11 | The Green Goods name stays the domain identity; the username is an input to it | The ontology deliberately keeps the passkey out of domain vocabulary ("Authentication credential; account infrastructure, not domain vocabulary"). Promoting a credential handle into the domain would contradict that without need |
| 12 | Any on-chain reservation rides the sender v2 in `ens-l2-sender-admin-recovery`, never its own deployment | The deployed Arbitrum sender is a direct contract, not a proxy (that hub's `spec.md:36`), so an on-chain reservation means a new deployment and a state migration that the hub already has to do |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror — garden join requests (signed, expiring,
      account-keyed agent store)
- [x] List human judgment points before implementation — seven, in `spec.md`
- [x] Define what is out of scope — `brief.md § Scope Notes`
- [x] Choose the lightest honest validation commands — see Validation below
- [ ] **Founder answers questions 1, 2, and 3.** Steps 3 onward cannot be sequenced without them

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| R1 A name accepted at sign-up can become a Green Goods name | `state_api`, `ui` | Steps 2, 5 | ⏳ |
| R2 A reservation holds a name across every path the app controls | `state_api` | Steps 3, 4, 6 | ⏳ |
| R3 A reservation is not a registration | `ui`, `state_api` | Steps 1, 5, 6 | ⏳ |
| R4 Registering a reserved name is the existing claim, unchanged | `state_api` | Step 6 | ⏳ |
| R5 A reservation ends on a stated, visible condition | `state_api`, `ui` | Steps 3, 6 | ⏳ |
| R6 A wallet with a mainnet ENS name is already named | `ui` | Steps 7, 8 | ⏳ |
| R7 Existing accounts keep working | `state_api`, `ui` | Step 7 | ⏳ |
| R8 One documented name-resolution rule on every surface | `ui`, `state_api` | Step 8 | ⏳ |

## TDD / Proof Order

- [ ] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first
- [ ] Run the RED command and record evidence in the lane handoff
- [ ] Implement the smallest change that can satisfy the proof
- [ ] Run the GREEN command and record evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Implementation Steps

Dependency order is ontology → shared → agent → client, with the contract lane conditional on
founder question 1. Steps 1 and 2 are safe to start once questions 2 and 3 are answered; step 3
needs question 1.

### Step 1: Name the concept in the ontology

**Files**: `packages/shared/src/ontology/green-goods-ontology.json`, regenerated projections
**Details**: Add the Green Goods name as a domain concept and a `name-reservation` state machine
(`reserved → registering → registered`, plus `expired` and `displaced`) with
`source_status: "specified"`, naming this hub as the governing specification and its planned
source anchor, per `ontology.md § Specified-source semantics`. Do not add a `username` or
`passkey` entity: decision 11. Regenerate with
`node scripts/quality/check-ontology.mjs --generate`; never hand-edit a projection.
**Verification**: `bun run check --only ontology` passes and the new entry appears in the
generated projections.

### Step 2: A single place that answers "can this account reserve this name?"

**Files**: `packages/shared/src/modules/ens/name-reservation.ts` (new), its test
**Details**: A pure function composing what already exists: `validateSlug` for shape,
`isSlugAvailableAcrossChains` for both chains and the 30-day cooldown, and the reservation store
for holds. It returns a discriminated result — available, invalid with the existing message,
registered, reserved by someone else, or unknown when a read failed — so callers never have to
re-derive the reason. No new rule text (decision 4).
**Verification**: unit tests for each branch, including the RPC-failure branch returning
`unknown` rather than `false`.

### Step 3: The reservation store and its routes (off-chain path)

**Files**: `packages/agent/src/api/routes/name-reservation*.ts` (new),
`packages/agent/src/services/db/name-reservations.ts` (new), API test
**Details**: Mirror the join-request contract exactly (decision 7): signed proof of the account,
one active reservation per account, revision and idempotency nonce, `expiresAt` from the answer to
question 2, and a stage-reporting failure log that never keeps a raw error. Reads answer one
question — "is this name held, and by whom" — and must not enumerate accounts or names.
**Verification**: API tests for create, replace, expire, conflict with another account, and a
rejected signature.
**Blocked by**: founder question 1. If the answer is on-chain, this step becomes a requirement on
`ens-l2-sender-admin-recovery` instead (decision 12).

### Step 4: The reservation hook

**Files**: `packages/shared/src/hooks/ens/useNameReservation.ts` (new), its test
**Details**: Read and write the reservation for the current account, with query keys under
`ensKeys` so the existing invalidation in `useENSClaim` (`ensKeys.all`) already covers it.
**Verification**: hook tests for held, expired, displaced, and none.

### Step 5: Normalize and confirm at sign-up

**Files**: `packages/client/src/views/Login/index.tsx`,
`packages/shared/src/hooks/client-ui/auth/useLoginScreenController.ts`, i18n `en`/`es`/`pt`
**Details**: Show the slug the typed name becomes (`suggestSlug`), report the result from step 2
inline, and let the person accept or edit it. The account is still created when the check cannot
run (decision 5); the reservation is then deferred to the next sign-in. Keep the existing
three-character floor and the existing error copy for the too-short case.
**Verification**: tests for a clean name, a name needing normalization, a taken name, and an RPC
failure that still creates the account.

### Step 6: The claim form and the reminder consume the reservation

**Files**: `packages/client/src/views/Profile/ENSSection.tsx`,
`packages/client/src/routes/ENSClaimReminder.tsx`, i18n
**Details**: Prefill from the reservation rather than re-deriving a suggestion, say how long the
hold lasts, and re-check at claim time so a displaced reservation is reported plainly rather than
failing as a generic `NameTaken`. The reminder names the held name instead of inviting the person
to invent one.
**Verification**: tests for held-and-available, held-but-displaced, and no reservation.

### Step 7: Lazy migration at sign-in

**Files**: `packages/shared/src/hooks/ens/useNameReservation.ts`, one client call site, i18n
**Details**: On sign-in, an account with no Green Goods name and no reservation is offered one,
seeded from its stored username through `suggestSlug`. An account whose wallet resolves a mainnet
ENS name is skipped entirely (decision 10). Offer once, remember the answer the way
`ENSClaimReminder` already does.
**Verification**: tests for a valid username, an invalid one, an already-registered account, and a
wallet with a mainnet ENS name.

### Step 8: One name-resolution rule on every surface

**Files**: `packages/shared/src/utils/app/text.ts` or a new resolver, plus the client and admin
call sites that currently each decide for themselves
**Details**: Apply `Green Goods name → wallet ENS name → chosen passkey username → shortened
address` from one exported helper. The public site cannot read the chain
(`check-pwa-precache-budget.mjs:34-35`), so this step also settles where its names come from,
which is founder question 7.
**Verification**: a guard test that the surfaces listed in `spec.md` all resolve through the
helper.

### Step 9 (conditional): On-chain reservation

**Files**: `packages/contracts/src/registries/ENS.sol` (sender v2), tests, migration runbook
**Details**: Only if founder question 1 is answered "on-chain". Adds `reserve(slug)` writing a
`(slug → address, expiresAt)` mapping that `_cacheRegistration` consumes and `available()`
respects. Belongs to the sender v2 already required by `ens-l2-sender-admin-recovery`
(decision 12), including its state migration from events or the L1 receiver, since L2 mappings
are not enumerable.
**Verification**: Foundry tests for reserve, claim-your-reservation, claim-someone-else's,
expiry, and interaction with the 30-day cooldown.

## Test Strategy

- **Unit**: the reservation decision function (step 2) is the one place with branching logic and
  takes the densest tests, including the fail-open-on-unknown branch. Slug rules themselves are
  already covered by `packages/shared/src/__tests__/utils/ens.test.ts` and need no new copies.
- **Integration**: agent API tests for the store, following
  `packages/agent/src/__tests__/garden-join-requests.api.test.ts`, including a test that no raw
  error and no account list ever reaches a log or a read response.
- **E2E / Playwright**: sign-up with a name needing normalization, and sign-up while the chain
  reads fail, proving the account is still created.
- **Manual checks**: a real claim on a reserved name end to end, including the ~15–20 minute wait,
  on the authenticated Brave QA profile.
- **TDD proof**: RED/GREEN recorded per lane and summarized in `status.json`.

## Validation

- [ ] `bun run check --plan -- --intent <intent>` rendered before running anything
- [ ] `bun format && bun lint`
- [ ] `bun run check --only ontology` (step 1)
- [ ] `bun run check --only vocabulary` and the three locale files (steps 5, 6, 7)
- [ ] Targeted package tests per lane, then `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
- [ ] Sign-up and auth changes are `critical` (`values.md § Criticality Matrix`): full local
      override plus current-head CI before any readiness claim
