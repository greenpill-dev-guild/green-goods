# Green Goods Research Agenda

**Edition:** v5 · 2026-10-18 · **Owner:** Afo (Research panel: afo, coi, matt)
**Read by:** the [`research-synthesis`](research-synthesis.md) routine every Saturday 00:00 UTC, the `research-agenda` skill when a human applies accepted edits, and anyone asking "what are we researching and why".
**Review cadence:** humans edit this file at each Research (RESR) cycle boundary, roughly monthly. The routine never edits it. It proposes edits in the Linear document *Research agenda · pending edits*, the panel ticks what it accepts, and the `research-agenda` skill applies the ticked edits and bumps the edition.

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
- **Note** — optional; the qualifiers that do not fit the two lists (what already graduated, which phase is running). `Horizon` and `Stage` carry exactly one value each from the lists above, so the routine can compare them literally. Like Anchors, a Note never carries Linear state.
- **Question** — the one question the track exists to answer, in product terms.
- **Anchors** — the corpus for the track, as identifiers and topics only: Linear issue identifiers, project and initiative names, document titles, `.plans/` paths and Drive document titles. Never a state, owner, due date, cycle, target or project membership; Linear owns those and the routine reads them live every run, so the agenda cannot drift on them.
- **Status surface** — where the routine writes the weekly state of the track (a project status update, an initiative status update, or a comment on the anchor issue).
- **Settled** — what the evidence has already established. Cite the source.
- **Open** — the frontier: the questions still open, each with its next concrete step and who can answer it.
- **Implementable when** — the bar at which research is done and the work graduates to Product, as a numbered list of bars. The routine counts the bars met and asks for the graduation decision when all of them are.
- **Watch keywords** — how the routine classifies a Discord share or a call-note passage onto this track.

Two sections after the tracks, *Candidate tracks* and *Candidate questions*, hold what the routine proposes and the panel has not yet confirmed.

## The agenda at a glance

| # | Track | Horizon | Stage | Anchor | The frontier, in one line |
|---|---|---|---|---|---|
| 1 | Commitment pooling | now | evidencing | Linear projects *Commitment Pooling* and *Cosmo-Local Integration* · RESR-73 / RESR-74 | Use the completed deployment read to decide network terms; prove whether credits move through a third party |
| 2 | Impact methodology and verifiable reporting | quarter | evidencing | Linear project *Impact Framework v0.1 Refresh* · RESR-46 / RESR-49 / RESR-14 / RESR-77 | Settle the base evidence and evaluator meaning, then define what a report and certificate claim |
| 3 | Yield strategies for garden endowments | quarter | evidencing | RESR-9 / RESR-15 / RESR-8 | A strategy and preset recommendation with live APY evidence, plus the funding-rail map it sits in |
| 4 | Capital access: off-ramps and on-ramps by geography | quarter | blocked (external) | Linear project *Capital Off-Ramp Corridors* · RESR-70 / RESR-82 | Five provider facts that only direct contact can settle; the on-ramp side is unframed |
| 5 | Accessible impact reporting via WhatsApp and SMS | quarter | graduated | RESR-75 / RESR-79 · Linear project *Agent Messaging Channels (WhatsApp + SMS)* | Prototype entry criteria accepted; evaluate pilot burden, processor terms and live account/operational compatibility |
| 6 | Revenue token models (Revnets) for a goods and services layer | next | framing | RESR-76 (RESR-15 rail row; AgroforestDAO case) | Frame what a Revnet adds beyond pooling, vaults, and cash-out, using AgroforestDAO's live setup as the case |
| 7 | Community infrastructure with AI for data sovereignty | 12mo | horizon | Linear initiative *Community Evidence Mesh* | Phase 0 outputs: burden baseline, metric registry v0, Evidence Envelope v0, the ADR |

**Why this order.** Commitment pooling is the core loop and the current cycle theme, so it leads. Impact methodology is second because its evidence and evaluator definitions feed tracks 3, 5, and 7. The first House of Alignment report (GROW-15) is Done and its metric-inventory issue (RESR-65) was Canceled; neither remains an open September gate. Yield is third because the Sustainability & Monetization initiative is at risk and the strategy research is in progress. Capital access is fourth: the desk research is finished and the next step requires provider contact. Accessible reporting is fifth because the entry criteria are Done; the remaining pilot research measures reporting burden and verifies processing terms, quality and live compatibility. Revnets is sixth because its framing sits in the December cycle. The evidence mesh is the long horizon and is reviewed monthly.

## 1. Commitment pooling

**Horizon:** now · **Stage:** evidencing
**Note:** v1 (contracts and indexer) has graduated to Product under the *Commitment Pooling* project; the open frontier, exchange and interoperability, runs under *Cosmo-Local Integration*.

**Question.** Can gardens coordinate, keep, and settle commitments on Green Goods, and can kept commitments become value that moves beyond the garden without Green Goods holding funds?

**Why it matters.** This is the product's core loop and the current RESR cycle theme (Q3 September: Evaluations, Commitments & Yield Impact). It carries the G$ settlement arrangement with GoodDollar's House of Alignment, the SustainableFinance.Live hackathon entry (GROW-43, PRD-857), and the first path from contribution to value.

**Anchors.**
- Linear projects [Commitment Pooling](https://linear.app/greenpill-dev-guild/project/commitment-pooling-4bc53572f354) and [Cosmo-Local Integration](https://linear.app/greenpill-dev-guild/project/cosmo-local-integration-6273120022c7).
- RESR-73 (design record for the Cosmo-Local voucher integration) and RESR-74 (live-deployment read). RESR-57 and RESR-58 (external brief and v1 scenarios) are the canonical scenario pack.
- PRD-650 (foundation roadmap), PRD-649 (architecture record), PRD-651 (exchange, redemption, federation; evidence-gated), PRD-796 (compatibility boundary), PRD-857 (the two-pool hackathon outcome) with PRD-1096 (rehearsal on a local copy of Gnosis), PRD-1097 (funder passport), PRD-1100 (go live) and PRD-1197 (the go or no-go record); COM-46 (issuer terms and capacity) and COM-28 (the pilot).
- Linear documents: *Commitment Pooling — Lifecycle And Aggregator Semantics*, *Pool Identity + Capability Architecture*, *Settlement Capability — Vouchers On Shared Pool Identity*, *Proof Capability*, *Feedback & Notes*.
- External canonical doc: the Green Goods Commitment Pooling Google Doc (tabs 01 External Brief and 04 Rollout Plan, owned by RESR-57).
- `.plans/active/commitment-pooling/` (`plan.todo.md` is the entry point; `exchange-architecture-brief.md`, `pilot-evidence-spec.md`, `settlement-spec.md`), `.plans/backlog/commitment-credit-follow-on/`, `.plans/backlog/cosmo-local-credit-interop/`.

**Status surface.** Project status update on *Cosmo-Local Integration*.

**Settled.**
- Commitments are module-native records on a non-transferable registry; a future voucher is a separate settlement instrument and never carries promise authority (`.plans/active/commitment-pooling/status.json` notes; PRD-649).
- G$ settles canonically on Celo through split-state CCIP commands; nothing bridges, only authorization crosses (settlement spec; RESR-73).
- Valuation happens in three layers that must not collapse: native units, a published per-cycle comparison table frozen at cycle open, and exchange that consumes the table. Federation needs no shared valuation; never build a global cross-pool rate table (RESR-73).
- Token expiry is not used; the Grassroots Economics repository is AGPL-3.0 and its security review is internal, so it does not satisfy the external-audit gate (RESR-73). Clean-room boundary: paper and public docs only.

**Open.**
1. Which network-membership path, if any, the completed RESR-74 findings support. Next step: carry its live-deployment findings into the go or no-go decision and name any remaining partner terms. Answerable by the team and Grassroots Economics.
2. The Grassroots Economics questions (supported versions for third-party use, licence for deployed interaction, quoter and limiter behaviour in production, wrap restriction to fulfilled commitments, who owns the pool a Green Goods voucher lists into). Next step: confirm whether the 19 August conversation happened and what it produced; if not, send the five prepared questions. Answerable by Grassroots Economics.
3. The pilot's falsifiable question: do vouchers move through a third party, or does everything settle bilaterally? Next step: collect the pilot-evidence-spec metrics from one garden cycle. Answerable only by pilot data.
4. The second confirmer on a redemption has no answer yet (RESR-73 tensions). Next step: a design note in the exchange brief.
5. Pilot-garden adoption: the Tech & Sun weekly sync of 2026-09-01 recorded a next step to present the protocol and team incentives to the garden team. Next step: the presentation and its feedback into *Feedback & Notes*.

**Implementable when.**
1. The RESR-74 findings are carried into a documented go or no-go on network membership.
2. The Grassroots questions are answered.
3. One garden cycle has produced pilot-evidence metrics.

Exchange work then moves through the PRD-651 gates (external audit, 3-of-5 Safe, 48-hour timelock, two weeks of testnet, tested rollback, explicit authorization).

**Watch keywords.** commitment, pool, pooling, voucher, Cosmo-Local, CLC, Grassroots Economics, Sarafu, settlement, G$, GoodDollar, clearing, mutual credit, CCIP, redemption, federation, cycle policy.

## 2. Impact methodology and verifiable reporting

**Horizon:** quarter · **Stage:** evidencing
**Note:** the foundation order is RESR-46 → RESR-49 → RESR-14, recorded as Linear blocker relations.

**Question.** How does the data generated on Green Goods (work, approvals, assessments, hypercerts) become an impact report that fits a named standard, is verifiable by outsiders, and is a credible asset a funder can invest in or support?

**Why it matters.** The Q3 strategy's third focus is "impact claims become outsider-verifiable: GIF v0.1 published, one real evaluation run end to end, one funder report in its language". The first House of Alignment report (GROW-15) is Done; its metric-inventory issue (RESR-65) was Canceled. The remaining research must make reporting definitions reusable beyond that first report. This track also supplies the language for yield-to-impact (track 3), the evidence contract for messaging channels (track 5), and the metric registry for the evidence mesh (track 7).

**Anchors.**
- Linear project [Impact Framework v0.1 Refresh](https://linear.app/greenpill-dev-guild/project/impact-framework-v01-refresh-79f8601bb953) under the *Impact Methodologies & Evaluator Flywheel* initiative.
- RESR-46 (base attestation schema), RESR-49 (data standards, baselines, governance), RESR-14 (evaluator workflow and rubric v0.1). RESR-77 defines report and certificate meaning against that foundation; RESR-8 (yield-to-impact language) consumes track 3; RESR-47 (IFRS S1/S2 mapping) is downstream and optional.
- RESR-65 (metric inventory), GROW-15 (first House of Alignment report), RESR-6 (taxonomy and glossary v1) and RESR-52 (reviewer and methodology collaborators), the foundation records.
- Linear documents: *Consolidation Memo — Impact Framework v0.1 Architecture*, *Literature Review Addendum — Biodiversity Infrastructure, Standards, MRV, and Certification Layers*, *Research Memo — IFRS S1/S2 Constraint Ladder*, *Research Memo — Outcome-Based Verification: Savory EOV and Backstory's Prove (2026-08-23)*, *Impact-Claim Domain Taxonomy & Glossary v1*, *A measurement framework for Green Goods regen impact*.
- The public garden impact API (the machine-readable surface shipped in PR 782, `packages/agent/src/api/routes/public-garden-impact.ts`) and `.plans/ideas/environmental-data-inputs/` with RESR-10 and RESR-72 (Open Forest Protocol and Silvi as verified-outcome inputs). Environmental data inputs remain an MRV sub-question here until a specific provider and pilot make a bounded research project useful.

**Status surface.** Project status update on *Impact Framework v0.1 Refresh*.

**Settled.**
- Taxonomy and glossary v1 are accepted (RESR-6). Reviewer and collaborator network exists (RESR-52).
- The RESR-46 → RESR-49 → RESR-14 sequence is already recorded in Linear blocker relations; the project description now explains the later report, funder-language, and optional mapping work.
- Work submissions capture no per-measurement coordinates; only gardens have a location. Per-measurement coordinates are a hard requirement for forest MRV of any kind (RESR-72 exploration). Open Forest Protocol has no public API, SDK, or developer docs, so anything past link-only needs a partnership; Silvi is the cheaper EVM-native alternative with an unverified integration surface.
- RESR-46 is stalled on one bounded revision request from 2026-06-18: ground the schema in the current work-submission and approval schemas, where sensor, human, and AI provenance fields already exist.

**Open.**
1. The RESR-46 revision. Next step: a crosswalk from the current submission and approval schemas to the proposed base fields, starting with the location row that RESR-72 already evidenced. Answerable by anyone with repo access.
2. Which metric definitions and sources from the completed GROW-15 report should become the reusable registry, and which still need a source. Next step: compare that report's evidence packet with the public garden impact API's response types. Answerable by the team.
3. Which standard the first report targets and what "verifiable" means to a funder: evaluator attestation with provenance, or third-party MRV. IRIS+, IMP, and CIDS as reporting vocabularies versus IFRS S1/S2 as a disclosure-supporting overlay (RESR-49, RESR-47). Next step: a one-page decision note for the panel.
4. What outcome-based verification (Savory EOV, Backstory's Prove) implies for the evaluator rubric (RESR-14). Next step: fold the 2026-08-23 memo's findings into the RESR-14 acceptance criteria.

**Implementable when.**
1. RESR-46 and the dependent standards and evaluator decisions are accepted.
2. The report and certificate meanings are settled.
3. A real evaluation run plus a funder report can be expressed in the framework's language.

RESR-47 remains an optional overlay.

**Watch keywords.** impact, methodology, evaluator, rubric, attestation, EAS, schema, hypercert, MRV, IRIS, IMP, CIDS, IFRS, baseline, metric registry, verification, verifiable, impact report, funder report, Open Forest Protocol, OFP, Silvi, Savory, EOV, Prove.

## 3. Yield strategies for garden endowments

**Horizon:** quarter · **Stage:** evidencing
**Note:** the strategy question is research-owned; the operator UX project belongs to Product.

**Question.** Which conservative Arbitrum yield strategies should garden endowments consider against the current Aave baseline, with what principal protection, liquidity, custody and failure risks; who controls principal and yield; and how does yield turn into funded impact?

**Why it matters.** The *Sustainability & Monetization* initiative is marked at risk and "first protocol revenue" is the quarter's bar. The cycle theme names yield impact. The `/vaults` Octant vault and Cookie Jar flows exist, and the harvest-to-distribution operator flow shipped in PR 776 (PRD-763, Done). Its archived QA lanes were not certified and the Brave check was not recorded; those proof gaps do not reopen delivery.

**Anchors.**
- RESR-9 (conservative Arbitrum yield strategy research), RESR-15 (map Season Two campaigns, vaults, and funding rails), RESR-8 (yield-to-impact codification).
- Linear project [Operator Yield Split Visibility & Presets](https://linear.app/greenpill-dev-guild/project/operator-yield-split-visibility-and-presets-375773578105) (PRD-351) and the Linear document *Green Goods x Octant Vault Scope Lock*.
- `.plans/ideas/rwa-yield-expansion/` owns the RESR-9 research boundary. Its former Aave/Morpho/Ondo mix, Conservative/Balanced presets, buffer/FIFO design and sustained ≥5% target are historical hypotheses, not accepted constraints. The admin harvest-and-distribute workflow shipped in PR 776 is separate implementation evidence.
- The weekly growth-pulse status update on *Sustainability & Monetization* for TVL and yield numbers. Do not re-query PostHog or the indexer here.

**Status surface.** Comment on RESR-9 (there is no research-owned project; the Product project is for the operator UX, not the strategy question).

**Settled.**
- RESR-9 produces a decision-ready recommendation with current primary-source evidence and explicit uncertainty. Research does not authorize contracts, adapters, custody, migration or fund movement; no preset architecture is accepted by this agenda.
- Harvest and distribution are separate transactions; admin must not report harvest as distribution (harvest-distribution-ux brief).
- Cookie Jar is historical context, not an active rail (RESR-15 boundary).

**Open.**
1. The current candidate strategy set on Arbitrum, compared with the Aave baseline on principal protection, liquidity, custody/compliance, yield mechanism and failure/recovery. The former strategy list and Q2 dates are historical. Next step: RESR-9's first artifact, a strategy table with current primary sources and explicit uncertainty. Answerable by the owner.
2. Whether presets or a policy layer are appropriate at all, and what allocation authority, liquidity model, migration boundary and timelocks a recommendation would require. Hats roles, buffer/FIFO redemption and the 48-hour switch are reopened hypotheses. Next step: compare alternatives and reconcile any recommendation with the scope-lock document before accepting implementation scope.
3. The funding-rail map (RESR-15): Octant vault crowdfunding, Juicebox and Revnet, direct Safe payout, partner rounds, GoodDollar allocation paths, with initiator, principal control, yield control, evidence trigger, and funder view per rail. Next step: deliver its October comparison; it also feeds track 6.
4. Yield-to-impact language (RESR-8) once RESR-15 lands.
5. What yield outcome current evidence supports at conservative risk. Sustained ≥5% is a historical hypothesis, not a minimum acceptance bar. Next step: the panel reads RESR-9's table and accepts or rejects a revised outcome.

**Implementable when.**
1. A strategy recommendation and any required architecture with current yield evidence, risk notes and audit implications are accepted.
2. RESR-15's rail map is accepted.
3. The operator UX scope (PRD-351) is confirmed against that decision.

Presets are conditional on the accepted recommendation.

**Watch keywords.** yield, vault, APY, Aave, Morpho, Metamorpho, Ondo, USDY, RWA, endowment, preset, strategy, Octant, MultistrategyVault, harvest, splitYield, treasury, TVL, Cookie Jar.

## 4. Capital access: off-ramps and on-ramps by geography

**Horizon:** quarter · **Stage:** blocked (external)
**Note:** desk research is complete; the next step is provider contact.

**Question.** How can a gardener in Nigeria, South Africa, Brazil, or the United States turn a payout of roughly $5 to $100 into local money from inside the app, and how can supporters bring capital in, without Green Goods taking custody?

**Why it matters.** Payout that cannot be spent is not a payout. The corridor work decides whether Green Goods is usable in the pilot geographies at all, and the on-ramp side decides how accessible the product is to supporters in the same places.

**Anchors.**
- Linear project [Capital Off-Ramp Corridors](https://linear.app/greenpill-dev-guild/project/capital-off-ramp-corridors-3f9573efe397). RESR-70 (confirm provider terms before choosing an integration). RESR-71 (independent review pass over the corridor research).
- RESR-82 (a familiar donation flow for Nigeria-connected supporters) and RESR-94 (evidence for the diaspora funding pitch); Linear project *Garden Fiat Contributions* for the supporter-inflow side.
- `.plans/ideas/capital-offramp-corridors/brief.md` (the corrected research brief; sections 12.2 to 12.8 carry the option tables) and `reports/codex-review-2026-08-04.md`.
- Adjacent: the House of Alignment project (G$ distribution rail decision) and the Celo GardenAccount evidence in `packages/contracts/config/celo-garden-accounts/` for the Celo settlement path.

**Status surface.** Project status update on *Capital Off-Ramp Corridors*.

**Settled.**
- Keep the three money flows separate: treasury conversion, participant payout, funder inflow. Only participant payout is in scope of the corridor brief.
- Do not move payouts off Arbitrum to reach an off-ramp; Breet, Kotani, Fonbnk, and VALR publish Arbitrum USDC paths.
- Nigeria: regulator-verifiable routes only; no provider selected. South Africa: VALR is the strongest verified technical corridor, but no in-app route is selected.
- Community currencies and G$ support local circulation; they are not a substitute for a credible cash exit.
- A provider is a candidate, not a selection, until entity eligibility, exact network and asset direction, minimum, all-in quote, payout rail, refund behaviour, and current regulatory status are proven.
- The independent review (RESR-71) confirmed 3 of 20 high-impact claims as written and corrected 17.

**Open.**
1. RESR-70's five provider facts: whether a foreign entity can hold the Nigerian payout provider's business account and disburse to third parties; whether any provider accepts a garden's local entity as account holder; per-provider minimums; whether the aggregator covers naira and rand; and what the two unpriced providers charge. Next step: direct provider contact. Answerable only by the providers.
2. Regulatory movement in Brazil, Nigeria, and South Africa this quarter against the 2026-08-03 snapshot. Next step: a dated re-check of the sources cited in the brief. Answerable by desk research; this is the one part of the track the routine can advance.
3. The on-ramp and supporter-inflow side is explicitly outside the corridor brief and has no issue. Next step: frame it as its own question (who the supporter is, which rails already exist through `/vaults` and Cookie Jar, and what geography changes). Answerable by the team.
4. Whether G$ through House of Alignment covers a pilot garden's near-term needs while fiat exits stay unresolved. Next step: read against the House of Alignment rail decision.

**Implementable when.** For one corridor:
1. A live quote at 5, 15, 20, 50, and 100 USDC to a same-name bank account.
2. A confirmed account-holder model.
3. A tested refund and name-mismatch path.

**Watch keywords.** off-ramp, on-ramp, cash-out, payout, Breet, Kotani, Fonbnk, VALR, Yellow Card, Onramper, Transak, PIX, naira, NGN, rand, ZAR, BRL, KYC, KYB, money transmission, remittance, GoodDollar, G$, stablecoin.

## 5. Accessible impact reporting via WhatsApp and SMS

**Horizon:** quarter · **Stage:** graduated
**Note:** the entry-criteria research graduated to Product and the active Plan Hub. Pilot research remains open; graduation does not establish implementation or live proof.

**Question.** What must be true for gardeners to report impact from WhatsApp or SMS without installing the app, with a short account step only when signing is required, and what pilot proves lower total reporting burden rather than burden moved onto operators?

**Why it matters.** The *Accessible Participation* initiative sets real pilot submissions as the bar. RESR-75 completed the entry-criteria gate, and the messaging project is In Progress. The remaining pilot research tests whether the accepted reporting architecture reduces total gardener and operator burden under acceptable consent, retention, regional and accuracy terms.

**Anchors.**
- Linear project [Agent Messaging Channels (WhatsApp + SMS)](https://linear.app/greenpill-dev-guild/project/agent-messaging-channels-whatsapp-sms-71cda634fcf7).
- RESR-75 (entry criteria) and RESR-79 (which models may read a gardener's report, and on what terms); the pilot research set RESR-88 (what intake may retain before consent), RESR-89 (what each infrastructure milestone measures), RESR-90 (a Telegram Mini App for account linking), RESR-91 (the reporting service availability target) and RESR-92 (delegate key custody before wider rollout).
- PRD-955 (the Meta Cloud API prototype record) and PRD-970 (the chat field walk). Older build assignments and gate instructions in those records do not redispatch delivered work; current handoffs own remaining live acceptance.
- [Current Agent Messaging Plan Hub](../../.plans/active/agent-messaging-channels/technical-brief.md): existing EOAs sign exact publications; existing Kernel users may grant separate limited reporting/review permissions after compatibility proof.
- The evidence mesh roadmap's Phase 1 evidence list (minutes per accepted submission, completion and abandonment, correction rate, operator minutes, data cost, language and device coverage, consent comprehension).
- PostHog Agent project (`262124`) for what the Telegram agent already sees; read through growth-pulse or bug-intake, never re-queried here.

**Status surface.** Project status update on *Agent Messaging Channels (WhatsApp + SMS)*.

**Settled.**
- The prototype entry criteria were accepted on 2026-09-21. The current user-approved architecture is API-harness-first and Meta DM-first, with reporting/correction/review in chat and platform-neutral browser ceremonies when authentication or signing is needed.
- The prototype uses existing EOA/Kernel accounts and pre-enrolled TAS or Aiyeloja Family Garden members. EOA publications require exact signing; Kernel reporting and review delegation are separate, limited and subject to proof. Universal passkey onboarding/Profile wallet association remain future work.
- OpenAI processes content and Jev makes bounded typed decisions. Documents, photos and spreadsheets are included, with isolated automatic Office conversion. Provider terms and live quality still need evidence.
- Capture is private and consent-gated; public evidence requires separate confirmation. Afolabi operates WhatsApp as a sole proprietor doing business as Green Goods (decided 2026-10-04, replacing WEFA) and owns support at contact@greengoods.app. The accepted grant/retention limits and current implementation contract live in the Plan Hub.

**Open.**
1. Pilot cohort, baseline and metric set: reporting completion/correction, total gardener and operator time, language/device coverage, support load and consent comprehension. A successful prototype is not pilot-effectiveness evidence.
2. Pilot provider provisioning, templates, geography/pricing and applicable processing/retention terms. SMS is excluded from the current prototype and must not re-enter through this research track implicitly.
3. Live content-processing quality/coverage, latency and cost, including RESR-79's labelled-set comparison against the deterministic walk; exact Kernel permission/custody compatibility and gas limits; browser/account handoff and deployed configuration proof. Track these evidence gates without treating a selected provider as a passed evaluation. No live or shadow processing of gardener reports before the provider/consent gate passes; use synthetic fixtures meanwhile.
4. Operational readiness before real intake: support rehearsal, provider settings and the remaining audit/backup retention schedule. The support owner, the support address and local draft-data retention decisions are settled; their implementation is not: the chat and its pages do not show the address yet, and the mailbox is unverified.
5. How activity fields and evidence map to the base attestation recommendation in track 2. Next step: one worked example per prototype garden domain.

**Implementable when.**
1. The prototype product direction is accepted.
2. Live intake and each demonstrated capability pass the Plan Hub's separate operating and compatibility gates, which current handoffs own for delivered source.
3. Pilot acceptance: the metric, cohort and evidence work in the Open list above is done.

The completed PRD-998 tracker and start gate do not authorize redispatch, and this document never changes Linear issue or project state.

**Watch keywords.** WhatsApp, SMS, Twilio, Meta Business, messaging, agent, session key, Telegram, low-bandwidth, USSD, voice note, opt-in, template message, entry criteria, feature phone.

## 6. Revenue token models (Revnets) for a goods and services layer

**Horizon:** next · **Stage:** framing
**Note:** framing now, decision next quarter.

**Question.** Could a Revnet-style revenue token let a garden sell goods and services through Green Goods with transparent, rule-based revenue sharing, and how would it relate to commitment vouchers, vault endowments, and cash-out?

**Why it matters.** Gardens produce goods (harvests, seedlings, compost, energy) and services (workshops, training). Green Goods records the work but offers no way to sell its output. The *Sustainability & Monetization* initiative names tokenization and service revenue. At least one pilot garden already runs one: AgroforestDAO ties agroforestry to a biogas-to-electricity Revnet (pooling scenario B3).

**Anchors.**
- RESR-15 lists Juicebox and Revnet as a Season Two funding rail to compare (initiator, principal control, yield control, evidence trigger, funder view).
- `.plans/active/commitment-pooling/reports/linear/linear-apply-pack.md` section B3 (AgroforestDAO's Revnet stays outside pooling v1 scope; the module never custodies funds).
- RESR-76 (frame what a Revnet would add to a garden's goods and services beyond pooling and vaults). No bounded project or plan hub exists, by design, until the framing lands.

**Status surface.** Comment on RESR-76.

**Settled.**
- Nothing about the mechanism is settled. Revnet integration is outside pooling v1 and the pooling module never custodies funds.

**Open.**
1. Frame the question: what a Revnet provides that pooling plus vaults plus cash-out do not (continuous rule-based issuance and redemption against revenue, automated splits, no discretionary governance) and what it costs (which chains carry the contracts, Arbitrum availability, fees, audit status, and the legal posture of a revenue token for a garden). Next step: the one-page framing note that RESR-76 asks for.
2. Who issues (a garden Safe or Green Goods), who holds, how goods and services are priced and delivered, and what "revenue" means for a garden with mostly in-kind output.
3. Interaction with Cosmo-Local vouchers: two tokens per garden is a smell, and the no-universal-price rule from track 1 applies here too.
4. AgroforestDAO's actual Revnet configuration as the case study. Next step: read it and record it before designing anything.

**Implementable when.**
1. A decision-ready brief compares a Revnet, a pooling voucher, and a plain Safe split for one garden's goods and services.
2. The panel picks a path, including "not now".

**Watch keywords.** Revnet, revnets, Juicebox, revenue token, goods and services, marketplace, split, buyback, issuance, redemption, bonding curve, AgroforestDAO, biogas.

## 7. Community infrastructure with AI for data sovereignty (Community Evidence Mesh)

**Horizon:** 12mo · **Stage:** horizon
**Note:** August 2026 to July 2027; Phase 0 (foundation) runs August to September 2026.

**Question.** How does Green Goods become a community-owned evidence layer where AI proposes but never originates evidence, raw data stays local by default, and communities can run, export, and stop the infrastructure themselves?

**Why it matters.** This is the direction the near-term tracks converge on: messaging capture (5), the metric registry and evidence contract (2), community-authored context (Community Needs & Signals), and eventually evidence-to-capital (1). It is also the sovereignty argument that distinguishes Green Goods from extractive MRV.

**Anchors.**
- Linear initiative [Community Evidence Mesh](https://linear.app/greenpill-dev-guild/initiative/community-evidence-mesh-f7bdee530343).
- Linear documents: *Community Evidence Mesh: Thesis, Architecture & Narrative*; *Evidence Model, Privacy & Trust*; *12-Month Roadmap, Dependencies & Measures*; *Green Goods and Gitcoin's Local-First Pivot*.
- RESR-69 (the Certified and Ma Earth approval publishing contract, which carries the AT Protocol identity question) as a possible sovereignty prerequisite. The Public Goods Staking Protocol is a watched dependency for community edge compute, not an AI-node commitment.

**Status surface.** Initiative status update on *Community Evidence Mesh*, monthly at most, and only when a Phase 0 output or a locked decision changes.

**Settled (locked decisions).** The name; AI proposes and never originates evidence; a shared metric registry is required; an ADR precedes any expansion; raw media stays local by default; familiar channels before sensors; bounded energy sensing before ecological sensing; a separate edge box before validator colocation; connect existing projects rather than create a new project tree.

**Open.**
1. Phase 0 outputs: the current reporting-burden baseline, metric registry v0 (informed by the completed GROW-15 report and RESR-49 in track 2), Evidence Envelope v0, the ADR, two or three community co-design sessions, and a pilot selection rubric. Next step: reconcile the report's actual metrics with the framework research; RESR-65 is Canceled and no longer a gate.
2. The 90-day go or no-go on the familiar-channel pilot, which is track 5's decision.
3. Whether an identity layer (RESR-69) is a sovereignty prerequisite or a later concern.
4. How the local-first funding narrative (the Gitcoin pivot document) shapes what funders are asked to pay for.

**Implementable when.** The Phase 0 gate passes:
1. The metric set is explicit.
2. The evidence-origin rule is explicit.
3. The raw-data boundary is explicit.
4. The review authority is explicit.
5. The correction path is explicit.

**Watch keywords.** evidence mesh, data sovereignty, sovereign, local-first, edge, on-device, transcription, provenance, consent, metric registry, ADR, Evidence Envelope, AT Protocol, Certified, Gitcoin, sensor, edge node, privacy.

## Off-agenda board work (watch only)

These live on the Research team but are not agenda tracks this quarter. The routine mentions them in its memo only when a human touched them, and never in the digest unless they connect to a track above. Identifiers only; the routine reads their state live.

- PGSP research trio: RESR-66, RESR-67, RESR-68.
- Cross-chain Safe owner validation: RESR-78, which gates external architecture sharing (GROW-56) and the Safe proposal (GROW-44). The October credit pilot (PRD-857) uses the separate settlement-lane path and does not wait on this memo.
- GreenWill recognition mapping: RESR-4, with no badge build until the mapping decision.
- Account recovery and identity: RESR-21, whose owner still needs to confirm the current plan and scope. RESR-69 is read through track 7 only.

## Candidate tracks

Panel-confirmed entries only. Candidates live in the Linear document *Research agenda · pending edits*: the routine lists a Research issue or a `.plans` hub that matches no track from the first run that sees it, with a run count for recurrence, and a panel member may add a candidate line there directly. At a cycle boundary the panel confirms or rejects each one, and the `research-agenda` skill's `candidates` mode turns a confirmed candidate into a track section here. Until confirmation this section stays empty, and the routine reads a candidate's issues onto the nearest track or the watch list.

## Candidate questions

Routine-proposed one-line research questions from `#research` shares and call notes, in the Accepted Research Task question shape, confirmed by the panel before they become an Open item or a Research issue. None confirmed yet; proposals live in the pending-edits document.

## Change log

- **v5 · 2026-10-18.** Restructure only; no track order, horizon, stage, question, settled fact or open item changed, apart from one settled line moved from track 4's anchors. Anchors now carry identifiers and topics, never state, owners, dates, cycles, targets or project membership, which the routine reads live. Removed from anchors and notes: the project states and targets on every track; the owners and cycles on RESR-9, RESR-15, RESR-70 and RESR-76; the Done and Canceled markers on RESR-74, RESR-57, RESR-58, RESR-65, RESR-6, RESR-52, RESR-71 and RESR-75; the "unowned" note on track 2; the PRD-998 gate narrative on track 5; the dates and states in the off-agenda list. Added by identifier: *Cosmo-Local Integration* on track 1, which is now its status surface because *Commitment Pooling* completed on 2026-10-09; PRD-1096, PRD-1097, PRD-1100, PRD-1197, COM-46 and COM-28 on track 1; RESR-82, RESR-94 and *Garden Fiat Contributions* on track 4; RESR-88 to RESR-92 on track 5; RESR-69's current title on track 7. Implementable-when bars are numbered so the routine can count them. New sections *Candidate tracks* and *Candidate questions* hold only panel-confirmed entries; proposals, including the three candidates the hub brief names, live in the pending-edits document until the 29 October review. The 2026-10-16 anchor-wording edit that carried no edition line is folded in. Substantive drift proposals since v4 stay in the pending-edits document for the 29 October cycle review.
- **v4 · 2026-10-06.** Track 3 now treats the former yield mix, preset architecture, ≥5% target and Q2 dates as historical hypotheses; research must produce a current evidence-backed recommendation before implementation scope is accepted. It also records PRD-763 delivery separately from its uncertified QA and unrecorded Brave proof. Track 5 retires the completed PRD-998 start gate and points remaining live acceptance to current handoffs. Track order, horizons and stages are unchanged.
- **v3 · 2026-10-04.** Track 5 only: the WhatsApp operator in the settled list changed from WEFA to Afolabi as a sole proprietor doing business as Green Goods, and the support address changed from afo@wefa.world to contact@greengoods.app, after the user decisions of 2026-10-04 recorded in the Plan Hub. No order, horizon, stage or open question changed; the next Research cycle review still decides those.
- **v2 · 2026-09-24.** Reconciled completed and canceled research gates with Linear; recorded the Impact Framework sequence, current messaging research gate, and the environmental-data and identity backlog cleanup. The next Research cycle review still decides priorities and dates.
- **v1 · 2026-09-02.** First edition. Seven tracks ordered from the steward's brief of 2026-09-02, grounded in the live Linear board, the `.plans/` hubs, and the routine's own August memos. The two gaps the edition named were filed the same day as RESR-75 (track 5) and RESR-76 (track 6).
