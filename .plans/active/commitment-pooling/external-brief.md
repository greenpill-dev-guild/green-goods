# Commitment Pooling — External Document Pointer

The [Green Goods Commitment Pooling Google Doc](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit) is the **single source of truth for external-facing prose**. The repository does not maintain a mirrored external brief or rollout narrative.

Use the repo only for the implementation, evidence, and visual sources that substantiate the external document:

| Question | Canonical source |
|---|---|
| What is the current execution state and dated phase plan? | [`status.json`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/status.json) and [`plan.todo.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/plan.todo.md) |
| What exactly do the contracts and settlement rails do? | [`contract-spec.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/contract-spec.md) and [`settlement-spec.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/settlement-spec.md) |
| How do Offer once, Offer over time, finite availability, repeated fulfillment, trust, and succession fit together? | [`standing-commitments-spec.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/standing-commitments-spec.md) |
| Is the initial architecture adaptable to full Commitment Pooling, and what gates the path? | [`exchange-architecture-brief.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/exchange-architecture-brief.md), [`architecture-closure-matrices.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/architecture-closure-matrices.md), and [`pilot-evidence-spec.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/pilot-evidence-spec.md) |
| What do the product surfaces and states do? | [`uiux-spec.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/uiux-spec.md), [`wireframes.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/wireframes.md), and [`prototypes.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/prototypes.md) |
| What is the canonical Needs model? | [`community-interface/spec.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/community-interface/spec.md) |
| Which audience graphics are current? | [`visual-assets.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/visual-assets.md) |
| Which external claims were verified or corrected? | [`reports/corrections-log.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/reports/corrections-log.md) and [`reports/external-verification-2026-07-20.md`](https://github.com/greenpill-dev-guild/green-goods/blob/develop/.plans/active/commitment-pooling/reports/external-verification-2026-07-20.md) |

**Current pilot-funding fact (corrected 2026-08-04):** Good Labs Foundation provides Green
Goods with **$800 per month, paid in G$, for July through September 2026 — $2,400 total**.
This is the upstream House of Alignment funding arrangement. Do not substitute a
transaction-level G$ token count for this agreement, and do not treat the upstream funding as
proof of any onward distribution to gardens or gardeners.

## Current staged-growth alignment

The accepted six-tab Google Doc now keeps the initial implementation and every later capability
visibly separate:

- **00 Start Here** states that the non-transferable commitment system comes first; voucher,
  bounded-pool, and federation capabilities require separate evidence and authorization.
- **01 External Brief** explains why the initial system is useful without vouchers or exchange,
  why G$ support is not redemption, and how later stages move only through separate gates.
- **02 Deeper Reference** owns the two real sections `How Commitment Pooling can grow in stages`
  and `What one bounded pool would still need to prove`. Their blank image anchors sit immediately
  above their captions; image insertion remains a manual user step.
- **03 Applied Reference** keeps Tech and Sun's next-cycle ongoing education Offer distinct from a
  future voucher possibility and records no agreement to a voucher pilot.
- **04 Rollout, Measurement & Claims** gives future voucher and exchange stages no promised date
  and treats `Not supported` and `Unavailable` as valid outcomes.
- **05 Sources & Citations** keeps one current G14 funding entry and records the Tech and Sun
  consent boundary in G12.

## Editing rule

- Edit the Google Doc for narrative, audience framing, use cases, rollout copy, and citations.
- Edit the relevant repo source first when a technical fact, gate, state, date, visual, or evidence record changes; then reconcile the Google Doc.
- For the current full-pooling narrative and image pass, follow
  [`handoffs/claude-full-pooling-visual-docs.md`](handoffs/claude-full-pooling-visual-docs.md);
  preserve the live document's six-tab structure and voice rather than rewriting it from this
  pointer.
- Use Linear for current delivery status. Do not copy Linear status prose into this hub.
- Do not recreate `external-communications.md` or another repo copy of the external narrative.
