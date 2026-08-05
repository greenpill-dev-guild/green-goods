# Adversarial review: Capital Off-Ramp Corridors

**Linear**: RESR-71  
**Source reviewed**: `brief.md`, created 2026-08-03  
**Review posture**: Public-source correction record only. No provider contact, implementation, partner commitment, or legal conclusion.  
**Access date convention**: All sources below were accessed 2026-08-04 UTC unless a different date is stated.

## 1. Verdict

The brief's country-by-country recommendation does **not** survive as an implementation or provider-selection basis. The broad direction survives: keep Green Goods non-custodial, use licensed local rails, preserve Arbitrum where a provider accepts inbound Arbitrum USDC, and obtain legal review before Green Goods or a garden uses a business payout account. The proposed execution path does not. Nigeria's recommended Breet route rests on an unsupported SEC-licensing claim and omits a $15 USDC deposit minimum and withdrawal fees; Yellow Card and Fonbnk expose user-KYC widget paths that break the brief's central two-shape/disjoint-set argument; the Transak coverage needed for Brazil is not established by the cited public material; Brazil's October 2026 rules are materially misread; the South African communication is misnumbered; and the US tax threshold and GENIUS Act effective date are stale or wrong. No corridor should be scope-locked from the brief alone. South Africa has the strongest verified Arbitrum venue path, but an inside-PWA route still needs a live quote and integration eligibility check. Nigeria, Brazil, and the United States all require a new provider and legal-facts matrix before a recommendation.

## 2. Correction record

### Fees and economics

#### Claim 1 — Mainstream widgets are roughly 1% with a ~$3.99 minimum and unusable below ~$150

**CORRECTED.**

- Ramp does not currently publish a universal `0.99% / $3.99 minimum` off-ramp tariff. Its pricing policy describes variable processing fees, with bank-transfer percentages up to 1.40%, card percentages up to 5.45%, PIX up to 2.90%, and a minimum processing fee of up to €2.49. Network and partner fees can also apply. [Ramp pricing policy](https://rampnetwork.com/pricing-policy) (accessed 2026-08-04).
- MoonPay advertises sell fees “from 1%,” but its formal pricing disclosure says direct transaction fees may be up to 4.5% and a minimum fee may be up to $3.99 below a transaction threshold. The public materials do not support the brief's formulation of `1% + $3.99`; a minimum fee is not an additive fixed fee on every transaction. [MoonPay Sell](https://www.moonpay.com/sell) and [MoonPay pricing disclosure](https://www.moonpay.com/en-ca/legal/pricing_disclosure) (accessed 2026-08-04).
- If a venue charged 1% subject to a $3.99 minimum, the fee stops being the minimum at about $399, not $150. At $150 it is still 2.66%. Whether that is “unusable” is a product threshold, not a verified market fact.
- MoonPay's asset-level minimums are also material: its current support table lists minimum sell amounts that vary by asset and network, including $15 for several USDC routes. [MoonPay minimum sell amounts](https://support.moonpay.com/en/articles/384277-how-do-i-sell-cryptocurrency-with-moonpay) (accessed 2026-08-04).

The brief's comparative fee table should not drive selection without corridor-specific live quotes showing the amount received after provider fee, spread, network fee, and bank-payout fee.

#### Claim 2 — Breet charges up to 0.5% with no setup, monthly, or hidden-spread fee

**CORRECTED.**

Breet's current Partner Dashboard article says the API fee is a flat 0.5%, while its business marketing page says “up to 0.5%.” Both say there is no setup or monthly charge. The provider also states that it does not add a hidden spread, but that is a provider representation, not an independently audited effective-rate finding. [Breet Partner Dashboard](https://help.breet.io/en/articles/12150186-what-is-the-breet-api-partner-dashboard), [Breet Business API](https://breet.io/business/api), and [Breet API FAQs](https://docs.breet.io/faqs) (accessed 2026-08-04).

The same FAQ discloses additional transaction costs the brief omitted: crypto withdrawals can incur roughly $0.50–$4 network fees and naira withdrawals incur ₦50. “0.5% with no other cost” is therefore not established. The official pages' “flat” versus “up to” wording should be resolved in binding pricing before use.

#### Claim 3 — Yellow Card charges a ~2–3% spread with no fixed floor

**CORRECTED.**

Yellow Card's current Payment API pricing is corridor- and rail-specific, not a universal 2–3% spread. Its published table lists a flat ₦100 Nigerian payout fee and a South African EFT payout fee of 0.25%, subject to a R10 minimum for the published R200–R60,000 bracket. The 2–3% figure appears in a supplier-payment page as an estimated saving over traditional rails, not as Yellow Card's tariff. [Yellow Card Payment API fees](https://help.yellowcard.io/articles/8792393400-supported-payment-methods-and-associated-fees-for-yellowcard-s-payment-api), [Yellow Card transaction limits](https://help.yellowcard.io/articles/1643131698-understanding-transaction-limits-in-the-payment-api), and [Yellow Card global supplier example](https://docs.yellowcard.engineering/docs/pay-global-suppliers-invoices) (accessed 2026-08-04).

A Yellow Card example also separates a service fee from a network fee, reinforcing that effective cost cannot be represented as spread alone. [Yellow Card direct settlement example](https://docs.yellowcard.engineering/docs/direct-settlement) (accessed 2026-08-04).

#### Claim 4 — Quidax is 0% swap plus ₦200 withdrawal; Busha naira in/out is free

**CORRECTED.**

- Quidax currently says Instant Swap carries no explicit fee, but naira withdrawal is ₦200 and withdrawals of ₦10,000 or more also incur a ₦50 stamp duty. Quidax also warns that rates can change. [Quidax fees](https://support.quidax.io/hc/en-us/articles/360016166012-What-fees-does-Quidax-charge) (updated 2026-06-15; accessed 2026-08-04).
- Busha's API documentation lists ₦100 for naira deposits and ₦100 for naira withdrawals. “Free NGN in/out” is false. [Busha fees](https://docs.busha.co/guide/reference/fees) (accessed 2026-08-04).

Neither fee page, by itself, proves that its retail tariff is available through an embedded third-party PWA flow.

#### Claim 5 — Coinbase CDP gives integrators 0% USDC on-ramp and off-ramp

**CORRECTED.**

Coinbase does advertise zero-fee USDC on- and off-ramp for qualifying applications, but the program is not an automatic entitlement for every developer integration. The launch page says it is available to select apps upon request, subject to qualification, region, and continuation of the offer; the FAQ directs developers to apply. [Coinbase zero-fee USDC launch](https://www.coinbase.com/developer-platform/discover/launches/zero-fee-usdc) and [Coinbase CDP Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq) (accessed 2026-08-04).

The defensible planning assumption is “potentially 0% after approval,” not “0% if integrated.”

### Nigeria safety and regulation

#### Claim 6 — Binance removed NGN services in early 2024, has not restored them, and has no Nigerian licence

**CORRECTED.**

Binance announced that NGN P2P pairs were removed on 2024-02-28, NGN deposits stopped on 2024-03-05, spot pairs were delisted on 2024-03-07, and NGN withdrawals stopped on 2024-03-08. The brief compresses those events into an inaccurate “all pairs in February” statement. [Binance NGN discontinuation announcement](https://www.binance.com/en/support/announcement/binance-to-discontinue-all-nigerian-naira-ngn-services-f9857dc2fea4448ba1fb8815d87d8144) (accessed 2026-08-04).

Nigeria's SEC warned that the named Nigerian operation was not registered or regulated, and Binance does not appear on the SEC's current registered-fintech/operator list. [Nigeria SEC Binance circular](https://home.sec.gov.ng/for-investors/keep-track-of-circulars/circular-on-the-activities-of-binance-nigeria-limited/) and [Nigeria SEC registered fintech operators](https://home.sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/) (accessed 2026-08-04).

The stronger dynamic assertion, “has not restored them as of August 2026,” is **UNVERIFIABLE** from the public pages reviewed. It would be settled by Binance's current Nigerian eligibility/support matrix and a live, eligible Nigerian account showing whether NGN deposit, withdrawal, spot, and P2P actions are actually available. The lack of an SEC listing remains sufficient to reject it as a Green Goods recommended licensed venue.

#### Claim 7 — The EFCC froze 1,100+ crypto traders' accounts, and freezes lock the whole account

**CORRECTED.**

The court order covered 1,146 bank accounts belonging to individuals and companies under investigation for unauthorised foreign-exchange dealing, money laundering, and related offences. Public reporting did not establish that all 1,146 belonged to “crypto traders”; one contemporaneous report said about 90% were accounts at traditional banks. [TheCable court-order report](https://www.thecable.ng/court-orders-efcc-to-freeze-1146-accounts-over-unauthorised-foreign-exchange-transactions/), [TechCabal account-freeze report](https://techcabal.com/2024/04/26/efcc-blocks-1146-accounts/), and [Punch investigation report](https://punchng.com/terrorists-using-cryptocurrency-traders-to-fund-insecurity-efcc/) (accessed 2026-08-04).

At least some accounts were later unfrozen by court order. [Nairametrics unfreezing report](https://nairametrics.com/2024/12/01/nigerian-court-unfreezes-n89-million-in-bank-accounts-previously-indicted-for-illegal-crypto-dealings/) (accessed 2026-08-04).

These reports show that a court can freeze an account during an investigation. They do **not** prove the categorical claim that every disputed P2P payment freezes a recipient's whole account rather than the disputed amount. That narrower operational claim is **UNVERIFIABLE** without the relevant bank terms, orders, and case records. P2P counterparty fraud remains a legitimate user-safety concern, but the brief overstates its evidence.

#### Claim 8 — MoonPay discontinued buy, sell, and swap service in Nigeria in June 2024

**CONFIRMED.**

MoonPay announced on 2024-06-21 that Nigerian customers could no longer buy, sell, or swap cryptocurrency through MoonPay. [MoonPay Nigeria service notice](https://www.moonpay.com/newsroom/nigeria) (accessed 2026-08-04).

This confirms the discontinuation event, not a general proposition that every MoonPay-powered aggregator route is permanently unavailable without a current eligibility check.

#### Claim 9 — SEC/ISA/ARIP status, first-global-exchange claim, and ₦2bn capital

**CORRECTED.**

- The Investment and Securities Act 2025 gives the SEC authority over digital-asset exchanges and virtual-asset service providers. [Nigeria Investment and Securities Act 2025](https://sec.gov.ng/documents/1326/INVESTMENT-AND-SECURITIES-ACT-NIGERIA-2025_1.pdf) (accessed 2026-08-04).
- ARIP/AIP is an incubation and provisional-admission path, not a final licence. On 2026-07-02 the SEC announced seven additional firms admitted in principle, explicitly stating that Approval-in-Principle is not final registration; a further two were announced on 2026-07-03. [SEC announcement of seven admissions](https://sec.gov.ng/for-investors/keep-track-of-circulars/sec-clears-seven-new-fintech-firms-for-admission-into-the-accelerated-regulatory-incubation-programme-arip/) and [SEC announcement of two additional VASPs](https://home.sec.gov.ng/for-investors/keep-track-of-circulars/sec-clears-further-2-additional-vasps-for-admission-into-the-accelerated-regulatory-incubation-programme-arip/) (accessed 2026-08-04).
- One announcement includes Luno, but the regulator does not call it “the first global exchange admitted.” That superlative is unsupported.
- The revised minimum capital for a Digital Asset Exchange is ₦2 billion, effective 2026-01-16 with a compliance deadline of 2027-06-30. [SEC revised minimum capital](https://sec.gov.ng/for-investors/keep-track-of-circulars/revised-minimum-capital-mc-for-regulated-capital-market-entities/) (accessed 2026-08-04).

The brief repeatedly treats ARIP/AIP admission as “licensed.” That is not how the SEC describes it and is a material due-diligence error.

### Provider capabilities

#### Claim 10 — Breet supports Arbitrum USDC, its stated API features, same-day KYB, and SEC ARIP licensing

**CORRECTED.**

- Breet currently lists USDC deposits on Ethereum, Solana, Arbitrum, Base, and Polygon, with a $15 minimum. Tron and BNB Chain are listed for USDT, not USDC. [Breet supported assets](https://docs.breet.io/supported-assets) (accessed 2026-08-04).
- Its public API materials support address generation, conversion/settlement, webhooks, NGN/GHS bank settlement, and business KYB. [Breet API FAQs](https://docs.breet.io/faqs) and [Breet Business API](https://breet.io/business/api) (accessed 2026-08-04).
- “Same-day” or “under 24 hours” is marketing language, not a service guarantee. Eligibility, remediation, and enhanced-due-diligence timing are not public.
- Breet is not listed on the Nigeria SEC's current registered-fintech/operator page. [Nigeria SEC registered fintech operators](https://home.sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/) (accessed 2026-08-04). The claim that Breet is SEC ARIP licensed is unsupported, and ARIP admission would not itself be a final licence in any case.

Arbitrum inbound compatibility survives, but the provider's regulatory status, $15 floor, and business-account eligibility materially weaken its rank.

#### Claim 11 — Yellow Card licences, 20+ countries, free supported-network transfers, and no Arbitrum

**CORRECTED.**

- Yellow Card's user-KYC widget says it supports buying and selling in 20 countries and can be embedded with a small amount of code. [Yellow Card Widget](https://help.yellowcard.io/articles/2764124561-yellow-card-widget) and [Yellow Card widget KYC](https://help.yellowcard.io/articles/1804731671-how-to-kyc-using-yellow-card-widget) (accessed 2026-08-04).
- Current widget network documentation lists USDC on Ethereum, Celo, Base, Stellar, Solana, and Polygon, but not Arbitrum. The settlement API likewise does not list Arbitrum. [Yellow Card widget assets](https://docs.yellowcard.engineering/v1.0.26/docs/supported-crypto-widget) and [Yellow Card settlement networks](https://docs.yellowcard.engineering/v1.0.26/docs/settlement-api) (accessed 2026-08-04).
- South Africa's published authorised-CASP list includes Yellow Card's South African entity. [FSCA authorised CASP list](https://www.fsca.co.za/Regulatory%20Frameworks/Documents/Published%20list%20of%20Authorised%20CASPs_18%20December%202024.pdf) (accessed 2026-08-04).
- The current Nigeria SEC operator list does not list Yellow Card. [Nigeria SEC registered fintech operators](https://home.sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/) (accessed 2026-08-04). No Kenyan regulator source found in this review substantiated the Kenyan licence claim. Those two country-licence claims are **UNVERIFIABLE** from the cited public regulatory records and require regulator entries or licence numbers.
- “Free stablecoin transfers” is not a safe pricing assumption for the required cash-out. Yellow Card publishes payout minimums/fees and its examples can include network fees. [Yellow Card Payment API fees](https://help.yellowcard.io/articles/8792393400-supported-payment-methods-and-associated-fees-for-yellowcard-s-payment-api) (accessed 2026-08-04).

Most importantly, the current user-KYC widget contradicts the brief's classification of Yellow Card as only a Shape 2 business payout API.

#### Claim 12 — VALR supports Arbitrum USDC deposit/withdrawal and is FSCA licensed

**CONFIRMED.**

VALR documents USDC deposits and withdrawals on Arbitrum, and the FSCA's authorised-CASP list includes VALR's South African entity. [VALR Arbitrum USDC support](https://support.valr.com/hc/en-us/articles/10810569257628-USDC-Deposits-Withdrawals-on-Arbitrum-Avalanche-Solana-Base-and-Ethereum) and [FSCA authorised CASP list](https://www.fsca.co.za/Regulatory%20Frameworks/Documents/Published%20list%20of%20Authorised%20CASPs_18%20December%202024.pdf) (accessed 2026-08-04).

The brief omits useful current economics: VALR says crypto deposits are free, normal ZAR bank withdrawals are free for the first 30 monthly withdrawals and R8.50 thereafter, and fast withdrawals are R30. [VALR charges](https://support.valr.com/hc/en-us/articles/360015777451-What-are-VALR-s-charges) (accessed 2026-08-04). What remains unverified is an embeddable third-party off-ramp flow; asset support in a consumer account is not an integration API.

#### Claim 13 — Kotani Pay integrates 15+ chains including Arbitrum and Celo

**CONFIRMED.**

Kotani's API site says it supports 15+ chains, including Arbitrum and Celo. More importantly for this use case, its create-crypto-deposit API explicitly lists USDC on Arbitrum and Celo as inbound assets, rather than merely generic transfer support. [Kotani APIs](https://kotanipay.com/apis) and [Kotani create crypto deposit](https://docs.kotanipay.com/reference/depositcryptointegratorcontroller_createcryptodeposit) (accessed 2026-08-04).

This confirms the technical asset path, not country eligibility, business-account eligibility, retail pricing, or a minimum payout.

#### Claim 14 — Fonbnk converts airtime at ~$0.01 granularity and supports Nigerian bank/airtime cash-out

**CORRECTED.**

Fonbnk's current coverage lists Nigeria with bank and airtime payouts. It also lists South Africa with bank/airtime and Brazil with bank payouts, and its current asset documentation includes Arbitrum USDC for on- and off-ramp. [Fonbnk supported countries/assets](https://docs.fonbnk.com/supported-countries-and-cryptocurrencies), [Fonbnk current coverage](https://www.fonbnk.com/), and [Fonbnk off-ramp parameters](https://docs.fonbnk.com/v1.5/off-ramp/url-parameters) (accessed 2026-08-04).

The ~$0.01 granularity claim is unsupported. Fonbnk exposes a minimum-order endpoint, and its published example returns a minimum of about $1.02, not $0.01. That example is not proof of a universal floor, but it directly defeats the brief's asserted granularity. [Fonbnk off-ramp endpoints](https://docs.fonbnk.com/v1.5/endpoints/off-ramp) (accessed 2026-08-04).

The brief also describes Fonbnk as “Stellar-centric,” which is stale relative to its current Arbitrum support. Fonbnk is a missed cross-corridor Shape 1 candidate, subject to live pricing, counterparty model, and regulatory review.

#### Claim 15 — Transak has 40+ off-ramp countries including Brazil PIX; Nigeria unresolved

**CORRECTED.**

Transak's current public pages use several different counts: the off-ramp page says 64+ countries and USDC on four chains, while Stream says 64+ countries, 40+ cryptocurrencies, and 29+ networks. The brief appears to have conflated the cryptocurrency count with country coverage. [Transak Off-Ramp](https://transak.com/off-ramp), [Transak Stream](https://transak.com/stream), and [Transak off-ramp documentation](https://docs.transak.com/products/off-ramp) (accessed 2026-08-04).

The public integration documentation confirms an off-ramp widget/SDK/iFrame. It also says off-ramp is not available through the whitelabel API, so “widget” and “headless API” must not be conflated. [Transak API integration limits](https://docs.transak.com/integration/api) (accessed 2026-08-04).

Transak's public fiat-currency API schema exposes whether payout is enabled and its minimum, but the live public request returned access denied during this review. The indexed primary pages reviewed do not establish NGN payout or Brazil PIX payout for the required asset/network/user combination. [Transak fiat-currency API](https://docs.transak.com/api/public/get-fiat-currencies) (accessed 2026-08-04).

Therefore:

- Nigeria remains **UNVERIFIABLE**. Settle it with a current successful quote for an eligible Nigerian user and the provider's current country/currency response.
- Brazil PIX is also **UNVERIFIABLE** from the primary public evidence found. Settle it with a current BRL payout quote identifying PIX, USDC, the network, minimum, and total recipient amount.

Transak cannot responsibly be assigned ZA + BR + US coverage in an implementation plan from these pages alone.

#### Claim 16 — Onramper has 8 off-ramps/46 fiat currencies, widget and headless, with unresolved NGN/ZAR

**CORRECTED.**

Onramper currently markets 8 off-ramp providers, while its widget documentation says 7+; the public pages reviewed do not substantiate “46 fiat currencies.” Its widget and off-ramp parameters are documented. The branded “Headless Ramps” page is framed around fiat-to-crypto buying and does not clearly promise a headless off-ramp equivalent, although provider-specific off-ramp initiation is documented. [Onramper Offramp](https://onramper.com/products/offramp), [Onramper Widget](https://docs.onramper.com/docs/widget), [Onramper off-ramp parameters](https://docs.onramper.com/docs/supported-widget-parameters-offramp), [Onramper Headless Ramps](https://onramper.com/products/headless-ramps), and [Onramper provider flow](https://docs.onramper.com/docs/offramp-process-flow) (accessed 2026-08-04).

The unresolved country question can now be answered:

- Nigeria is listed with off-ramp providers, and Onramper's Nigeria page reports three off-ramps. [Onramper off-ramp countries](https://knowledge.onramper.com/off-ramp-supported-countries) and [Onramper Nigeria coverage](https://onramper.com/country-coverage/NG) (accessed 2026-08-04).
- South Africa is listed with off-ramp providers, and its country page reports five off-ramps. [Onramper South Africa coverage](https://onramper.com/country-coverage/ZA) (accessed 2026-08-04).

Coverage is therefore **confirmed at aggregator level**, but it does not prove that every downstream combination accepts Arbitrum USDC, pays the desired local rail, or has viable $5–$100 economics.

#### Claim 17 — Nubank has 112M Brazilian customers, supports USDC, and exposes no third-party off-ramp API

**CORRECTED.**

Nubank's April 2026 public statement gives 113 million customers in Brazil and more than 60% of the adult population, not 112 million. Its public consumer material confirms USDC availability and rewards in Nubank Cripto. [Nubank 2026 Brazil investment/customer announcement](https://international.nubank.com.br/pt-br/companhia/nubank-investira-r-45-bilhoes-no-brasil-em-2026/) and [Nubank USDC rewards](https://international.nubank.com.br/consumers/nubank-expands-usdc-rewards-program-to-all-customers/) (accessed 2026-08-04).

“No third-party off-ramp API” is **UNVERIFIABLE** as an absence claim. No public API was found, but absence from indexed public documentation is not proof that no affiliate, banking, or private partner interface exists. Nubank should be excluded from an implementation shortlist until a public integration product or documented partner path exists; that is different from asserting that none exists.

### Regulation

#### Claim 18 — Brazil's 2026 framework, $100k cap, October stablecoin ban, and local-partner deadline

**CORRECTED.**

- BCB Resolutions 519, 520, and 521 entered into force on 2026-02-02. The BCB states that specified virtual-asset activities are treated as foreign-exchange operations and that a $100,000 transaction limit applies to payment/international-transfer operations where the counterparty is not authorised to operate in FX. It is not a general $100,000 cap on every “standard VASP” transaction. [BCB framework summary](https://www.bcb.gov.br/detalhenoticia/20918/nota?s=08) and [BCB Resolution 521](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=521&tipo=Resolu%C3%A7%C3%A3o+BCB) (accessed 2026-08-04).
- Resolution 520's October rule prevents BCB-authorised institutions from enabling virtual-asset activity with a provider that is neither authorised nor in the authorisation process. Its transition provisions for foreign providers are more specific than “must have a local subsidiary or Brazilian SPSAV partner.” [BCB Resolution 520](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=520&tipo=Resolu%C3%A7%C3%A3o+BCB) (accessed 2026-08-04).
- Resolution 561 revises the electronic-FX framework effective 2026-10-01 and restricts electronic FX to authorised institutions. Neither the resolution nor the BCB summary reviewed states the brief's categorical claim that electronic-FX providers are barred from stablecoin cross-border remittance. [BCB Resolution 561](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=561&tipo=Resolu%C3%A7%C3%A3o+BCB) and [BCB Resolution 561 summary](https://www.bcb.gov.br/detalhenoticia/21110/nota) (accessed 2026-08-04).

The brief's “scheduled expiry” conclusion for an aggregator and its “licensed Brazilian SPSAV” prescription do not follow directly from these rules. A Brazil route needs counsel to map the actual entities and transaction roles to BCB authorisation and FX requirements; provider marketing is not enough.

#### Claim 19 — South African CASP counts, exchange-control rewrite, Joint Communication 1, and ZARU

**CORRECTED.**

- At 2026-03-31, the FSCA reported 533 licence applications received, 310 approved, 17 declined, and 124 withdrawn. That supersedes the brief's end-2025 snapshot of 300/512 for current planning. [FSCA 2026 CASP update](https://docs.publicnow.com/viewDoc?filename=77945%2FEXT%2F982BDB6F529F1EDFC1C68441F7D06DCE7F675D5A_B5FB125B8D7F9D82772EF0E798B80CE5011524B6.PDF) and [SARB 2026 Financial Stability Review](https://www.resbank.co.za/content/dam/sarb/publications/reviews/finstab-review/2026/first-edition/first-fsr.pdf) (accessed 2026-08-04).
- South Africa is rewriting its exchange-control framework, but the replacement framework was still a draft consultation, not operative law, in the public material reviewed. [SARB capital-flow framework comment notice](https://www.resbank.co.za/en/home/publications/publication-detail-pages/media-releases/2026/capital-flow-comment) and [SARB draft framework extension](https://www.resbank.co.za/en/home/publications/publication-detail-pages/media-releases/2026/draft-capital-flow-extend) (accessed 2026-08-04).
- Joint Communication 1 of 2026, dated 2026-03-24, concerns the transition from JIBAR. The domestic-payment crypto communication dated 2026-05-28 is **Joint Communication 4 of 2026**, not 1. [SARB Joint Communication 1](https://www.resbank.co.za/en/home/publications/publication-detail-pages/prudential-authority/pa-public-awareness/Communication/2026/Joint-Communication-1-of-2026) and [Joint Communication 4: crypto assets for domestic payment](https://www.resbank.co.za/content/dam/sarb/what-we-do/payments-and-settlements/regulation-oversight-and-supervision/designation-notices/280526%20Joint%20Communication_Crypto%20assets%20for%20domestic%20payment%20purposes.pdf) (accessed 2026-08-04).
- ZARU launched in February 2026 and was initially available only to qualified institutional participants. [ZARU launch notice](https://zaru.network/blog/leading-south-african-financial-institutions-launch-rand-stablecoin) (accessed 2026-08-04).

The brief is directionally right that exchange control matters, but it cites the wrong communication and speaks about draft rules too conclusively.

#### Claim 20 — US GENIUS Act, wallet scope, FinCEN NPRM, $600 reporting, and Form 1099-DA

**CORRECTED.**

- The GENIUS Act became law on 2025-07-18, but its operative effective date is the earlier of 18 months after enactment or 120 days after the primary federal regulators issue final implementing regulations. That is not 2026-05-01. Current agency material reviewed was still proposed, not a final rule that would start the 120-day clock. [GENIUS Act, Public Law 119-27](https://www.govinfo.gov/content/pkg/PLAW-119publ27/html/PLAW-119publ27.htm) and [OCC proposed GENIUS Act rule](https://www.occ.treas.gov/news-issuances/bulletins/2026/bulletin-2026-3.html) (accessed 2026-08-04).
- The Act excludes qualifying self-custodial software from its “digital asset service provider” definition and preserves protected self-custody activity. That supports a narrow GENIUS Act scope statement, not a blanket conclusion about federal/state money-transmission, sanctions, consumer-protection, tax, or securities law. The brief's MiCA reference is irrelevant to a US-corridor conclusion. [GENIUS Act, Public Law 119-27](https://www.govinfo.gov/content/pkg/PLAW-119publ27/html/PLAW-119publ27.htm) (accessed 2026-08-04).
- FinCEN did publish an April 2026 proposed rule addressing AML/CFT requirements for permitted payment stablecoin issuers. [FinCEN GENIUS Act proposal](https://www.fincen.gov/news/news-releases/treasury-proposes-rule-implement-genius-acts-requirements-counter-illicit) and [FinCEN Federal Register notice](https://www.fincen.gov/resources/statutes-regulations/federal-register-notices/permitted-payment-stablecoin-issuer-anti) (accessed 2026-08-04).
- For payments made after 2025, the general information-reporting threshold for services is $2,000, indexed thereafter, not $600. Classification still matters: employee compensation is W-2 income; nonemployee service payments may require Form 1099-NEC; business/entity and other exceptions apply. [IRS information-return threshold](https://www.irs.gov/businesses/small-businesses-self-employed/am-i-required-to-file-a-form-1099-or-other-information-return), [IRS Publication 1099](https://www.irs.gov/publications/p1099), and [IRS digital-asset transaction FAQ](https://www.irs.gov/individuals/international-taxpayers/frequently-asked-questions-on-digital-asset-transactions) (accessed 2026-08-04).
- Form W-9 is a TIN-certification/request form, not a universal rule that every person receiving $600 must submit it “before first payment.” [IRS Form W-9](https://www.irs.gov/pub/irs-pdf/fw9.pdf) (accessed 2026-08-04).
- Form 1099-DA broker gross-proceeds reporting begins with sales/exchanges after 2025. That is separate from the payer's possible wage or nonemployee-compensation reporting. [IRS Form 1099-DA instructions](https://www.irs.gov/instructions/i1099da) (accessed 2026-08-04).

The US reporting issue is real, but the brief combines different reporting regimes and uses an obsolete threshold.

## 3. Reasoning review

### R1 — A business payout API changes Green Goods' regulatory position; a garden account holder mitigates it

**PARTLY HOLDS, but the central mitigation is not proved.**

FinCEN's money-transmitter definition turns on accepting currency, funds, or other value from one person and transmitting it to another location or person, subject to exclusions and the facts and circumstances. [31 CFR §1010.100(ff)](https://www.law.cornell.edu/cfr/text/31/1010.100), [FinCEN 2019 convertible-virtual-currency guidance](https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models), and [FinCEN 2013 virtual-currency guidance](https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering) (accessed 2026-08-04).

A user-KYC widget can keep the provider as the party receiving the user's asset and paying the user's own bank account. A business API can create a different fact pattern if its account holder receives value and directs payments to third parties. That distinction is real.

The brief makes two unjustified leaps:

1. A garden entity paying its own workers, vendors, or beneficiaries from its own assets may be paying its own obligations rather than transmitting value “on behalf of another.” That can reduce money-transmitter risk, but it depends on who owns the funds, owes the payment, controls the instruction, bears refunds/loss, and contracts with the recipient.
2. Merely putting the provider account in a garden's name does not settle Green Goods' role. If Green Goods controls the account, batches instructions, determines recipients, can redirect value, holds credentials, or acts as the garden's agent, regulators and providers can look through the label to the actual conduct. It also does not remove the garden's local payment, employment, tax, FX, or licensing obligations.

Yellow Card's B2B materials also require payer/payee KYC information for transactions, so Shape 2 does not automatically eliminate per-recipient compliance. [Yellow Card B2B Payment API FAQ](https://help.yellowcard.io/articles/1217049093-faq-b2b-payment-api) (accessed 2026-08-04).

Before Shape 2 is approved, counsel needs a concrete role-and-funds diagram for each corridor: legal payer, beneficial owner of the crypto, provider customer, API credential holder, instruction initiator, recipient relationship, refund recipient, fee payer, and settlement-record controller. Federal FinCEN analysis is only one layer; applicable state and local licensing must be assessed separately.

### R2 — Loved consumer apps and PWA-integrable providers are nearly disjoint, forcing exactly two shapes

**BREAKS.**

The brief missed or misclassified current hybrid paths:

- Yellow Card has a user-KYC buy/sell widget across 20 countries, including Nigeria and South Africa, alongside its business Payment API. [Yellow Card Widget](https://help.yellowcard.io/articles/2764124561-yellow-card-widget) (accessed 2026-08-04).
- Fonbnk has an embeddable user flow, supports Nigeria, South Africa, and Brazil payouts, and currently lists Arbitrum USDC. [Fonbnk supported countries/assets](https://docs.fonbnk.com/supported-countries-and-cryptocurrencies) and [Fonbnk widget flow](https://docs.fonbnk.com/widget-integration/how-it-works) (accessed 2026-08-04).
- Onramper aggregates off-ramp providers in Nigeria and South Africa through an embedded widget. [Onramper off-ramp countries](https://knowledge.onramper.com/off-ramp-supported-countries) (accessed 2026-08-04).

Consumer venue, embedded provider, aggregator, payout API, wallet-initiated order, and local operator distribution are not just two mutually exclusive shapes. The actual decision matrix has at least: who contracts with the provider; who completes KYC/KYB; who owns the crypto; who initiates the onchain send; whose bank account receives fiat; and whether the provider or Green Goods renders the user interface.

### R3 — Staying on Arbitrum is viable under the integrable set

**HOLDS technically, but is not yet a commercial route.**

The strongest flow-specific evidence is:

- Breet accepts inbound USDC on Arbitrum, with a $15 minimum. [Breet supported assets](https://docs.breet.io/supported-assets) (accessed 2026-08-04).
- Kotani's crypto-deposit endpoint explicitly accepts Arbitrum USDC. [Kotani create crypto deposit](https://docs.kotanipay.com/reference/depositcryptointegratorcontroller_createcryptodeposit) (accessed 2026-08-04).
- Fonbnk's current off-ramp parameters list Arbitrum USDC. [Fonbnk off-ramp parameters](https://docs.fonbnk.com/v1.5/off-ramp/url-parameters) (accessed 2026-08-04).
- VALR accepts Arbitrum USDC deposits and withdrawals in its consumer account. [VALR Arbitrum USDC support](https://support.valr.com/hc/en-us/articles/10810569257628-USDC-Deposits-Withdrawals-on-Arbitrum-Avalanche-Solana-Base-and-Ethereum) (accessed 2026-08-04).
- Yellow Card's current widget and settlement lists do not include Arbitrum. [Yellow Card widget assets](https://docs.yellowcard.engineering/v1.0.26/docs/supported-crypto-widget) (accessed 2026-08-04).

Arbitrum therefore does not need to be abandoned merely to make off-ramp possible. It does not follow that the recommended provider accepts the relevant entity, activates the route in the target country, or economically supports $5–$100. Each candidate still needs a live corridor quote and eligibility proof. Bridging should remain a fallback because it adds another quote, fee, confirmation, failure state, and recovery path.

### R4 — Transak for ZA/BR/US plus Breet for Nigeria covers all four

**BREAKS.**

The proposed minimum-coverage pair depends on four unproved or incorrect premises:

1. Breet is not established as SEC-licensed or ARIP-admitted by the current regulator list.
2. Breet's Arbitrum USDC route has a $15 deposit minimum and additional withdrawal/network fees.
3. Transak's public pages reviewed do not prove Brazil PIX or the required South African payout for the exact token/network/user combination.
4. Transak's public product is a user-KYC widget, not a headless off-ramp API, and its live fee/minimum response was not publicly retrievable in this review.

Current evidence instead warrants a short-list test, not a two-provider decision: Yellow Card widget/API, Fonbnk widget, Onramper widget, Breet API, Kotani API, VALR consumer route, Transak widget, and Coinbase CDP. The test must produce a quote and eligibility record at $5, $15, $20, $50, and $100 for each claimed corridor before ranking.

### R5 — Nigeria should be licensed-venues-only as a user-safety rule

**HOLDS as a conservative product policy, not as the factual deduction presented.**

The Nigeria SEC's public warnings and registry support limiting Green Goods recommendations to providers whose exact operating entity and authorisation status can be verified. [Nigeria SEC Binance circular](https://home.sec.gov.ng/for-investors/keep-track-of-circulars/circular-on-the-activities-of-binance-nigeria-limited/) and [Nigeria SEC registered fintech operators](https://home.sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/) (accessed 2026-08-04).

The brief's evidence does not establish that all P2P recipients face whole-account freezes or that a “licensed” venue eliminates counterparty fraud. A stronger rule is:

- no anonymous or social-channel counterparties;
- no provider whose exact Nigerian entity and current approval status cannot be matched to the regulator;
- no third-party bank-account payout or payer/payee name mismatch;
- explicit fee, dispute, refund, and support path before the user sends;
- clear warning that provider review or a bank restriction can delay access to funds.

The rule survives, but some venues the brief labels licensed, especially Breet and Yellow Card in Nigeria, are not substantiated by the current SEC list.

### R6 — The US needs no off-ramp integration and should be verification-only

**BREAKS as a categorical conclusion.**

The product question is an individual gardener turning a $5–$100 payout into spendable money from inside the PWA. Existing organisational bank accounts do not answer that individual flow. The US may have the least urgent integration because bank and exchange access is widespread, but “no integration” is a strategy choice, not a deduction from tax law.

The corrected $2,000 service-payment threshold means the brief also overstates how often a $5–$100 pilot payout necessarily triggers Form 1099-NEC. Reporting still depends on annual aggregate, payer/payee status, whether the payment is for services, employee classification, and exceptions. [IRS information-return threshold](https://www.irs.gov/businesses/small-businesses-self-employed/am-i-required-to-file-a-form-1099-or-other-information-return) (accessed 2026-08-04).

A low-scope US user-KYC off-ramp can still be valuable as a control corridor for KYC completion, quote expiry, state recovery, and settlement receipts. Coinbase CDP is a candidate, but its zero-fee offer and app eligibility must be approved rather than assumed.

## 4. Gaps and missed options

### 4.1 The strongest missed provider paths

1. **Fonbnk deserves a full candidate row.** Its current public materials list a user-facing widget, Arbitrum USDC, and bank/airtime payout coverage in Nigeria and South Africa plus bank payout in Brazil. That directly challenges the asserted need for a Nigeria-only Shape 2 account and the claim that Fonbnk is Stellar-centric. [Fonbnk supported countries/assets](https://docs.fonbnk.com/supported-countries-and-cryptocurrencies) (accessed 2026-08-04). Its marketplace/counterparty mechanics, exact fee, minimum, liquidity, disputes, and licensing role remain blockers, so this is a due-diligence candidate, not a recommendation.
2. **Yellow Card's user-KYC widget was missed.** It gives the same provider both a user-KYC and business-API path in African corridors, invalidating the brief's mutually exclusive classification. [Yellow Card Widget](https://help.yellowcard.io/articles/2764124561-yellow-card-widget) (accessed 2026-08-04).
3. **Onramper's NGN and ZAR question is resolved positively at aggregator level.** It may provide redundancy when a single downstream provider is unavailable, although each quote still inherits the downstream provider's KYC, network, fee, and country rules. [Onramper off-ramp countries](https://knowledge.onramper.com/off-ramp-supported-countries) (accessed 2026-08-04).
4. **Kotani's SMS path is relevant to the offline-first population.** It is not proof that the required off-ramp works offline, but it is the only public candidate found that deliberately exposes a feature-phone/SMS interaction surface. [Kotani SMS](https://kotanipay.com/sms) (accessed 2026-08-04).

No public-source candidate was verified as both **percentage-only with no minimum** and available for the required Nigeria or Brazil flow. Breet has a percentage API fee but a $15 USDC deposit minimum. Yellow Card has published minimums/fixed components. Fonbnk exposes a minimum endpoint. Any “no floor” recommendation remains unproved.

### 4.2 Minimum transaction amounts that can be resolved now

The brief says no provider minimum could be confirmed. Several can:

| Provider/path | Public minimum evidence | Consequence |
|---|---|---|
| Breet USDC deposit | $15 on supported USDC networks, including Arbitrum | Excludes $5 and likely $10 payouts from the direct route |
| MoonPay sell | Asset/network dependent; several USDC routes list $15 | Excludes the smallest target payouts |
| Yellow Card Payment API | Nigeria send minimum ₦1,800; South Africa R200 in the published bracket | Must be converted to current USD value and live-quoted |
| Fonbnk | Minimum endpoint exists; published example is about $1.02 | Promising, but example is not a corridor guarantee |
| Coinbase onramp FAQ | Approximately $5 for some Apple Pay/Google Pay onramp flows | Not evidence of an off-ramp minimum |

Sources: [Breet supported assets](https://docs.breet.io/supported-assets), [MoonPay minimum sell amounts](https://support.moonpay.com/en/articles/384277-how-do-i-sell-cryptocurrency-with-moonpay), [Yellow Card transaction limits](https://help.yellowcard.io/articles/1643131698-understanding-transaction-limits-in-the-payment-api), [Fonbnk off-ramp endpoints](https://docs.fonbnk.com/v1.5/endpoints/off-ramp), and [Coinbase CDP Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq) (accessed 2026-08-04).

The next evidence artifact should be an all-in recipient-amount table, not another headline fee table. It should record quote time, payout amount, chain/token, provider fee, spread against an independent market price, gas/network fee, receiving-bank fee, minimum/maximum, quote expiry, expected arrival, and refund amount.

### 4.3 Garden local-entity eligibility is still unverified

Public pages establish that Breet, Yellow Card, Kotani, and similar products conduct KYB for business accounts. They do not publicly promise that an arbitrary garden entity in each target country may:

- open the account;
- fund it with crypto originating from a garden Safe;
- pay unrelated individuals or beneficiaries rather than employees/customers;
- let Green Goods submit API instructions;
- keep refunds in the garden's control; or
- use the service at $5–$100 per recipient.

This remains **UNVERIFIABLE** without provider underwriting and legal review. No provider was contacted for this review. It should be treated as a gating acceptance criterion, not as an implementation detail.

### 4.4 Offline-first behavior is absent from the brief

Provider cash-out is an online, multi-system transaction even when Green Goods is offline-first. KYC, sanctions screening, bank-account verification, quotes, deposit addresses, onchain confirmation, provider processing, and fiat settlement all require current server state. A safe implementation must not present “cash out” as a queueable offline mutation.

Minimum state model:

1. draft created locally;
2. online connection required;
3. provider KYC not started / pending / approved / failed;
4. quote active with explicit expiry;
5. user approval awaiting onchain submission;
6. submitted with transaction hash;
7. provider deposit detected;
8. provider processing / manual review;
9. fiat settled;
10. failed, expired, refunded, or support required.

The app must never silently retry a value transfer after connectivity returns. Order creation and webhook processing need idempotency keys; reconnect must reconcile provider order status and chain state before allowing another send; expired quotes/addresses must be visibly invalid; and the PWA should retain only the minimum encrypted order identifier and transaction evidence needed for recovery.

Relevant public behavior:

- Transak recommends webhooks or order-status retrieval to track state. [Transak order-status guide](https://docs.transak.com/guides/track-order-status) (accessed 2026-08-04).
- Coinbase documents time-limited deposit-address behavior in its flow. [Coinbase CDP Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq) (accessed 2026-08-04).
- Yellow Card says some API transactions can remain pending for up to two hours. [Yellow Card API FAQ](https://help.yellowcard.io/articles/6945026935-common-issues-and-solutions-faqs) (accessed 2026-08-04).
- Kotani exposes a refund-status endpoint, showing that refund/recovery is a first-class state rather than a generic error. [Kotani refund status](https://docs.kotanipay.com/reference/offrampcontroller_getrefundstatus) (accessed 2026-08-04).

Required pre-build proof should include interrupted KYC, connectivity loss before and after signing, quote expiry, duplicate webhook, provider pending state, partial provider outage, fiat rejection, refund to the correct self-custodial address, and app restart on another device.

### 4.5 Other missing decision inputs

- **Exact regulated entity and permission.** “Brand operates in country” is insufficient. Record the contracting legal entity, licence/approval number, regulator, status, permitted activity, and whether the route is direct or an underlying provider.
- **Asset contract and network direction.** “Supports Arbitrum” must include the exact USDC contract and inbound-deposit direction, not generic withdrawals or transfers.
- **Recipient identity model.** Establish whether provider KYC, bank-account ownership, garden records, and the self-custodial wallet can be matched without exposing wallet addresses or identity data in public settlement evidence.
- **Refund ownership.** Define where fiat rejection, wrong memo, below-minimum deposit, unsupported asset, or expired-quote funds return and who can recover them.
- **Quote/spread audit.** Provider claims of “no hidden fee” do not measure effective FX spread. Compare recipient fiat against an independent timestamped reference rate.
- **Accessibility and assisted use.** Brazil's broad age range and intermittent-connectivity users require a tested provider-hosted KYC flow with clear language, document capture recovery, screen-reader support, and a non-smartphone support path where possible.
- **Operational concentration.** An aggregator adds resilience only if downstream venues, KYC vendors, and bank rails are actually distinct. Provider-status and corridor-disable controls belong in any future registry.

## 5. What changed since 2026-08-03

No material public regulatory change published after 2026-08-03 was identified in the sources reviewed through 2026-08-04 UTC. The report's major corrections are not overnight changes; they come from public material already available before the brief was written or from current provider pages that the brief misread or did not use. The most consequential examples are Brazil Resolution 561's actual scope, Yellow Card's user-KYC widget, Fonbnk's Arbitrum and three-corridor coverage, Breet's missing SEC listing and $15 floor, Busha's nonzero fees, Onramper's now-readable Nigeria/South Africa coverage, South Africa's correct Joint Communication number, and the US $2,000 reporting threshold.

Because the affected jurisdictions and provider products are changing, the correction record should be refreshed at scope lock and again immediately before any live pilot. A provider selection should require a regulator-record snapshot and successful corridor quote no more than seven days old.

### Scope-control note

This review created only this report inside `.plans/ideas/capital-offramp-corridors/`. No file outside the requested lane was intentionally modified. A repository-wide working-tree inventory could not be produced because both available local Git executables were unusable in this environment: the system Git depends on a missing developer-tools path, and the Homebrew Git binary cannot load its PCRE2 dynamic library. Existing changes outside this lane therefore remain unobserved rather than reviewed or altered.
