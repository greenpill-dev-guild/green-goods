# ARCHIVE — Commitment Pooling Apply Pack (fully applied and reconciled 2026-07-11)

> **Archive status — read nothing here as current.** This pack records what was applied to Linear
> on 2026-07-11, when a fourth garden had been **recorded as selected** (Decision Log `#25`). That
> was reversed: **Decision Log `#29` (2026-07-18) establishes that no fourth garden is or was
> selected** — the slot is open with its criteria retained. Every selection statement below is
> superseded and non-canonical, preserved only as the record of what was written at the time.
>
> **Redaction note (2026-07-19)**: this record originally named the candidate. The name was
> scrubbed under Decision Log `#29` — no artifact names a fourth garden, and this repository is
> public. The applied Linear state is unchanged; only the identity is withheld. It lives in
> research-notes storage.
>
> **Settlement supersession (2026-07-23):** every Functions, receipt-report, `Reported`,
> `Oracle-verified`, and operator-execution statement below is also historical. Decision Log
> `#46` and `settlement-spec.md` replace that transport with message-only CCIP command +
> authenticated acknowledgment. Do not apply the old settlement payloads to Linear.
>
> **Readiness supersession (2026-07-24/25):** registers `#54`–`#60` amend `#53`; `#60` is the current
> correction set.
> AssessmentV3 is only a schema name on the upgraded existing `AssessmentResolver`; current
> settlement uses the dual-chain CCIP/direct-lane, exact-net G$, native Roles allowance, and
> deterministic Safe gates. This archive is not a source for the next Linear sync.

**Prepared**: 2026-07-10 (RESR-57 external-brief wave) · **amended 2026-07-11** (pilot-alignment wave, decision #24)
**Why this exists**: historical audit trail for the writes applied on 2026-07-11. **Do not execute or re-apply any payload below.** Current execution truth is the repo source set plus the live Linear re-read summarized in the reconciliation addendum.
**Historical apply order**: 1 → 6, then the manual step, then the verification checklist. This is retained for provenance only.
**2026-07-11 amendments**: §2's RESR-57 payload was reconciled in place (the pilot-cohort required fact restored — it is already live on Linear and must not be clobbered — and the interim 2026-07-16 target decoupled from session timing per PRD-701's re-dating to 2026-07-30). §§5–6 add the alignment wave: RESR-58 document replacement (worked examples + all-gardens settlement capability), PRD-701 re-dating, RESR-62 and survey-doc UNICEF wording.

## 1. Document `research-memo-commitment-pooling-for-green-goods-3864d8e05c4c`

- **Retitle** to: `Commitment Pooling — External Documentation & Rollout Plan` (current “Research Memo …” title contradicts the content header).
- **Replace full content** with the current `external-communications.md` verbatim, applying one transform — hyperlink the canonical synthesis in the header line:

```
**Canonical synthesis**: [“Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building”](https://linear.app/greenpill-dev-guild/document/commitment-pooling-green-goods-grassroots-economics-learnings-and-the-d3939e890b14). This plan defines derivative materials and rollout; it does not replace or compress the synthesis into a new source of truth.
```

This single replace also lands the two formerly credit-blocked/unmirrored refinements now embedded in the local file: the corrected **Oracle-verified** label (successful Safe/module execution + exact canonical-G$ `Transfer` logs from the registered Safe; outer sender may be a scoped Zodiac executor — never “registered Safe sender”) and the corrected **offline-sync denominator** (all eligible jobs that begin a normal send attempt, with the retry-recovery population as a separate cut), plus the pilot focus cohort, settlement-authority line, documentation-set ownership map, and the three new claims guardrails.

## 2. Issue RESR-57 — replace description with:

```
## Outcome

Publish a concise, audience-specific orientation without creating a second source of truth.

Canonical synthesis: [Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building](https://linear.app/greenpill-dev-guild/document/commitment-pooling-green-goods-grassroots-economics-learnings-and-the-d3939e890b14)

Repo sources: `.plans/active/commitment-pooling/external-communications.md` (rollout plan) and `.plans/active/commitment-pooling/external-brief.md` (brief draft). Settlement and verification claims are owned by `settlement-spec.md`.

## Required facts

* Commitments are module-native on Arbitrum; EAS is not the commitment state machine.
* Offer recipient confirms; Request creator confirms; the provider cannot self-confirm.
* DomainImpact uses repeatable `{ actionUID, requiredCount }` requirements; domain tags are derived from registry-validated actions, may repeat across requirements, and UID `0` is valid.
* G$ stays on Celo. House of Alignment funds stream directly to the GG protocol Safe; Green Goods models only `ProtocolToGarden`.
* A Celo transaction report is not proof. Chainlink Functions verifies one finalized receipt; only a valid current request callback may produce `Verified`. There is no human fallback.
* Community is a planned independent PWA; operator/evaluator tools live in admin `/community`; funder discovery remains in existing client public surfaces.
* Funding shown in Need context supports a garden and is not escrow or steering.
* The pilot anchors on the named focus cohort (2026-07-10; a fourth garden was recorded as selected 2026-07-11 — since reversed, see the archive status above): Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (Muizenberg / Deep South Circles; UNICEF-funded program, partner stays off-platform), AgroforestDAO / Redemption Hill (Bias Fortes, Brazil), and a fourth slot then recorded as filled (the mature MRV-adoption anchor; never named here — Decision Log `#29`, which reopened the slot). Naming never presumes readiness; gardens are never ranked. July rewards are Cookie Jar/treasury only; in August every focus garden is G$-settlement-capable, with Tech and Sun Hub as the first-execution hypothesis and Pass-2 evidence ordering the rollout.
* The `CommitmentRegister` is non-transferable in v1 — no swaps, exchange rates, or tradeable vouchers; transferable settlement vouchers are the evidence-gated follow-on (PRD-651).
* No custody anywhere: the module never holds rewards; August settlement is operator-executed from garden Safes (automation is a stretch goal, else September).
* Borrow-and-repay is an active August-wave companion (`../../../commitment-credit-follow-on/spec.md`): records-only, interest-free, never a per-person credit score, and still undispatchable until its in-code interface freeze, spec revalidation, and human legal/operations review gates clear.
* External evidence claims come only from the canonical synthesis Sources section. Funding provenance is stated precisely: GIP-26 failed its DAO vote; Good Labs Foundation separately funds Green Goods with $800 per month paid in G$, July through September 2026, for $2,400 total. No Flow State mechanism is claimed, and transaction-level token counts do not replace the funding agreement.

## Deliverables and acceptance

Two-page external brief (English first; shareable doc/PDF through the July 31 dry run, docs-site publication later), audience notes for operators/members/evaluators/funders/collaborators, and FAQ/technical appendix. The go-to-community plan lives in the attached rollout-plan document. The evaluator architecture note is owned by PRD-649/the docs lane and the operator onboarding guide by PRD-701 — this issue links them; it does not produce them.

Interim target 2026-07-16: the operator-facing subset (brief + operator note) is content-ready; the co-design sessions themselves are scheduled under PRD-701 (due 2026-07-30). Funder/collaborator material lands by 2026-07-30. Partner factual review (participating gardens, GoodDollar/House of Alignment, methodology collaborators) precedes any external distribution.

Every claim is labeled Built, Planned, Reported, Oracle-verified, or Evidence-gated; dates match July 31, August 31, September 30, and December 31; every derivative links the synthesis.
```

Keep everything else unchanged: state, assignee, cycle, due 2026-07-30, labels (`activity:research`, `protocol:green-goods`, `source:plans`), relations, attached documents.

## 3. Issue PRD-686 — wording-only refinement (the credit-blocked write)

In the description, replace the ambiguous “stored Safe sender” receipt wording with:

```
Oracle verification requires successful Safe/module execution on Celo; the canonical-G$ `Transfer.from` must equal the stored Safe; the expected recipient/amount multiset must match exactly (duplicates counted with multiplicity); the outer Celo `transaction.from` may be the scoped Zodiac executor and is not part of the predicate.
```

No other field changes. Authority: `settlement-spec.md` “Verification contract” paragraph.

## 4. New document — “Commitment Pooling — External Brief (v1 draft, English)”

Create a Linear document with that title, attached to RESR-57, content = `external-brief.md` verbatim.

## 5. Document `commitment-pooling-use-cases-and-domain-scenarios-88ff9704a3bb` — replace full content (2026-07-11 wave)

Carries the B1–B3 worked examples (decision #24 constraints: quantities illustrative, no personal names, rewards "declared at seeding"), all-gardens settlement capability with the TAS first-execution hypothesis, and the UNICEF funded-program upgrade. Title and `:world_map:` icon unchanged.

**2026-07-11 hold (decision #26)**: the Garden-4 name is withheld pending first contact — a later same-day pass anonymized every presentation-facing and operational surface to "a fourth garden — in outreach, named only once participation is confirmed." This applied-result below remains the accurate record of what was applied at 03:06–03:10Z.

**2026-07-11 late amendment (decision #25 — superseded by Decision Log `#29`)**: Garden 4 was recorded as selected during application — apply §§5–6 with every "Garden 4 — TBD" occurrence replaced by **the fourth-garden candidate** (AGRO; the es locale proof rides B4; Part A intro reads "Named candidates (2026-07-10; Garden 4 selected 2026-07-11)"; the criteria paragraph reads as selection rationale with Pass 1 verifying each criterion; the domains sentence counts four candidates; the matrix July column reads "Cookie Jar / treasury only (from onboarding)"; B4 retitles to the candidate name plus "mature-organization MRV adoption" with the es note and Pass-1/2 open questions; S12's pilot thread reads "B4 (the candidate)"). The applied-result section records the final content as written.

```
# Commitment Pooling — Use Cases & Domain Scenarios

**Last aligned**: 2026-07-11
**Canonical synthesis**: [Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building](https://linear.app/greenpill-dev-guild/document/commitment-pooling-green-goods-grassroots-economics-learnings-and-the-d3939e890b14)
**Owning issue**: [RESR-58](https://linear.app/greenpill-dev-guild/issue/RESR-58/commitment-pooling-v1-use-cases-and-scenarios)
**Execution sources**: both active plan hubs, Commitment Pooling diagrams/wireframes, and Community diagrams/wireframes/journeys.

**How to read this document.** Parts A–B are the coherence layer: the named pilot cohort and its garden journeys, written for operators, partners, evaluators, and funders. Part C is the normative mechanism contract that contracts, indexer, shared, applications, and QA implement without inventing behavior. Where a journey names a real garden, behavior is still defined by Part C; a journey never overrides a mechanism.

## Part A — Pilot focus cohort

Named candidates (2026-07-10). Naming a candidate never presumes readiness: [RESR-62](https://linear.app/greenpill-dev-guild/issue/RESR-62/garden-survey-needs-commitments-and-methodologies) records **confirmed / incomplete / unavailable** per garden, and only garden-confirmed mandate artifacts gate August seeding.

| Garden | Focus | Domains exercised | Cohort status |
| -- | -- | -- | -- |
| **Tech and Sun Hub** (Awka, Nigeria) | Solar hub development + educational programs; the live dogfood garden | SOLAR, EDU | Candidate — RESR-62 fielding |
| **Greenpill Cape Town** (Muizenberg / Deep South Circles) | Waste management; UNICEF-funded program with the partner off-platform | WASTE | Candidate — RESR-62 fielding |
| **AgroforestDAO / Redemption Hill** (Bias Fortes, Brazil) | Agroforestry + farm-school education ladder | AGRO, EDU | Candidate — RESR-62 fielding |
| **Garden 4 — TBD** | Mature MRV-adoption anchor | Any | Selection in progress (parallel deep research) |

**Garden 4 selection criteria**: operationally mature with an existing methodology and track record; strong strategic location; existing access to capital or funders; an explicit need to make impact legible (an MRV tool, not a fresh start); a committed steward with capacity inside the pilot window.

The three named candidates together exercise all four action domains (SOLAR, EDU, WASTE, AGRO). Gardens named in the canonical synthesis beyond this set (for example Greenpill Kenya, Instituto Awê Herue) remain narrative context and later-wave candidates, not operational rows.

### Reward-path matrix

Labels follow the external-communications evidence vocabulary (Built / Planned / Reported / Oracle-verified / Evidence-gated). No G$ moves in the July dry run. In August every focus garden is G$-settlement-capable — one Celo Safe per garden, deployed on demand; Tech and Sun Hub is the first-execution hypothesis, and Pass-2 evidence (steward, local relevance, in-pool spend sink) orders the rollout. A reported Celo transaction is never proof; only the authenticated CCIP acknowledgment produces Oracle-verified.

| Garden | July dry run | August reward path |
| -- | -- | -- |
| Tech and Sun Hub | Cookie Jar / treasury only | G$-capable; **first-execution hypothesis** — the hub runs on local mobile money and stablecoins today, with the hub store/membership as the recirculation sink (Pass 2 confirms) |
| Greenpill Cape Town | Cookie Jar / treasury only | G$-capable; rollout order per Pass-2 evidence |
| AgroforestDAO / Redemption Hill | Cookie Jar / treasury only | G$-capable; rollout order per Pass-2 evidence (GoodCollective's Brazil pilots stalled at wallet friction and off-ramp dependency — cautionary input) |
| Garden 4 — TBD | — | G$-capable on selection; order per Pass-2 evidence |

## Part B — Garden journeys

### B1. Tech and Sun Hub — solar and education (S1, S2, S4, S5; forward: S8–S9)

The hub already runs on the mix the synthesis describes: skills traded for skills, some work paid, and costs fronted before income arrives. Members seed mutual-aid support-service Offers — a design workshop, catering for a gathering, node configuration — that close on counterparty confirmation with no token movement (S1), including named-group thresholds when a cohort attends. Workshop and bootcamp cycles run as DomainImpact commitments pairing SOLAR and EDU domains with registered actions (S4), as Campaigns inside one open Season (S5). The hub runs on local mobile money and stablecoins today; it is the **first-execution hypothesis** for August G$ settlement (S8–S9), with the hub's own sink (membership, refreshments) as the recirculation target and Pass-2 evidence confirming steward and sink. Multi-hub stays a vision: today this is a single garden in Awka; a network of solar hubs across Nigerian regions is the roadmap case for garden-to-garden federation, which remains reserved and out of scope.

**Worked example — one workshop cycle at the Awka hub** (quantities illustrative; rewards read "declared at seeding"):

1. **Mutual-aid Offer (S1, no domains).** A member offers one two-hour design workshop (unit: 1 session). The attending cohort is the named confirmation group (for example 3-of-5 attendees; every member of the delivery team is excluded). Evidence: lightweight CID — a photo plus the attendance list. Reward: none — confirmation is the settlement.
2. **Skill swap pair (S1 × 2).** Design work is exchanged against catering for the next gathering, and separately against node configuration (unit: hours). Two support-service commitments, each closed by its recipient's confirmation; no token movement.
3. **Install-day Request (S2).** The hub requests one crew day at the container hub (unit: 1 crew day). The accepted team provides; the hub operator who created the Request confirms; every frozen team member is excluded.
4. **Bootcamp Campaign (S4 + S5).** A SOLAR+EDU DomainImpact commitment carries repeatable registered action/count requirements (UID `0` valid where the generic action applies) inside a Campaign running concurrently with the open Season; SOLAR and EDU are derived tags. Work is attributed to the accepted team through pre-linked workUIDs; full MDR evidence. Reward: Cookie Jar, declared at seeding.
5. **Forward (Planned / Evidence-gated): first G$ execution (S8–S9).** A fulfilled paid-work commitment (for example bootcamp facilitation) derives a G$ reward queue entry; the operator executes from the TAS garden Safe on Celo; Reported → Functions callback → Oracle-verified; member delivery only if the AA gate passes.

**Open questions → Pass 1/2**: workshop cadence and the units the hub actually uses; named confirmation groups per commitment type; which ActionRegistry actions pair with SOLAR/EDU; hub-sink pricing readiness for G$ recirculation.

### B2. Greenpill Cape Town — waste with partner legibility (S2, S5, S7, S10, S11)

The Muizenberg / Deep South Circles waste value-chain work (the "Mountain of Waste" mapping, the **UNICEF-funded** trash-bin and cleanup program) already counts kilograms diverted, recycling rate, and area cleaned. The operator seeds cleanup and bin-maintenance Requests — the creator confirms; delivery-team members never self-confirm (S2). The UNICEF-funded program runs as a Campaign concurrent with the garden's open Season (S5). Beach cleanups include members without devices, so the operator records promises analog with the member as social source (S7). UNICEF holds no account, wears no Hat, and has no confirmation role: the partner deliverable is aggregate progress, evaluator CSV/JSON export, and receipt-checked FundingAttribution for the program funding (S11 composing S10). Pass 1 captures the reporting cadence and deadline UNICEF expects and the funding path that FundingAttribution receipts must check.

**Worked example — one cleanup cycle under the UNICEF campaign** (quantities illustrative):

1. **Weekly cleanup Request (S2).** The operator seeds "one beach cleanup — 20 collection bags" (unit: bags; kilograms diverted where scales exist). The accepted team provides; the operator as Request creator confirms; every frozen team member is excluded.
2. **Bin-maintenance cycle (S5).** Bin checks recur inside the UNICEF Campaign while the Season stays open; an unclaimed week expires and releases committed units exactly once.
3. **Analog promise at a gathering (S7).** A device-free member takes a cleanup slot; the operator records it with the member as social source and operator as `recordedBy` — never when the operator is the provider.
4. **Domain evidence (S4).** Where the commitment claims the WASTE domain, photo-plus-weight evidence carries the MDR path; kilograms diverted, recycling rate, and area cleaned map to the garden's existing metrics.
5. **Partner report pack (S11 → S10).** Program funding lands as receipt-checked, de-duplicated FundingAttribution; the export is aggregate progress plus evaluator CSV/JSON. No ranking, steering, or escrow in any partner view.

**Open questions → Pass 1/2**: UNICEF reporting cadence and deadline; which entity receives program funds (the FundingAttribution receipt path); bag versus kilogram units; the named confirmation group for cleanups beyond the operator.

### B3. AgroforestDAO / Redemption Hill — agroforestry and the farm-school ladder (S1, S2–S3, S4, S6–S7)

The garden ties agroforestry to a biogas→electricity Revnet and a farm-school internship ladder (apprentice → intern → mentor). Planting and nursery Requests run approval-gated where crew slots are scarce: stored claim terms, one decline clearing one request, deterministic acceptance and supersession (S3). Commitments carry registered AGRO and EDU action/count requirements (S4), so one planting-education cycle can claim both honestly without coupling requirements to unique domains. Rural connectivity makes offline the default: drafts, `waiting_for_hat`, retry/edit/cancel/delete, and analog capture ride S6–S7, and this journey carries the pt-BR locale proof for every new string. The education ladder is the named-group confirmation case: cohort members confirm a training delivery with every member of the delivery team excluded. The Revnet itself stays outside v1 scope — the module never custodies funds and no Revnet integration ships.

**Worked example — one planting-education cycle** (quantities illustrative):

1. **Approval-gated planting Request (S3).** "Plant 200 seedlings across two weekend crews" (unit: seedlings). Crew slots are scarce, so claims are steward-reviewed: claimants A and B store kind, provider garden, and timestamp; declining A clears only A; accepting B supersedes the other pending requests through the commitment-keyed index.
2. **Multi-domain cycle (S4).** The planting Campaign carries registered planting and training requirements; AGRO and EDU are derived domain tags, so the same cycle counts the planting and the apprentices trained without double machinery.
3. **Grafting workshop Offer (S1).** A mentor offers one grafting workshop; the learner cohort is the named confirmation group (every frozen delivery-team member is excluded; acceptance fails if exclusion makes the threshold unreachable).
4. **Offline-first field capture (S6–S7).** Drafts and evidence save offline and sync later; a new member's job waits in `waiting_for_hat` without consuming retries; the operator captures analog promises at gatherings. Every new string ships en/es/pt, with this journey as the pt-BR proof.
5. **Ladder Initiative (S10).** "Apprentice cohort #2" is seeded as an Initiative Need; the commitments it seeds carry `needUID`, so the ladder's progress is traceable end-to-end.

**Open questions → Pass 1/2**: seedling/nursery units the garden actually counts; who confirms planting work (creator versus named group); apprentice-cohort size and confirmation threshold; G$ relevance given GoodCollective's Brazil wallet-friction precedent.

### B4. Garden 4 — mature-organization MRV adoption (S12 composing S10)

Reserved for the deep-research selection. Journey skeleton: an operationally mature organization arrives with an existing methodology and existing funders. An operator- or evaluator-authored assessment v3 baseline records current state; historical records stay in evidence CIDs and documents, never as retroactive on-chain work. Its existing program becomes commitments with repeatable registry-matched action/count requirements where DomainImpact is claimed; UID `0` remains valid and domain tags are derived. The standard loop (work → approval → delta by Evaluator Hat → testimony by Community Hat → Hypercert `needUID` lineage → evaluator exports → receipt-checked FundingAttribution) makes the impact legible to the capital they already reach. No mechanism is new in this journey — that is the point: adoption must not require special machinery.

## Part C — Normative mechanism scenarios

### Scenario 1 — Open Offer

A gardener offers six hours of work. The claimant becomes the recipient/counterparty. Acceptance commits units; matching Work is linked and approved; the recipient confirms. The provider cannot confirm. Fulfillment converts committed units.
*Pilot threads*: B1 mutual-aid support services (design workshop, catering, node configuration); B3 training delivery confirmed by the learner group.

### Scenario 2 — Open Request

A member requests a service. The accepted claimant is the provider; the Request creator is the confirmer. Named groups exclude the provider, and acceptance fails if exclusion makes the threshold unreachable.
*Pilot threads*: B1 install-day request; B2 cleanup and bin-maintenance requests; B3 planting and nursery requests.

### Scenario 3 — Approval-gated competing claims

Claimants A and B each submit claimant kind, provider garden, and timestamp. Declining A clears only A. Accepting B consumes B's stored terms; the indexer loads the commitment-keyed request index, marks B Accepted, and marks other pending requests Superseded. No database-wide scan occurs.
*Pilot threads*: B3 scarce planting-crew slots; protocol-pool proto-commitments claimed by more than one garden.

### Scenario 4 — DomainImpact provider garden

Each DomainImpact requirement has a registry-valid action UID and non-zero required count; UID `0` is valid, and domain tags are derived rather than positional. Work keeps the credited contributor while Garden Work remains scoped to a gardener/operator of the stored provider garden. Protocol-pool Work and assessments use the provider garden as EAS recipient while the commitment stays in the root pool.
*Pilot threads*: B1 SOLAR+EDU workshop cycles; B3 AGRO+EDU planting-education cycles.

### Scenario 5 — Cycle and dispute recovery

One Season is open; two Campaigns overlap. A commitment disputes from ReadyForConfirmation and stores that prior state. `RestorePrevious` returns there without unit movement. Expiry releases committed units once; an expired commitment never becomes Fulfilled.
*Pilot threads*: B1 Season + workshop Campaigns; B2 Season + the UNICEF program Campaign.

### Scenario 6 — Offline and membership wait

A member saves a Need, signal, testimony, commitment, claim, evidence, Work link, or confirmation offline. Community jobs may enter `waiting_for_hat` without consuming retries. The UI offers Edit/Retry/Cancel/Delete, retains media, resumes after membership, and never fabricates a successful write.
*Pilot threads*: B3 rural offline paths carrying the pt-BR locale proof.

### Scenario 7 — Analog capture

An operator records a member's promise with the member as social source and operator as `recordedBy`. The operator can use a reasoned fallback only when eligible and never when they are the provider.
*Pilot threads*: B2 device-free cleanup members; B3 field capture.

### Scenario 8 — Immutable batch and oracle verification

A 24-member batch persists immutable IDs. The executor reports one Celo transaction hash; state is Reported. A separate Chainlink Functions request stores its request ID; "checking receipt" is derived. A valid current callback verifies exact finalized chain/success/Safe/G$/recipient/amount/log coverage. Receipt-invalid marks the attempt Failed. Infrastructure failure stays Reported for a new request. A stale callback is ignored. Failed batch members are individually requeued or canceled, and requeue clears the prior batch ID.
*Pilot threads*: none in July (no G$ in the dry run); in August settlement rolls out across the focus gardens as Pass-2 evidence confirms each — first execution at Tech and Sun Hub (B1).

### Scenario 9 — Funding routes and AA gate

House of Alignment funds the protocol Safe upstream. Green Goods derives ProtocolToGarden. If the Celo AA/paymaster round trip fails, this Safe-to-Safe route may continue while automated member delivery and member sends stay disabled.
*Pilot threads*: same rollout as S8; the funding route exercises per garden as its Safe deploys.

### Scenario 10 — Community Need through evaluation and funding

A Request, Offer, or Initiative is triaged with separate moderation/progress axes and optional domains, then seeds a commitment with `needUID`. Joined reads connect EAS Need records to Envio commitment/work/assessment events. FundingAttribution is receipt-validated and de-duplicated. Hypercert lineage uses `needUID`. Evaluators export CSV/JSON. Funder views show pending/failed/retry without rankings, steering, or escrow.
*Pilot threads*: B2 partner-program Needs; B3 ladder Initiative; B4 funder legibility.

### Scenario 11 — Institutional partner and program legibility (added 2026-07-10)

An operator seeds an Initiative or Request linked to a named partner program. The partner holds no account, wears no Hat, and has no confirmation role; direction-aware confirmation and provider exclusion proceed unchanged among community members. The partner-facing exit is aggregate progress, evaluator CSV/JSON export, and receipt-checked, de-duplicated FundingAttribution where partner funds flowed. No ranking, steering, or escrow appears in any partner view. If the partnership form changes — for example an on-platform partner role — that is a new scope decision, not a fallback path.
*Pilot threads*: B2 (UNICEF — funded program).

### Scenario 12 — Mature-organization MRV adoption (added 2026-07-10)

A mature organization with an existing methodology joins without changing how it works. An assessment v3 baseline authored by an evaluator or operator records current state; historical records stay in evidence CIDs and documents, never retroactive on-chain work. Its program maps to commitments with repeatable registry-matched action/count requirements where DomainImpact is claimed; UID `0` remains valid and domain tags are derived. The standard loop — work, approval, delta by Evaluator Hat, testimony by Community Hat, Hypercert `needUID` lineage, evaluator exports, receipt-checked FundingAttribution — produces funder-legible lineage. This scenario introduces no new mechanism; it is the composition proof that adoption requires none.
*Pilot threads*: B4 (Garden 4 — TBD).

## Acceptance mapping

For every scenario record: role entry, successful exit, loading/empty/offline/pending/waiting/declined/superseded/failed/retry/reported/verified states; exact contract events; Envio entity/lookup; owning frame/diagram; en/es/pt copy; accessible names/focus/touch/reduced-motion/screen-reader behavior; and the named Bun test from the relevant handoff. Additionally: every garden journey (B1–B4) maps to at least one normative scenario chain and one row in the July proto-commitment tracking doc; every scenario names its pilot threads or an explicit none-in-pilot rationale (S8–S9: none in July; August rollout across the focus gardens per Pass-2 evidence, first execution at Tech and Sun Hub); and the Part A cohort statuses mirror RESR-62 evidence, never inferring readiness.
```

## 6. Issue and document deltas (2026-07-11 wave)

**PRD-701** — set `dueDate` to `2026-07-30` (was 2026-07-16), and in the description replace the heading `## July 16 exit` with `## Kickoff exit (due 2026-07-30)`. All other content, including the Focus cohort section, stays.

**RESR-62** — in the Focus cohort paragraph, replace `Greenpill Cape Town (Muizenberg / Deep South Circles — carries the UNICEF trash-bin/waste-cleanup showcase folded in from canceled RESR-53)` with `Greenpill Cape Town (Muizenberg / Deep South Circles — UNICEF-funded trash-bin/waste-cleanup program; showcase folded in from canceled RESR-53)`.

**Garden Mandate Survey document** (`garden-mandate-survey-unified-two-pass-onboarding-instrument-needs-c9271149e328`) — same one-line replacement as RESR-62 in its "Cohort and readiness" paragraph.

**RESR-58 issue description** — two small edits to match §5: in the Pilot focus cohort paragraph, replace `waste, with UNICEF as an off-platform program partner` with `waste; UNICEF-funded program with the partner off-platform`, and replace the final sentence `July rewards are Cookie Jar/treasury only; G$ attaches only where Pass 2 confirms, one garden first.` with `July rewards are Cookie Jar/treasury only; in August every focus garden is G$-settlement-capable, with Tech and Sun Hub as the first-execution hypothesis and Pass-2 evidence ordering the rollout.` Also update the Required-scenarios bullet `Per-garden reward-path matrix with evidence labels; no G$ in the July dry run; S8–S9 attach only to the single Pass-2-confirmed settlement garden.` to end `…no G$ in the July dry run; S8–S9 roll out across the focus gardens per Pass-2 evidence, first execution at Tech and Sun Hub.`

## Historical manual step (resolved)

At apply time, the then-connected `save_issue` schema could not express a null due date, so PRD-651 and PRD-697 temporarily retained 2026-07-29. Both dates were later cleared in the Linear UI and live-re-read as `null` on 2026-07-11; no action remains.

## Post-apply verification

- Re-read the retitled rollout-plan document: Oracle-verified label contains “successful Safe/module execution” and “scoped Zodiac executor”; offline-sync row divides by “all eligible jobs that begin a normal send attempt”; the synthesis title is a working hyperlink.
- Re-read RESR-57: twelve required facts (including the pilot-cohort fact with all-gardens settlement capability), the content-ready interim wording pointing sessions at PRD-701 (due 2026-07-30), ownership reroutes to PRD-649/docs lane and PRD-701, both repo sources named, synthesis link intact.
- Re-read PRD-686: no “stored Safe sender” phrasing remains.
- Confirm the new brief document is attached to RESR-57 and matches `external-brief.md`.
- Confirm PRD-651/697 show no due date.
- Re-read the RESR-58 scenario document: "Last aligned 2026-07-11"; Part B carries the three worked examples; the reward-path matrix says every focus garden is G$-capable with Tech and Sun Hub as the first-execution hypothesis; no "single Pass-2-confirmed garden" or "sink-first pacing" phrasing remains anywhere in it.
- Re-read PRD-701: due date 2026-07-30, heading reads "Kickoff exit (due 2026-07-30)", Focus cohort section intact.
- Re-read RESR-62, the Garden Mandate Survey document, and the RESR-58 issue: Cape Town reads "UNICEF-funded … program" and the RESR-58 issue's settlement wording matches §6.
- Confirm RESR-58 relations still include RESR-62, PRD-701, RESR-57, PRD-650.

## Applied result (2026-07-11)

Applied in order §1→§6 with the Garden-4 substitutions from the late amendment (a fourth garden recorded as selected mid-application: the candidate — agroforestry, the mature MRV-adoption anchor; superseded by Decision Log `#29`), after a pre-write drift check (the five most-recently-updated project issues and both project documents showed only this pipeline's own 2026-07-11T01:49–01:52Z writes; no manual edits to reconcile):

- **§1** — memo document retitled to "Commitment Pooling — External Documentation & Rollout Plan" and re-mirrored from `external-communications.md` (which by application time also carried the UNICEF-funded wording, the Garden 4 cohort line, and the new anti-single-garden claims guardrail), with the synthesis hyperlink transform. Applied 03:06Z.
- **§2** — RESR-57 description replaced with the reconciled payload: twelve required facts including the full four-garden cohort with all-gardens settlement capability, decoupled 07-16 interim target pointing sessions at PRD-701 (due 2026-07-30). Applied 03:06Z.
- **§3** — PRD-686 receipt predicate corrected: successful Safe/module execution, `Transfer.from` = stored Safe, exact recipient/amount multiset, outer `transaction.from` may be the scoped Zodiac executor; "stored Safe sender" removed. Applied 03:06Z.
- **§4** — new document "Commitment Pooling — External Brief (v1 draft, English)" created and attached to RESR-57, mirroring `external-brief.md` **after** its three stale single-garden spots (lines 29/45/52) were corrected and Garden 4 added to its cohort. Applied 03:06Z.
- **§5** — RESR-58 scenario document replaced: Last aligned 2026-07-11, four-garden Part A with reward-path matrix, B1–B3 worked examples, B4 Garden 4 journey (es locale proof), S1–S12 with updated pilot threads. Applied 03:08Z.
- **§6** — RESR-58 issue (cohort + bullets), PRD-701 (dueDate 2026-07-30 + "Kickoff exit (due 2026-07-30)" + session-scheduling note), RESR-62 (UNICEF-funded + Garden 4 + Pass-1 supplements), Garden Mandate Survey document (same + schedule row re-point), and the July tracking doc (Garden 4 rows 4/8, all rows Open). Applied 03:08–03:10Z.

Every write's returned payload was inspected as the live re-read; no write was rejected and no credit limit was hit. **Historical state at 03:16Z**: the stale 2026-07-29 due dates on PRD-651 and PRD-697 still required a manual UI clear. The reconciliation addendum below records their later verified `null` state.

**Convergence addendum (03:08–03:16Z)**: a second session applied the same pack concurrently — its §§1–3 landed 03:08Z and §§5–6 at 03:11–03:12Z, layered over the 03:06–03:10Z application above with identical pack payloads plus the `external-communications.md` documentation-set item-3 Garden 4 fix (03:07Z), which the live memo mirror therefore carries. Two first-application refinements were briefly overwritten and re-applied at 03:15–03:16Z: RESR-62's Pass-1 Garden 4 criterion-verification supplement, and the survey document's kickoff schedule row re-point to the PRD-701 2026-07-30 kickoff exit plus its Last-aligned bump to 2026-07-11. As of 03:16Z the memo, brief document, RESR-57, PRD-686, RESR-58 issue/document, PRD-701, RESR-62, and the survey document all carry the union state; treat that as final and do not re-apply earlier payloads over it.

## Reconciliation addendum (2026-07-11 ~20:45Z, post-apply deep-review pass)

A pre-build technical review verified the applied state live and closed the trailing items; nothing from this pack remains outstanding.

- **Due dates**: the manual clears on PRD-651/697 were completed in the Linear UI earlier today (both `dueDate` fields re-read as null), and the now-obsolete "administrative residue … clear it manually" sentences were removed from both issue bodies (writes 20:43–20:44Z, payloads re-read clean).
- **Companion documents**: the five pre-spec-session docs — Pool Identity + Capability Architecture, Lifecycle And Aggregator Semantics, UX Brief — Cross-Surface Flows, Proof Capability, and Settlement Capability — Vouchers — were rewritten in place as current-state concise mirrors (user-approved): "updated after the 2026-07-03 spec session" banners and superseded stances removed, answered open questions dropped, each stamped **Last aligned: 2026-07-11** and linked to the canonical synthesis, `.plans/` specs, and the RESR-58 scenario document (writes 20:44–20:46Z, each live-re-read in full).
- **Repo side**: `plan.todo.md:9` and the matching `status.json` note now record the applied state; `RESR-53` was removed from `july_dry_run.linear_issues`; the stale "TBD mature MRV" cohort note carries the decision #25/#26 anonymized wording.

## Exchange-wave apply pack — 2026-08-01

This section is an applied historical pack, not a pending instruction. The authenticated
2026-08-01 pass and its re-read are recorded under “Applied result” below. Do not re-apply it.
If a future correction is needed, re-read the live issue first, preserve newer human edits, and
author a new dated addendum rather than replaying these payloads.

> **Archival payload boundary:** every subsection and imperative phrase below, including “Add,”
> “Handle,” “Point,” and “Apply,” quotes the already-applied 2026-08-01 payload. None is executable
> or pending. Only a new dated addendum written after a live Linear re-read may authorize another
> change.

### PRD-649 — Bilateral exchange amendment re-closes the architecture freeze

The Commitment Pooling architecture freeze was reopened for exactly one additive function and is
re-closed by the second 2026-08-01 amendment. August contract scope now includes
`acceptExchange(uint256 exchangeCommitmentId)`, the `ExchangeAccepted` marker, and the named
exchange errors. The path atomically accepts two counter-referenced Individual Offers, emits both
ordinary `CommitmentAccepted` events, commits both exact-label registry classes, and consumes one
provider slot per lead. Any per-side failure reverts the whole transaction. After acceptance the
two promises remain completely independent.

Living contract names are `CommitmentRegistry`, `ICommitmentRegistry`, and `TestimonyResolver`;
historical decision text keeps the names originally recorded. Full source:
[contract specification](../../contract-spec.md), Decision Log #41 and register #75 in the
[execution plan](../../plan.todo.md).

This comment authorizes no implementation or broadcast. August 12 remains a stretch date and all
existing evidence and human-authorization gates remain binding.

Applied-history touch-up to perform in the same pass: the previously applied narrative line “The
`CommitmentRegister` is non-transferable in v1” (earlier applied section of this file) should read
`CommitmentRegistry` in the live Linear document/description the next time that body is written.
Apply the one-word update in Linear only; the applied section text in this file stays as recorded.

### PRD-650 — Exchange, Offer templates, and plain language join the app lane

The August app roadmap gains three scope-locked additions with no new Solidity: exchange-pair UX
on the shipped commitment primitives, a practice-first template library, and the noun-reduction
plain-language pass. Claims choose one accountable lead; contributors join afterward through the
accepted commitment's roster policy. The client copy uses “in exchange for,” calm dates, and the
locked mutual-aid vocabulary, with no market framing.

Canonical sources: [UI/UX Appendix E](../../uiux-spec.md), [wireframes W28–W31](../../wireframes.md),
and planned journeys SB-35/SB-36 in the [prototype source](../../prototypes.md). Decision Log #43
and register #77 mirror the scope. The entry authorizes no implementation dispatch by itself.

### PRD-651 — Canonical exchange-architecture brief exists, implementation stays gated

PRD-651 now has a canonical design-only brief at
[exchange-architecture-brief.md](../../exchange-architecture-brief.md). It specifies the later
transferable-voucher wrap, quoter, limiter, venue/vault, the Sarafu-pool hybrid fork, custody and
legal gates, pilot-evidence gates, and questions for the scheduled 2026-08-19 Grassroots
Economics conversation.

The brief activates nothing. `settlementAdapter`, `settlementEnabled`, custody, multilateral
execution, and any new settlement lane still require a future scope lock plus pilot, clean-room,
audit, legal, partner, and human-authorization evidence. Decision Log #42 and register #76 record
that posture.

### PRD-721 — Contracts lane mirror

Add `acceptExchange` to the existing contracts lane using the exact semantics and named errors in
[contract-spec.md](../../contract-spec.md). The work remains on the lane's named integration path,
with two ordinary acceptance events plus `ExchangeAccepted`, no new storage, and no lifecycle
coupling after acceptance. Naming targets are `CommitmentRegistry` in `registries/Commitment.sol`
and `TestimonyResolver` in `resolvers/Testimony.sol`. This comment does not dispatch the lane.

### PRD-722 and PRD-723 — Indexer and state/API lane mirror

Handle `ExchangeAccepted` as one `CommitmentExchange` marker entity keyed
`chainId-EXCHANGE-poolId-idA-idB`, while the two ordinary acceptance events remain the sole
per-commitment lifecycle/accounting inputs. Shared state adds pair creation, proposed/matched/
counterpart-lapsed derivation, pair feed, and the online `acceptExchange` mutation. Module-events-
only derivation, exact-label count safety, composite IDs, and independent post-acceptance
lifecycles remain unchanged. These comments mirror register #75 and authorize no dispatch.

### PRD-724, PRD-725, and PRD-727 — App and documentation lane mirror

Point the client/admin/docs lanes at [UI/UX Appendix E](../../uiux-spec.md), W28–W31, and planned
SB-35/SB-36. Client owns the template-first entry, exchange picker, pair detail/feed, and A-creator
confirmation. Admin preserves pair visibility and the lead-vs-roster distinction. Post-QA docs
reconcile the new brief, contract names, pair/plain-language behavior, and the one human GDoc pass
in [exchange-wave-gdoc-checklist.md](../exchange-wave-gdoc-checklist.md). These comments mirror
registers #76–#77 and authorize no dispatch, artifact publication, or external document write.

### Applied result — 2026-08-01 (authenticated Linear pass)

Applied and re-read the same day: comments on PRD-649/650/651 and lane mirrors on
PRD-721/722/723/724/725/727; surgical description patches where wave-1 text contradicted the
exchange wave (PRD-650 scope-lock bullets incl. `acceptExchange` + `CreditRegistry`; PRD-721
second-amendment sentence; PRD-722 twelve→thirteen core entities + `CommitmentExchange`;
PRD-724/725 bilateral-vs-multilateral nuance; PRD-727 37 screens + artifacts-republished note;
PRD-651 rename + brief pointer). Companion doc "Settlement Capability — Vouchers On Shared Pool
Identity" re-aligned (renames, brief pointer, and the stale "Chainlink Functions receipt
verification" transport corrected to message-only CCIP + authenticated acknowledgment). Project
description corrected the same way (Oracle-verified/Functions → authenticated CCIP acknowledgment;
D1–D13 → D1–D19). Touch-up finding: the applied sentence "The CommitmentRegister is
non-transferable in v1" no longer exists in any live Linear body (superseded by the 2026-07-11
companion-doc rewrites); its successor line in PRD-651 now reads `CommitmentRegistry`.
