# Green Goods Research Agenda

**Edition:** v1 · 2026-09-02 · **Owner:** Afo (Research panel: afo, coi, matt)
**Read by:** the [`research-synthesis`](research-synthesis.md) routine every Saturday 00:00 UTC, and by anyone asking "what are we researching and why".
**Review cadence:** humans edit this file at each Research (RESR) cycle boundary, roughly monthly. The routine never edits it; it reports **agenda drift** in its weekly memo with ready-to-paste wording, and the panel decides what changes.

This file is the compass. It fixes *what* Green Goods is researching, in *what order*, and *what would make each track implementable*. Linear holds the accepted work and its status; `.plans/` holds execution truth; Drive holds memos and call notes; `#research` holds the shares. None of those say what matters most this quarter. This does.

## How to read a track

Each track carries the same fields. The routine reads them literally, so keep them filled.

- **Horizon** — `now` (the core focus), `quarter` (this RESR quarter), `next` (framing now, decision next quarter), or `12mo` (direction-setting; reviewed monthly, not weekly).
- **Stage** — where the research is on the road to implementation:
  - `framing` — the question is not yet specific; the next step is to write the question and its acceptance bar.
  - `evidencing` — the question is specific and evidence is being gathered (desk research, on-chain reads, partner contact).
  - `decision-ready` — the evidence is sufficient; a human decision is what remains.
  - `graduated` — the decision landed; implementation lives on Product and in `.plans/`; research only watches for new questions.
  - `blocked (external)` — the next step needs a party outside the team.
  - `horizon` — direction-setting work with its own gates.
- **Question** — the one question the track exists to answer, in product terms.
- **Anchors** — the Linear project, issues, and documents; the `.plans/` hub; the Drive doc. The routine reads these first and treats them as the corpus for the track.
- **Status surface** — where the routine writes the weekly state of the track (a project status update, an initiative status update, or a comment on the anchor issue).
- **Settled** — what the evidence has already established. Cite the source.
- **Open** — the frontier: the questions still open, each with its next concrete step and who can answer it.
- **Implementable when** — the bar at which research is done and the work graduates to Product.
- **Watch keywords** — how the routine classifies a Discord share or a call-note passage onto this track.

## The agenda at a glance

| # | Track | Horizon | Stage | Anchor | The frontier, in one line |
|---|---|---|---|---|---|
| 1 | Commitment pooling | now | graduated (v1) · evidencing (exchange) | Linear project *Commitment Pooling* · RESR-73 / RESR-74 | Read the live Cosmo-Local Credit deployment and decide network membership; prove whether vouchers move through a third party |
| 2 | Impact methodology and verifiable reporting | quarter | evidencing · prerequisite unowned | Linear project *Impact Framework v0.1 Refresh* · RESR-46 / RESR-65 | Ground the base attestation schema in the live schemas and define the public metric set before the 2026-09-30 House of Alignment report |
| 3 | Yield strategies for garden endowments | quarter | evidencing | RESR-9 / RESR-15 / RESR-8 | A strategy and preset recommendation with live APY evidence, plus the funding-rail map it sits in |
| 4 | Capital access: off-ramps and on-ramps by geography | quarter | blocked (external) | Linear project *Capital Off-Ramp Corridors* · RESR-70 | Five provider facts that only direct contact can settle; the on-ramp side is unframed |
| 5 | Accessible impact reporting via WhatsApp and SMS | quarter | framing | RESR-75 · Linear project *Agent Messaging Channels (WhatsApp + SMS)* | Write the entry criteria the strategy already requires (RESR-75, unowned) |
| 6 | Revenue token models (Revnets) for a goods and services layer | next | framing | RESR-76 (RESR-15 rail row; AgroforestDAO case) | Frame what a Revnet adds beyond pooling, vaults, and cash-out, using AgroforestDAO's live setup as the case (RESR-76, unowned) |
| 7 | Community infrastructure with AI for data sovereignty | 12mo | horizon (Phase 0) | Linear initiative *Community Evidence Mesh* | Phase 0 outputs: burden baseline, metric registry v0, Evidence Envelope v0, the ADR |

**Why this order.** Commitment pooling is the core loop and the current cycle theme, so it leads. Impact methodology is second because it has the hardest deadline (the House of Alignment quarterly report on 2026-09-30 needs RESR-65), it is the Q3 strategy's third focus, and it feeds tracks 3, 5, and 7. Yield is third because the Sustainability & Monetization initiative is at risk and the research already has an owner and a cycle slot. Capital access is fourth: the desk research is finished and the next step is external, so weekly synthesis can only track and watch for regulatory movement. Accessible reporting is fifth because the strategy gates the build on entry criteria nobody had written until RESR-75, which is exactly research work. Revnets is sixth because it is the newest and least framed. The evidence mesh is the long horizon by the steward's own framing; it is reviewed monthly and connected to the near-term tracks rather than synthesized weekly.

## 1. Commitment pooling

**Horizon:** now · **Stage:** graduated (v1 contracts and indexer merged) · evidencing (exchange and interoperability)

**Question.** Can gardens coordinate, keep, and settle commitments on Green Goods, and can kept commitments become value that moves beyond the garden without Green Goods holding funds?

**Why it matters.** This is the product's core loop and the current RESR cycle theme (Q3 September: Evaluations, Commitments & Yield Impact). It carries the G$ settlement arrangement with GoodDollar's House of Alignment, the SustainableFinance.Live hackathon entry (GROW-43, PRD-857), and the first path from contribution to value.

**Anchors.**
- Linear project [Commitment Pooling](https://linear.app/greenpill-dev-guild/project/commitment-pooling-4bc53572f354) (In Progress, target 2026-09-30; milestones through *Follow On / Hardening*).
- RESR-73 (design record for Cosmo-Local Credit voucher interoperability, In Progress) and RESR-74 (read the live deployment before committing, In Progress, due 2026-09-15). RESR-57 and RESR-58 (external brief and v1 scenarios, Done) are the canonical scenario pack.
- PRD-650 (August proof), PRD-649 (architecture record), PRD-651 (exchange, redemption, federation; evidence-gated), PRD-796 (compatibility boundary), PRD-857 (hackathon build).
- Linear documents: *Commitment Pooling — Lifecycle And Aggregator Semantics*, *Pool Identity + Capability Architecture*, *Settlement Capability — Vouchers On Shared Pool Identity*, *Proof Capability*, *Feedback & Notes*.
- External canonical doc: the Green Goods Commitment Pooling Google Doc (tabs 01 External Brief and 04 Rollout Plan, owned by RESR-57).
- `.plans/active/commitment-pooling/` (`plan.todo.md` is the entry point; `exchange-architecture-brief.md`, `pilot-evidence-spec.md`, `settlement-spec.md`), `.plans/active/commitment-credit-follow-on/`, `.plans/backlog/cosmo-local-credit-interop/`.

**Status surface.** Project status update on *Commitment Pooling*.

**Settled.**
- Commitments are module-native records on a non-transferable registry; a future voucher is a separate settlement instrument and never carries promise authority (`.plans/active/commitment-pooling/status.json` notes; PRD-649).
- G$ settles canonically on Celo through split-state CCIP commands; nothing bridges, only authorization crosses (settlement spec; RESR-73).
- Valuation happens in three layers that must not collapse: native units, a published per-cycle comparison table frozen at cycle open, and exchange that consumes the table. Federation needs no shared valuation; never build a global cross-pool rate table (RESR-73).
- Token expiry is not used; the Grassroots Economics repository is AGPL-3.0 and its security review is internal, so it does not satisfy the external-audit gate (RESR-73). Clean-room boundary: paper and public docs only.

**Open.**
1. The live Cosmo-Local Credit configuration: owner and proxy admin per contract, protocol and pool fees, seal state, whether a pool proxy exists, and whether burn works after expiry on a fork. Next step: the on-chain read and fork check in RESR-74. Answerable by the team.
2. The Grassroots Economics questions (supported versions for third-party use, licence for deployed interaction, quoter and limiter behaviour in production, wrap restriction to fulfilled commitments, who owns the pool a Green Goods voucher lists into). Next step: confirm whether the 19 August conversation happened and what it produced; if not, send the five prepared questions. Answerable by Grassroots Economics.
3. The pilot's falsifiable question: do vouchers move through a third party, or does everything settle bilaterally? Next step: collect the pilot-evidence-spec metrics from one garden cycle. Answerable only by pilot data.
4. The second confirmer on a redemption has no answer yet (RESR-73 tensions). Next step: a design note in the exchange brief.
5. Pilot-garden adoption: the Tech & Sun weekly sync of 2026-09-01 recorded a next step to present the protocol and team incentives to the garden team. Next step: the presentation and its feedback into *Feedback & Notes*.

**Implementable when.** RESR-74's findings record exists with a documented go or no-go on network membership; the Grassroots questions are answered; and one garden cycle has produced pilot-evidence metrics. Exchange work then moves through the PRD-651 gates (external audit, 3-of-5 Safe, 48-hour timelock, two weeks of testnet, tested rollback, explicit authorization).

**Watch keywords.** commitment, pool, pooling, voucher, Cosmo-Local, CLC, Grassroots Economics, Sarafu, settlement, G$, GoodDollar, clearing, mutual credit, CCIP, redemption, federation, cycle policy.

## 2. Impact methodology and verifiable reporting

**Horizon:** quarter · **Stage:** evidencing, with the prerequisite issue unowned

**Question.** How does the data generated on Green Goods (work, approvals, assessments, hypercerts) become an impact report that fits a named standard, is verifiable by outsiders, and is a credible asset a funder can invest in or support?

**Why it matters.** The Q3 strategy's third focus is "impact claims become outsider-verifiable: GIF v0.1 published, one real evaluation run end to end, one funder report in its language". The House of Alignment quarterly report (GROW-15, due 2026-09-30) depends on the public metric set (RESR-65). This track also supplies the language for yield-to-impact (track 3), the evidence contract for messaging channels (track 5), and the metric registry for the evidence mesh (track 7).

**Anchors.**
- Linear project [Impact Framework v0.1 Refresh](https://linear.app/greenpill-dev-guild/project/impact-framework-v01-refresh-79f8601bb953) (Backlog, target 2026-11-30) under the *Impact Methodologies & Evaluator Flywheel* initiative.
- The chain, in the order the June comments fixed it: RESR-46 (base attestation schema) → RESR-49 (data standards, baselines, governance) → RESR-14 (evaluator workflow and rubric v0.1); RESR-47 (IFRS S1/S2 mapping object) downstream and optional; RESR-8 (yield-to-impact codification) consumes track 3.
- RESR-65 (metric inventory for the House of Alignment report; Todo, unowned, Low). RESR-6 (taxonomy and glossary v1) and RESR-52 (reviewer and methodology collaborators) are Done.
- Linear documents: *Consolidation Memo — Impact Framework v0.1 Architecture*, *Literature Review Addendum — Biodiversity Infrastructure, Standards, MRV, and Certification Layers*, *Research Memo — IFRS S1/S2 Constraint Ladder*, *Research Memo — Outcome-Based Verification: Savory EOV and Backstory's Prove (2026-08-23)*, *Impact-Claim Domain Taxonomy & Glossary v1*, *A measurement framework for Green Goods regen impact*.
- `.plans/active/public-garden-impact-api/` (the machine-readable surface, PR 782) and `.plans/ideas/environmental-data-inputs/` with RESR-10 and RESR-72 (Open Forest Protocol and Silvi as verified-outcome inputs). Environmental data inputs are folded into this track as the MRV sub-question; they are not a separate agenda item.

**Status surface.** Project status update on *Impact Framework v0.1 Refresh*.

**Settled.**
- Taxonomy and glossary v1 are accepted (RESR-6). Reviewer and collaborator network exists (RESR-52).
- Sequencing is fixed in comments, not in Linear relations, which is why the board does not enforce it (research-synthesis memo 2026-08-08).
- Work submissions capture no per-measurement coordinates; only gardens have a location. Per-measurement coordinates are a hard requirement for forest MRV of any kind (RESR-72 exploration). Open Forest Protocol has no public API, SDK, or developer docs, so anything past link-only needs a partnership; Silvi is the cheaper EVM-native alternative with an unverified integration surface.
- RESR-46 is stalled on one bounded revision request from 2026-06-18: ground the schema in the current work-submission and approval schemas, where sensor, human, and AI provenance fields already exist.

**Open.**
1. The RESR-46 revision. Next step: a crosswalk from the current submission and approval schemas to the proposed base fields, starting with the location row that RESR-72 already evidenced. Answerable by anyone with repo access.
2. The public metric set and its sources for the 2026-09-30 report (RESR-65: TVL, yield, participation, submissions, assessments, and what each is read from). Next step: name an owner and draft the set from the public garden impact API's response types. Answerable by the team.
3. Which standard the first report targets and what "verifiable" means to a funder: evaluator attestation with provenance, or third-party MRV. IRIS+, IMP, and CIDS as reporting vocabularies versus IFRS S1/S2 as a disclosure-supporting overlay (RESR-49, RESR-47). Next step: a one-page decision note for the panel.
4. What outcome-based verification (Savory EOV, Backstory's Prove) implies for the evaluator rubric (RESR-14). Next step: fold the 2026-08-23 memo's findings into the RESR-14 acceptance criteria.

**Implementable when.** RESR-65 is accepted, RESR-46 is accepted, and one real evaluation run plus one funder report exist in the framework's language.

**Watch keywords.** impact, methodology, evaluator, rubric, attestation, EAS, schema, hypercert, MRV, IRIS, IMP, CIDS, IFRS, baseline, metric registry, verification, verifiable, impact report, funder report, Open Forest Protocol, OFP, Silvi, Savory, EOV, Prove.

## 3. Yield strategies for garden endowments

**Horizon:** quarter · **Stage:** evidencing (owned, unstarted)

**Question.** Which vault strategies and presets give garden endowments materially better yield than today's Aave-only position while staying conservative, who controls principal and yield, and how does yield turn into funded impact?

**Why it matters.** The *Sustainability & Monetization* initiative is marked at risk and "first protocol revenue" is the quarter's bar. The cycle theme names yield impact. The `/vaults` Octant vault and Cookie Jar flows exist, and the harvest-to-distribution operator flow is in progress (PRD-763).

**Anchors.**
- RESR-9 (RWA Yield Expansion research; Todo, assigned to Matt, in the current cycle), RESR-15 (map Season Two campaigns, vaults, and funding rails; Todo, unowned), RESR-8 (yield-to-impact codification; Backlog).
- Linear project [Operator Yield Split Visibility & Presets](https://linear.app/greenpill-dev-guild/project/operator-yield-split-visibility-and-presets-375773578105) (Product, Backlog; PRD-351) and the Linear document *Green Goods x Octant Vault Scope Lock*.
- `.plans/ideas/rwa-yield-expansion/` (Conservative and Balanced presets mixing Aave V3, Morpho Metamorpho, and Ondo USDY with an instant-withdrawal buffer and a FIFO redemption queue; a sustained ≥5% target) and `.plans/active/harvest-distribution-ux/`.
- The weekly growth-pulse status update on *Sustainability & Monetization* for TVL and yield numbers. Do not re-query PostHog or the indexer here.

**Status surface.** Comment on RESR-9 (there is no research-owned project; the Product project is for the operator UX, not the strategy question).

**Settled.**
- Yield expansion is a policy layer on top of the existing MultistrategyVault, not a replacement; `YieldResolver` stays untouched; operators opt into presets rather than composing strategy baskets (rwa-yield-expansion brief).
- Harvest and distribution are separate transactions; admin must not report harvest as distribution (harvest-distribution-ux brief).
- Cookie Jar is historical context, not an active rail (RESR-15 boundary).

**Open.**
1. The current candidate strategy set on Arbitrum with live, verifiable APY and risk. The rwa-yield-expansion brief's dates (a May contract freeze and a June deploy) have lapsed, so its strategy list needs re-verification against what is live now. Next step: RESR-9's first artifact, a strategy table with sources fetched this quarter. Answerable by the owner.
2. Who holds preset authority (Hats roles) and what timelock applies, and whether a 48-hour operator-initiated switch is still the intended shape. Next step: confirm against the scope-lock document.
3. The funding-rail map (RESR-15): Octant vault crowdfunding, Juicebox and Revnet, direct Safe payout, partner rounds, GoodDollar allocation paths, with initiator, principal control, yield control, evidence trigger, and funder view per rail. Next step: assign RESR-15; it also feeds track 6.
4. Yield-to-impact language (RESR-8) once RESR-15 lands.
5. Whether a sustained ≥5% is achievable at conservative risk, or the bar should be restated. Next step: the panel reads RESR-9's table.

**Implementable when.** A strategy and preset recommendation with live APY evidence, risk notes, and audit implications is accepted; RESR-15's rail map is accepted; and the operator preset UX scope (PRD-351) is confirmed against it.

**Watch keywords.** yield, vault, APY, Aave, Morpho, Metamorpho, Ondo, USDY, RWA, endowment, preset, strategy, Octant, MultistrategyVault, harvest, splitYield, treasury, TVL, Cookie Jar.

## 4. Capital access: off-ramps and on-ramps by geography

**Horizon:** quarter · **Stage:** blocked (external); desk research complete

**Question.** How can a gardener in Nigeria, South Africa, Brazil, or the United States turn a payout of roughly $5 to $100 into local money from inside the app, and how can supporters bring capital in, without Green Goods taking custody?

**Why it matters.** Payout that cannot be spent is not a payout. The corridor work decides whether Green Goods is usable in the pilot geographies at all, and the on-ramp side decides how accessible the product is to supporters in the same places.

**Anchors.**
- Linear project [Capital Off-Ramp Corridors](https://linear.app/greenpill-dev-guild/project/capital-off-ramp-corridors-3f9573efe397) (Backlog). RESR-70 (confirm provider terms; Backlog, unowned, High). RESR-71 (independent review pass; Done: of 20 high-impact claims, 3 confirmed and 17 corrected).
- `.plans/ideas/capital-offramp-corridors/brief.md` (the corrected research brief; sections 12.2 to 12.8 carry the option tables) and `reports/codex-review-2026-08-04.md`.
- Adjacent: the House of Alignment project (G$ distribution rail decision) and `.plans/active/celo-garden-account-safe-ownership/` for the Celo settlement path.

**Status surface.** Project status update on *Capital Off-Ramp Corridors*.

**Settled.**
- Keep the three money flows separate: treasury conversion, participant payout, funder inflow. Only participant payout is in scope of the corridor brief.
- Do not move payouts off Arbitrum to reach an off-ramp; Breet, Kotani, Fonbnk, and VALR publish Arbitrum USDC paths.
- Nigeria: regulator-verifiable routes only; no provider selected. South Africa: VALR is the strongest verified technical corridor, but no in-app route is selected.
- Community currencies and G$ support local circulation; they are not a substitute for a credible cash exit.
- A provider is a candidate, not a selection, until entity eligibility, exact network and asset direction, minimum, all-in quote, payout rail, refund behaviour, and current regulatory status are proven.

**Open.**
1. RESR-70's five provider facts: whether a foreign entity can hold the Nigerian payout provider's business account and disburse to third parties; whether any provider accepts a garden's local entity as account holder; per-provider minimums; whether the aggregator covers naira and rand; and what the two unpriced providers charge. Next step: direct provider contact. Answerable only by the providers.
2. Regulatory movement in Brazil, Nigeria, and South Africa this quarter against the 2026-08-03 snapshot. Next step: a dated re-check of the sources cited in the brief. Answerable by desk research; this is the one part of the track the routine can advance.
3. The on-ramp and supporter-inflow side is explicitly outside the corridor brief and has no issue. Next step: frame it as its own question (who the supporter is, which rails already exist through `/vaults` and Cookie Jar, and what geography changes). Answerable by the team.
4. Whether G$ through House of Alignment covers a pilot garden's near-term needs while fiat exits stay unresolved. Next step: read against the House of Alignment rail decision.

**Implementable when.** For one corridor: a live quote at 5, 15, 20, 50, and 100 USDC to a same-name bank account, a confirmed account-holder model, and a tested refund and name-mismatch path.

**Watch keywords.** off-ramp, on-ramp, cash-out, payout, Breet, Kotani, Fonbnk, VALR, Yellow Card, Onramper, Transak, PIX, naira, NGN, rand, ZAR, BRL, KYC, KYB, money transmission, remittance, GoodDollar, G$, stablecoin.

## 5. Accessible impact reporting via WhatsApp and SMS

**Horizon:** quarter for the research gate; build afterwards · **Stage:** framing

**Question.** What must be true before gardeners can report impact from WhatsApp or SMS with no app install and no sign-up, and what is the smallest pilot that proves lower total reporting burden rather than burden moved onto operators?

**Why it matters.** The *Accessible Participation* initiative (Planned, target 2026-10-31) sets "real pilot submissions" as the bar. The Q3 strategy says "no agent-channel implementation until entry criteria pass", and the Community Evidence Mesh roadmap's Phase 1 (September to November 2026) is exactly familiar-channel capture. The entry criteria became an accepted research question on 2026-09-02 (RESR-75); nobody has written them yet.

**Anchors.**
- RESR-75 (define the entry criteria for reporting impact over WhatsApp and SMS; Backlog, unowned, filed 2026-09-02). The project below is Product-only, so the research issue stays unprojected and relates to PRD-834.
- Linear project [Agent Messaging Channels (WhatsApp + SMS)](https://linear.app/greenpill-dev-guild/project/agent-messaging-channels-whatsapp-sms-71cda634fcf7) (Product, Backlog, target 2026-12-31): "research to entry criteria, then build behind the gate, then a pilot channel". PRD-290 (the epic) is Done as a spec. PRD-834 (third-party bot integration path for partner-run gardens; Backlog).
- `.plans/ideas/agent-messaging-channels/` (session keys scoped by ERC-4337, tiered rate limits, a dual revoke path).
- The evidence mesh roadmap's Phase 1 evidence list (minutes per accepted submission, completion and abandonment, correction rate, operator minutes, data cost, language and device coverage, consent comprehension).
- PostHog Agent project (`262124`) for what the Telegram agent already sees; read through growth-pulse or bug-intake, never re-queried here.

**Status surface.** Project status update on *Agent Messaging Channels (WhatsApp + SMS)*.

**Settled.**
- The Telegram agent exists and is the foundation; WhatsApp and SMS are adapters on the same handler set (agent-messaging-channels brief).
- Transactional actions run under session keys, not an agent-held key; read is unlimited, write is rate-limited, and revocation works from web or by keyword.
- Capture creates a private candidate, never an immediate public record, and every channel must produce the same candidate-evidence contract (evidence mesh thesis, locked).

**Open.**
1. The entry criteria themselves: identity and verification without sign-up, expected support load, cost per accepted submission by country, consent comprehension, and the manual fallback. RESR-75 holds this question. Next step: an owner drafts the criteria from the roadmap's Phase 1 gate and the panel accepts or returns them.
2. Provider and policy constraints for the WhatsApp Business platform and SMS in the pilot geographies: template approval, opt-in rules, per-country pricing, and number provisioning. Next step: a dated source table.
3. The minimal "report impact" payload (photo, text, location) and how it maps to the base attestation schema in track 2. Next step: one worked example per pilot domain.
4. Which pilot garden and which metric set. Next step: the evidence mesh 90-day go or no-go.

**Implementable when.** The entry criteria are accepted by the panel and one pilot garden with its metric set is chosen.

**Watch keywords.** WhatsApp, SMS, Twilio, Meta Business, messaging, agent, session key, Telegram, low-bandwidth, USSD, voice note, opt-in, template message, entry criteria, feature phone.

## 6. Revenue token models (Revnets) for a goods and services layer

**Horizon:** next (framing now, decision next quarter) · **Stage:** framing

**Question.** Could a Revnet-style revenue token let a garden sell goods and services through Green Goods with transparent, rule-based revenue sharing, and how would it relate to commitment vouchers, vault endowments, and cash-out?

**Why it matters.** Gardens produce goods (harvests, seedlings, compost, energy) and services (workshops, training). Green Goods records the work but offers no way to sell its output. The *Sustainability & Monetization* initiative names tokenization and service revenue. At least one pilot garden already runs one: AgroforestDAO ties agroforestry to a biogas-to-electricity Revnet (pooling scenario B3).

**Anchors.**
- RESR-15 lists Juicebox and Revnet as a Season Two funding rail to compare (initiator, principal control, yield control, evidence trigger, funder view).
- `.plans/active/commitment-pooling/reports/linear/linear-apply-pack.md` section B3 (AgroforestDAO's Revnet stays outside pooling v1 scope; the module never custodies funds).
- RESR-76 (frame what a Revnet would add to a garden's goods and services beyond pooling and vaults; Backlog, unowned, filed 2026-09-02; related to RESR-15 and RESR-73). No project or plan hub exists, by design, until the framing lands.

**Status surface.** Comment on RESR-76.

**Settled.**
- Nothing about the mechanism is settled. Revnet integration is outside pooling v1 and the pooling module never custodies funds.

**Open.**
1. Frame the question: what a Revnet provides that pooling plus vaults plus cash-out do not (continuous rule-based issuance and redemption against revenue, automated splits, no discretionary governance) and what it costs (which chains carry the contracts, Arbitrum availability, fees, audit status, and the legal posture of a revenue token for a garden). Next step: the one-page framing note that RESR-76 asks for.
2. Who issues (a garden Safe or Green Goods), who holds, how goods and services are priced and delivered, and what "revenue" means for a garden with mostly in-kind output.
3. Interaction with Cosmo-Local vouchers: two tokens per garden is a smell, and the no-universal-price rule from track 1 applies here too.
4. AgroforestDAO's actual Revnet configuration as the case study. Next step: read it and record it before designing anything.

**Implementable when.** A decision-ready brief compares a Revnet, a pooling voucher, and a plain Safe split for one garden's goods and services, and the panel picks a path, including "not now".

**Watch keywords.** Revnet, revnets, Juicebox, revenue token, goods and services, marketplace, split, buyback, issuance, redemption, bonding curve, AgroforestDAO, biogas.

## 7. Community infrastructure with AI for data sovereignty (Community Evidence Mesh)

**Horizon:** 12 months (August 2026 to July 2027) · **Stage:** horizon; Phase 0 foundation runs August to September 2026

**Question.** How does Green Goods become a community-owned evidence layer where AI proposes but never originates evidence, raw data stays local by default, and communities can run, export, and stop the infrastructure themselves?

**Why it matters.** This is the direction the near-term tracks converge on: messaging capture (5), the metric registry and evidence contract (2), community-authored context (Community Needs & Signals), and eventually evidence-to-capital (1). It is also the sovereignty argument that distinguishes Green Goods from extractive MRV.

**Anchors.**
- Linear initiative [Community Evidence Mesh](https://linear.app/greenpill-dev-guild/initiative/community-evidence-mesh-f7bdee530343) (Proposed, target 2027-07-31).
- Linear documents: *Community Evidence Mesh: Thesis, Architecture & Narrative*; *Evidence Model, Privacy & Trust*; *12-Month Roadmap, Dependencies & Measures*; *Green Goods and Gitcoin's Local-First Pivot*.
- RESR-69 (AT Protocol as an identity layer; Todo, Low) as a possible sovereignty prerequisite. The Public Goods Staking Protocol is a watched dependency for community edge compute, not an AI-node commitment.

**Status surface.** Initiative status update on *Community Evidence Mesh*, monthly at most, and only when a Phase 0 output or a locked decision changes.

**Settled (locked decisions).** The name; AI proposes and never originates evidence; a shared metric registry is required; an ADR precedes any expansion; raw media stays local by default; familiar channels before sensors; bounded energy sensing before ecological sensing; a separate edge box before validator colocation; connect existing projects rather than create a new project tree.

**Open.**
1. Phase 0 outputs: the current reporting-burden baseline, metric registry v0 (shared with RESR-65 and RESR-49 in track 2), Evidence Envelope v0, the ADR, two or three community co-design sessions, and a pilot selection rubric. Next step: draft metric registry v0 from the existing impact-reporting research, because it is also track 2's blocker.
2. The 90-day go or no-go on the familiar-channel pilot, which is track 5's decision.
3. Whether an identity layer (RESR-69) is a sovereignty prerequisite or a later concern.
4. How the local-first funding narrative (the Gitcoin pivot document) shapes what funders are asked to pay for.

**Implementable when.** The Phase 0 gate passes: metric set, evidence-origin rule, raw-data boundary, review authority, and correction path are explicit.

**Watch keywords.** evidence mesh, data sovereignty, sovereign, local-first, edge, on-device, transcription, provenance, consent, metric registry, ADR, Evidence Envelope, AT Protocol, Certified, Gitcoin, sensor, edge node, privacy.

## Off-agenda board work (watch only)

These live on the Research team but are not agenda tracks this quarter. The routine mentions them in its memo only when a human touched them, and never in the digest unless they connect to a track above.

- PGSP research trio: RESR-66, RESR-67, RESR-68 (deferred to Q4 or later).
- GreenWill recognition mapping: RESR-4 (gated by the strategy's "no badge spend until recognition mapping is decided").
- Account recovery and identity: RESR-21; RESR-69 is read through track 7 only.

## Change log

- **v1 · 2026-09-02.** First edition. Seven tracks ordered from the steward's brief of 2026-09-02, grounded in the live Linear board, the `.plans/` hubs, and the routine's own August memos. The two gaps the edition named were filed the same day as RESR-75 (track 5) and RESR-76 (track 6).
