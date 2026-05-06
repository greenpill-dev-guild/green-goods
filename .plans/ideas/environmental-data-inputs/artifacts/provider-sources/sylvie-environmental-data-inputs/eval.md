# Sylvie Environmental Data Inputs Evaluation

## Acceptance Criteria

| ID | Criterion | Lane | Evidence |
|---|---|---|---|
| AC-1 | Sylvie API/data shape is known before implementation | `state_api` | Discovery note with sample payload or docs reference |
| AC-2 | Environmental claim mapping is explicit | `state_api` | Claim table covering source field, normalized claim, confidence, observed time |
| AC-3 | Attestation path preserves Green Goods trusted-attester model | `state_api` | EAS writer design or test asserts Green Goods signer |
| AC-4 | Admin badge is advisory and source-specific | `ui` | Story or screenshot once implemented |
| AC-5 | Scope stays Sylvie-only | `qa_pass_1` | Diff review shows no locale.network implementation |

## Exit Rule

Promote this hub only after Sylvie discovery is complete enough to estimate implementation. Archive it if Sylvie access is not available for Q2.
