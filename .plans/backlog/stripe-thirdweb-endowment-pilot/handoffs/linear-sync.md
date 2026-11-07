# Linear reconciliation — 2026-10-15

The user explicitly requested syncing the accepted pilot into the existing issues and project. Updated [Garden Fiat Contributions](https://linear.app/greenpill-dev-guild/project/garden-fiat-contributions-3675da59ceb3), its four existing milestone descriptions and twelve existing issue descriptions. Added one [readable project specification](https://linear.app/greenpill-dev-guild/document/email-first-endowment-pilot-useu-priorities-and-regional-gates-f0623203e286); no issue or lane issue was created.

## Work mapping

| Existing issue | Current responsibility |
| --- | --- |
| [PRD-1031](https://linear.app/greenpill-dev-guild/issue/PRD-1031) | Pilot roadmap and parent-only hub mirror |
| [PRD-1039](https://linear.app/greenpill-dev-guild/issue/PRD-1039) | Existing Arbitrum vault, asset and regional route prerequisites; now Scope and Design |
| [PRD-1032](https://linear.app/greenpill-dev-guild/issue/PRD-1032) | thirdweb donor email wallet and original-account recovery |
| [PRD-1033](https://linear.app/greenpill-dev-guild/issue/PRD-1033) | Bounded sponsored execution with no second endowment confirmation |
| [PRD-1034](https://linear.app/greenpill-dev-guild/issue/PRD-1034) | Stripe direct US/EU payment and wallet-funding reconciliation |
| [PRD-1035](https://linear.app/greenpill-dev-guild/issue/PRD-1035) | Public email/payment/endowment journey |
| [PRD-1036](https://linear.app/greenpill-dev-guild/issue/PRD-1036) | Paid-but-pending recovery without duplicate charge or deposit consent |
| [PRD-1037](https://linear.app/greenpill-dev-guild/issue/PRD-1037) | Ownership, regional QA, timing/cost and go/no-go evidence |
| [PRD-1038](https://linear.app/greenpill-dev-guild/issue/PRD-1038) | Separately authorized US/EU live cohorts and route-specific rollout decision |
| [COM-38](https://linear.app/greenpill-dev-guild/issue/COM-38) | Supported initial US/EU participants and support rehearsal |
| [MAR-33](https://linear.app/greenpill-dev-guild/issue/MAR-33) | Donor-owned endowment explanation and qualified-market claims |
| [RESR-82](https://linear.app/greenpill-dev-guild/issue/RESR-82) | Existing Nigerian crypto-user/direct-donation research; related to later regional qualification |

## Scope and dependency reconciliation

- thirdweb email/signing replaces the former Reown/Pimlico pilot selection. Existing account migration and runtime changes are not authorized.
- US/EU donors are the initial priority; expected capital origin remains a strategy assumption. US L0 and EU required verification are separate cohorts. Brazil Ramp/Fonbnk Pix and South Africa Fonbnk redirect remain conditional; Nigeria Fonbnk remains no-go pending manual-flow, verification and operating gaps.
- Removed RESR-82 as a blocker of PRD-1031 and retained it as a related issue. Preserved its existing Nigerian audience, provider research, assignee, cycle and In Progress state.
- Removed the old PRD-1037 → PRD-1039 qualification dependency. PRD-1039 now depends on the roadmap and gates PRD-1033/PRD-1034; the bounded execution spike also gates the payment adapter. Read-back found no dependency cycle.
- Every updated issue carries the existing `source:plans` label. Existing labels, states, assignees, cycles and due dates were preserved. Eleven delivery/coordination issues remain Backlog; RESR-82 remains In Progress. The project remains Backlog; milestone dates remain unset.

## Verification

At the observed 22:29:28 UTC boundary, connector read-back matched the intended project, document and all twelve issue bodies after accounting for Linear's bullet, URL-bracket and table-separator formatting. The four milestone descriptions and dependency edits matched; no operational completion or live-payment proof is claimed. The preserve-only manifest's PRD-1031 record was re-read before confirmation. `confirm-linear-sync` recorded 2026-10-15T22:30:56.782Z; the observed 22:31:02 UTC checks validated 28 hubs and all eight local files/30 relative links and anchors, JSON/whitespace and backlog/pending implementation states. See the validation receipt in eval.md.

Task record: `stripe-thirdweb-endowment-pilot` | Type: tracking sync | Outcome: complete; external reconciliation and local confirmation/validation passed
Agent/model: Codex / model unknown | Coverage: this Linear-sync request only

| Phase | Start → end (UTC) | Result / evidence |
| --- | --- | --- |
| investigate | 2026-10-15 22:22:27 → 2026-10-15 22:23:56 | Read routing, current project, issues, labels, milestones and hub sync manifest. |
| implement | 2026-10-15 22:23:56 → 2026-10-15 22:28:50 | Recorded existing mirror identifiers; updated project, four milestones, twelve issues and one project specification. |
| verify | 2026-10-15 22:28:50 → 2026-10-15 22:31:02 | External content/state/dependency read-back, local sync confirmation and plan/relative-link checks passed. Only this evidence receipt was finalized afterward. |

Human corrections: 0 in this segment; attention: unknown. No provider accounts, personal data, payment, broadcast, dependency installation or runtime implementation was involved. Unrelated shared-checkout changes were left untouched.
