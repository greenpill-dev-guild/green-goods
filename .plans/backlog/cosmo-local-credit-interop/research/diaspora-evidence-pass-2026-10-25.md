# Diaspora evidence pass · 25 October 2026

Research for RESR-94 ahead of the 27 October status refresh. It checks every fact the
SustainableFinance.Live deck (18 slides at `7dc4b4fad`), its speaker notes and the companion
brief present about remittances, the Nigerian diaspora, Omo Yoruba of Southern California, Tech
and Sun, institutions and the funding proposition.

**Status: proposals only.** Nothing here edits the deck, notes, brief, README or claim ledger.
Those changes wait for Afo's scope lock. No Linear writes, outreach, signups or downloads were
made. Read-only research; sources were read on 25 October 2026 UTC unless stated.

Evidence labels follow the research skill: **ESTABLISHED** (current primary evidence),
**CORRECTED / CONTRADICTED** (a claim is wrong or authorities conflict), **INFERRED** (reasoned,
not stated by a source), **UNRESOLVED** (absent, inaccessible or ambiguous).

## Findings, ranked by impact on the deck and brief

1. **Replace the $21.3bn remittance figure with the World Bank series** (slide 12, note 12, brief
   pages 5 and 6). The African Development Bank figure rests on indexed table text that could not
   be opened here, and the bank compiles rather than produces balance-of-payments data. The World
   Bank series is primary, current and has an exact indicator. Details in
   [the series recommendation](#which-remittance-series-to-present).
2. **"Kept promises earn rewards" is labeled "Live today", but money rewards are deferred in the
   current release** (slide 13, note 13, brief pages 2 and 5). The steward guides, last changed
   19 October, tell stewards to leave "Does this come with a reward?" at **No** "for this release"
   and say the recognition split "records terms; it does not distribute money"
   (`docs/docs/community/steward-guide/seed-promises.mdx:71`,
   `docs/docs/community/steward-guide/commitment-pooling.mdx:60` and `:74`). The G$ path exists and
   paid out earlier (C08), so confirm the live app before keeping the wording.
3. **Omo Yoruba is not shown to have the capacity to commission a program** (slide 11, note 11,
   brief page 5). IRS-derived records list it as a Form 990-N filer for every year from 2014 to
   2025, which means gross receipts of normally $50,000 or less (ProPublica Nonprofit Explorer,
   EIN 33-0763431). No agreement to fund anything exists (C46). Name associations in general, not
   Omo Yoruba, as program commissioners.
4. **"A Los Angeles nonprofit since 1997" conflicts with the current IRS record** (slide 12,
   note 12). The IRS-derived record shows "Tax exemption issued: Oct. 2014" and no returns for 2011
   to 2013, a pattern that matches an automatic revocation and later reinstatement (INFERRED; the
   IRS search tool refused the read). The organization's own site said "exempt since 31 December
   1997" on 9 October. Drop the year until Omo Yoruba confirms its founding year in writing.
5. **"Its earnings go to the garden" overstates the endowment's default split** (slide 13,
   note 13). By default 48.65% of harvested earnings reaches the garden's shared fund, 48.65% goes
   to impact certificate fractions (escrowed while that routing is unavailable) and 2.7% backs
   GOODS through Juicebox (`packages/contracts/src/resolvers/Yield.sol:119-129`). The brief's
   page 5 already states the split correctly.
6. **"Ecosystem funds that already back Green Goods" is a present-tense claim on past grants**
   (slide 11, note 11, brief page 5). The recorded backing is the House of Alignment stream for
   July to September 2026, renewal unconfirmed (C09), and the Arbitrum grant period of 1 January
   to 5 September 2026 (C16). Use "have backed" unless a current grant is confirmed.
7. **Add the corridor cost as a Q&A answer, not a slide.** The World Bank's Remittance Prices
   Worldwide still shows Q3 2025 as its latest data: 2.72% to send $200 from the US to Nigeria and
   1.96% to send £120 from the UK, against a global average of 6.36%. It supports "we don't compete
   on transfer cost".
8. **Diaspora counts are now primary.** England and Wales: 270,768 Nigeria-born residents
   (Census 2021, TS012). United States: 532,602 (ACS 2024, table B05006, margin ±26,797), with
   14,248 in Los Angeles County (±3,852). C38 can move from secondary to primary.
9. **The diaspora giving gap has a primary source.** FP Analytics' April 2026 report, produced
   with support from the Ford Foundation, finds that "few of those interviewed systematically
   measure" impact and that giving runs through "familial, hometown, and professional networks".
   It replaces the ImpactAlpha citation in C40.
10. **Smaller wording fixes.** Slide 13's exchange-pool card says supporters and endowment
    earnings "can add funds"; the notes and brief say "could", and no route exists (C85, C88).
    Note 11 says diaspora supporters "sponsor seasons", but no supporter has agreed yet (C46). The
    brief's page 5 says kept promises are "confirmed by the people served" without the steward
    fallback the notes require (C06).
11. **Optional context for slide 8.** In 2024, 62.5% of Nigerians had access to electricity and
    41.2% used the internet (World Bank). National figures, not Awka.
12. **Ledger hygiene.** The uncommitted 23 October addendum reuses IDs C68 to C80 for new claims,
    while this branch's historical table already uses C68 to C74 for different claims. The
    proposals below start at C90.

## Which remittance series to present

| Series | 2024 value | Definition | Access on 25 October | Verdict |
|---|---:|---|---|---|
| World Bank WDI, personal remittances received (`BX.TRF.PWKR.CD.DT`) | $22,126,757,545 ($22.13bn) | Personal transfers plus compensation of employees, current US$, IMF balance-of-payments data and World Bank staff estimates (BPM6) | First-party API, last updated 2026-10-08 | **Recommended.** ESTABLISHED |
| CBN balance of payments, personal remittances (C35) | $20.93bn | The central bank's own personal transfers line; its annual highlights give $20.98bn | Primary PDF behind a Cloudflare human check; dated press reports only | Keep as secondary context. Do not present beside the WDI value |
| AfDB, African Economic Outlook 2026, table 2.4 (addendum C80) | $21.3bn | Not readable: the table title, unit and source note could not be opened | PDF refused (403 to WebFetch; the browser pane offered it as a download, which was not saved) | **CONTRADICTED** by the primary series in value; table UNRESOLVED. Retire from the slide |

**Present the WDI 2024 value: $22.1bn.** It keeps the slide's year, so only the number and the
source change. The 2025 value is $22.79bn, but the indicator's source note includes World Bank
staff estimates and no CBN full-year 2025 balance of payments was found, so 2025 may rest on an
estimate. Use $22.8bn only with "2025, World Bank" and no comparison to the CBN.

Why the three values differ: the WDI series adds compensation of employees to personal transfers,
and the AfDB value is likely an earlier vintage from another compiler (both INFERRED; neither
source note could be read). Never add, average or blend the series, and never infer a Green Goods
pipeline or market share from a national total.

Other values in the same WDI pull: 2023 $19.55bn; 2025 $22.79bn; remittances were 8.77% of GDP
in 2024 and 7.84% in 2025 (`BX.TRF.PWKR.DT.GD.ZS`), after 4.01% in 2023, a jump that partly
reflects the naira's fall (C34). CBN personal transfers for H1 2026 were $11.12bn (Q1 $5.30bn,
Q2 $5.82bn), per Nairametrics' 21 September 2026 reading of the CBN balance-of-payments
highlights: secondary, and never set beside the WDI series.

## Claims table

Where: S = slide, N = speaker note, B = brief page. Ledger rows refer to this branch (C01 to C74)
or the uncommitted 23 October addendum (C80 to C89).

| # | Claim as presented | Where | Verdict | Primary source and date | Definition and unit | Confidence | Recommended wording |
|---|---|---|---|---|---|---|---|
| 1 | "$21.3bn sent home to Nigeria in 2024", African Development Bank (C80) | S12, N12, B5, B6 | CONTRADICTED in value; source table UNRESOLVED | World Bank WDI API, `BX.TRF.PWKR.CD.DT`, updated 2026-10-08, read 25 Oct | Personal remittances received, current US$ | High for WDI | S12: "$22.1bn" / "in remittances to Nigeria in 2024" / "World Bank, personal remittances received, updated 8 October 2026. National context, not our market size." |
| 2 | "Live today: Members promise work. Kept promises earn rewards and build the record." | S13, N13, B2, B5 | CORRECTED for this release | Steward guides `seed-promises.mdx:71`, `commitment-pooling.mdx:60,74`, changed 19 Oct 2026; C08 for the earlier G$ payout | Rewards: money or vouchers paid for a kept promise | Medium-high (docs state it; the live app was not opened) | S13: "Members promise work. Kept promises build the record and earn agreed recognition." |
| 3 | "Diaspora associations, like Omo Yoruba, can commission a whole program themselves" | S11, N11, B5 | Not supported for Omo Yoruba | ProPublica Nonprofit Explorer (IRS data), EIN 33-0763431, read 25 Oct: Form 990-N for 2014 to 2025; C46 | 990-N: gross receipts normally $50,000 or less | High on filing status; capacity otherwise unknown | S11: "Associations can pool members' gifts behind one program, no institution needed." |
| 4 | "Omo Yoruba of Southern California, a Los Angeles nonprofit since 1997" (C47) | S12, N12 | CONTRADICTED (current IRS ruling date Oct 2014); founding year UNRESOLVED | ProPublica (IRS data), read 25 Oct; organization site read 9 Oct (C47) | IRS ruling date versus founding year | High that the record says 2014; revocation INFERRED | S12: "Omo Yoruba of Southern California, a Yoruba community nonprofit in Los Angeles, is our first diaspora community." |
| 5 | Omo Yoruba is "our first diaspora community" (C46) | S12, N12, B5 | ESTABLISHED as Afo's decision (9 Oct; kept in the 25 Oct review) | C46; review-2026-10-25.md | A chosen relationship, not a funding commitment | n/a | Keep |
| 6 | Omo Yoruba photos: "a festival and a Yoruba language class" (C50) | S12, N12 | UNRESOLVED externally; photos approved by Afo | C50 (Afo's July 2026 design material); artifacts README | Captions | Medium | Keep; confirm the festival name with the organization if asked |
| 7 | Tech and Sun "builds solar-powered hubs in Nigeria" | S8, N8, B1 | ESTABLISHED | techandsun.com, read 25 Oct: "dependable solar-powered hubs" | Self-description of an initiative | High | Keep |
| 8 | "Its first hub is live in Awka, near Nnamdi Azikiwe University" | S8, N8, B1, B6 | ESTABLISHED | techandsun.com: Awka "Active", "live pilot hub", "near UNIZIK's Coke Center", activation 14 March 2026 | Site status words | High | Keep |
| 9 | "steady power and internet for students and builders" | S8 | ESTABLISHED as the site's description; no uptime evidence | techandsun.com: solar generation, battery storage "through outages and evening hours", Starlink | Equipment described, not measured supply | Medium | Keep; never quote uptime without data |
| 10 | "its plan names Enugu and Abuja next" | N8 | ESTABLISHED | techandsun.com roadmap, Q3 2026: "Prepare the next hub locations, including Enugu and Abuja"; Enugu "Coming Soon", "subject to confirmation" | Plan, not hubs | High | Keep; no Lagos or Nsukka (neither appears on the site) |
| 11 | "Members told us internet and power come first, then learning, engineering and AI" (C02) | S8, N8 | Internal, not externally verifiable | 8 Sept 2026 workshop poll, about ten gardeners (C02) | Ranked themes, small sample | Medium | Keep; never a percentage |
| 12 | "A member survey put introductions to work and one-to-one career calls first" (C03) | S8, N8 | Internal, not externally verifiable | Lead Sync notes 7 Oct 2026, about 8 to 10 completions (C03) | Ranked preferences, small sample | Medium | Keep; never a count or "proven demand" |
| 13 | Live garden page counts "come from the record" | S8 | ESTABLISHED at capture | Re-captured 25 Oct UTC: 16 approved submissions, 14 members, 0 assessments, 0 certificates | Live counts | High at capture | Re-capture before presenting. Note: no baseline assessment is recorded for the hub |
| 14 | "Hubs are rich in capital, but short of money"; the eight forms of capital | S10, N10, B5 | Framing, not a fact | Eight forms of capital (Ethan Roland and Gregory Landua, 2013), not re-read | Framework | n/a | Keep; cite the framework if asked |
| 15 | Diaspora supporters "give gifts and sponsor seasons" | N11 | Partly unsupported: no supporter has sponsored a season (C46) | C46; FP Analytics on giving through family and hometown networks | Present tense | Medium | N11: "Diaspora supporters can give gifts and sponsor seasons." |
| 16 | "Public goods funds... already back Green Goods" | S11, N11, B5 | Supported in the past tense only | C09 (House of Alignment, July to September 2026, renewal unconfirmed); C16 (Arbitrum grant, 1 January to 5 September 2026) | Grant periods | High on receipt, unknown on renewal | S11: "Ecosystem funds that have backed Green Goods." |
| 17 | "Institutions and programs: grants for climate, clean energy and skills" | S11, N11, B5 | Category, not a claim about a named funder | n/a | n/a | n/a | Keep |
| 18 | Endowment "Live today... its earnings, which vary, go to the garden" | S13, N13 | CORRECTED (partial) | `Yield.sol:119-129`; funding guide | Default split in basis points: 4865 / 4865 / 270 | High | S13: "Supporters deposit. The capital stays invested, and part of its earnings, which vary, goes to the garden." |
| 19 | Endowment details: DAI or WETH, withdrawal claim, default split, principal can lose value | B5, N (Q&A) | ESTABLISHED | `funding-a-garden.mdx:40,53,130`; `withdraw-from-a-vault.mdx:64` (up to 1% processing loss); `Yield.sol` | Vault shares | High | Keep. Optional: "the certificate share waits in escrow until fraction purchases open" |
| 20 | Exchange pool: "Next, supporters and endowment earnings can add funds" | S13 (card and arc label) | CORRECTED (tense) | Addendum C85, C88: no route exists | Future step | High | S13: "could add funds", matching the notes and brief |
| 21 | Business model: "never as a cut of a garden's funds or capital" | S14, N14, B5 | ESTABLISHED as a proposal (C81) | C81 to C83 | Pricing rule | Medium (unvalidated) | Keep. For Q&A, the notes already say 2.7% of endowment earnings backs GOODS by default |
| 22 | Illustrative $50,000 program, 100 diaspora supporters at $100 | N (Q&A), B5 | Labeled illustrative (C82, C83); arithmetic reconciles | C82, C83 | USD planning assumptions | n/a | Keep the label. Context, if asked: about 14,000 Nigeria-born residents in Los Angeles County (row 26) |
| 23 | "Kept promises, confirmed by the people served, earn agreed rewards" | B5 | CORRECTED (fallback and reward status) | C06; row 2 | Confirmation path | High | B5: "Kept promises, confirmed by the people served or, as a labeled fallback, a steward, build the record funders read." |
| 24 | Cosmo-Local Credit "grew from the Sarafu community pools in Kenya" | B3, B6 | ESTABLISHED per C32 (not re-read) | Cosmo-Local white paper v0.8, p. 8 | Lineage | High | Keep |
| 25 | Corridor costs | Not presented | ESTABLISHED, available for Q&A | RPW corridor pages, read in the browser pane 25 Oct: latest period Q3 2025 | Average total cost, % of $200 or £120 | High | Q&A line in [stronger facts](#stronger-facts-the-pitch-could-use) |
| 26 | Diaspora size | Not presented | ESTABLISHED, available for Q&A or brief | ONS Census 2021 TS012; ACS 2024 B05006 and B04006 | Country of birth; ancestry | High (US read through a mirror) | Q&A line in [stronger facts](#stronger-facts-the-pitch-could-use) |

## Stronger facts the pitch could use

| Fact | Value | Source, date and access | Definition | Confidence | Supports | Does not support | Where it could go |
|---|---|---|---|---|---|---|---|
| Remittances to Nigeria | $22.1bn (2024); $22.8bn (2025) | World Bank WDI API, `BX.TRF.PWKR.CD.DT`, updated 2026-10-08 | Personal transfers plus compensation of employees | High | National scale | Any Green Goods market, pipeline or share | S12, N12, B5 |
| Cost of sending money to Nigeria | US: 2.72% for $200 (fee $4.47, FX margin 0.48%). UK: 1.96% for £120 (fee £1.47, FX margin 0.73%). Global average 6.36% | Remittance Prices Worldwide, Q3 2025 (collected 8 to 22 August 2025); site last updated 18 August 2025; read 25 Oct 2026 in the browser pane | Average total cost as a share of the amount sent | High; dated (no later quarter published) | "Transfers are already cheap; we add a record of what the money did" | Fee savings; "transfers are expensive" | Q&A |
| Nigeria-born residents, England and Wales | 270,768 of 59,597,538 usual residents | ONS Census 2021, TS012 (Nomis `NM_2032_1`, geography `K04000001`), read 25 Oct | Country of birth | High | Diaspora size | Ethnicity, income or giving | Q&A, B5 |
| Nigeria-born residents, United States | 532,602 (±26,797); California 40,970 (±6,806); Los Angeles County 14,248 (±3,852) | ACS 2024 1-year, table B05006, column 124, via the Census Reporter API, read 25 Oct | Foreign-born population by country of birth; 90% margins | High on values; the Census API now needs a key and data.census.gov showed a human check | Diaspora size, and the scale around Omo Yoruba | Yoruba counts (ACS does not separate them) | Q&A, B5 |
| People reporting Nigerian ancestry | US 858,236 (±38,186); California 68,381 (±9,341); Los Angeles County 21,956 (±4,691) | ACS 2024 1-year, table B04006, column 079, via Census Reporter, read 25 Oct | First or second ancestry reported; includes the US-born | High | Second-generation reach | Membership of any association | Q&A |
| Diaspora giving and measurement | Giving "tends to be fragmented and ad hoc"; "few of those interviewed systematically measure" impact; giving runs through "familial, hometown, and professional networks" | FP Analytics, *Driving Sustainable Development in Nigeria Through Diaspora Philanthropy*, April 2026, produced with support from the Ford Foundation; desk research, a roundtable and interviews; read 25 Oct | Qualitative findings; sample size not stated | Medium-high | "Measurement is the gap"; "supporters can't read the record" | Any giving total, or demand for Green Goods | B5, N2 or Q&A |
| Diaspora investment barriers | Willingness to invest "is high"; constraints: "limited policy awareness," "lack of trust," "absence of structured investment channels" | NISER and NiDCOM study of Nigerian professionals across six continents, validated at an Abuja workshop in late April 2026 (ThisDay, 29 April 2026); NISER summary page, read 25 Oct | Survey findings; sample size not published | Medium | Trust and structure as named barriers | Demand for Green Goods; the consumption share (see below) | Q&A |
| Power and internet, national | 62.5% of people had electricity access; 41.2% used the internet (2024) | World Bank WDI, `EG.ELC.ACCS.ZS` and `IT.NET.USER.ZS`, updated 2026-10-08 | National shares | High | Why members put power and internet first | Conditions in Awka or Anambra; reliability of supply | N8 or B5 |
| Comparable: Mexico's 3×1 Program for Migrants | Hometown associations' money matched by federal, state and municipal government, a dollar from each per association dollar | CONEVAL evaluations (2008 to 2019); FP Analytics Mexico case study; later cancellation per a CLACSO repository abstract | Matched collective remittances | Medium (end date not read in a primary decree) | Associations can co-fund local public works with institutions | That diaspora associations fund programs alone; Nigerian demand | Q&A |
| Comparable: Nigeria's 2017 diaspora bond | $300 million | Cited by FP Analytics; Debt Management Office primary not read | Sovereign bond | Medium | Diaspora-targeted instruments exist in Nigeria | Retail diaspora demand for community programs | Q&A only if asked |
| Comparable: Sarafu and Cosmo-Local Credit | 26,367 users, 188 pools, $320,692 swap volume, July 2023 to July 2025 (C32) | Cosmo-Local white paper v0.8, p. 8 | Historical Kenyan network | High | The voucher lineage | Current adoption | Already in B3 |

**Do not use:** the AfDB $21.3bn figure; "17 million Nigerians abroad" (an IOM estimate that FP
Analytics repeats, basis not checked); any share of remittances going to consumption (the NISER
summary says "about 90%", and a NiDCOM page indexed by search reportedly says about 70%; the NiDCOM
site did not resolve); any Yoruba population count other than Omo Yoruba's own self-estimate.

### Proposed copy

All copy follows the brand voice: no em dashes, US spelling, "promise" in user-facing copy, and
the financial example stays labeled illustrative. No chain names appear on slides.

| Place | Current | Proposed |
|---|---|---|
| S12 statistic | "$21.3bn" / "sent home to Nigeria in 2024" | "$22.1bn" / "in remittances to Nigeria in 2024" |
| S12 source line | "African Development Bank, African Economic Outlook 2026. National context, not our market size." | "World Bank, personal remittances received, updated 8 October 2026. National context, not our market size." |
| N12, first sentence | "The Nigerian diaspora sent 21.3 billion dollars home in 2024, according to the African Development Bank." | "In 2024, 22.1 billion dollars in remittances reached Nigeria, according to the World Bank." |
| S12 and N12, Omo Yoruba | "a Los Angeles nonprofit since 1997" | "a Yoruba community nonprofit in Los Angeles" |
| B5, diaspora row | "associations like Omo Yoruba of Southern California can commission a program with no institution. Nigeria received $21.3bn in remittances in 2024, national context rather than our market (African Development Bank)" | "associations can pool members' gifts behind a program with no institution. Nigeria received $22.1bn in personal remittances in 2024, national context rather than our market (World Bank)" |
| B6, sources | "African Development Bank, African Economic Outlook 2026 : Nigeria's 2024 remittances." | "World Bank, World Development Indicators, personal remittances received (BX.TRF.PWKR.CD.DT), Nigeria, updated 8 October 2026." |
| B6, sources (add) | n/a | "Omo Yoruba of Southern California, IRS exempt-organization data through ProPublica Nonprofit Explorer, read 25 October 2026." Add only if any Omo Yoruba status claim remains. |
| S11, associations card | "Groups like Omo Yoruba can commission a whole program, no institution needed." | "Associations can pool members' gifts behind one program, no institution needed." |
| N11 | "Diaspora supporters give gifts and sponsor seasons. Diaspora associations, like Omo Yoruba, can commission a whole program themselves, with no institution needed." | "Diaspora supporters can give gifts and sponsor seasons. Diaspora associations can pool their members' gifts behind a whole program, with no institution needed." |
| S11, public goods card; N11; B5 | "already back Green Goods" | "have backed Green Goods" |
| S13, endowment card | "The capital stays invested, and its earnings, which vary, go to the garden." | "The capital stays invested, and part of its earnings, which vary, goes to the garden." |
| N13, endowment | "its earnings, which vary, go to the garden" | "part of its earnings, which vary, goes to the garden's shared fund" |
| S13, commitment pool card | "Members promise work. Kept promises earn rewards and build the record." | "Members promise work. Kept promises build the record and earn agreed recognition." |
| N13, commitment pool | "members promise work, and kept promises earn rewards and build the record." | "members promise work, and kept promises build the record." |
| S13, exchange pool card and arc | "can add funds" | "could add funds" |
| B2, commitment pooling list | "Kept promises earn the agreed rewards, and the record becomes evidence a funder can act on." | "Kept promises earn the recognition the garden agreed, and the record becomes evidence a funder can act on. Money rewards for new promises are deferred to a later release." |
| B5, commitment pool | "Kept promises, confirmed by the people served, earn agreed rewards and build the record funders read." | "Kept promises, confirmed by the people served or, as a labeled fallback, a steward, build the record funders read. Money rewards for new promises are deferred to a later release." |
| Q&A, transfer cost (new) | n/a | "Sending money home is already cheap. In the World Bank's latest survey, sending $200 from the US to Nigeria cost 2.72 percent on average, and £120 from the UK 1.96 percent, against 6.36 percent worldwide. We don't compete on transfer cost. We add a record of what the money did." |
| Q&A or B5, diaspora size (new) | n/a | "About 533,000 people born in Nigeria live in the United States (2024 estimate) and about 271,000 in England and Wales (2021 census). About 14,000 live in Los Angeles County." |
| B5 or N2, giving gap (new) | n/a | "Nigerian diaspora giving is often informal, and few givers track what it achieved (FP Analytics, April 2026, supported by the Ford Foundation)." |
| N8, power and internet (optional) | n/a | "Nationally, about six in ten Nigerians had electricity in 2024, and about four in ten used the internet." |
| Notes, claims to keep straight (add to "Never say") | n/a | "the African Development Bank remittance figure; Omo Yoruba 'since 1997' or 'exempt since 1997'; that Omo Yoruba funds or commissions a program; a fee saving on transfers" |

If Afo confirms that money rewards are live in the current app, keep "earn rewards" and drop the
deferral sentences. If Omo Yoruba confirms its founding year in writing, "founded in 1997" can
return; "exempt since 1997" should not.

## Proposed ledger row changes

Proposals for the ledger owner. Nothing in the ledger was edited. New IDs start at C90 to avoid
the collision noted in finding 12.

| Row | Proposed change |
|---|---|
| C33 | Reread 25 October: values unchanged (2024 $22,126,757,545; 2025 $22,789,097,830; lastupdated 2026-10-08). Make it the one presented series. Say: "$22.1bn in personal remittances reached Nigeria in 2024 (World Bank)". Do not say: a pipeline, share or market; a blend with CBN or AfDB values. |
| C80 (addendum) | Retire from slide and brief use. Status: table UNRESOLVED (PDF unreadable on 23 and 25 October); value contradicted by C33. Keep as a dated note only. |
| C35 | Unchanged; record the primary document's name for a later read: CBN, "2024 Annual Balance of Payments Highlights" (8 April 2025), behind a human check. |
| C36 | Add: CBN personal transfers H1 2026 $11.12bn (Q1 $5.30bn, Q2 $5.82bn), Nairametrics 21 September 2026, secondary. Never set beside C33. |
| C37 | Reconfirmed 25 October in the browser pane: Q3 2025 is still the latest period. Add the global average of 6.36% (RPW home page; site last updated 18 August 2025). |
| C38 | Replace with primary values: England and Wales 270,768 (Census 2021 TS012, Nomis `NM_2032_1`); United States 532,602 ±26,797, California 40,970 ±6,806, Los Angeles County 14,248 ±3,852 (ACS 2024 1-year B05006, read through Census Reporter). Confidence high. |
| C39 | Verified on NISER's summary page. Add: sample size unpublished; the consumption share conflicts between official pages (about 90% versus about 70%), so never cite a consumption share. |
| C40 | Replace the ImpactAlpha source with FP Analytics, *Driving Sustainable Development in Nigeria Through Diaspora Philanthropy*, April 2026, produced with support from the Ford Foundation: "few of those interviewed systematically measure"; giving "tends to be fragmented and ad hoc". Interview count unstated. |
| C47 | Correct: IRS-derived record (ProPublica, read 25 October), EIN 33-0763431, 501(c)(3), "Tax exemption issued: Oct. 2014"; Form 990-N for 2014 to 2025, 990-EZ for 2006, no returns listed for 2008 to 2009 or 2011 to 2013. Revocation and reinstatement INFERRED. Say: "a Yoruba community nonprofit in Los Angeles". Do not say: "exempt since 1997"; any budget or capacity. |
| C48 | Afo's pending update stands (drop the fiscal-sponsor role). Add: the gift route has no confirmed method, and the organization's California charity registration was not checked. |
| C90 (new) | No evidence that Omo Yoruba can fund or commission a program: a 990-N filer (gross receipts normally $50,000 or less) and no agreement (C46). Say: "associations can pool members' gifts". Do not say: "Omo Yoruba can commission a program". |
| C91 (new) | Money rewards for new promises are deferred in the current release: steward guides changed 19 October 2026 (`seed-promises.mdx:71`; `commitment-pooling.mdx:60,74`). The G$ path and the August payout stay true as history (C08). Do not say "kept promises earn rewards" under "Live today" until the app shows rewards enabled. |
| C92 (new) | Endowment default split detail: 4865 / 4865 / 270 basis points to the shared fund, certificate fractions and GOODS backing through Juicebox; the fractions share is escrowed while routing is unavailable (`Yield.sol:119-129`). Say: "part of its earnings goes to the garden". |
| C93 (new) | National context: electricity access 62.5% and internet use 41.2% in 2024 (WDI, updated 2026-10-08). Context only; not Awka. |
| C94 (new) | Comparable models with limits: Mexico's 3×1 Program (matched hometown-association funding; since discontinued, secondary source); Nigeria's 2017 diaspora bond of $300 million (secondary). Q&A only. |
| Ledger maintenance | Renumber the addendum's C68 to C80, or prefix them, so each ID names one claim. |

## Contributions, mechanisms and rights

Status classes follow the ledger: **Live** (in use), **Rehearsal** (owned forks, synthetic
participants), **Planned** (accepted design), **Proposal** (commercial direction, unvalidated).

| Contribution | Typical contributor | Mechanism | Status today | What the contributor gets | Evidence |
|---|---|---|---|---|---|
| Money: a gift to one garden | Diaspora supporter or anyone with a wallet | Donate to the garden's shared fund (Cookie Jar) in DAI or WETH | Live | A gift record; no withdrawal right; Green Goods cannot send it back; no charitable receipt promised | `donating-to-a-garden.mdx`; C10 |
| Money: an endowment deposit | Supporter, association or institution whose terms allow investing | Octant vault deposit; earnings split by default 48.65 / 48.65 / 2.7 | Live | A withdrawal claim on vault shares; principal and earnings not guaranteed; withdrawals depend on liquidity and allow up to 1% processing loss; no return to the depositor | `funding-a-garden.mdx`; `withdraw-from-a-vault.mdx`; `Yield.sol`; C84, C85 |
| Money: a funded program | Institution, diaspora association, NGO | Manual: the garden allocation goes to the approved recipient; Green Goods is paid a separate fee | Proposal (C81 to C83); no sale | Terms not yet written; reporting from the record | C81 to C83, C88 |
| Money: rewards for kept promises | A program or stream funder | G$ reward path on Celo | Path implemented and paid once (C08); new money-reward promises deferred in this release | The recipient gets G$; the funder sees which promises were kept | C08; C91 |
| Money: buying a voucher for a learner | Supporter | Bounded swap from the issuer's inventory in the shared pool | Rehearsal | The holder gets a claim on the issuer's future service; no cash-out | Addendum C70, C75, C89 |
| Money: funds in the exchange pool | Supporter; endowment earnings | None | Planned; no route exists | Nothing today | C85, C88 |
| Money: buying certificate fractions | Institution or supporter | Hypercert registration and minting exist; buying in the app is unfinished | Partial | A documented share of an impact claim; not equity, ownership or an offset | C87 |
| Money: a gift through a US 501(c)(3) | US diaspora donor | Off-platform gift through Omo Yoruba (route accepted 9 October) | Not confirmed: method, terms and current role open | A 501(c)(3) receipt under its terms | C48, C49, C90 |
| Expertise: career calls, introductions, mentoring | Diaspora professional, member | An Offer or Request promise; the person served confirms | Live (promises since 14 October) | Recognition in the record; no money reward in this release | Commitment pooling guides; C06; C91 |
| Expertise: a member's own service | Member | A member-owned voucher in the shared pool | Rehearsal (21 member cases, 24 October) | The issuer keeps ownership; holders get a service claim | Addendum C68, C89 |
| Expertise: baselines and evidence standards | Evaluator | Assessments recorded as attestations | Live; Tech and Sun's page showed 0 assessments on 25 October | Attribution for the assessment | Brief pages 2 and 4; artifacts README |
| Materials: equipment, space, tool time | Community, institution, diaspora | A promise offering use of equipment or space; a garden voucher for collective services such as a hub visit | Promise: Live (a general promise, INFERRED from the model, not a materials feature). Garden voucher: Rehearsal | Delivery confirmation; no ownership transfer recorded | Brief pages 2 and 3; C87 |
| Materials: donated goods | Anyone | None on the platform | Not modeled | Nothing on the platform | Gap |
| Social: witnessing and confirming | Community members | Confirmation by the person served; a steward fallback is labeled | Live | A named confirmation in the record | `ConfirmLib.sol`; C06 |
| Social and cultural: networks, introductions, cultural programs | Diaspora associations, institutions | Off-platform; an introduction can become a promise | Promise: Live; the rest not modeled | Recognition when recorded as a promise | C03, C50 |

Only the endowment depositor keeps a financial claim. A gift gives no claim. A voucher holder's
service claim exists only in rehearsal. A program funder's rights would come from terms that do
not exist yet.

## Gaps and open research questions

**Missing local data, Tech and Sun and Awka**

- No baseline assessment on the hub's garden page (0 assessments on 25 October), so the loop's
  Needs step has no recorded baseline for the pilot.
- No measured power hours, outages, connectivity uptime, weekly hub users or seat capacity.
- Member needs rest on a poll of about ten and a survey of 8 to 10, both internal and unconsented
  for quotes.
- No local quotes behind the illustrative $8,000 for hub power, connectivity and tools.
- No subnational electricity or internet figures for Anambra were found; WDI is national only.
- Tech and Sun's registered name is unconfirmed (C05); the site's founder line reads "Tech and Sun
  Initiative". The site also presents on-site Ethereum staking as hub income, with no amounts.

**Service-capacity evidence**

- Who delivers career calls and introductions, and how many hours a season.
- Seats, workshops and sessions a season can carry, with COM-46 terms and prices.
- The 120 delivery hours behind the illustrative $6,500 cost are unmeasured.

**Diaspora**

- No named first supporter and no evidence of willingness to give $100.
- Omo Yoruba: board approval for any role; the gift method; its California charity registration
  status; the revocation and reinstatement dates; its founding year.
- Yoruba-specific counts are not available from standard ACS tables.

**Institutional buying questions**

- Which budget line pays: the program grant, monitoring and evaluation, or technical assistance?
- Does the $10,000 fee count as a direct reporting cost or as overhead under an indirect-cost cap?
  In the illustration it is 20% of the $50,000 total and 25% of the $40,000 garden allocation.
- What evidence format satisfies the funder, and is a confirmation by the person served accepted?
- May a garden invest grant money in an endowment, or must it be spent within the grant period?
- What due diligence does the recipient need: registered entity, bank account, safeguarding, and
  the route from dollars to naira?
- What result would make the funder renew?

**Sources still to read**

- AfDB African Economic Outlook 2026, table 2.4: title, unit and source note.
- CBN 2024 Annual Balance of Payments Highlights and any 2025 annual release.
- IRS Tax Exempt Organization Search for EIN 33-0763431, and the California Attorney General's
  Registry of Charitable Trusts.
- Nigeria's Debt Management Office on the 2017 diaspora bond; the official end of Mexico's 3×1.
- Remittance Prices Worldwide, if a quarter after Q3 2025 appears before submission.
- Institutional programs relevant to solar hubs and digital skills in Nigeria: not researched in
  this pass.

## What this changes for the first audience and offer

- **Diaspora audience:** Omo Yoruba's members as a giving circle, with the association as convener
  rather than funder. The surrounding population is real but modest: about 14,000 Nigeria-born
  residents and about 22,000 people reporting Nigerian ancestry in Los Angeles County (ACS 2024),
  against the association's self-estimate of more than 3,000 Omo Yoruba in Southern California.
- **Offer:** keep the illustrative diaspora slice (100 gifts of $100) and lead with the record as
  the return, since giving is informal and rarely measured. A confirmed recipient and gift method
  must come first.
- **Next actions for Afo, not taken here:** ask Omo Yoruba's board whether it will host a members'
  appeal, which gift method and terms apply, and its founding year; ask one institutional program
  officer the fee and evidence-format questions above.

## Source access on 25 October 2026

- **Worked:** World Bank WDI API through WebFetch; Remittance Prices Worldwide in the browser pane;
  Nomis API for the census; Census Reporter API for ACS tables; ProPublica and Charity Navigator
  pages; techandsun.com; NISER and FP Analytics pages; the AfDB country page in the browser pane.
- **Refused or blocked:** the AfDB report PDF (403 to WebFetch; the browser pane offered it as a
  download, which was not saved or retried); the Census API (now requires a key, so not used);
  data.census.gov (Cloudflare human check, not bypassed); the IRS search tool, GuideStar, LA2050
  and ImpactAlpha (403); nidcom.gov.ng (did not resolve). CBN PDFs were not attempted, per the
  known human check.

## Task record · RESR-94 diaspora evidence pass

Task record: RESR-94 diaspora evidence pass | Type: research | Outcome: note complete; findings
await Afo's scope lock
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: deck, notes and brief at `7dc4b4fad`;
claim ledger on this branch and the uncommitted addendum and event note in the main checkout
(read only); external primary sources listed above

| Phase | Start → end (UTC, 25 October 2026) | Result / evidence |
|---|---|---|
| investigate | unknown → unknown | Linear RESR-94 and comments, deck, notes, brief, review, README, ledger, research brief, supporter offer and event note read; claims inventoried |
| verify | unknown → unknown | WDI, RPW, Nomis, Census Reporter, ProPublica, techandsun.com, NISER, FP Analytics, `Yield.sol` and the funder and steward guides checked |
| write | unknown → commit time | This note |

Human corrections: 0 observed; attention unknown. Phase clock times were not recorded.
