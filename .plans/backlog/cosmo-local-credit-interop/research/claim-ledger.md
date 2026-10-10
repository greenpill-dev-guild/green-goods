# Claim ledger

**Checked:** 2026-10-09 at commit `06a31dbf5`. Read this before editing a slide, the one-pager or
any external copy. Status labels: **Implemented** (code and tests), **Observed** (dated live or
project record), **Planned** (accepted design, not built), **Scenario** (illustrative arithmetic),
**External** (third-party source), **Draft** (our own untested wording). Confidence is the
drafter's read of the evidence, not a measurement.

## The hub and its people

| ID | Claim | Status | Evidence and date | Confidence | Say | Do not say |
|---|---|---|---|---|---|---|
| C01 | Tech and Sun runs a community hub in Awka with solar power, internet and shared workspace, and is registered as an NGO | Observed | case-study draft 9 Oct 2026 (pending review); June 2026 deck photos; project record Sept 2026 for the NGO status; hub photos from the June deck and the X account approved for use by Afo, 9 Oct | high | "a solar-powered community hub in Awka" | "hubs in Enugu, Abuja and Lagos" (an aspiration, not a record) |
| C02 | Members come for internet, learning, engineering, AI, steady power and workspace | Observed, internal | 8 Sept 2026 workshop poll, about ten gardeners | medium | "members told us internet and power come first" | any percentage; a named person |
| C03 | Members prioritise work introductions and one-to-one career calls over an AI subscription seat | Observed, internal, unpublished | Lead Sync notes 7 Oct 2026: about 8 to 10 survey completions | medium | "a recent member survey put introductions and career calls first" | a count as a published figure; "proven demand" |
| C04 | A season of ten certification seats, twelve discussions, five workshops and a repair reserve costs about $800 | Scenario | COM-36 draft allocation ($300 + $120 + $200 + $180) | medium | "the hub's draft season plan" | "the price list"; dollar amounts as G$ counts |
| C05 | The hub's registered NGO name may be used; signers are confirmed | Name approved (Afo, 9 Oct); the registered string is pending; signers not yet | COM-46 Todo, due 21 Oct; no document read carries the registered string | n/a | "Tech and Sun" plus the registered name once inserted | a guessed registered name |

## What Green Goods does today

| ID | Claim | Status | Evidence and date | Confidence | Say | Do not say |
|---|---|---|---|---|---|---|
| C06 | A commitment records who promised what, with evidence, and is confirmed by the person served under explicit eligibility, thresholds and fallbacks; self-confirmation is rejected | Implemented | `CommitmentRegistry`, `ConfirmLib`; six registry tests and the confirmation suites at `06a31dbf5` | high | "confirmed by the people served, with fallbacks that stay visible" | "every Fulfilled record was confirmed by the beneficiary" (generic Fulfilled can include fallback) |
| C07 | Two Offers in one pool can be accepted together as a pair | Implemented | `ExchangeLib`, 15 tests | high | "paired exchange works today" | "members already trade credits" |
| C08 | G$ support for kept promises settles on Celo through an authenticated, replay-protected path; the first live payout was acknowledged | Implemented path; Observed payout | 27 security tests; release checkpoint on PRD-731 (27 Aug 2026), balances read 1 Sept 2026 | medium-high; recheck PRD-731 receipts | "support is paid in G$ when a promise is kept" | "every member receives G$ directly" (member-level delivery not evidenced) |
| C09 | House of Alignment provided $2,400 (21,655,273 G$) and about $800 a month for July to September; renewal is unconfirmed | Observed | submitted initial report; GROW-5; GROW-46 | high on receipt, unknown on renewal | "the first season is funded by GoodDollar's House of Alignment stream" | "ongoing funding"; GoodBuilders Season 5 as secured |
| C10 | Direct support goes to a garden's Cookie Jar; it creates no withdrawable position and is not automatically tax deductible | Implemented, documented | Donate guide; Cookie Jar claim cap | high | "support goes straight to the garden's jar" | "donation", "tax deductible" |
| C11 | An endowment deposit gives redeemable vault shares; yield funds the garden; principal is not guaranteed | Implemented; External disclosure | Endow guide; Octant developer introduction | high | "designed to keep the deposit invested" | "guaranteed principal", "passive income" |
| C12 | Certificate fractions represent a documented share of an impact claim under the certificate's terms | Implemented registration and listing | `Hypercerts.sol`; Arbitrum final report found no buyer demand | high on mechanics, low on demand | "a documented claim with stated rights" | "equity", "land", "carbon offset", "audited impact" |
| C13 | Harvested yield splits 48.65 / 48.65 / 2.7 percent to Cookie Jar, certificate fractions and Juicebox; a CLC pool would be a fourth destination and needs a code change | Implemented | `Yield.sol`; 182 yield tests | high | nothing in the pitch; appendix only | "yield seeds the pool today" |
| C14 | Lending records exist (disbursement, repayment, unique references); G$ repayment disabled | Implemented | `Credit.sol`, 31 tests | high | appendix only | "credit line", "revolving credit" |
| C15 | Green Goods operates across 14 gardens on five continents | Observed, published | Afo's public post; internal pool count is 18 on Arbitrum | high | "14 gardens across five continents" | "18 pools" in external text unless Afo chooses |
| C16 | Arbitrum grant period: 85 work submissions, 42 peer approvals, 29 active wallets, 11 active gardens of 14 onboarded; $24,800 paid across five milestones | Observed, project-reported | Arbitrum final report (1 Jan to 5 Sept 2026); Questbook ledger | medium | "early community use during a grant period" | product-market fit; audited impact |
| C17 | The focused foundation suites pass | Observed | 275 passed, 0 failed, 10 suites, 2026-10-09T20:35Z at `06a31dbf5` | high | "the foundations are tested" | "the integration is tested" |
| C18 | There is no CLC integration in the code: no Gnosis chain, adapter, issuer, swap or passport | Implemented: absent | chain registry; `networks.json`; runtime search at `06a31dbf5`; `origin/develop` adds no contract change | high | "the credit pools are the planned pilot" | present tense for credits, exchange or passport |

## The planned pilot

| ID | Claim | Status | Evidence and date | Confidence | Say | Do not say |
|---|---|---|---|---|---|---|
| C19 | Tech and Sun and Green Goods each issue a credit redeemable for their own services | Planned | PRD-857, spec 2026-10-09 | design accepted | "the hub's services as prepaid credits" | "live", "launched" |
| C20 | Credits can be earned under published rules or purchased for a learner; both consume an entitlement once and stay within issuer capacity | Planned | PRD-857; purchase receipt verifier still a design decision | medium | "earned or purchased, within what the hub can deliver" | "kept promises are the only way to mint" |
| C21 | Only authorization travels from Arbitrum to Gnosis; no money is bridged; the issuer cannot withdraw pool money | Planned | spec; settlement-lane precedent | medium | "no money crosses chains, only a signed instruction" | "bridged value" |
| C22 | A member swaps from their own Gnosis account with minimum output and deadline bounds | Planned; account derivation unproven | PRD-1096 | medium | "a bounded swap" | "same account on every chain" before proof |
| C23 | Presentment, delivery, confirmation and once-only discharge are separate facts; a swap or burn is not delivery | Planned | COM-46, PRD-1096, white paper pp. 11 and 38 | high as a rule | "delivery is confirmed separately from any transfer" | "redeemed means delivered" |
| C24 | Each pool accepts the other's credit at parity with about 500 units of cross-holding capacity | Scenario | planning parameters in PRD-857 | low | "an initial, revisable limit" | "$500 of cash", "a loan", "proof of capacity" |
| C25 | Tech and Sun's 24 percent credit-to-cash swap-back is rehearsal-only; Green Goods credit has no cash-out | Status | PRD-857, COM-46 | high | "no cash-out in this scope" | "76 cents back on the dollar" |
| C26 | The passport joins real commitment, issuance, settlement and delivery receipts with definitions, units, windows and freshness | Planned | PRD-1097 | design accepted | "a readable account a funder can check" | "credit rating", "audited impact", "lending approval" |
| C27 | Live pools require the 22 October human go with every original gate addressed: external audit, 3-of-5 Safe, 48-hour timelock, two weeks testnet operation, tested rollback | Gate | PRD-1197, PRD-651 | high | "a separate human decision" | any implied waiver |
| C28 | A no-go still shows real Arbitrum records beside labeled local rehearsal | Plan | PRD-1197, GROW-43 | high | "rehearsal, labeled" | a fork receipt as a live receipt |

## Cosmo-Local Credit

| ID | Claim | Status | Evidence and date | Confidence | Say | Do not say |
|---|---|---|---|---|---|---|
| C29 | Protocol v1.1.0 provides direct SwapPool swaps, caps, pool and protocol fees and a quote-only router; it records no fulfillment and creates no automatic LP shares | External | white paper v0.8 p. 5, p. 8; docs read 2026-10-09 | high | "built to work with Cosmo-Local's current protocol" | network routing, netting, insurance or governance tokens as live |
| C30 | Pool deposits create no automatic share, repayment, withdrawal, reward or governance rights; the pool owner can withdraw liquidity and the proxy admin can upgrade | External | white paper p. 7, p. 15; network docs | high | "a seed is a grant unless terms say otherwise" | "LP position" |
| C31 | Only the token owner can burn, and only its own balance; issuer mint-writer authority does not grant burn authority | External | contract docs | high | appendix only | "the issuer burns redeemed credits" |
| C32 | Historical Sarafu snapshot: 26,367 users; 285,197 exchanges; 188 pools; 745 vouchers; $320,692 swap volume (Celo, July 2023 to July 2025) | External, historical | white paper p. 8 | high | "the Kenyan lineage shows the pattern works" | current CLC adoption; our adoption |

## Nigeria and the diaspora

| ID | Claim | Status | Evidence and date | Confidence | Say | Do not say |
|---|---|---|---|---|---|---|
| C33 | Personal remittances received: $19.55bn (2023), $22.13bn (2024), $22.79bn (2025) | External, primary | World Bank WDI API, updated 2026-10-08 | high | "more than $22bn a year" | our pipeline or share |
| C34 | Remittances were 8.77 percent of GDP in 2024 and 7.84 percent in 2025 | External, primary | World Bank WDI API | high; the 2023 to 2024 jump partly reflects a smaller dollar GDP | context only | causal claims |
| C35 | CBN: personal remittances $20.93bn in 2024, up 8.9 percent; IMTO inflows $4.73bn, up 43.5 percent from $3.30bn | External, secondary | CBN release as reported by NAN, Gazette, Nairametrics (2025); annual highlights give $20.98bn | medium-high | keep series separate | adding the two; a mixed World Bank and CBN figure |
| C36 | IMTO inflows: $1.29bn in Q1 2026 (record, up 45 percent); $3.8bn January to July 2026, up 50.2 percent; July $947m | External, secondary | Nairametrics 17 Aug 2026; Techeconomy 31 Aug 2026 citing CBN | medium | "formal operator flows are growing fast" | "most money now moves formally" |
| C37 | Average total cost of sending $200 from the US is 2.72 percent and £120 from the UK 1.96 percent (Q3 2025) | External, primary | World Bank RPW corridor pages, read 2026-10-09 | high | "these corridors are already cheap" | "we save fees"; "transfers are expensive" |
| C38 | About 270,800 Nigeria-born residents in England and Wales (2021) and about 476,000 in the US (2023) | External, secondary | ONS TS012 and MPI tabulation as compiled; direct reads refused | medium; verify | rounded context | precise figures without the primary tables |
| C39 | Diaspora professionals' willingness to invest is high; barriers are trust, transparency, structured channels and bureaucracy; about 90 percent of remittances go to consumption | External | NISER and NiDCOM survey summary, 2026 | medium (sample size not published on the page) | "the barriers named are trust and transparency" | "diaspora investors want our product" |
| C40 | Few diaspora philanthropists measure impact; much giving is informal | External | ImpactAlpha, 24 June 2026, citing FP Analytics and the Ford Foundation | medium | "measurement is the gap" | any Nigeria-specific giving total |
| C41 | Scams and diversion by intermediaries are a concern | Anecdote | press coverage, undated | low | "a clear recipient and a way to dispute" | "eliminates scams"; "lower fraud" |

## The diaspora anchor

| ID | Claim | Status | Evidence and date | Confidence | Say | Do not say |
|---|---|---|---|---|---|---|
| C47 | Omo Yoruba of Southern California is a Los Angeles 501(c)(3), exempt since 31 December 1997, with a self-estimated community of more than 3,000 Omo Yoruba in Southern California | External | organization website, read 2026-10-09 | high on status; the size is self-reported | "a 29-year-old Yoruba community institution in Los Angeles" | a verified member count |
| C48 | Omo Yoruba is Tech and Sun's US fiscal sponsor and the sponsor Green Goods applies through; a gift through it is the accepted route for the first supporter before a live go (Afo, 9 Oct) | Observed; route accepted | Ma Earth round 3 application (May 2026, consent to feature), RESR-40, GROW-61 | high | "US fiscal sponsorship through Omo Yoruba of Southern California" | "tax-deductible" without the sponsorship terms and the donor's own position |
| C49 | A supporter can give online through Omo Yoruba's website today | Not yet | donate page has no payment form, read 2026-10-09; July 2026 site review found the same | high | "the gift method is confirmed with the treasurer" | "donate at the website" |
| C50 | Programs include the Yoruba Language School, the Yoruba Cultural Collective (Solar Hub, Green Goods), Kids and STEM and cultural exchange; signature events are the Odun De Festival and the End-of-Year Gala | Observed | Afo's design material for the organization, July 2026 | medium | name the programs the board already publishes | counts or outcomes |

## Event and copy

| ID | Claim | Status | Evidence and date | Confidence | Say | Do not say |
|---|---|---|---|---|---|---|
| C42 | Dates: bootcamp 16 Oct; build 16 to 27 Oct; conference 20 Oct; submission 27 Oct "2-3 PM" with no timezone; pitches 28 Oct; online completion allowed; a Digital Sandbox is provided by an unnamed provider | External | agenda and FAQ, read 2026-10-09 | high on dates; timezone unknown | "we plan to 14:00 London" | an official cutoff time |
| C43 | Eight to ten minutes is the pitch length | Internal assumption | MAR-32 | unknown | nothing; confirm 16 Oct | "the required format" |
| C44 | "Fund useful services close to home, and follow what your support makes possible" | Draft | handover candidate line | untested | as a working line | approved copy |
| C45 | One seat about $30; one season pack $800; a Green Goods coordination package of $1,200 per hub-season (two onboarding sessions at $120, twelve support hours at $40, twelve evidence and reporting hours at $40) | Scenario; the package was accepted by Afo on 9 October | COM-36 draft; House of Alignment Q3 report unit prices (15 Sept 2026) | low until COM-46 confirms prices | "a labeled scenario" | a price; "fully funds the integration" |
| C46 | The first supporter community is Omo Yoruba of Southern California; no individual supporter has agreed | Decided for the community (Afo, 9 Oct); Not yet for an individual | this session | n/a | "we are starting with the Omo Yoruba community" | a named individual; a signed commitment |

## Architecture and integration (checked 10 October)

Chain reads on 10 October 2026 at Gnosis block 48,683,249, Arbitrum block 513,486,280 and Celo
block 79,727,365, all read-only. Detail and sources: [architecture-integration-research.md](architecture-integration-research.md).

| ID | Claim | Status | Evidence and date | Confidence | Say | Do not say |
|---|---|---|---|---|---|---|
| C51 | Cosmo-Local Credit's App opened for public use under Terms of Service v1.1 on 1 October 2026; its network is still being migrated onto Gnosis, and no application repository or integration API is public | External and Observed | docs.cosmolocal.credit terms page and GitHub organization metadata, read 10 Oct; chain state at Gnosis block 48,683,249 | high | "Cosmo-Local's platform opened for public use on 1 October and is still migrating its network onto Gnosis" | a launch-stage label the team has not published ("beta", "soft launch"); "fully live"; "battle-tested" |
| C52 | The live Gnosis deployment holds 1,864 factory-created instances (121 pools, 1,260 vouchers) administered from its operator's accounts, none sealed, with 77 swaps recorded and no on-chain directory; most instances are existing groups being migrated | Observed; the migration reading is inferred | factory events to block 48,683,249; sampled pool reads; `ContractRegistry` identifiers unset | high at that block | "a network in the middle of moving onto Gnosis" | the instance count as adoption; names of pools or people; "test only" |
| C53 | Our pools would be our own instances of the published v1.1.0 contracts, owned by each community's Safe with a timelocked upgrade admin, and do not depend on Cosmo-Local's catalog | Planned | spec 2026-10-09; `docs/DEPLOY.md` admin rule; research 6.1 | design accepted; topology proposed | "community-owned instances of Cosmo-Local's open contracts" | "listed in the Cosmo-Local App" before Grassroots Economics agrees |
| C54 | The Chainlink CCIP lane between Arbitrum One and Gnosis is live in both directions on Router 1.2.0, selectors 4949039107694359620 and 465200170687744372 | Observed | `isChainSupported`, `getOnRamp` and `getFee` on both routers, 10 Oct | high | "the message lane already exists" | "instant", "free" |
| C55 | A 200,000-gas message-only command costs about 0.000044 ETH from Arbitrum and an acknowledgment about 0.14 xDAI from Gnosis | Observed | router `getFee` quotes, 10 Oct | high at that time; fees move | "cents per instruction" | a fixed price |
| C56 | A gardener's passkey account derives to the same address on Arbitrum, Gnosis and Celo | Observed | `KernelFactory.getAddress` with identical input on three chains, 10 Oct | high | "the same address on every chain" | "already usable on Gnosis" |
| C57 | That account cannot be deployed or used on Gnosis today because the passkey validator contract the app uses has no code there; a simulated deployment reverts | Observed; blocker | `eth_getCode` on `0xbA45…90Fd`; simulated `createAccount` reverts with `InitializeError()` on Gnosis and succeeds on Arbitrum and Celo, 10 Oct | high | nothing in the pitch; in the appendix, "member accounts on Gnosis need one more contract deployed" | "members already sign on Gnosis" |
| C58 | Hats Protocol, Safe 1.4.1, EntryPoint v0.7, the Kernel factory and implementation, the ERC-6551 registry and the deterministic deployer exist on Gnosis at the same addresses as on Arbitrum; Pimlico and Envio serve Gnosis | Observed and External | bytecode reads 10 Oct; Pimlico and Envio documentation 10 Oct; Hats documentation | high | "the standard pieces are there" | "configured" (they are not, in our code) |
| C59 | The Green Goods code has no Gnosis configuration: chain registry, Pimlico endpoints, account profiles, deployed chain ids and `networks.json` all lack chain 100, and the chain registry silently falls back to Sepolia for it | Implemented: absent | code at `06a31dbf5`, 10 Oct | high | "the configuration work is listed" | present tense for Gnosis support |
| C60 | Earned issuance can check `Fulfilled` on chain but not which confirmation path produced it; the person-served label comes from the indexed event | Implemented (views) and Planned (passport label) | `getCommitment`, `getConfirmers`; `CommitmentFulfilled` event; research 3.7 and 6.3 | high | "confirmed by the person served, shown from the record" | that the chain enforces beneficiary-only issuance |
| C61 | Purchased credits in October would be issued against a steward-recorded off-chain receipt (the fiscal-sponsor gift), not an on-chain payment; the on-chain WXDAI purchase is rehearsed, not used | Planned | research 6.4; accepted gift route 9 Oct | design proposed | "a recorded gift becomes sponsored seats" | "paid on chain", "settled" |
| C62 | Returned or discharged credits are held and burned by the community Safe as token owner; the issuer only mints; delivery is a separate recorded step | Planned | SPEC burn rule; research 6.5 | design proposed | "the hub retires used credits; delivery is confirmed separately" | "the issuer burns redeemed credits" |
