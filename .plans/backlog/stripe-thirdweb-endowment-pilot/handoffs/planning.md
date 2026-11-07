# Planning handoff

## Current scope — 2026-10-15

Updated this existing hub for US/EU-first donor acquisition and later Brazil, South Africa and Nigeria pilots. Retained the slug, backlog stage, lane states and original planning record below. The user's expected capital origin is recorded as strategy to validate, not a research finding.

Stripe direct remains the US/EU choice, with separate US L0 and EU verification profiles. Brazil compares Ramp Pix with Fonbnk Pix before selecting one; South Africa evaluates Fonbnk bank redirect; Nigeria remains no-go for the intended checkout until manual confirmation and verification/operating gaps are resolved. MoonPay is a comparison-only fallback, not scheduled implementation. See [regional decisions](../regions.md), [ownership and consent design](../spec.md) and [acceptance gates](../eval.md).

All cohorts retain email-first recovery, donor-owned redeemable shares, one endowment consent, sponsored bounded execution and no post-payment deposit confirmation. The plan now covers bank delays, independent region decisions, proposed UX/cost thresholds, receipts and support. The unverified Arbitrum vault and durable authorization remain shared prerequisites; no live route is certified.

Task record: `stripe-thirdweb-endowment-pilot` | Type: planning update | Outcome: requested plan update complete; implementation and live proofs pending
Agent/model: Codex / model unknown | Coverage: 2026-10-15 regional plan update only; preceding research excluded

| Phase | Start → end (UTC) | Result / evidence |
| --- | --- | --- |
| investigate | 2026-10-15 21:46:28 → 2026-10-15 21:47:33 | Read existing hub/guidance, rechecked owning implementation anchors and current Stripe EU requirements. |
| implement | 2026-10-15 21:47:33 → 2026-10-15 21:54:57 | Updated plan documents/status and added regions.md; no runtime edits or external writes. |
| verify | 2026-10-15 21:54:57 → 2026-10-15 21:56:21 | Regional consistency reviewed. Final rerun: validator passed across 28 hubs; seven plan files and 28 relative links/anchors passed JSON/whitespace/pending-state checks. No runtime proof claimed. |

Human corrections: 0 in this segment; the regional priority is new scope. Human attention: unknown.

No implementation commit receipt is claimed: these seven plan files are untracked in the shared checkout. Existing unrelated changes were left untouched. No provider contact, account creation, personal-data submission, payment, deployment, dependency change, branch action or external record update occurred.

## Original scope — 2026-10-14

Prepared a small, sequential Stripe-direct/thirdweb endowment pilot. The user clarified that the donor retains the endowment position; a direct donation instead goes to the garden. No implementation, live provider request, account, personal-data submission, payment or external write occurred.

Prerequisites remain unverified: Stripe preview entitlement and exact Arbitrum/card/use-case approval; an existing donor-owned Arbitrum endowment vault; bounded execution that survives checkout closure. Source observations and the build candidate are in [spec.md](../spec.md); all acceptance proofs remain pending in [eval.md](../eval.md).

Task record: `stripe-thirdweb-endowment-pilot` | Type: planning | Outcome: complete for the requested plan; pilot not run
Agent/model: Codex / model unknown | Coverage: this plan request only; earlier research excluded

| Phase | Start → end (UTC) | Result / evidence |
| --- | --- | --- |
| investigate | 2026-10-14 08:45:41 → 2026-10-14 08:54:57 | Repository/domain and official provider evidence reconciled; user clarified endowment ownership. |
| implement | 2026-10-14 08:54:57 → 2026-10-14 08:59:21 | Plan artifacts only; no runtime edits. |
| verify | 2026-10-14 08:59:21 → 2026-10-14 09:00:27 | Plan validator passed across 28 hubs; all 16 local Markdown links resolved. See [planning validation](../eval.md#planning-validation). |
| review | 2026-10-14 09:00:27 → 2026-10-14 09:02:00 | Tightened go/no-go: recoverable pending funds cannot count as a completed endowment. |

Human corrections: 0 in this segment; ownership reply is a clarification. Human attention: unknown.

No commit-attributed runtime validation receipt is claimed. Planning checks are recorded in eval.md; runtime TDD and authenticated wallet proof remain pending.
