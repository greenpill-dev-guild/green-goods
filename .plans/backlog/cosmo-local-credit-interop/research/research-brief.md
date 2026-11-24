# Research brief: funding useful services close to home

**Evidence checked:** 2026-10-09 against Green Goods commit `06a31dbf5`, live Linear records,
primary data sources and the supplied inputs. **Owner records:** RESR-94 (this research), MAR-32
(pitch), GROW-43 (event). **Status:** first draft for Afo's review. Recommendations are proposals.
Labels: **Implemented** (code and tests at the checked commit), **Observed** (a dated live or
project record), **Planned** (design accepted, not built), **Scenario** (illustrative arithmetic),
**External** (a third-party source, dated).

## 1. Question and decision

Who is the first supporter the SustainableFinance.Live pitch should be written for, what exactly do
they fund, what evidence do they get back, and which claims can the deck make today without
overstating the integration?

The decision it unblocks: the audience, first offer and funding ask that MAR-32 needs before the
16 October briefing, plus the claim boundaries the go and no-go demos must respect.

## 2. Recommendation in brief

**First audience: Nigerian diaspora supporters reached through Omo Yoruba of Southern California.**
Confirmed by Afo on 9 October. Omo Yoruba is a Los Angeles 501(c)(3) founded in 1997 that already
acts as the US fiscal sponsor for Tech and Sun's grant applications, so the first supporters have
a cultural motive, the smallest decision cost (no procurement) and an existing legal route for a
gift. Their money, expertise and introductions are exactly what hub members asked for.
Institutions are the second audience: they read the same evidence to decide on a defined program,
not on a credit line.

**First offer: sponsor a season of seats at Tech and Sun and follow each one to delivery.** The
offer is built from the hub's own draft season plan: certification seats, weekly climate
discussions, workshops and a repair reserve. Expertise is a second way in: a diaspora professional
can offer career calls and work introductions as kept promises in the same record.

**Ask: labeled scenarios, not confirmed prices.** One seat about $30 and one season pack $800 (the
COM-36 draft allocation) for Tech and Sun. For Green Goods, a coordination package of $1,200 per
hub-season, priced from the unit prices the House of Alignment report already publishes
(accepted by Afo on 9 October; the amounts stay scenarios until COM-46 confirms prices): two onboarding sessions at $120, twelve
member-support hours at $40 and twelve evidence-review and reporting hours at $40. The reusable
integration build stays grant-funded and is not part of the sponsor ask. See section 7 for the
arithmetic and section 12 for the decisions.

**Demo claim boundary.** Present tense only for what runs today: commitments, confirmation by the
person served, evidence, G$ support on Celo, direct support and endowment deposits on Arbitrum.
Credits, the two-pool exchange and the passport are the planned pilot. A no-go shows real Arbitrum
records beside labeled local rehearsal; a go adds the authorized live pools after PRD-1197.

## 3. Source coverage

| Authority | What was read | Freshness |
|---|---|---|
| Plan hub | brief, spec, plan, eval, whitepaper v0.8 review, project reconciliation, hackathon discussion, PWA brief and spec | 2026-10-09, uncommitted edits on `codex/cosmo-local-planning` |
| Linear | RESR-94, MAR-32, GROW-43, RESR-73, PRD-857, PRD-1096, PRD-1097, PRD-1100, PRD-1197, COM-46, COM-28, COM-36, COM-35, COM-15, RESR-82, PRD-1031, PRD-1038, PRD-1039, GROW-80, MAR-35 and their comments | live, 2026-10-09 |
| Code | `packages/shared/src/config/chains.ts`, `packages/contracts/deployments/networks.json`, contract sources named in the v0.8 review, runtime grep for Gnosis and CLC | commit `06a31dbf5`; `origin/develop` adds one release-sync commit that does not touch contracts or chain config |
| Tests | focused foundation suites rerun this session | 275 passed, 0 failed, 2026-10-09T20:35Z |
| CLC | white paper v0.8 (all 46 pages), public contract and network documentation | 30 Sep 2026 publication; docs read 2026-10-09 |
| Data | World Bank WDI API, World Bank Remittance Prices Worldwide corridor pages, CBN figures through dated press reports, NISER and NiDCOM survey summary, ImpactAlpha on diaspora philanthropy, hackathon site and agenda | see section 7 |
| Supplied inputs | 8 October research brief, Octant deck images, Lead Sync notes of 7 October, the Tech and Sun case-study draft | as dated |

Not followed: the CBN primary PDFs sit behind a human-verification check, so CBN figures carry a
secondary label. The ONS and US Census APIs refused direct reads; the diaspora population counts
stay secondary with a verification path. No AGPL CLC source was read.

## 4. The hub and its need

Tech and Sun runs a community hub in Awka, Anambra State, that combines solar power, internet and a
shared workspace with workshops and peer learning. It is now registered as an NGO (project record,
September 2026; legal issuer name still to confirm, COM-46). The hub's own description of its
need: students, creatives and builders cannot participate consistently when electricity,
connectivity and safe working space are unreliable (case-study draft, 9 October, pending Afo's
review).

What members come for, in their words from the 8 September workshop (about ten gardeners polled):
internet first, then learning, engineering, AI, steady power and uninterrupted workspace. What the
hub asks for: UN climate certification seats, a weekly climate discussion at about $10 a session,
and hub workshops on AI, agriculture or the environment. What members can offer: software, project
management, data analytics, design, web3 basics, graphics, AI content, marketing, counselling, plus
hands-on help such as clean-ups, cooking and repair (Observed: workshop record mapped in the
"Tech and Sun on Cosmo-Local" working page, 13 September).

The October survey changed the service mix. About 8 to 10 workshop participants completed it
(internal count, Lead Sync 7 October; not a published figure). They put introductions to projects
and work first and one-to-one career or portfolio calls second, ahead of an AI subscription seat.
Career calls are now being scheduled; the AI seat moves to November at the earliest. For the pitch
this matters twice: the most wanted service is relational, and it is a service a diaspora
professional can supply directly as a kept promise.

Draft season budget (COM-36, a proposal awaiting the steward's confirmation):

| Line | Draft amount | Unit arithmetic |
|---|---|---|
| Ten climate-course certifications | $300 | $30 per seat |
| Twelve discussion sessions | $120 | $10 per session |
| Five workshops | $200 | $40 per workshop |
| Member offers and repair reserve | $180 | pooled |
| **Season total** | **$800** | with a proposed $100 per-person ceiling |

Dollar budgets are not G$ token counts. Earlier illustrative prices (hub day 5, workshop seat 20,
certification seat 50) exist in the September model page; COM-36 is the later and more specific
draft, so this brief uses it and flags the conflict for COM-46.

## 5. Comparable approaches

| Approach | What it gives a supporter | What it lacks for our case | Source |
|---|---|---|---|
| Sending money home through an IMTO | Fast, cheap on these corridors (section 7) | No record of what the money did; trust rests on the recipient | World Bank RPW, Q3 2025 |
| Hometown associations and diaspora-led projects | Cultural motive, pooled money, local execution | Measurement is informal; few track impact; trust works through personal ties | SOAS research on diaspora finance; FP Analytics and Ford report as cited by ImpactAlpha, June 2026 |
| Pooled diaspora giving with evidence (Kwanda) | Projects funded on need and monitoring, real-time evidence | Not Nigeria-specific; a grant vehicle, not a service economy | ImpactAlpha, June 2026 |
| Sarafu and Cosmo-Local Credit vouchers | Issuer-backed commitments, pool exchange, published terms | Historical Sarafu activity is Celo-era evidence, not current CLC adoption; the current protocol records no fulfillment | CLC white paper v0.8, pp. 5 to 11 |
| Green Goods today | A kept promise confirmed by the person served, with evidence and a support receipt | No service credit, exchange or passport yet | code at `06a31dbf5` |

The proposition that survives comparison is legibility plus delivery, not cheaper transfer. The
US and UK corridors to Nigeria are already cheap for small amounts; what a supporter cannot buy
today is a clear recipient, a confirmed service and a way to see what is still owed.

## 6. Funding routes compared

| Route | Rights the supporter gets | Cost and risk | Status |
|---|---|---|---|
| Direct support to a garden (Donate to the garden's Cookie Jar) | A receipt; no withdrawal right; not automatically tax deductible | Gas sponsored for passkey users; claim-capped draw by gardeners | Implemented on Arbitrum (documented Donate guide) |
| Sponsored seats paid in G$ (House of Alignment stream) | Support reaches a participant when a promise is kept | Depends on the GoodDollar stream and its renewal | Implemented settlement path on Celo; first 1 G$ payout acknowledged 27 August (project record, recheck PRD-731) |
| Purchased service credits (prepaid seats) | A claim on a named issuer's future service under published terms; delivery confirmation; remedy terms | Issuer capacity, delivery failure, no cash-out for Green Goods credit; Tech and Sun cash swap-back is rehearsal-only | Planned (PRD-857, PRD-1096); no live route |
| Expertise as kept promises (career calls, introductions) | Recognition in the record; the person served confirms | Time, not money; needs consent for any public mention | Implemented commitment and confirmation model; pilot use planned |
| Endowment deposit (Endow vault shares) | Redeemable shares; yield routed to the garden | Principal not guaranteed; strategy, contract and liquidity risk | Implemented on Arbitrum; Octant discloses that losses can reduce depositor value |
| Impact certificate fraction (Hypercerts) | A documented share of an impact claim under the certificate's terms | Not equity, land, carbon or audited impact; no buyer demand evidenced | Implemented registration and listing; demand unproven (Arbitrum final report) |
| CLC pool deposit | None automatically: no shares, repayment, withdrawal, reward or governance rights | Owner withdrawal powers and upgrade rights sit with the pool owner and proxy admin | Planned instances; v1.1.0 semantics per white paper |
| Gift through the US fiscal sponsor (Omo Yoruba of Southern California) | A receipt from a 501(c)(3); funds earmarked for Tech and Sun's season under the sponsorship terms; deductibility depends on those terms and the donor's position | Any sponsorship fee; an offline method until the website's donate page carries a payment form (none on 9 October) | Route in use for grant applications (Ma Earth, May 2026; SFF, April 2026); first-gift method to confirm with the treasurer |
| Card or bank fiat donation in-app | As direct support, once a provider is qualified | Provider fees, verification, refunds and recovery unresolved | Not qualified (RESR-82 Todo); stretch only |

Endowment sensitivity (Scenario, from the 8 October brief): an $800 monthly budget is $9,600 a
year; at 5 percent net distributable yield that needs $192,000 invested, at 3 percent $320,000.
Early sponsorship is the right size for a first season; an endowment is a later instrument.

## 7. Nigeria data

Keep the series apart. The World Bank series (personal transfers plus compensation of employees,
balance of payments basis) is not the CBN personal remittance series, and the CBN IMTO series is a
subset of formal flows through licensed operators. Never add them.

### Scale and trend

| Series | Value | Period | Source and date |
|---|---|---|---|
| Personal remittances received, World Bank WDI | $19.55bn | 2023 | World Bank API, indicator BX.TRF.PWKR.CD.DT, updated 2026-10-08 |
| same | $22.13bn | 2024 | same |
| same | $22.79bn | 2025 | same |
| Personal remittances as share of GDP, World Bank WDI | 8.77 percent (2024), 7.84 percent (2025) | 2024 to 2025 | World Bank API, indicator BX.TRF.PWKR.DT.GD.ZS, updated 2026-10-08. The jump from 4.01 percent in 2023 reflects the smaller dollar GDP after the naira's 2023 to 2024 moves as well as higher inflows (inference) |
| Personal remittances, CBN balance of payments | $20.93bn, up 8.9 percent | 2024 | CBN 2024 balance of payments release, as reported by NAN, Gazette and Nairametrics in April and May 2025 (secondary; primary PDF behind a bot check). The CBN annual highlights give $20.98bn for personal transfers |
| IMTO inflows, CBN | $4.73bn, up 43.5 percent from $3.30bn | 2024 | same release, same reporting; a later CBN bulletin reading gives $4.76bn |
| IMTO inflows, CBN | $2.07bn, down 11.8 percent from $2.34bn | H1 2025 | CBN quarterly statistical bulletin as reported by Economic Confidential |
| IMTO inflows, CBN | $1.29bn record, up 45 percent from $888.47m | Q1 2026 | CBN Q1 2026 statistical bulletin as reported by Nairametrics, 17 August 2026 |
| IMTO inflows, CBN | $3.8bn, up 50.2 percent from $2.5bn; July alone $947m | January to July 2026 | CBN statement as reported by Techeconomy, 31 August 2026 |
| Personal transfers, CBN balance of payments highlights | $11.12bn (Q1 $5.30bn, Q2 $5.82bn) | H1 2026 | Nairametrics analysis of CBN BoP Highlights Q1 and Q2 2026, 21 September 2026 |

What these support: Nigeria's diaspora already moves more than $20bn a year home on every
measure, formal operator flows have grown sharply since 2024, and the CBN is publicly targeting
$1bn a month through formal channels. What they do not support: any Green Goods pipeline, any
share of these flows, or a claim that transfers are expensive or unsafe.

### Corridor cost

| Corridor | Average total cost | Range across listed services | Period | Source |
|---|---|---|---|---|
| United States to Nigeria, $200 | 2.72 percent ($5.43), average fee $4.47, FX margin 0.48 percent | about -0.5 percent to 9.9 percent | Q3 2025, collected 8 to 20 August 2025 | World Bank Remittance Prices Worldwide corridor page, read 2026-10-09 |
| United Kingdom to Nigeria, £120 | 1.96 percent (£2.35), average fee £1.47, FX margin 0.73 percent | about -0.1 percent to 6.3 percent | Q3 2025, collected 8 to 22 August 2025 | same |

Both corridors sit far below the global average for $200 reported in the RPW quarterly report
(about 6.5 percent in Q1 2025, secondary summary; verify in the report). Do not claim fee savings.
Negative total costs come from promotional exchange rates and are not a durable benchmark.

### Diaspora size and motives

| Fact | Value | Source and label |
|---|---|---|
| Nigeria-born residents, England and Wales | about 270,800 (Census 2021) | ONS TS012 as compiled by a secondary source; verify against the TS012 table before external use |
| Nigeria-born residents, United States | about 476,000 (2023) | secondary summary of a Migration Policy Institute tabulation of ACS data; the Census variable is B05006_124E for a direct check |
| Diaspora professionals' willingness to invest | high, held back by low policy awareness, lack of trust and transparency in systems, weak coordination and bureaucracy | NISER and NiDCOM survey summary (six continents; sample size not on the page), validated April 2026 |
| Use of remittances | about 90 percent to household consumption | same survey summary |
| Diaspora philanthropy measurement | few interviewed philanthropists measure impact; much giving is informal | FP Analytics and Ford Foundation report as cited by ImpactAlpha, 24 June 2026 |
| Trust and fraud concerns | press coverage of relatives diverting funds and of informal channels; no survey figure found | press, undated; treat as anecdote |

### The first diaspora community: Omo Yoruba of Southern California

| Fact | Value | Source and label |
|---|---|---|
| Status | 501(c)(3) nonprofit, federally exempt since 31 December 1997, Los Angeles | organization website, read 2026-10-09 |
| Community size | more than 3,000 Omo Yoruba in Southern California by its own estimate; more than 5,000 including other Yoruba speakers | organization website, self-reported |
| Programs and events | Yoruba Language School, Yoruba Cultural Collective (which hosts the Solar Hub and Green Goods work), Kids and STEM, cultural exchange; the Odun De Festival at Leimert Park each June and the End-of-Year Gala | Afo's design material for the organization, July 2026 |
| Role for Tech and Sun | US fiscal sponsor, stated publicly in the Ma Earth round 3 application (May 2026, consent to feature) and used for the April 2026 SFF application | project records; Observed |
| Donation route | The website's donate page carries no payment form; a July 2026 review found the same; a site revamp was planned | organization website, read 2026-10-09 |

This changes the first offer's mechanics more than its story: a US supporter already has a legal,
receipted route for a gift to Tech and Sun, and the Green Goods record adds what that route lacks,
a confirmed service and a view of what is still owed.

### Reading for the pitch

The evidenced need is not cheaper money. It is a clear recipient, a confirmed service and a way to
verify delivery and raise a dispute. That is what the record offers and what the survey summary
names as missing: trust, transparency and structured channels.

## 8. Four levels of capital, with the community at the center

Resources flow inward toward useful local work. Evidence flows outward to the people who
supported it. Ownership of the hub, its terms and its records stays local. These are overlapping
roles, not a hierarchy: a diaspora member can also be a hub member; an institution can fund a hub
directly.

| Level | What flows in | Mechanism | Status | What flows back | What to measure |
|---|---|---|---|---|---|
| Hub (Tech and Sun) | Time, skills, equipment access, power, internet, learning | Requests and Offers as commitments; confirmation by the person served; evidence | Implemented | Kept promises, evidence, confirmation receipts | Service units promised, available capacity, delivered units, unresolved obligations, delivery time |
| Community (members, local vendors, other hubs) | Reciprocal work, shared equipment, referrals, service credits where useful, cash where available | Paired Offers accepted together (implemented); two-pool credit exchange (planned) | Implemented pairs; planned exchange | Completed exchanges, confirmations | Unique people and hubs served, exchanges completed; whether credits move beyond pairs (a bilateral-only result is valid) |
| Nigerian diaspora, starting with Omo Yoruba of Southern California | Money, expertise, equipment, introductions | Gift through the fiscal sponsor (route exists); sponsor seats (planned purchase); direct support in-app (implemented); expert hours as Offers (implemented model) | Mixed, labeled | Delivery confirmations, obligations still owed, passport (planned) | Net money reaching the hub, seats used, expert hours delivered, equipment received, repeat support |
| Institutions (foundations, programs, banks, councils) | Grants, program funding, matched funding, endowment deposits, certificate purchases | Fund a defined program; inspect delivery, obligations and complaints; endowment and certificate routes exist | Routes implemented; passport planned | Program outcomes, use of funds, evidence quality | Outcomes, remaining obligations, evidence quality, separately evaluated energy, learning and ecological results |

No measured totals exist for any ring. Collect unique funding receipts before putting amounts on
the diagram, so one contribution moving between levels is not counted twice. Keep invested
principal, distributed yield, purchases, grants, loans and in-kind services separate.

## 9. Implementation truth at the checked commit

| Area | Finding | Label |
|---|---|---|
| CLC integration | No CLC adapter, GiftableToken use, Gnosis issuer, voucher swap or passport in runtime code or configuration. The shared chain registry supports Ethereum, Arbitrum, Sepolia and Celo only; `networks.json` has no chain 100 entry. A word-bounded search for Gnosis in runtime packages hits only two comments naming the Safe brand | Implemented: absent |
| Commitments and confirmation | Non-transferable commitment units move once from committed to fulfilled or released; contributor self-confirmation is rejected; eligible groups, thresholds and fallback paths are explicit. Generic Fulfilled can include pool or protocol fallback, so it is not automatically confirmation by the person served | Implemented (CommitmentRegistry, ConfirmLib) |
| Paired exchange | Two Offers in one pool accepted together; priced pairs rejected; later lifecycles independent | Implemented (ExchangeLib) |
| Celo settlement | Source authentication, token-free messages, deduplication, deferred acknowledgment | Implemented; first live payout recorded in project records (recheck PRD-731) |
| Lending records | Disbursement and repayment records with unique references; G$ repayment disabled | Implemented (CreditRegistry); not a voucher issuer |
| Yield and certificates | Yield has three destinations (4865, 4865, 270 basis points); a CLC pool would be a fourth and needs a code change; hypercert registration and listing implemented | Implemented; no impact certification |
| Fresh receipt | `bun run --cwd packages/contracts test --suite solidity --profile match 'test/unit/{CommitmentRegistry,CommitmentPoolingExchange,CeloSettlementSecurity,CreditRegistry,YieldSplitter,HypercertsModule}.t.sol'` at `06a31dbf5`: 275 passed, 0 failed, 0 skipped, 10 suites, finished 2026-10-09T20:35:31Z. The wrapper first cloned the pinned Foundry submodules (`lib/kernel` v1.0.1, `lib/tokenbound` v0.3.1) into this worktree; `git status` stayed clean | Observed |

These tests prove the tested foundation behavior only. They are not an integration proof,
security audit or deployment certificate. `origin/develop` is one commit ahead
(`55a67ae2b`, release sync) with no change under `packages/contracts` or the chain registry.

Concrete product gaps for scope review (not implemented here): Gnosis in the chain registry and
account sponsorship configuration; the CLC adapter and hand-written interfaces; purchase-receipt
verification for purchased issuance; presentment and exactly-once discharge; the passport
projection; credits and obligations on the PWA Home (RESR-93); a qualified fiat route.

**Architecture follow-up, 10 October.** A deeper read of the live Gnosis state, the message lane,
member accounts and the protocol interfaces is in
[architecture-integration-research.md](architecture-integration-research.md). Two findings change
the words used here: Cosmo-Local's platform opened for public use on 1 October and its network is
still being migrated onto Gnosis (1,864 factory instances, 121 pools, 77 swaps at block
48,683,249), and a gardener's passkey account
derives to the same address on Gnosis but cannot be deployed there until the passkey validator
contract exists on that chain. The Arbitrum to Gnosis lane is live in both directions. Ledger rows
C51 to C62 carry the allowed phrasing.

## 10. Event facts

| Item | Fact | Source |
|---|---|---|
| Dates | 1 September webinar; 16 October bootcamp; 16 to 27 October build window; 20 October conference; 27 October submission "2-3 PM"; 28 October pitches 10 to 12, judging 1 to 2, awards 3 to 4 | agenda page, read 2026-10-09; no timezone on any item |
| Format | "designed to be completed online"; attending London helps networking; "exclusive datasets, fintech APIs, and a Digital Sandbox" (provider unnamed); outputs "MVPs, platform concepts, and customer journeys"; strongest ideas progress to accelerators and incubators | hackathon page and FAQ, read 2026-10-09 |
| Judging | nine judges and mentors listed without roles; no published rubric or pitch duration | hackathon page |
| Internal plan | 14:00 London on 27 October as the conservative cutoff; eight to ten minutes as preparation guidance; confirm both at the 16 October briefing | GROW-43, MAR-32 |

Problem Statement 2 asks how community assets, commitments and histories become visible to support
fair finance, mutual credit and coordination, with Sarafu as an idea starter. The fit is direct.

## 11. Gaps, unknowns and next validation

| Gap | Why it matters | Next validation | Owner |
|---|---|---|---|
| No consented participant quotes | Hub photos are approved (Afo, 9 October); quotes and individual names still need consent | Separate consent for participation, public passport and marketing; collect in the COM-28 pilot by 26 October | COM-28, MAR-35 |
| Service prices, capacity and issuer terms unconfirmed | Ask amounts are scenarios until COM-46 lands | Steward confirms COM-36 allocation and COM-46 terms by 21 October | COM-46 |
| First supporter and gift method | The community is chosen (Omo Yoruba); no individual has agreed; the fiscal-sponsor gift method is unconfirmed because the donate page has no payment form | Name one supporter; confirm the method (check, transfer or processor) with Omo Yoruba's treasurer | Afo |
| Registered NGO name | Approved for use, but the exact registered string is not in any document read | Afo inserts it in the supporter offer and the credit terms | Afo, COM-46 |
| Green Goods coordination package | Accepted at $1,200 per hub-season from published unit prices; still a scenario until the unit prices are confirmed as the sponsor-facing basis | Confirm the price basis with the team before the leave-behind prints; the integration build stays grant-funded | Afo |
| Exchange demand unproven | Third-party credit use is the pilot's honest question | Record whether credits ever move beyond pairs | COM-28 |
| Live passport data | No-go must label simulated Gnosis data | Build the passport from real Arbitrum records first (PRD-1097) | PRD-1097 |
| Diaspora counts secondary | External text should carry a primary citation | Pull ONS TS012 and Census B05006_124E directly | RESR-94 follow-up |
| CBN primary documents unread | Bot check blocked the PDFs | Read the 2024 release and the 2025 annual highlights in a browser session | RESR-94 follow-up |
| Hackathon rubric and duration | Pitch length and scoring unknown | Confirm at the 16 October briefing | GROW-43 |

## 12. Decisions taken on 9 October, and what remains

| # | Question | Afo's answer | Applied or recommended |
|---|---|---|---|
| 1 | First audience | Diaspora route, with Omo Yoruba of Southern California cited | Applied across the brief, ledger, offer, scripts and deck |
| 2 | Ask amounts | Accepted the recommendation | Keep the $30 seat and $800 season pack as labeled scenarios; add a Green Goods coordination package at $1,200 per hub-season from the published unit prices; keep the integration build grant-funded. Applied; amounts remain scenarios until COM-46 |
| 3 | Images and legal name | Hub images from the X account and the uploaded photos may be used; the legal name may be used | Photos applied to the deck; the registered name string was not found in any document, so the offer carries a one-line placeholder to fill |
| 4 | Payment route before a live go | Accepted the recommendation | A gift through Omo Yoruba as fiscal sponsor, earmarked for the season pack, with the method confirmed by its treasurer; Green Goods records the funded seats as commitments. The in-app Donate route feeds a garden jar that members draw from in small claims, so it does not fit seat sponsorship; purchased credits wait for the 22 October decision. Applied |
| 5 | Linear states | Accepted the recommendation | RESR-94 and MAR-32 moved to In Progress on 10 October (UTC); GROW-43 stays In Progress; COM-46 and the Product issues unchanged |

Still open: a named first supporter, the gift method, the registered NGO name string, the working
line "Fund useful services close to home, and follow what your support makes possible" (test with
one real supporter before it becomes copy), and COM-46 terms.

## 13. Sources

- World Bank, World Development Indicators API, indicators BX.TRF.PWKR.CD.DT and BX.TRF.PWKR.DT.GD.ZS for Nigeria, last updated 2026-10-08.
- World Bank, Remittance Prices Worldwide, corridor pages United States to Nigeria and United Kingdom to Nigeria, Q3 2025 data, read 2026-10-09.
- Central Bank of Nigeria 2024 balance of payments release and 2025 bulletins, as reported by NAN, Gazette, Nairametrics (23 May 2025, 17 August 2026, 21 September 2026), Economic Confidential and Techeconomy (31 August 2026). Primary PDFs not read.
- NISER and NiDCOM, dissemination workshop summary of the diaspora professionals survey, 2026.
- ImpactAlpha, "Nigeria's diaspora needs impact measurement systems", 24 June 2026, citing FP Analytics and the Ford Foundation.
- Cosmo-Local Credit white paper v0.8, 30 September 2026; public contract and network documentation at docs.cosmolocal.credit.
- SustainableFinance.Live hackathon page, FAQ and agenda, read 2026-10-09.
- Green Goods plan hub files listed in section 3; Linear records listed in section 3; code at commit `06a31dbf5`; the contract test receipt above.
- Supplied inputs: research brief of 8 October 2026 (private), Lead Sync notes of 7 October 2026 (private), Tech and Sun case-study draft of 9 October 2026 (pending review), Octant deck images (June 2026).
