# Client PWA Gardener Audit Evaluation

| Acceptance Check | Lane | Evidence |
|---|---|---|
| Browser mode login presents the passkey-first new-user path | `qa_pass_1` | Browser walkthrough note |
| Default gardener cannot reach operator-only governance/endowment affordances | `qa_pass_1` | Browser walkthrough note |
| Account details are collapsed by default and advanced vocabulary is opt-in | `qa_pass_1` | Browser walkthrough note |
| Assessment detail renders gardener-friendly rows, not raw JSON/UIDs | `qa_pass_1` | Browser walkthrough note |

Validation: browser pass from `fixes.md`, then `node scripts/harness/plan-hub.mjs validate`.
