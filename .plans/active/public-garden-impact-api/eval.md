# Public Garden Impact API Evaluation Plan

## Release Gates

1. Correctness: every count and null state follows the source-availability and deduplication rules.
2. Usability: the response is versioned, stable, privacy-safe, and usable from any browser origin.
3. Regression safety: protected route CORS remains allowlisted and invalid chains cannot fall back.
4. Evidence quality: research evidence and open assumptions are recorded before implementation.
5. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Public contract | Response types and path builder are exported through `public-contracts` | `state_api` | Shared targeted suite passed |
| AC-2 | Aggregation | Approval, certificate, deduplication, partial/null, privacy, and ordering rules pass | `state_api` | Direct aggregator suite passed |
| AC-3 | Strict readers | Chain support, pagination, schema gaps, provider failures, and overflow fail closed | `state_api` | Direct reader suite passed |
| AC-4 | HTTP route | GET/OPTIONS, validation, status mapping, wildcard CORS, rate limit, and cache pass | `state_api` | Agent integration suite passed |
| AC-5 | Regression review | Protected CORS, source structure, package types, builds, and repo checkpoint pass | `qa_pass_1`, `qa_pass_2` | Validation receipts |

## Test Strategy

- Unit: direct Shared contract, aggregator, and reader tests with injected source results.
- Integration: in-process Hono requests with injected snapshot loader, clock, and rate limiter.
- E2E / Playwright: not applicable; no UI surface changes.
- Manual checks: inspect JSON for identity leakage and confirm docs match the implemented shape.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, missing requirements, and test gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Re-run targeted validation and close the loop on remaining defects
