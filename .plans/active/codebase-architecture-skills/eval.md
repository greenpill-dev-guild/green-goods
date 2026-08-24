# Codebase Architecture Skills and Seam Governance Evaluation Plan

## Release Gates

1. Responsibility: architecture discovery, change review, drift audit, seam certification, and
   cleanup route to distinct existing skills.
2. Architecture: the shared model defines depth and seam decisions without duplicating workflow.
3. Enforcement: registered seams fail closed on export, composition, proof, or fingerprint drift.
4. Test quality: no direct-test baseline exceptions remain; coverage stays a separate outer-loop floor.
5. Velocity: review intent selects only relevant evidence checks; ship intent preserves hard gates.
6. Tracking: the successor parent is recorded, PRD-831 is closed, and the future ratchet is dated.

## Acceptance Checks

| ID | Behavior boundary | Check | Owner |
|---|---|---|---|
| AC-1 | Architecture routing | Deterministic contracts and one semantic trigger-eval run distinguish all five skills. | `state_api` |
| AC-2 | Registry correctness | Export-map, schema, proof, duplicate, lifecycle, and fingerprint fixtures pass. | `state_api` |
| AC-3 | Direct proof | Self-mocking and missing direct imports fail; exact baseline is empty. | `state_api` |
| AC-4 | Validation scope | Architecture evidence review selects exactly three checks; ship adds mandatory gates. | `state_api` |
| AC-5 | Documentation | Guidance links, Node/DOM model, export taxonomy, coverage, and velocity wording agree. | `state_api` |
| AC-6 | Plan/Linear | Hub validates, parent-only ID is recorded, PRD-831 has a closure comment and Done state. | `state_api` |
| AC-7 | Repository safety | Exact-path Ship Gate and full required validation pass on a clean committed path set. | `qa_pass_1` |
| AC-8 | Integration coverage | Manual coverage workflow succeeds for the pushed integration SHA. | `qa_pass_1` |
| AC-9 | Final certification | Read-only module-seams/readiness review has no unresolved Must-Fix or Should-Fix finding. | `qa_pass_2` |

## Required Fixture Scenarios

- Public package leaf resolves through `package.json#exports`.
- Certified subject is imported outside mocks and is not self-mocked.
- Missing module, composition root, consumer, or proof path fails.
- Duplicate ID or public specifier fails.
- Changed tracked content produces a stale fingerprint failure.
- `SELECTED` may omit certification proof; `CERTIFIED` may not.
- A corrected violation makes an old baseline entry stale; final baseline contains zero rows.
- Architecture guidance under review selects `agent-guidance`, `test-quality`, and
  `validation-system-test`, with no unrelated package suite.
- Ship intent retains supply-chain, guidance, and validation-system gates.

## Evidence Contract

Every green or terminal claim records the exact command, UTC time, tested SHA, output summary,
validated paths, and clean-path status. The semantic trigger evaluation runs once. Coverage must
name its workflow run and integration SHA. An environment-blocked external check remains `BLOCKED`.

## Scheduled Checkpoint

`coverage_ratchet` is due `2026-09-22`. Raise every supported configured metric by two points and
update parity expectations in the same change. If measured coverage cannot support the increase,
record the evidence and blocker; do not archive this hub or describe the ratchet as complete.
