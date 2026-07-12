# Commitment Pooling - Claude Docs Handoff

## Status

- Execution sub-lane: docs
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/docs/commitment-pooling
- Current state: follow status.json; architecture/glossary work is independent of product implementation
- Linear context: PRD-650 parent-only mirror

## Inputs

- Corrected contract, settlement, UI, diagrams, and external-communications artifacts
- Existing docs architecture/glossary/reference pages
- `acceptance-matrix.md` §3 public claims matrix and vocabulary rules

## Outputs

- Architecture, glossary, data-boundary, and settlement documentation aligned to the frozen specs.
- Explicit built, planned, reported, oracle-verified, and evidence-gated labels.
- Links to parent-only roadmap records without dispatching historical child issues.
- Updated anchors and validated docs build.

## Acceptance

- Commitments are module-native; EAS carries only the named schemas and Envio never indexes EAS.
- G$ remains on Celo; only the two downstream routes are Green Goods actions.
- Reported is an executor assertion; only a successful Functions callback is oracle-verified.
- Safe recovery owners and Roles executors are described separately.
- AA failure is documented as blocked member delivery and never creates a garden-held member claim.
- Unsupported outcome numbers are framed as pilot targets with source/date/measurement method.
- Vocabulary and links are current.

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

- Product implementation, speculative screenshots, claiming planned behavior is live, manual receipt verification, garden-held member claims, new Linear children, or altering the canonical synthesis.

## Unblock evidence

- Owning spec language is internally consistent.
- Proof-limit evidence names every changed page and its owning source.
- All exact Bun commands pass; any unavailable link or external claim is reported rather than waived.
