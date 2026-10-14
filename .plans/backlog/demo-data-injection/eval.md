# Demo Data Injection Seams Evaluation Plan

Gates and checks below apply per rung, at the point a rung is promoted out of `backlog`. Nothing
here is claimed while the hub is deferred.

## Release Gates

1. **Correctness**: a seeded garden reads the same story on all three surfaces. The counts a
   steward sees in the console, the rows a gardener sees on the phone, and the figures the public
   record publishes all describe one garden, not three.
2. **Usability**: getting a populated environment is one documented command. If it takes a
   research session, the rung has not landed.
3. **Regression safety**: production builds fold every seam away, and no injected read survives a
   flag flip, a reload, or a restart.
4. **Evidence quality**: research evidence and open assumptions are recorded before implementation.
   The untested assumption about a live indexer overwriting hand-inserted rows is settled with a
   real test, not a guess.
5. **Human judgment**: the tradeoff in Decision 4 — that a browser worker changes what a review
   proves — is stated in the PR that introduces rung 3, not discovered afterwards.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Seeded data reaches every surface | One garden renders populated on the client PWA, the editorial pages, and the admin console, with no product-code branch between them | `state_api` | Rendered proof through the authenticated Brave QA profile, one capture per surface |
| AC-2 | Seeding is idempotent | Running the seeder twice leaves the database in the same state; running it after `bun run reset` rebuilds it | `state_api` | Row counts before and after both runs |
| AC-3 | Nothing outlives its flag | With the admin dehydration guard fixed, flipping the flag off and reloading leaves no pooling read in `gg-admin-react-query` | `state_api` | IndexedDB contents before and after the flip |
| AC-4 | Writes stay blocked | Every act composed against injected data fails to send, in all three existing guard paths | `qa_pass_1` | The thrown-error toast and the permanently-waiting job, observed |
| AC-5 | Production folds it away | A production bundle contains no fixture module and registers no worker | `qa_pass_2` | Bundle grep, and the built output's chunk list |
| AC-6 | Rung 4 only: chain truth | A pooling commitment created through the helpers appears in the indexer and then on all three surfaces without any seeding step | `contracts` | Fork transaction receipt, then the same three captures as AC-1 |

## Test Strategy

- **Unit**: fixture builders and any selector that has to tolerate synthetic shapes. Rung 2's
  fixtures need the same shape coverage the existing `demo-reads` fixtures have.
- **Integration**: the seeder against a real local Postgres, asserting the GraphQL a UI actually
  issues returns what the UI expects — not that rows exist, but that the readers resolve them.
- **E2E / Playwright**: not required for rungs 1 and 2. Rung 3 needs one, because worker
  registration is exactly the kind of thing that works in dev and not in a built preview.
- **Manual checks**: the three-surface read is the point of this work, so it is a manual visual
  check by construction. Use the authenticated Brave QA profile per the Agentic Modern Web
  Standard; isolated profiles cannot support the claim.
- **TDD proof**: RED/GREEN commands and evidence recorded in lane handoffs and summarized in
  `status.json`. Where a rung genuinely changes no product behavior — likely for rung 1 — record
  `not_applicable` with a concrete note rather than inventing a test to satisfy the field.

## QA Sequence

### Claude QA Pass 1

- Focus on whether the populated surfaces actually agree with each other, and on anything that
  looks real but is not
- Confirm AC-4: no injected act can reach a chain
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Focus on the production-build boundary (AC-5) and on regressions in the readers that were wrapped
- Re-run targeted validation and close the loop on remaining defects
