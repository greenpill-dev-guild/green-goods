# Locale Energy IoT Data Inputs Evaluation

## Acceptance Criteria

| ID | Criterion | Lane | Evidence |
|---|---|---|---|
| AC-1 | locale.network API/protocol and pilot device path are known before implementation | `state_api` | Discovery note with sample payload or docs reference |
| AC-2 | Measurement and proof metadata shape is explicit | `state_api` | Field table covering device, metric, unit, value, observed time, proof reference, confidence |
| AC-3 | Attestation path does not over-claim ZK/TEE verification | `state_api` | Test or review note distinguishes verified proof from partner-reported proof |
| AC-4 | Admin badge is advisory and source-specific | `ui` | Story or screenshot once implemented |
| AC-5 | Scope stays locale-only | `qa_pass_1` | Diff review shows no Sylvie implementation |

## Exit Rule

Promote this hub only after locale.network discovery is complete enough to estimate implementation. Archive it if API/proof access or pilot hardware is not available for the target window.
