# Capital Off-Ramp Corridors

**Slug**: `capital-offramp-corridors`  
**Stage**: `ideas`  
**Created**: 2026-08-03  
**Last reviewed**: 2026-08-04 UTC  
**Linear issue**: [RESR-71](https://linear.app/greenpill-dev-guild/issue/RESR-71/independent-review-pass-over-the-off-ramp-corridor-research)  
**Linear project**: [Capital Off-Ramp Corridors](https://linear.app/greenpill-dev-guild/project/capital-off-ramp-corridors-3f9573efe397)  
**Evidence**: [Independent correction record](reports/codex-review-2026-08-04.md)

## Status

This is a corrected research brief, not an implementation plan.

The original 2026-08-03 desk-research pass was independently reviewed against current public
sources. Of the 20 high-impact factual claims selected for review, 3 were confirmed as written and
17 required correction. Several central conclusions did not survive:

- no provider or provider pair is ready to select;
- Nigeria cannot be assigned to Breet on the current licensing evidence;
- Transak is not proven to cover the required Brazil PIX route;
- Yellow Card and Fonbnk invalidate the claimed split between consumer/user-KYC and business-only
  infrastructure;
- Brazil's October 2026 rules were overstated;
- the United States tax threshold and GENIUS Act effective date were wrong.

No provider has been contacted, no commercial terms have been confirmed, and no dependency,
account, integration, custody change, or contract change is authorized.

## 1. Question and scope

How can an individual gardener in Nigeria, South Africa, Brazil, or the United States turn a payout
of roughly $5–$100 into local spendable money through a route reachable from inside the Green Goods
PWA?

Only the individual participant payout is in scope.

| Flow | Status here | Reason |
|---|---|---|
| Garden treasury conversion | Out of scope | A business treasury relationship has different actors, amounts, and legal duties |
| Individual gardener payout | In scope | This is the product question |
| Funder on-ramp | Out of scope | Institutional funding is a separate flow |

Production runs on Arbitrum and wallets are self-custodial. Green Goods does not hold participant
keys or balances. Preserving that posture is a hard constraint, but being non-custodial does not
automatically resolve money-transmission, tax, employment, sanctions, FX, or local payment-law
questions.

## 2. Decisions that survive review

1. **Keep the three money flows separate.** Treasury conversion, participant payout, and funder
   inflow must not share one assumed legal or provider model.
2. **Do not move gardener payouts off Arbitrum merely to reach an off-ramp.** Breet, Kotani,
   Fonbnk, and VALR each publish a relevant Arbitrum USDC path. Commercial and country eligibility
   remain unproved, but the chain is not the current blocker.
3. **Use only regulator-verifiable routes in Nigeria.** Green Goods should not recommend anonymous
   or social-channel peer-to-peer counterparties. A brand claim is insufficient: the exact
   operating entity, approval status, and permitted activity must match the live regulator record.
4. **Do not let Green Goods hold a provider business account without legal approval.** A garden
   account may reduce risk when the garden is paying its own obligations from its own assets, but
   merely naming the garden as account holder does not settle Green Goods' role.
5. **Treat every provider as a candidate, not a selection.** A candidate enters a scope lock only
   after entity eligibility, exact network/asset direction, minimum, all-in quote, payout rail,
   refund behavior, and current regulatory status are proven.
6. **Keep local circulation separate from fiat payout.** Community currencies and G$ may support
   local circulation, but thin liquidity and limited merchant acceptance mean they are not a
   substitute for a credible cash exit.

## 3. Corrected country conclusions

### 3.1 Nigeria

**Current conclusion: no provider selected.**

The safe product policy is regulator-verifiable venues only, but the original research applied that
label too loosely.

- Breet publishes an API with Arbitrum USDC deposits and NGN settlement, but its current public
  asset list has a $15 USDC minimum. It is not present on the Nigeria SEC's current operator list.
  The claim that it is SEC ARIP licensed is unsupported.
- Yellow Card publishes both a user-KYC widget and a business Payment API. Its current network list
  does not include Arbitrum, and its Nigerian regulatory status was not substantiated by the
  regulator records reviewed.
- Fonbnk publishes a user-facing widget, Nigerian bank and airtime payout, and current Arbitrum USDC
  support. Its exact fee, live minimum, liquidity model, and regulatory role still need verification.
- Onramper now publishes Nigerian off-ramp coverage at aggregator level. The downstream
  provider/network/fee combination still requires a successful live quote.
- Binance's NGN services were discontinued in March 2024 and it is not on the current Nigeria SEC
  operator list. Public sources did not conclusively establish whether every NGN surface remains
  unavailable in an eligible account as of this review.
- The 2024 court order concerned 1,146 accounts tied to investigations into unauthorized FX,
  money laundering, and related conduct. It did not establish that every account belonged to a
  crypto trader or that every disputed P2P receipt freezes an entire bank account.

**What would settle the corridor**:

1. Match each candidate's Nigerian legal entity and permission to the current SEC registry.
2. Produce live $5, $15, $20, $50, and $100 quotes for Arbitrum USDC to a same-name Nigerian bank
   account.
3. Confirm provider support for a user-KYC embedded flow or document exactly which local garden
   entity can pass KYB and pay which recipient classes.
4. Test failed bank payout, refund destination, account-name mismatch, and support escalation.

Sources: [Breet supported assets](https://docs.breet.io/supported-assets),
[Nigeria SEC operator list](https://home.sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/),
[Yellow Card Widget](https://help.yellowcard.io/articles/2764124561-yellow-card-widget),
[Fonbnk supported countries and assets](https://docs.fonbnk.com/supported-countries-and-cryptocurrencies),
and [Onramper Nigeria coverage](https://onramper.com/country-coverage/NG), accessed 2026-08-04.

### 3.2 South Africa

**Current conclusion: strongest verified technical corridor, but no inside-PWA route selected.**

- VALR is on the FSCA authorised-CASP list and publishes Arbitrum USDC deposits and withdrawals.
  This proves a viable consumer account path, not a third-party embedded API.
- Yellow Card's South African entity appears on the FSCA authorised-CASP list, and Yellow Card
  publishes a user-KYC widget as well as a business API. Its current widget asset list does not
  include Arbitrum.
- Kotani publishes inbound Arbitrum USDC support. Country activation, minimum, pricing, and the
  legal entity serving the transaction remain unresolved.
- Onramper publishes South African off-ramp coverage at aggregator level.
- At 2026-03-31 the FSCA reported 533 CASP applications received and 310 approved. South Africa's
  replacement exchange-control framework was still a draft consultation in the public sources
  reviewed.
- The domestic-payment crypto notice dated 2026-05-28 is Joint Communication 4 of 2026, not Joint
  Communication 1.

**What would settle the corridor**:

1. Decide whether a consumer-account handoff can satisfy the “inside the PWA” requirement.
2. Obtain a successful ZAR quote for each embedded candidate and record the underlying licensed
   entity.
3. Confirm whether funding the payout is domestic or cross-border and obtain advice against the
   final, not draft, exchange-control framework.

Sources: [VALR Arbitrum support](https://support.valr.com/hc/en-us/articles/10810569257628-USDC-Deposits-Withdrawals-on-Arbitrum-Avalanche-Solana-Base-and-Ethereum),
[FSCA authorised CASP list](https://www.fsca.co.za/Regulatory%20Frameworks/Documents/Published%20list%20of%20Authorised%20CASPs_18%20December%202024.pdf),
[Onramper South Africa coverage](https://onramper.com/country-coverage/ZA), and
[SARB Joint Communication 4](https://www.resbank.co.za/content/dam/sarb/what-we-do/payments-and-settlements/regulation-oversight-and-supervision/designation-notices/280526%20Joint%20Communication_Crypto%20assets%20for%20domestic%20payment%20purposes.pdf),
accessed 2026-08-04.

### 3.3 Brazil

**Current conclusion: PIX remains the preferred last mile, but no provider is proven for the full
route.**

- BCB Resolutions 519, 520, and 521 took effect on 2026-02-02 and bring specified virtual-asset
  activities into the FX framework.
- The $100,000 limit applies to specified payment/international-transfer operations where the
  counterparty is not authorized to operate in FX. It is not a universal cap on every standard
  VASP transaction.
- Resolution 561 changes the electronic-FX framework from 2026-10-01. The public text reviewed does
  not state a blanket ban on stablecoin cross-border remittance.
- Resolution 520 restricts authorized institutions from enabling virtual-asset activity with a
  provider that is neither authorized nor in the authorization process. Its foreign-provider
  transition is more specific than “local subsidiary or Brazilian SPSAV partner by 2026-10-30.”
- Transak publishes a broad off-ramp widget, but its public pages did not prove the required BRL PIX
  payout for the exact user, asset, and network combination.
- Fonbnk publishes Brazilian bank payout and Arbitrum USDC support and should be tested alongside
  Transak and Onramper.
- Nubank has 113 million Brazilian customers and supports USDC for its customers, but no public
  third-party off-ramp API was found. Absence of a public API is not proof that no private partner
  path exists.

**What would settle the corridor**:

1. Produce a successful BRL PIX quote that identifies the underlying regulated entity, USDC
   network, minimum, total recipient amount, and refund behavior.
2. Map the actual parties and funds flow to Resolutions 519/520/521/561 with Brazilian counsel.
3. Test PIX key types, same-name bank ownership, accessibility, and recovery from failed or delayed
   payout.

Sources: [BCB virtual-asset framework summary](https://www.bcb.gov.br/detalhenoticia/20918/nota?s=08),
[BCB Resolution 520](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=520&tipo=Resolu%C3%A7%C3%A3o+BCB),
[BCB Resolution 561](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=561&tipo=Resolu%C3%A7%C3%A3o+BCB),
[Transak Off-Ramp](https://transak.com/off-ramp), and
[Fonbnk supported countries and assets](https://docs.fonbnk.com/supported-countries-and-cryptocurrencies),
accessed 2026-08-04.

### 3.4 United States

**Current conclusion: optional control corridor, not categorically “verification only.”**

The United States may have the lowest need for an embedded off-ramp, but an existing organization
bank account does not answer the individual gardener flow.

- Coinbase CDP advertises zero-fee USDC on/off-ramp only for qualifying applications, upon request,
  in supported regions, and while the offer remains available.
- The GENIUS Act is not effective from 2026-05-01. It becomes effective on the earlier of 18 months
  after enactment or 120 days after final primary-regulator rules.
- Qualifying self-custodial software is outside the Act's digital-asset-service-provider definition.
  That does not settle other federal or state laws.
- For service payments made after 2025, the general information-reporting threshold is $2,000,
  indexed thereafter, not $600. Employee, nonemployee, entity, and exception analysis still
  controls the actual form.
- Form 1099-DA is broker gross-proceeds reporting and is separate from a payer's wage or
  nonemployee-compensation duties.

A small US pilot could be useful as a control for provider KYC completion, quote expiry, recovery,
and settlement receipts. It should be chosen because it teaches the product something, not because
the corrected research proves that integration is necessary.

Sources: [Coinbase zero-fee USDC program](https://www.coinbase.com/developer-platform/discover/launches/zero-fee-usdc),
[GENIUS Act](https://www.govinfo.gov/content/pkg/PLAW-119publ27/html/PLAW-119publ27.htm),
[IRS information-return threshold](https://www.irs.gov/businesses/small-businesses-self-employed/am-i-required-to-file-a-form-1099-or-other-information-return),
and [IRS Form 1099-DA instructions](https://www.irs.gov/instructions/i1099da), accessed 2026-08-04.

## 4. Candidate matrix

This is a due-diligence queue, not a ranking.

| Candidate | Integration evidence | Corridor evidence | Arbitrum inbound evidence | Current blocker |
|---|---|---|---|---|
| Breet | Business API | Nigeria/Ghana settlement | Yes, USDC | $15 minimum; Nigerian regulator status and entity eligibility unresolved |
| Yellow Card | User-KYC widget and business API | Nigeria and South Africa published | No on current widget/API lists | Nigeria approval unverified; live all-in quote needed |
| VALR | Consumer account | South Africa | Yes, USDC deposit/withdrawal | No public embedded third-party off-ramp proven |
| Kotani | Business API and SMS surface | Country activation not fully proven | Yes, USDC deposit | Price, minimum, entity eligibility, and payout rail unresolved |
| Fonbnk | User-facing widget | Nigeria, South Africa, Brazil published | Yes, USDC | Exact fee/minimum, counterparty model, and regulatory role unresolved |
| Onramper | Aggregator widget | Nigeria and South Africa published | Downstream-dependent | Underlying provider, fee, asset/network, and local rail vary |
| Transak | User-KYC widget/SDK | Broad marketing coverage | Product-dependent | Brazil PIX and exact ZA route not proven by reviewed public response |
| Coinbase CDP | User-KYC developer flow | US/selected regions | Route eligibility must be confirmed | Zero-fee program requires approval; minimum and app eligibility unresolved |

## 5. Corrected economics

There is no defensible universal “1% plus $3.99” Western-widget model or universal “2–3% with no
floor” African-provider model.

- Ramp publishes variable fees by payment method, including a minimum processing fee of up to
  €2.49 and possible network/partner fees.
- MoonPay advertises sell fees from 1%, but its disclosure allows higher direct fees and a minimum
  up to $3.99 below a threshold. A minimum is not an additive fee on every transaction.
- Breet publishes 0.5% or “up to 0.5%” depending on the page, plus crypto/network and fiat
  withdrawal charges. Its USDC deposit minimum is $15.
- Yellow Card publishes corridor-specific fixed and percentage fees, including a Nigerian payout
  fee and a South African percentage fee with a minimum.
- Quidax publishes no explicit Instant Swap fee, plus naira withdrawal and applicable stamp duty.
- Busha publishes nonzero naira deposit and withdrawal fees.
- Coinbase's zero-fee USDC program is conditional, not automatic.

Known public minimum evidence:

| Provider/path | Minimum evidence | Planning effect |
|---|---|---|
| Breet USDC deposit | $15 | Direct route excludes the smallest payouts |
| MoonPay USDC sell | Often $15, asset/network dependent | Smallest payouts excluded |
| Yellow Card Payment API | Nigeria ₦1,800; South Africa R200 in the published bracket | Must be live-converted and quoted |
| Fonbnk | Minimum endpoint; published example around $1.02 | Promising but not a corridor guarantee |

No candidate has been verified as both percentage-only with no minimum and available for the
required Nigeria or Brazil flow.

The decision artifact must be an all-in quote table at $5, $15, $20, $50, and $100. For each quote,
record provider fee, FX spread against an independent timestamped reference, network fee, receiving
fee, amount delivered, minimum/maximum, quote expiry, expected arrival, and refund amount.

## 6. Integration and regulatory model

The market is not limited to exactly two shapes.

| Shape | Provider customer | Value movement | Main question |
|---|---|---|---|
| User-KYC widget | Gardener | Gardener sends to provider; provider pays gardener | Does the provider support the exact corridor, asset, amount, and same-name bank account? |
| Aggregator widget | Gardener | Underlying provider handles conversion | Which regulated entity and terms actually sit beneath the quote? |
| Wallet-initiated provider order | Gardener | User sends after receiving a provider order/address | How are quote expiry, recovery, and duplicate sends handled? |
| Garden business payout API | Garden entity | Garden funds and directs local payments | Is the garden paying its own obligations, and may Green Goods operate any part of the account? |
| Green Goods business payout API | Green Goods | Green Goods directs payments to third parties | Money-transmission and custody questions are live; do not pursue without legal approval |
| Consumer-account handoff | Gardener | Gardener transfers to an existing venue account | Can this remain meaningfully inside the PWA and be supported safely? |
| Operator distribution with receipts | Garden/operator | Local entity converts and distributes | Reconciliation, trust, employment/tax, and proof-of-payment duties remain |

Before any business API scope lock, create a corridor-specific role-and-funds diagram naming:

- legal payer and beneficial owner of the crypto;
- provider customer and API credential holder;
- instruction initiator and party able to redirect/cancel;
- recipient relationship and KYC responsibility;
- fee payer, refund recipient, and loss bearer;
- controller of settlement evidence and recipient identity data.

The garden-entity mitigation is a hypothesis to test with counsel and provider underwriting, not a
settled answer.

## 7. Offline-first product contract

Cash-out requires live provider state even though Green Goods is offline-first. KYC, sanctions
screening, quotes, deposit addresses, onchain confirmation, provider processing, and bank settlement
cannot be treated as an ordinary queue-and-retry mutation.

Required state:

1. local draft;
2. connection required;
3. KYC not started, pending, approved, or failed;
4. quote active with visible expiry;
5. awaiting explicit user approval;
6. onchain transaction submitted;
7. provider deposit detected;
8. provider processing or manual review;
9. fiat settled;
10. expired, failed, refunded, or support required.

Hard safety rules:

- never silently retry a value transfer when connectivity returns;
- reconcile provider order and chain state before allowing another send;
- use idempotency for order creation and webhook processing;
- invalidate expired quotes and deposit instructions visibly;
- retain only the minimum encrypted order and transaction evidence needed for recovery;
- make the refund address and recovery owner explicit before signing;
- do not claim completion from an onchain transaction alone; fiat settlement is the terminal proof.

Pre-build verification must exercise interrupted KYC, connectivity loss before and after signing,
quote expiry, duplicate webhook, provider pending/manual review, rejected bank payout, refund, app
restart, and recovery on another device.

## 8. Research gates before any scope lock

All gates must pass for at least one candidate in a corridor before an implementation plan is
created.

- [ ] Exact contracting and regulated entity identified
- [ ] Current licence/approval and permitted activity verified with the regulator
- [ ] User-KYC or eligible local garden-entity model confirmed
- [ ] Inbound Arbitrum USDC direction and contract confirmed
- [ ] Successful $5/$15/$20/$50/$100 quotes recorded
- [ ] Payout rail, same-name requirement, minimum, maximum, and timing recorded
- [ ] Provider fee, FX spread, network fee, and recipient amount measured
- [ ] Quote/address expiry and duplicate-send behavior tested
- [ ] Failed fiat payout and refund destination tested
- [ ] KYC accessibility and interrupted-session recovery tested
- [ ] Data handling and public settlement-receipt privacy boundary reviewed
- [ ] Corridor-specific legal role-and-funds analysis completed
- [ ] Current regulator/provider evidence refreshed within seven days of decision

## 9. Next research sequence

1. **Live quote matrix**: user-KYC candidates first because they best preserve the current
   non-custodial posture.
2. **Regulated-entity matrix**: identify the legal entity behind each successful quote and match it
   to the live regulator record.
3. **Garden-entity underwriting question**: only after user-KYC economics are measured, test whether
   a local garden entity is eligible for a business payout account and which recipient
   relationships are permitted.
4. **Legal role map**: assess the actual successful provider flows rather than abstract provider
   categories.
5. **Offline recovery prototype**: model state and recovery without initiating real transfers.
6. **Human scope lock**: choose a single corridor/pattern for an implementation plan, or stop if no
   route safely supports the target amounts.

## 10. What this does not authorize

- provider outreach or a partner commitment;
- a production account or KYB submission;
- dependency installation;
- Green Goods or a garden taking custody on behalf of gardeners;
- real-money test transactions;
- a bridge, token, contract, indexer, shared, client, admin, or agent change;
- treating a provider's brand-level country coverage as proof of the required route;
- presenting draft regulation or provisional admission as final authorization.

The full factual record, source URLs, reasoning review, missed-provider analysis, and scope-control
notes remain in [the independent review report](reports/codex-review-2026-08-04.md).
