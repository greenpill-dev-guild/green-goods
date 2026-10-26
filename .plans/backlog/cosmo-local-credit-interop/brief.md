# Cosmo-Local Integration

**Reconciled:** 2026-10-23 Pacific · **Stage:** backlog · **Posture:** controlled live pilot
preparation now includes member-owned and garden/collective vouchers in one shared Gnosis pool.
Steward-assisted onboarding is accepted; members retain ownership and exact approval. The
[architecture](spec.md#accepted-pilot-amendment--member-and-garden-issuers-23-october-pacific) and
[implementation sequence](plan.todo.md#member-and-garden-issuer-pilot--accepted-23-october-pacific)
record this added scope, which is not yet implementation or deployment evidence. The
[deployment handoff](handoffs/codex-live-pilot-deployment.md) owns current signed checkpoints,
account proof and live operations. The zero-delay upgrade decision supersedes older waiting
periods; owner controls and accepted voucher safeguards remain.

The selected implementation example is a TAS impact website: three separately scoped commitments
for a designer, analyst and engineer under one shared brief, plus an exchange between two
member-owned service vouchers in the same pool. The peer-help service stays distinct from the
rewarded project deliverables. Actual people, terms, capacities, rates and funded rewards are
still open; fixtures and simulated delivery must be labeled. Broader project-token and bundle
features remain outside scope.

The user adopted escrow before activation, exact voucher consent enforced at core acceptance,
and one immutable final delivered/refundable split at 23:42 UTC. Earlier no-core-upgrade and
incremental-release descriptions are historical within their original slices. The narrow core
integration is now authorized; personal G$ remains on Celo. The
[reconciliation record](handoffs/codex-voucher-reconciliation.md) owns the selected design and
remaining proof. The new member-issuer amendment selects explicit issuer ownership and assisted
onboarding; it does not select a general permissionless issuer or automatic capacity mechanism.

**Linear project:** [Cosmo-Local Integration](https://linear.app/greenpill-dev-guild/project/cosmo-local-integration-6273120022c7)
· [Architecture RESR-73](https://linear.app/greenpill-dev-guild/issue/RESR-73)
· [Delivery PRD-857](https://linear.app/greenpill-dev-guild/issue/PRD-857)

## Outcome

A member can contribute to a hub, earn access to useful services, use those services and understand
what remains available or owed. A supporter can fund access and follow the resulting delivery.
Tech and Sun, Green Goods and admitted individual members are pilot service-voucher issuers.
A member voucher promises that member's service; a collective voucher promises the collective's
service. The member roster, service units and capacity still need issuer confirmation.

The user clarified that the same commitment can receive vouchers and G$, with both terms agreed
at acceptance. The
[accepted specification](spec.md) keeps independent reward receipts linked to one fulfillment,
with the existing core and G$ rail unchanged in the earned-voucher slice. A new module binds voucher terms/consent and a Gnosis
adapter distributes from a finite issuer reserve allowance. Older core-upgrade and mint-writer
proposals and the earlier G$ installment plan are superseded.

The subsequent 21 October planning decision includes gardeners spending their own G$ on offers
across gardens, alongside voucher redemption. G$ stays on Celo. The planned default reuses the
buyer's garden Safe for personal deposits and the existing payout/refund rail, with narrow future
changes to opt-in offer eligibility and settlement funding. Buying does not require joining the
provider's garden or authorize spending another garden's treasury. This is planning scope only;
the amendment alone did not dispatch implementation. The later user request dispatched the
[service contracts](handoffs/codex-service-access-execution.md), followed by the
[local integration sequence](handoffs/codex-service-access-integration.md).

The separately dispatched [direct Gnosis purchase slice](handoffs/codex-contracts-purchases.md)
reuses CLC's bounded pool swap to a named learner. WXDAI is a local-rehearsal payment asset only.
This slice does not implement personal G$ purchases, service discharge or an app checkout.

Green Goods records commitments, evidence, confirmation and support. Cosmo-Local supplies the
planned service-voucher exchange mechanism. The passport makes their relationship understandable
to communities, the Nigerian diaspora and institutions without requiring them to understand chains.

## Broader hub scope (later slices included)

- One shared curated Gnosis exchange pool for individual and collective issuers, earned reserve delivery and bounded direct purchases,
  service presentment and discharge, and explicit failure/recovery behavior.
- Personal G$ service purchases across garden and protocol pools, with bound buyer consent,
  recorded funding, provider acceptance and mutually exclusive Celo payout/refund outcomes.
- A passport joining actual funding, issuance and delivery receipts with capacity and obligations.
- Pilot terms and consent, a local fork rehearsal, and a separate human decision on any live use.
- Research, pitch and Q4 strategy content explaining hub, community, diaspora and institutional participation.
- Coordinated PWA simplification (the PWA Home hub closed on 26 October 2026; its row is in `.plans/ARCHIVE.md` and its files are in Git history) and admin/PWA cohesion,
  delivered in Green Goods 2.1.0 with their own design and acceptance gates.

The [four-goal delivery alignment](delivery-alignment.md) owns current priorities, issue homes and
dependencies. Cosmo-Local owns integration and narrative; 2.1.0 owns the app and public-site delivery.
Use voucher for the issuer instrument; retain Cosmo-Local Credit as the product-family name.

[Garden Fiat Contributions](https://linear.app/greenpill-dev-guild/project/garden-fiat-contributions-3675da59ceb3)
retains the fiat-onramp stretch. Its provider qualification, email wallet, gas sponsorship, payment
recovery and live-pilot approval remain separate. A blocked stretch does not block the core pitch.

## What is already true

The 21 October earned-voucher slice adds exact-revision consent, canonical earned allocation,
reserve delivery under a finite allowance, authenticated acknowledgments and recoverable failures without changing
the core or G$ rail. Current commands, fork pins, working-tree proof and limits are in
[the contracts handoff](handoffs/codex-contracts.md). This does not complete the broader lifecycle.

The 9 October [whitepaper review](whitepaper-v8-review.md) found implemented commitment, settlement,
yield and certificate foundations in checkout `06a31dbf5`, but no CLC runtime integration. Its 275
passing focused contract tests establish only the tested foundation behavior. They are not an
integration proof, security audit or current deployment certificate.

Commitment Pooling's Linear project is closed as the foundation. Its source hub remains available
for unresolved operational evidence, now tracked in this project. No unfinished lane was certified
by the project move; see [the reconciliation record](project-reconciliation.md).

## Decisions still needed

Each collective and individual issuer must approve real service prices, available capacity, signer identities and concrete
reward/purchase terms before live use. Canonical earned allocation and later partial-delivery,
discharge and remedy rules follow the accepted spec. Terms and reporting consent are
separate. A token holding limit is not a loan facility or proof of service capacity.

The live release must address remaining technical gates explicitly. External audit and the older
testnet waiting period are superseded by the accepted hackathon disposition, and no mandatory
upgrade delay remains. The separate PWA hub preserves its accepted design and execution gates. RESR-94
records the first diaspora audience and scenario asks; the exact first supporter, payment method and final COM-46 prices/capacity remain open.

## Evidence of success

Demonstrate a useful, understandable service journey and a supporter who can follow funding to
delivery. Record whether third-party exchange is actually useful; low demand or bilateral-only
use is a valid finding. Keep native service units, money, voucher balances and impact claims distinct.

## Read next

- [Architecture](spec.md), [work and decisions](plan.todo.md), [acceptance evidence](eval.md).
- [Prepared local-branch service-access prompt](handoffs/codex-service-access.md), no worktree.
- [Claude Fable research and pitch handover](handoffs/claude-fable-research-pitch.md).
- [Prior discussion](hackathon-discussion.md) and [v0.8 review](whitepaper-v8-review.md), dated evidence.

The August weighted-contribution design is superseded. Its version remains in Git history at
`06a31dbf5`; it is not the October build. The older [tensions](tensions.md) and [resources](resources.md)
remain useful historical research with the authority and freshness limits stated there.
