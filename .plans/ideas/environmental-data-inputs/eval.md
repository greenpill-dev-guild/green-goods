# Environmental Data Inputs Evaluation

| Acceptance Check | Lane | Evidence |
|---|---|---|
| Provider docs and data rights are confirmed for at least one provider | `state_api` | Discovery note in handoff/history |
| Normalized environmental claim shape is defined without over-claiming proof strength | `state_api` | Spec update |
| Advisory admin display requirements are clear before implementation | `ui` | Plan update or mock-ready acceptance notes |
| Provider-specific source plans remain preserved | `qa_pass_1` | Artifact paths under `artifacts/provider-sources/` |

Validation: `node scripts/harness/plan-hub.mjs validate` after any status update.
