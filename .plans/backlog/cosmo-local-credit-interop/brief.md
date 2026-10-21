# Cosmo-Local Integration

**Reconciled:** 2026-10-20 UTC · **Stage:** backlog · **Posture:** planning and research;
implementation and live operations require their own accepted dispatch.

**Linear project:** [Cosmo-Local Integration](https://linear.app/greenpill-dev-guild/project/cosmo-local-integration-6273120022c7)
· [Architecture RESR-73](https://linear.app/greenpill-dev-guild/issue/RESR-73)
· [Delivery PRD-857](https://linear.app/greenpill-dev-guild/issue/PRD-857)

## Outcome

A member can contribute to a hub, earn access to useful services, use those services and understand
what remains available or owed. A supporter can fund access and follow the resulting delivery.
Tech and Sun and Green Goods are the first two proposed service-voucher issuers.

The user clarified that the same commitment can receive vouchers and G$, with both terms agreed
at acceptance. The [architecture alignment](architecture-alignment.md) and Claude's
[second-pass review](handoffs/claude-architecture-review-results.md) settle on independent reward receipts linked to one fulfillment
through dedicated integration contracts and no CommitmentPooling upgrade, accepted on 20 October
as the PRD-1315 candidate; the remaining decisions are listed in the review. The earlier G$
installment plan is superseded.

Green Goods records commitments, evidence, confirmation and support. Cosmo-Local supplies the
planned service-voucher exchange mechanism. The passport makes their relationship understandable
to communities, the Nigerian diaspora and institutions without requiring them to understand chains.

## Current scope

- Two community-owned Gnosis voucher pools, bounded earned and purchased issuance, direct swaps,
  service presentment and discharge, and explicit failure/recovery behavior.
- A passport joining actual funding, issuance and delivery receipts with capacity and obligations.
- Pilot terms and consent, a local fork rehearsal, and a separate human decision on any live use.
- Research, pitch and Q4 strategy content explaining hub, community, diaspora and institutional participation.
- Coordinated [PWA simplification](../pwa-interface-simplification/brief.md) and admin/PWA cohesion,
  delivered in Green Goods 2.1.0 with their own design and acceptance gates.

The [four-goal delivery alignment](delivery-alignment.md) owns current priorities, issue homes and
dependencies. Cosmo-Local owns integration and narrative; 2.1.0 owns the app and public-site delivery.
Use voucher for the issuer instrument; retain Cosmo-Local Credit as the product-family name.

[Garden Fiat Contributions](https://linear.app/greenpill-dev-guild/project/garden-fiat-contributions-3675da59ceb3)
retains the fiat-onramp stretch. Its provider qualification, email wallet, gas sponsorship, payment
recovery and live-pilot approval remain separate. A blocked stretch does not block the core pitch.

## What is already true

The 9 October [whitepaper review](whitepaper-v8-review.md) found implemented commitment, settlement,
yield and certificate foundations in checkout `06a31dbf5`, but no CLC runtime integration. Its 275
passing focused contract tests establish only the tested foundation behavior. They are not an
integration proof, security audit or current deployment certificate.

Commitment Pooling's Linear project is closed as the foundation. Its source hub remains available
for unresolved operational evidence, now tracked in this project. No unfinished lane was certified
by the project move; see [the reconciliation record](project-reconciliation.md).

## Decisions still needed

Both issuers must agree service prices and available capacity, earning and purchase entitlements,
recipient allocation, partial delivery, discharge and repair. Terms and reporting consent are
separate. A token holding limit is not a loan facility or proof of service capacity.

The October go/no-go must address each existing mainnet gate explicitly. Current plans grant no
waiver. The PWA composition remains open. RESR-94 records the first diaspora audience and scenario
asks; the exact first supporter, payment method and final COM-46 prices/capacity remain open.

## Evidence of success

Demonstrate a useful, understandable service journey and a supporter who can follow funding to
delivery. Record whether third-party exchange is actually useful; low demand or bilateral-only
use is a valid finding. Keep native service units, money, voucher balances and impact claims distinct.

## Read next

- [Architecture](spec.md), [work and decisions](plan.todo.md), [acceptance evidence](eval.md).
- [Claude Fable research and pitch handover](handoffs/claude-fable-research-pitch.md).
- [Prior discussion](hackathon-discussion.md) and [v0.8 review](whitepaper-v8-review.md), dated evidence.

The August weighted-contribution design is superseded. Its version remains in Git history at
`06a31dbf5`; it is not the October build. The older [tensions](tensions.md) and [resources](resources.md)
remain useful historical research with the authority and freshness limits stated there.
