# Work Linking Closure Handoff

**Status:** Source complete; targeted re-review passed
**Owner:** Codex
**Branch:** `develop`
**Parent:** PRD-650
**Linear issue:** PRD-837
**Source HEAD:** `29c935fb6b2420be289b7e47dcbb84b2a8edd327`

## Outcome

Complete both Work-to-commitment journeys without reopening the frozen contracts or indexer
interfaces:

1. A gardener links previously submitted or approved Work to an accepted commitment.
2. A gardener selects a commitment while submitting Work, and the existing queue links it after
   the Work attestation receives a UID.
3. A steward reconciles approved Work that was linked after its decision.
4. Client and admin surfaces distinguish awaiting approval, awaiting reconciliation, counted,
   fresh-review-required, and unavailable states.

## Locked Boundaries

- `syncWorkDecisions` remains steward-only. Never append it to a gardener-owned `workLink` job.
- Sequence-zero decisions are never counted or migrated. Require a fresh approval or rejection.
- Preserve the six existing queue job kinds and all persisted payloads containing `workUID`.
- No contract ABI/storage, indexer schema/handler, deployment, broadcast, authority, or environment
  change belongs to this lane.
- Hosted Envio deployment, full sync, and production read-back remain a human release gate.
- Stay on the current branch. Preserve unrelated QA report artifacts and stage only scoped files.

## Interfaces and Data Flow

- Generate a stable `clientWorkId` before direct or queued submission and encode that same value in
  Work metadata. `WorkJobPayload.clientWorkId` remains optional for old persisted jobs; every new
  job supplies it.
- Make `WorkLinkJobPayload` accept exactly one identity: a resolved legacy `workUID`, or a deferred
  `clientWorkId` with optional `sourceWorkJobId`. Keep the existing operation key stable across UID
  resolution and retries.
- Resolve deferred Work identities through a narrow dependency keyed by client ID, chain, garden,
  and caller. Parse the returned Work metadata and exact-match all identity fields. Zero matches is
  waiting, one exact match resolves, and duplicate or mismatched matches are terminal conflicts.
- Index lag does not consume retry budget. A terminal/discarded source Work job terminates its
  dependent link. Membership loss and frozen or terminal commitments fail with explicit recovery
  copy while leaving the Work intact.
- Query non-revoked WorkApproval attestations per linked Work, exact-match `workUID`, and validate
  candidates against `latestDecisionSequence` and `decisionSequenceByUID`. Sequence zero maps to
  fresh review; current nonzero approved decisions map to steward reconciliation. Read failures map
  to unavailable, never to an empty list.
- Expose `syncWorkDecisions` through shared mutation hooks and the admin commitment controller.
  After submission, wait for indexed attribution read-back before presenting the Work as counted.

## UI Contract

- Commitment detail keeps the existing Work picker. Its empty state offers “Submit work for this
  requirement” and deep-links the exact garden, action, commitment, and requirement.
- Generic Work Intro offers eligible accepted commitments after garden and action selection.
  Deep-link context preselects the exact requirement. Details remains action-specific and unchanged.
- Work Review includes a Fulfills card with the commitment and requirement ordinal. “Not for a
  Commitment” clears local context before any link is queued.
- Duplicate requirements using one action remain individually selectable and have unique names.
- Commitment and Work details use text or icon plus color for awaiting approval, awaiting steward
  reconciliation, counted, fresh review, and unavailable.
- Admin Recovery shows the number of approved linked Works waiting to count. Its online,
  steward-only confirmation warns that reconciliation may advance to Ready for confirmation and
  freeze the roster. Raw decision UIDs stay hidden.
- Use native controls, explicit labels and descriptions, visible focus, restored dialog focus, a
  polite status announcement for queued/success states, and alerts or shared toasts for failure.
- Add every new string to English, Spanish, and Portuguese.

## RED/GREEN and Validation

Record focused RED/GREEN evidence here before marking the lane complete:

- Contracts: approval first, link later, steward sync, requirement/contributor/count/readiness
  assertions in unit and real-EAS fork tests.
- Shared: decision classification, stable direct/queued `clientWorkId`, persisted-job compatibility,
  deferred resolution/wait/retry/conflict/source-failure behavior, and admin mutation/controller.
- Client: deep-link and generic selection, Review clearing, empty CTA, duplicate requirements, and
  all visible linking states.
- Admin: permission, offline, unavailable reads, confirmation, success, and pending indexed state;
  update stories for each recovery state.

Before final validation, render:

```sh
bun run validation:plan -- --intent ship --base origin/develop --head HEAD
```

Follow its critical overrides, then run the selected package checks, i18n/vocabulary checks,
`bun run agentic:check`, Storybook quality checks, and the uncached Ship Gate. Authenticated Brave
proof covers historical approved Work through reconciliation, new direct and queued Work through
deferred linking, sequence-zero fresh review, mobile client, desktop admin, and keyboard/focus
behavior.

## Validation Receipt

**Source HEAD:** `29c935fb6b2420be289b7e47dcbb84b2a8edd327`
**Validated:** `2026-08-25T20:45:37Z`

- The Ship validation plan selected the contract, shared, client, admin, agent, source-structure,
  design, ontology, supply-chain, Storybook, and authenticated-browser surfaces.
- `bun run test`, the client/admin/shared typechecks, the root client/admin build,
  `bun run build:agent`, and `bun run verify:contracts:fast` passed. The contract suite ran 2,051
  Solidity tests and 289 script tests; the shared suite ran 4,265 tests.
- Source structure, staged-module isolation, ontology, vocabulary, Storybook coverage and quality,
  plan validation, design tokens, contract lint/build, and focused Work-linking tests passed.
- Authenticated Brave rendered linked Work as `Linked · waiting for approval`; the mock admin and
  client surfaces also kept unavailable decision reads explicit instead of showing counted state.
- `bun format:check` remains blocked only by two preserved, unrelated QA JSON reports.
  `bun run check:design-generated` remains blocked by the pre-existing generated client PWA token
  audit. `bun run agentic:check` remains blocked by pre-existing authenticated-browser wording
  drift in agent guidance.
- Targeted re-review passed 18 contract tests, 13 shared tests, 47 client tests, 22 admin tests,
  shared/client/admin source typechecks, vocabulary checks, and an authenticated Brave render.
  The full gate was not repeated at the user's direction.
- Draft PR publication remains blocked because the configured GitHub CLI token is invalid. No push
  or PR was made.
- Hosted Envio deployment, full sync, and production read-back remain the human-controlled release
  gate and are not claimed here.
