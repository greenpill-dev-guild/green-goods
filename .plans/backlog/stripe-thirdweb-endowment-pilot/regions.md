# Regional choices and verification gaps

**Evidence date:** 2026-10-15. These are pilot selections, not production approvals. The donor's residence, actual location where relevant, payment issuer and provider account determine eligibility; the garden's location does not confer donor eligibility. The exact garden, beneficiary and endowment use case still require approval.

## Acquisition priority

US and EU donors are the first acquisition focus because a common Stripe integration is documented there and the user expects capital to flow primarily from these regions initially. Validate that expectation through opt-in interest, attempted/completed contributions and net principal by donor region; do not present it as established market research. Brazil, South Africa and Nigeria remain later local-donor pilots. Their payment gaps must not hold up an independently passing US/EU route.

## Provider decisions

| Cohort | Primary route and alternative | Documented verification | Unresolved before live enrollment |
| --- | --- | --- | --- |
| US, priority 1A | Stripe direct Embedded Components + thirdweb. Actual Visa/Mastercard credit cards. | Link account; L0 name, phone, email and address. Risk may require DOB/SSN or ID/selfie. | Product entitlement, supported state/card pair, exact Arbitrum preview parameters, genuine first-time L0 eligibility and issuer treatment. Stop this L0 attempt before charging on step-up. |
| EU, priority 1B | Same Stripe integration; locally issued credit cards in two approved EU countries. | Mandatory L2 document/selfie, EU information/identifiers as applicable and terms attestation; not US L0. | Country-specific card/fiat quote, verification completion/drop-off, reusable Link verification, exact asset route and total cost. Higher-value wallet verification is outside the small cohort and remains a separate expansion gate. |
| Brazil / Brasil, priority 2 | Ramp Pix first; compare Fonbnk Pix in preflight and select one. Test Ramp Visa/Mastercard credit separately if card demand warrants it. | Ramp's 2024 CPF+selfie route conflicts with its current generic ID requirement. Fonbnk basic/advanced requirements depend on the actual order. | Current lighter-verification eligibility, Portuguese UX, final Pix flow and automatic reconciliation. Fonbnk's docs classify Brazil bank payments as manual despite the public Pix quote. No claim of selfie-free onboarding. |
| South Africa, priority 3 | Fonbnk ZAR bank redirect. No card support claimed for this route. | Fonbnk describes basic name/DOB/ID-number verification; query actual order requirements, including step-up. | Enabled local ID types, bank/payment partner, all-in FX cost, actual settlement and authorization lifetime. Docs allow up to two business days. |
| Nigeria, priority 4 | Fonbnk NGN bank transfer; investigation only until manual steps are resolved. No card support claimed. | BVN required for on-ramping. Docs disagree on the availability of advanced verification. | Named operating entity/local payment partner and permissions, BVN/step-up behavior, automated payment matching, failure/refund SLA and removal of manual payer/agent confirmation. Current documented flow fails the intended checkout. |

The integration shortlist is **Stripe, Ramp and Fonbnk**. Choose one provider per enabled country/method; do not build a dynamic provider marketplace for this pilot. Switching provider is a new disclosed checkout with its own consent/KYC, never an automatic retry after an uncertain charge.

MoonPay is a comparison-only fallback: it documents credit cards in supported regions and does not exclude these three countries, but its Africa/Latin America verification includes ID/selfie and other information. Its Express tier is US/Canada only, and guest checkout is US-only through Apple Pay/Google Pay. A local credit issuer accepting the payment remains unverified. No MoonPay adapter is scheduled unless the selected route fails and scope is reconsidered. Ramp explicitly excludes Nigeria. Transak was not selected: the public coverage page did not corroborate these countries during research; that observation does not prove a universal contractual prohibition.

## Evidence register

| Class | Source and bounded finding | What it does not prove |
| --- | --- | --- |
| Official docs, refreshed today | [Stripe overview](https://docs.stripe.com/crypto/onramp/embedded-components-overview): US/EU, credit cards, Arbitrum USDC, required Link; New York excluded and US Amex not accepted. | Entitlement or successful combined route for this organisation/customer |
| Official docs, refreshed today | [Stripe US KYC](https://docs.stripe.com/crypto/onramp/kyc-integration-guide): tiered verification and risk step-ups. [Stripe EU KYC](https://docs.stripe.com/crypto/onramp/eu-kyc-integration-guide?platform=web): mandatory L2; nationality/residence identifiers as applicable; wallet ownership challenge for purchases at or above €1,000. | L0 availability in Europe, frictionless first checkout, or verified Arbitrum smart-wallet challenge compatibility |
| Official docs, researched today | [Ramp methods](https://support.rampnetwork.com/en/articles/12630-what-payment-methods-can-i-use-to-buy-crypto), [assets](https://support.rampnetwork.com/en/articles/432-what-cryptoassets-does-ramp-network-support) and [excluded countries](https://support.rampnetwork.com/en/articles/433-which-countries-and-us-states-are-unsupported-for-buying-and-selling-crypto): Pix/credit, Arbitrum ETH/USDC, Nigeria excluded. | Every country/payment/asset combination or endowment approval |
| Conflicting official docs | [Ramp CPF+selfie announcement, 2024](https://rampnetwork.com/blog/revolutionizing-crypto-purchases-ramp-network-unveils-document-free-verification) versus [current general KYC](https://support.rampnetwork.com/en/articles/441-what-are-the-kyc-limits-and-requirements). | Current document-free entitlement; neither promises selfie-free verification |
| Official docs, researched today | [Fonbnk coverage](https://docs.fonbnk.com/supported-countries-and-cryptocurrencies) lists all three countries and native Arbitrum USDC; [payment channels](https://docs.fonbnk.com/fiat-payment-channels) distinguish Brazil/Nigeria manual payments from South Africa redirect. | Fully automatic settlement, a license for this use case, or the requested donor experience |
| Conflicting official docs | [Fonbnk KYC](https://docs.fonbnk.com/kyc) and [order-specific KYC](https://docs.fonbnk.com/server-to-server/api-endpoints/get-user-kyc-state) agree on Nigerian BVN but disagree about advanced verification availability. | A guaranteed basic-only flow or functioning step-up recovery. The KYC-state GET can register a new user: never treat it as a harmless anonymous lookup. |
| Official comparator docs | [MoonPay verification](https://dev.moonpay.com/platform/guides/verification-tiers), [guest checkout](https://dev.moonpay.com/platform/guides/guest-checkout), [payments](https://support.moonpay.com/en/articles/389117-payment-methods-settlement-times-and-limits) and [country exclusions](https://support.moonpay.com/en/articles/380968-moonpay-s-unsupported-countries). | L0-like entry in Africa/Latin America or actual locally issued credit-card success |

## Public browser observations

Research on 2026-10-15 used a public, unauthenticated **Codex in-app browser** session. [Fonbnk's widget](https://pay.fonbnk.com/) displayed the following estimates for **receiving 50 USDC on Arbitrum**, not for spending exactly US$50:

| Quote selector | Displayed local payment | Displayed estimated fee |
| --- | --- | --- |
| Brazil, Pix | R$256.70 | 0.08 USDC |
| South Africa, bank transfer | R934.79 | 0.00 USDC |
| Nigeria, bank transfer | ₦70,670 | 1.29 USDC |

Quotes expire and were not accepted. The exchange rate may contain a spread; a zero fee label is not proof of zero cost. The widget showed Amount, Wallet, Login, ID Check, Details, Pay and Status stages. No wallet, email, identity or card information was submitted. The MoonPay public checkout did not render a usable form in this session. No browser evidence established KYC completion, bank/card acceptance, delivery or an endowment.

## Costs, delays and support to resolve

- Ramp's [pricing policy](https://rampnetwork.com/pricing-policy) publishes processing rates up to 2.9% for Pix, 3.9% for USD/EUR/GBP cards and 5.45% for other card currencies, with minimum-fee provisions and network costs. Its indicative Pix/card payment times exclude KYC and complete endowment execution. Use the actual quote and current minimum for the selected route.
- Fonbnk fees, limits and availability must come from the enabled route's quote. Verify local bank charges and FX separately. South Africa's documented bank delay must fit the signed execution validity policy, including weekends. Manual routes cannot be relabeled automatic because they expose webhooks.
- MoonPay's comparator docs give a $20-equivalent minimum and one-business-day Pix settlement. Its [refund policy](https://support.moonpay.com/en/articles/386106-transactions-faq) does not permit ordinary reversal of completed crypto purchases. Do not transfer this policy to other providers without confirming their terms.
- Before any live cohort, obtain provider approval for a donor-owned redeemable endowment, exact local operating/payment entities, receiving-organisation requirements, failed-payment refunds and support escalation/response times. Country and asset coverage are insufficient. No provider has been contacted or has approved this use case through this work.
- Green Goods should own the donor's support entry point, coordinate provider payment/KYC issues and own deposit/recovery issues. Agree who issues the purchase receipt, who refunds failed fiat payments and who resolves a delivered-but-not-deposited balance. The Green Goods receipt certifies a confirmed endowment, not tax deductibility or immediate spendable garden principal.
