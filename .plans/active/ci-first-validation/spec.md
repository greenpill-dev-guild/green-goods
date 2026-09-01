# CI-First Validation Balance Spec

## Summary

Local validation becomes a bounded ready-for-CI gate. Routine changes run changed-path hygiene and
focused behavior proof; sensitive changes receive a larger bound; critical changes retain the full
mandatory local override. GitHub CI keeps broad affected-package suites and becomes the only source
of merge-readiness approval for ordinary pull requests.

## Users

- Primary: contributors and coding agents making routine or sensitive changes.
- Secondary: reviewers relying on current-head GitHub CI evidence.

## Functional Requirements

1. Routine push validation must be targeted, non-mutating, and capped at 90 seconds.
2. Sensitive push validation must be capped at 180 seconds; critical overrides remain uncapped.
3. Plans that cannot fit their budget must stop before execution with focused remediation.
4. Exact passing receipts may be reused only when every existing fingerprint input still matches.
5. Design, Ontology, and Supply Chain CI routing must exclude unrelated work without weakening
   their owning checks.
6. Agent review, ship, PR-comment, and team guidance must use CI as merge authority.

## Research Evidence

- Existing pattern references: `scripts/quality/select-validation.mjs`,
  `scripts/dev/ci-local.js`, and exact-fingerprint passing receipts.
- Source files, tests, or docs reviewed: the validation policy and tests, Husky and Claude hooks,
  CI Gate and package workflows, ontology anchor checks, and the canonical validation guide.
- Evidence confirmed: narrow Shared utility changes currently fan out to full local consumer suites;
  broad checks also repeat in hooks and CI; budgets currently warn instead of controlling work.
- Open inferences or assumptions: none. The user selected CI-first authority, safe CI cuts, exact
  receipt integration, and one atomic PR.

## Human Judgment Points

- Decisions that need maintainer judgment: none remain; the implementation choices are locked.
- Protected or high-risk surfaces: validation tooling, workflows, hooks, and agent guidance are
  sensitive. Contract and shared mutation overrides are critical and must remain unchanged.
- Tradeoffs to keep visible during review: speed comes from local scope and de-duplication, not from
  shrinking affected-package CI coverage.

## Non-Functional Constraints

- Package boundaries: no product package public API changes.
- Performance: 90-second routine and 180-second sensitive push deadlines.
- Security: receipt trust inputs and mandatory critical overrides remain intact.
- Offline / sync: explicit `ship` remains available as a full local gate when CI is unavailable.
- Localization: not applicable; no product copy changes.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Not applicable |
| Validation tooling and policy | `state_api` | Selector, runner, hooks, CI routing, guidance |
| Contracts | `contracts` | Not applicable; critical contract rules remain regression-tested |
| QA | `qa_pass_1`, `qa_pass_2` | Workflow audit, timing proof, and full final gate |

## Risks

- Risk: local selection becomes too narrow. Mitigation: retain broad Shared consumer workflows in CI
  and encode critical overrides as mandatory regression cases.
- Risk: a hard deadline creates false success. Mitigation: deadline expiry is nonzero,
  `budget-exceeded`; only completed passing checks receive receipts.
- Risk: path filters drift from workflow behavior. Mitigation: selector/workflow parity and ontology
  anchor tests cover every narrowed route.
