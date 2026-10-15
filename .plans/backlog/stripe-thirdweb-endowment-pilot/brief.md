# Email-first endowment pilot — US and EU first

[Linear project](https://linear.app/greenpill-dev-guild/project/garden-fiat-contributions-3675da59ceb3) · [pilot roadmap](https://linear.app/greenpill-dev-guild/issue/PRD-1031) · [readable Linear specification](https://linear.app/greenpill-dev-guild/document/email-first-endowment-pilot-useu-priorities-and-regional-gates-f0623203e286). The repository hub owns execution detail; the existing issues provide visibility. See the [sync handoff](handoffs/linear-sync.md) for their mapping and verified state.

Prioritize donors in the **United States and European Union**. These regions have a documented Stripe on-ramp path and are the user's expected initial sources of capital. The capital-flow expectation is a product strategy assumption, not a measured demand finding. Gardens in Brazil, South Africa and Nigeria can remain intended beneficiaries; donor eligibility and garden location are separate checks.

Start with Stripe's direct Embedded Components Onramp and a thirdweb email wallet. Prove US credit-card purchases at L0, then a separate EU cohort with the required identity verification. Both must fund the selected Arbitrum endowment automatically, with donor-owned redeemable shares and no second endowment confirmation. The EU route is **not L0**: Stripe documents mandatory ID and selfie verification.

The user clarified on 2026-10-14 that this pilot is **endowment-based**. The donor retains the redeemable position; the garden benefits from yield according to the selected vault's rules. An irrevocable donation transfers funds to the garden and is a separate flow.

## Regional sequence

| Priority | Donor cohort | Payment choice | Present decision |
| --- | --- | --- | --- |
| 1A | US | Stripe direct, Visa/Mastercard credit cards; target eligible L0 users | First implementation candidate; entitlement, vault and automatic execution unverified |
| 1B | EU | Same Stripe integration, locally issued credit cards; mandatory L2 | Initial capital-acquisition priority alongside the US; a separate verification/UX gate |
| 2 | Brazil / Brasil | Ramp Pix first; compare Fonbnk Pix before selecting one route; Ramp credit card as a separate method | Conditional expansion after the US/EU foundation; lighter KYC and unattended payment completion unverified |
| 3 | South Africa | Fonbnk ZAR bank redirect | Conditional; must prove local verification, all-in costs and delayed automatic completion |
| 4 | Nigeria | Fonbnk NGN bank transfer, feasibility only | No-go for the target experience today: documented manual confirmation must be removed and verified first |

Keep the implementation shortlist to Stripe, Ramp and Fonbnk. MoonPay remains a documented card comparator, not another adapter to build. See [regional choices and evidence](regions.md) for verification gaps and sources. No region is approved for production by this plan.

## Shared scope and proposed cohorts

- One existing garden and one verified, deployed Arbitrum One vault; one accepted asset and one conversion route if required.
- thirdweb for email recovery, donor signing and sponsored execution in every cohort. No required passkey, seed phrase, wallet selector or donor-managed gas/conversion.
- US: three first-time participants and two repeats; five proposed $50 contributions across Visa/Mastercard, two issuers and two eligible states. Budget proposal: $250 principal plus $50 fees.
- EU: two first-time participants in two provider-approved EU countries and one repeat; three proposed €50 contributions, across two issuers. Budget proposal: €150 principal plus €30 fees. Measure first-time L2 separately from returning checkout.
- Later regions: preflight first; propose two first-time attempts and one repeat per selected route at approximately $50 equivalent in local currency, subject to local limits. Set a local-currency budget before each cohort; do not authorize all providers or countries as one test batch.
- Budgets are proposals, not spending authority. Include FX, issuer charges and any redemption costs before live approval. Tests establish feasibility, not population-wide reliability.

## Decision gates

1. The provider enables the exact country/payment/Arbitrum route and permits the redeemable endowment use case. A quote proves neither payment completion nor the customer's KYC tier.
2. An existing Arbitrum endowment preserves donor redemption rights and routes yield to the garden. The current public campaign manifests target Ethereum; they do not establish this prerequisite.
3. A donor-signed, bounded instruction can complete after funding without another confirmation, including when the checkout closes. No broad server access to donor funds.
4. Each cohort passes its own verification, payment, delay, cost and support gates. US L0 success does not approve EU L2 or local bank routes. See [go/no-go criteria](eval.md#regional-go-or-no-go).

If a prerequisite fails, stop that route and report the blocked requirement. Do not substitute Base, debit for credit-card proof, a direct donation, an organisation treasury, a new vault deployment or a second deposit button. Local bank/Pix routes are explicitly different payment methods, not evidence of credit-card acceptance.

Planning, the requested Linear sync and draft-PR publication only: no runtime changes, provider contact, accounts, personal-information submission, payments or deployments. See [specification](spec.md), [steps](plan.todo.md) and [acceptance checks](eval.md).
