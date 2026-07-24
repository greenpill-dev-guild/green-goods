# Commitment Pooling — Pilot Evidence Spec

- **Status**: STRUCTURE-APPROVED · OPERATIONAL-ASSIGNMENT-GATED
- **Execution sub-lane**: `settlement_evidence`
- **Accountable owner**: Afolabi Aiyeloja
- **Linear mirror**: PRD-735 under PRD-650
- **Operational checkpoint**: 2026-09-30
- **Last updated**: 2026-07-23

## 1. Authority and boundary

This document is the normative contract for:

- what the Commitment Pooling pilot is trying to learn;
- what evidence is required before Green Goods can claim that pooling strengthened settlement
  capacity;
- how coercion, hidden exposure, misleading circulation, repair, and privacy risks are evaluated;
- what may be reported internally, to trusted partners, or publicly; and
- what keeps an outcome claim unavailable even when product and settlement features work.

It does **not** authorize a product implementation, analytics pipeline, Celo transfer indexer,
partner outreach, release broadcast, garden-specific numeric threshold, or named role assignment.
Those remain operational decisions in the blocked `settlement_evidence` lane.

Companion authorities remain separate:

- `contract-spec.md` owns commitment state and permissions.
- `settlement-spec.md` owns transport, execution, acknowledgment, and the mechanical circulation
  definitions in §11.
- `uiux-spec.md` owns rendered state and public-display behavior.
- `acceptance-matrix.md` owns cross-surface implementation and QA targets.
- `handoffs/human-settlement-evidence.md` owns the operational-assignment gate and evidence-packet
  delivery.

If a companion document describes a metric without the baseline, safeguards, or claim limits
required here, the metric may be displayed only within that companion's approved scope. It does
not support a pilot-outcome claim.

### 1.1 Approved evaluation posture

The following structural decisions were approved by Afo on 2026-07-23. They are binding for the
pilot and are not part of the remaining assignment gate.

| Area | Approved structure |
|---|---|
| Purpose | Decide whether and how to continue or refine the pilot in the same gardens. Trusted-partner validation is secondary. This evidence does not authorize expansion to additional gardens. |
| Cohort and baseline | Treat each garden as its own cohort and compare cycles within that garden and a comparable commitment class. Use reliable pre-pilot evidence when available; otherwise the first complete cycle becomes the baseline. |
| Source hierarchy | Use a claim-specific authoritative source. Missing designated evidence is unavailable and cannot be replaced by a weaker source. |
| Decision thresholds | Use a two-key gate: predeclared capacity improvement plus safeguard clearance. Stop conditions override positive metrics. Do not create a composite score. |
| Qualitative method | Use a light-touch independent mixed method: optional start/close pulse plus a small cross-role interview set, in local language where needed. |
| Safeguarding and repair | Use local repair for ordinary operational issues and independent escalation for sensitive or serious cases, including a confidential bypass around the local steward. |
| Privacy and publication | Use restricted safeguarding, trusted partner/research, and public tiers, each with purpose limits, suppression, linkability, consent, and retention controls. |
| Implementation and approval | Run the first cycle as a reproducible human-reviewed operational process. Separate preparation, local-fact review, safeguarding/privacy clearance, and publication decisions. |

## 2. Claim hierarchy

Evidence for one claim class never automatically proves the next.

| Claim class | Minimum proof | Does not prove |
|---|---|---|
| Implemented | Current code, deployment, configuration, or rendered-surface proof | Use, settlement, fulfillment, or benefit |
| Commitment state changed | Authenticated contract event and indexed state | Value arrival, social agreement, or durable fulfillment |
| Settlement confirmed | Authenticated current CCIP success acknowledgment | Commitment quality, fair burden sharing, or strengthened capacity |
| Commitment fulfilled | Canonical fulfilled state plus the evidence and eligible-party confirmation required for that commitment | Improved pool-level capacity or wider community benefit |
| Settlement capacity strengthened | Approved cohort, baseline, complete metric registry, safeguard review, and no unresolved stop condition | Causal livelihood, resilience, or ecological impact |
| Wider impact | A separate approved impact methodology and evidence set | Not established by this pilot-evidence lane |

For this pilot, **settlement capacity** means:

> The pool's demonstrated ability to convert voluntary, bounded commitments into fulfilled and,
> where applicable, settlement-confirmed outcomes over repeated cycles without increasing
> unresolved exposure, concentrating burdens, removing safe refusal, or leaving failures without
> a fair repair path.

A declined, disputed, cancelled, expired, or unfulfilled commitment is not by itself evidence of
debt, poor character, creditworthiness, or moral failure. This lane must never produce participant
scores or punitive public comparisons from those states.

The pilot's primary decision is garden-specific: **continue**, **refine**, **pause**, or **stop**
the next cycle in that same garden. A trusted-partner annex may validate the method and its
limitations, but neither the internal decision nor the annex is an expansion decision.

Green Goods may claim that the pilot strengthened settlement capacity only when both keys are
true:

**Key 1 — capacity improvement**

1. the cohort, baseline, observation window, exclusions, and decision thresholds were approved
   before outcome interpretation;
2. each garden has one primary capacity measure and a small declared set of secondary measures;
3. the primary measure reaches its predeclared minimum meaningful improvement against a defensible
   baseline; and
4. the denominator, observation window, exclusions, and required claim-specific sources are
   complete at the declared proof level.

**Key 2 — safeguard clearance**

1. the remaining capacity and safeguard measures stay within their approved bounds;
2. no unresolved coercion, retaliation, materially worsening exposure or concentration, serious
   dispute without repair, privacy incident, or misleading-circulation condition applies; and
3. the evidence, safeguarding, privacy, and publication decision rights in §10.2 have been
   completed.

A stop condition overrides a positive metric. Missing denominators or designated sources make the
affected result unavailable; they do not become a pass. No composite score may offset a safeguard
failure with stronger activity or fulfillment numbers.

If thresholds or comparisons are selected after reviewing outcomes, the result must be labeled
**exploratory** and cannot support a pre-specified success claim.

Threshold values may be set after the baseline is understood, but they must be dated before the
comparison-cycle outcomes are reviewed.

## 3. Evaluation questions

The September evidence packet must answer each question as **Supported**, **Mixed — refine**,
**Not supported**, or **Unavailable**. These categories are judgments against declared evidence,
not a numeric composite:

- **Supported** — the required evidence supports the scoped claim and both decision keys clear.
- **Mixed — refine** — evidence shows useful capacity but a bounded design or operating change is
  required before the next cycle.
- **Not supported** — the declared evidence does not support continuation under the current
  design, or a stop condition requires pause or stop.
- **Unavailable** — the denominator, designated source, cohort comparability, or required review
  is incomplete; no substantive outcome conclusion is made.

| Question | Required evidence family | Claim limit |
|---|---|---|
| Did due commitments reach fulfillment more reliably? | State counts, `promiseKeptRate`, time-to-fulfillment, exclusions | Activity or settlement volume alone is insufficient |
| Did settlement become more reliable and recoverable? | Queued, dispatched, executed/ack-pending, confirmed, failed, delayed, retry, and repair evidence | Dispatch or Celo execution is never value-arrival proof |
| Did unresolved participant or provider exposure grow? | Open commitments, cap saturation, overdue/unresolved stock, unconfirmed settlement, concentrated burden | Averages may not hide a high-burden subgroup |
| Could people refuse, withdraw, pause, or dispute safely? | Product-path proof plus consent-based qualitative evidence and confidential safeguarding review | Telemetry cannot prove the absence of pressure or retaliation |
| Were failures repaired fairly? | Repair receipts, time to resolution, outcome, appeal/re-entry state | Closing a ticket is not evidence that trust or participation was restored |
| Did G$ circulate meaningfully? | Cohort-based, non-duplicative measures from `settlement-spec.md` §11 | Raw transfer count or volume is not healthy circulation |
| Were benefits and burdens distributed without public ranking? | Garden/cycle aggregates, concentration review, qualitative context | No participant score, leaderboard, or public comparative ranking |
| Can findings be shared without exposing participants? | Publication tier, consent, suppression, linkability, retention, and access review | A UI display threshold alone is not a research privacy decision |

## 4. Units of analysis

Every evidence item declares exactly one primary unit:

| Unit | Use |
|---|---|
| Commitment | Lifecycle, due/fulfilled state, evidence, dispute, and declared reward |
| Participant/provider | Internal safeguarding and burden analysis only; never a public outcome row |
| Garden/pool | Capacity, concentration, governance, and local context |
| Cycle/season | Cohort definition, before/after comparison, and circulation window |
| Settlement cohort | G$ distribution, acknowledgment, recirculation, leak, reseed, and hoard analysis |
| Repair episode | Trigger, authority, action, outcome, appeal, and restoration |

Cross-unit aggregation must not mix exact unit labels, gardens, cycles, or settlement cohorts
without an approved transformation recorded in the metric registry.

## 5. Metric and evidence registry

Before collection or implementation is assigned, every quantitative metric and qualitative
finding must have a completed registry row with:

| Required field | Rule |
|---|---|
| Evaluation question and allowed claim | Name the exact conclusion this evidence can support |
| Definition and proof limit | State what is measured and what remains unproven |
| Numerator, denominator, and unit | Required for rates; mark not applicable for qualitative evidence |
| Primary unit and aggregation grain | Commitment, participant/provider, garden, cycle, cohort, or repair episode |
| Observation window | Fixed dates or lifecycle boundary |
| Included and excluded states | Never silently drop failed, disputed, cancelled, delayed, or unavailable cases |
| Baseline or comparator | Name source, period, cohort, and comparability limits |
| Threshold and decision consequence | Declare the response triggered by crossing the threshold |
| Primary source and evidence owner | Include access owner, refresh cadence, and observation date |
| Missing-data behavior | Use `unavailable`; never infer zero or success |
| Privacy class and publication tier | Internal safeguarding, trusted partner/research, or public |
| Suppression and linkability rule | Include minimum cohort and complementary suppression where needed |
| Retention, consent, and deletion rule | Required for qualitative or participant-level source material |

### 5.1 Required metric families

| Family | Minimum measures to define | Principal proof limit |
|---|---|---|
| Commitment reliability | Due and fulfilled counts, `promiseKeptRate`, time to fulfillment, unresolved due stock | Does not establish why outcomes changed |
| Settlement reliability | State counts, confirmation latency, failures, same-key retries, acknowledgment retries, new attempts | Only authenticated current success acknowledgment proves arrival |
| Exposure and concentration | Open commitments, provider cap saturation, unresolved settlement, provider/role concentration, reported unreimbursed burden | Aggregate improvement may hide concentrated harm |
| Safe refusal and agency | Available decline/withdraw/pause/dispute paths, consent-based reports of whether refusal was safe | Product affordance does not prove social freedom to use it |
| Repair and governance | Disputes, resolution time, repair outcome, appeal, re-entry/terminal outcome, override/fallback use | Administrative closure does not equal restored participation |
| Circulation quality | Recirculation, reseed, velocity, leak, hoard, settlement cohort completeness | Raw transfer volume and repeated movement are not outcome evidence |
| Community legitimacy | Consent-based steward/member interpretation of fairness, cultural fit, usefulness, and burden | Small qualitative samples are contextual, not population estimates |

Numeric values, garden-specific source access, and named source owners remain unresolved until the
operational assignments in §10.3 are recorded.

### 5.2 Claim-specific source hierarchy

No source is authoritative for every claim. Each registry row uses the following hierarchy:

| Claim | Designated authoritative source | Proof limit |
|---|---|---|
| Arbitrum commitment state | Authenticated contract events and the current indexed state derived from them | Does not prove participant consent, value arrival, or social repair |
| Settlement arrival | Authenticated current CCIP success acknowledgment for the exact settlement command | Dispatch and destination execution are insufficient |
| Celo execution | Bounded `CeloSettlementExecutor` event | Proves the declared execution result, not arrival on Arbitrum |
| Circulation | Approved Celo observation or attested read model with complete cohort attribution and denominator | Raw transfer activity or an estimated denominator is insufficient |
| Voluntariness, burden, and safe refusal | Consent-based confidential qualitative evidence reviewed through the approved method | Product controls and telemetry cannot prove social freedom or absence of retaliation |
| Repair | Human-owned repair register plus privacy-safe supporting references | Administrative closure does not prove restored safety, agency, or trust |

Every source registration names its access owner, evidence owner, refresh cadence, observation
date, and proof limit. If the designated source is unavailable, the claim is **Unavailable**. A
weaker source may add context but may not substitute for the missing authoritative evidence.

## 6. Safeguard, exposure, and repair register

The evidence packet must include a confidential, human-owned register. Sensitive source material
does not belong in Linear, public analytics, or public repository artifacts.

| Risk | Observable signal | Required decision response |
|---|---|---|
| Coercion or retaliation | Credible report that a person could not safely decline, withdraw, dispute, leave, or choose whether to hold, spend, or cash out G$ | Pause the affected success claim; initiate the approved safeguarding review |
| Hidden provider exposure | Persistent cap saturation, unresolved commitments, repeated fronting of costs, or concentrated burden | Review caps and operating model before claiming stronger capacity |
| Hidden settlement exposure | Growing dispatched or executed/ack-pending stock, repeated failures, fees, or unreimbursed costs | Report the exposure explicitly; do not treat it as confirmed or fulfilled value |
| Unrepaired failure | Dispute backlog, overdue repair, repeated override/fallback use, or no appeal/re-entry path | Pause the affected governance or capacity claim |
| Misleading circulation | Missing cohort attribution, duplicate counting, incomplete denominator, or raw volume substituted for recirculation | Mark the circulation result unavailable |
| Privacy or re-identification | Small cell, linkable time slice, identifiable quotation, or excessive retention | Suppress publication and correct access/retention before redistribution |
| Burden concentration | A small provider/role group carries a disproportionate share of open or failed commitments | Add distribution context and withhold a pool-wide success claim until reviewed |

The stop-condition classes above are approved. Garden-specific warning thresholds, response
clocks, and accountable reviewers remain operational assignments. A credible safeguarding report
is not required to meet a public statistical threshold before review.

### 6.1 Repair receipt

Every material repair episode records:

- trigger and observation date;
- authorized decision-maker;
- pre-repair commitment, settlement, or participation state;
- action taken and privacy-safe evidence reference;
- post-repair state;
- appeal path;
- re-entry, withdrawal, or terminal outcome; and
- accountable reviewer sign-off.

A repair receipt proves that a defined response occurred. It does not prove that the participant
felt safe or that trust was restored; that requires consent-based qualitative evidence.

Repair is complete only when the trigger, authority, corrective action, outcome state,
re-entry/withdrawal/terminal choice, appeal path, and reviewer sign-off are recorded.
Administrative closure alone is insufficient. Repair must not automatically create an onchain
penalty, public mark, participant score, exclusion, or other punitive profile.

### 6.2 Qualitative evidence method

The first-cycle method is intentionally light-touch and independent:

1. offer every participant in a small cohort an optional short pulse at cycle start and close;
2. conduct a small number of semi-structured interviews across participant, provider, and steward
   roles;
3. use a neutral interviewer who is not the participant's direct steward when practicable;
4. use a shared core question set with local-language delivery and garden-specific follow-up;
5. ask about voluntariness, safe refusal, burden, fairness, choice to spend/hold/cash out G$, and
   the accessibility and fairness of repair; and
6. disclose invitations, responses, nonresponses, role mix, and limitations without claiming
   statistical representativeness.

Participation is optional. No quotation is public by default; exact wording requires separate
consent for the named publication tier. Optional qualitative material may be withdrawn before
synthesis and sign-off according to the recorded consent process.

### 6.3 Safeguarding and escalation

Ordinary operational issues may use a documented local repair path. Coercion, retaliation,
steward involvement, privacy incidents, repeated burden, serious exposure, or appeals require an
independent safeguarding path. A participant must be able to bypass the local steward and reach
that path confidentially. A steward cannot review a complaint in which they are implicated.
Sensitive case details remain outside Linear, the public repository, onchain records, and product
analytics.

## 7. Baseline and attribution

Each garden is its own primary cohort. The primary comparison is within that garden by cycle and
comparable commitment class. Use a documented pre-pilot baseline when reliable comparable
evidence exists; otherwise the first complete pilot cycle becomes the baseline and no
strengthened-capacity claim is available until a later defensible comparison cycle.

Protocol-wide aggregation is secondary, must preserve garden-level results, and must not hide a
garden with a stop condition or materially different operating context. The registry records
material changes in cohort composition, reward availability, steward capacity, settlement
enablement, merchant/sink availability, and external conditions.

A matched comparison garden or cohort may be used only when its comparability and consent are
approved. Without an appropriate comparison design, Green Goods may report an observed change or
participant interpretation but may not claim that commitment pooling caused a livelihood,
resilience, ecological, or community-wide outcome.

If individual member delivery is disabled, a denominator is incomplete, or the required Celo-side
observation is unavailable, the affected circulation or settlement-capacity result remains
unavailable. Narrative context cannot substitute for the missing denominator.

## 8. Circulation integrity

The formulas and open data dependencies remain in `settlement-spec.md` §11. This evidence contract
adds four claim rules:

1. recirculation is cohort-based and non-duplicative; the same distributed unit is counted at most
   once in the recirculation numerator;
2. raw transaction count, gross transfer volume, or repeated movement is diagnostic activity, not
   proof of healthy circulation;
3. rising circulation does not support a healthy-pool claim when `promiseKeptRate`, unresolved
   exposure, concentration, or safeguard measures breach their approved bounds; and
4. when payout attribution, in-pool counterparty classification, season identity, or the Celo-side
   denominator is incomplete, the metric is unavailable rather than estimated into success.

## 9. Privacy and publication

Collection and access are purpose-limited. The approved tiers are:

| Tier | Permitted content | Access, retention, and publication rule |
|---|---|---|
| Restricted safeguarding | Minimum necessary identifiable material for review and repair | Designated reviewer plus backup only; identities are separated from analysis material; retain through closure, appeal, and sign-off, then delete or anonymize unless a documented legal or safeguarding extension applies |
| Trusted partner/research | Garden/cycle de-identified aggregates, method, limitations, and consented qualitative material | No direct identifiers, raw interviews, case narratives, or linkable participant histories; exact quotations require separate consent |
| Public | Approved aggregate results above both the product-display floor and the stricter research publication threshold | Apply small-cell and complementary suppression plus a cross-time linkability review; never publish participant rows, wallet addresses, reason text, disputes, rankings, or case details |

The `uiux-spec.md` threshold of at least five due commitments and three distinct promisers is a
public product-display floor for `promiseKeptRate`; it is not by itself the research publication
threshold. The accountable privacy owner must also approve:

- minimum cohort sizes for each published cut;
- small-cell and complementary suppression;
- protection against re-identification across time slices;
- access, retention, deletion, and incident-response rules; and
- consent requirements for interviews, surveys, quotations, and partner sharing.

Suppressed and unavailable results remain distinguishable from zero. Public suppression must not
prevent authorized safeguarding reviewers from investigating a credible harm report.

The evidence packet must explain that public-blockchain records cannot be retroactively deleted.
Consent withdrawal and deletion apply to the optional qualitative material and offchain identity
links controlled by this process, not to already-public onchain events.

## 10. First-cycle operating and approval model

### 10.1 Reproducible operational process

The first evidence cycle is an operational process, not a productized analytics feature. It uses:

- existing queries and approved exports;
- a versioned metric registry;
- a versioned calculation workbook or bounded script;
- structured qualitative and repair templates;
- a separate private safeguarding store;
- a repeatable packet checklist; and
- recorded human review and sign-off.

A second authorized reviewer must be able to reproduce the same garden/cycle aggregates from the
declared inputs. Missing Celo cohort attribution or a complete circulation denominator makes the
circulation result unavailable; it does not authorize an estimate, Envio scope expansion, or new
participant tracking.

If repeated cycles justify a Celo circulation read model, that is a separate architecture decision.
Automation becomes eligible only after at least two cycles show stable metrics, reliable sources,
an effective privacy package, and a named long-term owner.

### 10.2 Approval chain and decision rights

1. The **evidence owner** prepares the registry, calculations, limitations, and draft outcome.
2. The **garden context reviewer** validates local facts and interpretation, but cannot suppress
   findings or access confidential material outside their role.
3. The **safeguarding reviewer** and **privacy reviewer** clear or block claims within their
   authority. A local steward cannot review their own complaint. Roles may be combined only with
   documented conflicts and an independent backup.
4. The **accountable publication owner** decides continue/refine/pause/stop for each garden and,
   after safeguard and privacy clearance, approves partner wording. They cannot override a
   safeguarding or privacy block. Public release is a separate approval.

Material disagreements are retained in the decision record rather than edited out of the evidence.

### 10.3 Operational assignments required before dispatch

The evaluation structure is approved. The lane remains blocked only on the concrete assignments
and values below:

| Area | Locked structure | Assignment still required |
|---|---|---|
| Source access | Claim-specific hierarchy in §5.2 | Name access and evidence owners, exact approved source/export, cadence, and proof limit for each claim |
| Garden cohorts | One cohort per garden; comparable class; first complete cycle may be baseline | Record each participating garden, commitment class, history source, dates, exclusions, and comparability notes |
| Measures and thresholds | One primary measure per garden, few secondary measures, two-key gate, stop-condition override | Select the primary measure and set dated minimum meaningful change, warning bounds, denominator, and window for each garden |
| Qualitative collection | Optional start/close pulse plus small cross-role interviews | Name interviewer(s), local language, schedule, consent instrument, response log, and approved storage |
| Safeguarding and repair | Local ordinary repair plus confidential independent escalation | Name reviewer and backup, confidential channel, response clock, escalation path, and sign-off authority |
| Privacy | Three purpose-limited tiers with suppression and linkability review | Name privacy owner; set research publication threshold, exact retention periods, deletion process, and incident response |
| Operational packet | Reproducible no-product first cycle | Name packet owner and second reviewer; record the registry, workbook/script, template, and private-store locations |
| Publication | Separated evidence, context, safeguard/privacy, and publication rights | Name internal decision and partner/public publication owners and record conflict backups |

Assignments must be dated before outcome interpretation. Thresholds must be dated before the
comparison-cycle outcomes are reviewed. Until these records are complete, PRD-735 and the
`settlement_evidence` lane remain blocked and receive no `agent:*` label.

## 11. September evidence packet

One controlled evidence base produces three different outputs:

1. the internal garden decision record, which is primary;
2. a trusted-partner/research annex using only its approved tier; and
3. a separately approved public summary, if the evidence clears the public threshold.

The evidence base contains:

1. approved evaluation questions, cohort, baseline, windows, and thresholds;
2. the completed source-to-field and metric registry;
3. result tables with numerator, denominator, sample size, exclusions, and proof limits;
4. a safeguard, exposure, concentration, and repair summary;
5. circulation results or an explicit unavailable-data statement;
6. qualitative context with consent and sampling limitations;
7. missing-data, source-access, and partner-confirmation status;
8. privacy tier, suppression, retention, and publication review;
9. an allowed/prohibited claims table;
10. garden-specific continue/refine/pause/stop decisions, with their limits; and
11. dated sign-off from the evidence, context, privacy, safeguarding, and publication owners.

The packet must preserve the distinctions between queued, dispatched,
executed/acknowledgment-pending, confirmed, failed, and delayed settlement, and between zero,
suppressed, mixed, and unavailable evidence.

## 12. Acceptance gates

- [x] The eight structural decisions in §1.1 are approved.
- [ ] Every operational assignment in §10.3 has a dated owner and value.
- [ ] Every evaluation question has a complete registry row and accountable owner.
- [ ] Baseline, cohort, thresholds, and stop conditions were approved before outcome
      interpretation.
- [ ] Source access and proof limits are current and verified.
- [ ] Coercion, exposure, concentration, repair, and privacy reviews are complete.
- [ ] Circulation calculations satisfy the non-duplicative cohort rule or are marked unavailable.
- [ ] No public result relies on a product-display threshold as its only privacy review.
- [ ] Allowed wording does not exceed the approved claim class.
- [ ] A second authorized reviewer reproduced the reported garden/cycle aggregates.
- [ ] The September packet is signed and the repo, thin Linear mirror, and canonical Google Doc
      agree after live rereads.

TDD is not applicable because this document changes no runtime behavior. The lightest honest
validation is the plan-hub validator plus link, terminology, JSON, and scoped-diff review.
