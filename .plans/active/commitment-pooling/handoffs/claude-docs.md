# Commitment Pooling - Claude Docs Handoff

## Status

- Execution sub-lane: docs
- Machine lane: none; post-QA communication lane
- Owner: Claude
- Branch signal: claude/docs/commitment-pooling
- Current state: blocked until QA Pass 1 completes
- Linear context: PRD-727 (docs lane) under parent PRD-650

## Inputs

- QA Pass 1 evidence, defect disposition, and verified staging source SHA
- Corrected contract, settlement, UI, diagrams, and external-communications artifacts
- Existing docs architecture/glossary/reference pages
- The former docs-guides scope: operator/gardener task guides and authenticated product screenshots
- `acceptance-matrix.md` §3 public claims matrix and vocabulary rules

## Outputs

- Architecture, glossary, data-boundary, and settlement documentation aligned to the frozen specs.
- Operator seeding/claims/settlement and gardener promise/evidence/confirmation/consideration guides
  replayed against the QA-tested product, with authenticated screenshots, alt text, captions,
  version/date, and source provenance.
- Explicit built, planned, dispatched, confirming, confirmed, and evidence-gated labels.
- Links to the lane issue and parent roadmap records without dispatching historical child issues.
- Updated anchors and validated docs build.

## Acceptance

- Commitments are module-native; EAS carries only the named schemas and Envio never indexes EAS.
- G$ remains on Celo. The only modeled funding top-up is protocol → garden. A fulfilled
  commitment instead creates a conserved payout plan paid by its provider garden Safe: the
  explicit garden-retained amount plus contributor child disbursements equals declared support.
- Dispatched and Celo-executed/acknowledgment-pending are not arrived; only an authenticated
  success acknowledgment for the subject's current execution key and attempt is Confirmed.
- Safe recovery owners and Roles executors are described separately.
- AA failure is documented as blocked member delivery and never creates a garden-held member claim.
- Unsupported outcome numbers are framed as pilot targets with source/date/measurement method.
- Vocabulary and links are current.
- Guide steps match current routes, accessible names, translations, and recovery behavior; no
  prototype frame is presented as shipped product.

## RED / GREEN or proof limit

- RED: semantic comparison finds a spec/copy/anchor mismatch or one exact docs/design/vocabulary command fails.
- GREEN: every changed page is re-read against its owning spec and all exact commands pass with current links and classifications.
- Proof limit: this lane changes documentation, not runtime behavior, so TDD is not applicable; unavailable external claims remain explicitly unverified rather than being treated as GREEN.

## Exact Bun commands

- bun run docs:audit
- bun run build:docs
- bun run lint:vocab
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens

## Out of scope

- Product implementation, speculative screenshots, walkthrough-video production, claiming planned
  behavior is live, manual settlement confirmation, garden-held member claims, new Linear
  children, or altering the canonical synthesis.

## Unblock evidence

- QA Pass 1 is GREEN with defects dispositioned and the tested source SHA recorded.
- Owning spec language is internally consistent with the QA-tested product.
- Proof-limit evidence names every changed page and its owning source.
- All exact Bun commands pass; any unavailable link or external claim is reported rather than waived.

## Binding documentation amendment — 2026-07-28

- Document commitments as one accountable lead plus optional contributors, repeatable requirements, roster freeze, and all-team confirmation exclusion.
- Explain the gardener Hypercert formula in plain language: equal commitment budgets, then the
  cycle's immutable recognition policy across equal participation and verified contribution
  (20/80 is the protocol default, not a fixed invariant); zero eligible contributors block instead
  of defaulting to the lead.
- Explain that the garden Safe pays eligible contributors through child disbursements, garden retention is explicit, recognition is hash-bound, payment weights derive from amounts, and payment corrections require reasons. Finalization freezes the plan without creating children; idempotent per-contributor preparation creates one Queued child from a frozen non-zero row. Include zero-child all-retained completion and stable parent-pointer rules.
- Preserve planned/live and proof labels: this architecture is specified and prototyped, not shipped or deployed.
