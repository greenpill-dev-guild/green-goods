# QA Journey Mode Evaluation

## Release Gates

1. The catalog and ID ledger accept every authored journey reference.
2. The built QA page preserves Walk and Priority behavior while Journey filters and counts remain
   correct.
3. Known-gate rows explain the blocker, leave every verdict unselected, and allow a tester to record
   Blocked after encountering the gate.
4. Desktop and mobile layouts have usable controls, accessible names, visible focus behavior, and no
   horizontal overflow.
5. Two authenticated wallets complete the deployed service-relay smoke.
6. The selected production-readiness gate passes against the final working tree and current commit.

## Acceptance Checks

| ID | Check | Evidence |
|---|---|---|
| AC-1 | Catalog and ledger validation | `bun run check:qa-id-ledger` passed with 153 IDs during the 2026-09-03 review |
| AC-2 | Journey build and interaction behavior | Agent-tool tests passed during the 2026-09-03 review; focused regression proof is recorded in the UI handoff |
| AC-3 | Desktop and mobile layout | Authenticated Brave rehearsal passed at 1912 × 995 and 375 × 812 with no horizontal overflow |
| AC-4 | Accessibility and known gates | Native controls, headings, accessible names, pressed state, roles, handoffs, and non-actionable gates were observed in the built page |
| AC-5 | Deployed two-wallet service relay | Pending |
| AC-6 | Final readiness validation and current-head CI | Pending |

## QA Sequence

Claude QA Pass 1 records the redeployed two-wallet smoke or the concrete blocker. Codex QA Pass 2
then reruns the repository-selected production gate and reviews only remaining regressions. Neither
pass can claim production readiness without current-head CI.
