# Green Goods OS: revised research-to-pitch commission

**Updated after narrative alignment, 8 October 2026 Pacific. The user accepted the four pillars and overall sequence. Final copy, visual concepts, first cohort, commercial inputs and ask remain to be refined. No implementation is authorized.**

## Objective and authority

Act as a technical research lead, product architect and independent strategy reviewer for Green Goods. Produce, in order: (1) deep technical, market and licensing research, (2) a PRD, (3) a strategy/theory-of-change brief, and (4) an actual editable pitch deck. Complete and record an evidence/quality review before carrying conclusions into the next stage. The overall slide flow is now aligned; use [the current narrative](../pitch-revision.md) as authority. Return material changes to that story for review. The next production checkpoint is image briefs and representative cover, problem and solution compositions before full-deck expansion.

Green Goods is the product, protocol and ecosystem. Green Goods OS is a proposed accessible community workspace connecting practical knowledge, relationships, accountable work and support. Coop is a separate reference project, not the product identity or an adopted dependency. Use authoritative repository facts and primary sources; prior generated planning documents are hypotheses to audit, not independent evidence.

Read repository AGENTS.md and relevant skills. Start in `/Users/afo/Code/greenpill/green-goods`. Existing work is in `.plans/ideas/green-goods-os/`; inspect its status/document map, then targeted files. Preserve unrelated changes and stay on the current branch. Record branch/commit baselines and source dates. No requirement or recommendation below changes canonical product policy until accepted by the human.

## Accepted direction and writing constraints

Green Goods is the central identity across the pitch, not only the OS. Use the user's proposition: “Green Goods helps communities caring for land and each other access useful tools at a low cost, learn from one another and coordinate support while retaining sovereignty over their knowledge.” A suggested refinement is “affordable tools and infrastructure”; it remains proposed wording. The global vision supports communities regardless of economic circumstances. Use land stewards as the umbrella; retain farmers in two of the four concrete settings. Use no em dashes in new or revised copy.

Pitch audiences include Ma Earth, Hypercerts, 5th World and BioFi. The current research interprets BioFi as The BioFi Project at biofi.earth. Verify the intended organization before tailoring any future outreach. Research their existing workflows and distinguish fit from demonstrated interest; no outreach is authorized.

## Narrative to investigate

Communities working toward healthier land have unequal access to useful tools, infrastructure, expertise, time and support. Different tools are not inherently a problem: the problem is where incompatible records, inaccessible services, missing context or weak sharing controls make work harder and keep practical experience in silos. Treat the frequency and severity of these problems as research questions, not established customer findings.

Explore four settings without building four products: a mid-sized farmer transitioning practices; a small regenerative farmer; a community managing land in the Global South; and a well-resourced environmental steward. Preserve local differences. Each can contribute expertise and receive useful knowledge; do not portray wealth as expertise or a resource-constrained community as only a beneficiary. Energy, waste and agriculture are possible domains, not an instruction to launch three hardware lines.

The proposed causal chain is accessible participation → useful local knowledge → voluntary reciprocal exchange → stronger relationships and better-contextualized decisions → accountable commitments and potential support. Intellectual, social, cultural and experiential value matter alongside financial value. Do not force them into tokens, a common score or financial equivalence. Community usefulness precedes reporting; credible supporter visibility is a downstream benefit.

Investigate browser participation and an optional extension on existing devices; optional source-grounded local AI; bounded sensor/import support; private community storage; deliberately shared AT records; and supported Green Goods protocol interactions. Lower total cost, reduced effort, better decisions and stronger relationships are hypotheses to test. Sovereignty means effective permissions, governance, portability, recovery and exit, not an unsupported promise of no servers or no risk of loss.

## Agreed principles and remaining decisions

The user accepted **Accessibility, Sovereignty, Trust and Reciprocity** as Green Goods' four pillars. Do not reopen that decision without material evidence or user direction. Privacy, Interoperability and Verifiability are essential across all four. Affordability, defined rights and appropriate transparency make the principles concrete. Explain overlaps and tensions without requiring disclosure. These are strategic commitments, not claims that all current capabilities satisfy them.

Do not silently fix the buyer as a U.S. conservation district or the workflow as moisture monitoring. Those were previous agent proposals. Recommend a first user, economic buyer, geography and workflow using relationships, demand, delivery capacity and evidence. Keep broader personas visible while narrowing the first delivery package.

## Evidence and numerical discipline

Maintain a claim register separating established implementation, observed field evidence, third-party/vendor claims, inference, proposed target, scenario and unresolved question. Distinguish shipped, tested, mocked, planned, deployed-but-unavailable and canceled work. Do not convert source-inspected tests into executed proof.

For every quantitative pitch claim record source, publication/access date, population, geography, unit, calculation, each assumed input, uncertainty, review status and permitted wording. Arithmetic review is not demand validation. Do not reuse the preceding deck's subscription prices, qualification percentage, TAM/SAM/SOM, ARR, margins, acquisition funnel or funding ask as accepted facts. Keep them out of the core pitch unless independently justified and explicitly reviewed. Preserve old files as history rather than overwriting their evidence status.

Market size must follow an agreed buyer/segment and an auditable denominator, with deduplication and attainable delivery capacity. Nature-finance totals and global farm counts are context, not software revenue. If the evidence cannot support a useful number, state the gap and the research required; do not manufacture precision to fill a conventional pitch slide. Cost any proposed ask from an agreed workplan, named roles, quotes or explicitly reviewed assumptions.

## Stage 1: research

Inspect Green Goods first: architecture, privacy constraints, current licenses, contracts, ABIs, schemas, wallet/passkey identity, offline work, reporting/evidence, indexers, attestations, funding, endowments and commitment pooling. Cite exact paths and symbols. Consult related Linear material, including Community Evidence Mesh and RESR-79, read-only. Inspect Coop separately for useful patterns, dependencies, rights and gaps.

Evaluate the five technical foundations:

1. **Browser/extension:** runtime, permission scope, storage, offline reconciliation, worker suspension, updates, accessibility, compatibility and recovery. Separate what members install, operators run and external infrastructure supplies.
2. **Local AI:** exact model/runtime/version and rights, download size versus total memory, latency, energy, language quality and review burden. Treat 4–8 GB devices as benchmark targets, not proven compatibility; no special development workstation is a member requirement. Provide complete non-AI participation and no silent cloud fallback. Define source-fidelity, abstention and review-effort tests without invented measurements.
3. **Green Goods:** trace actual callable functions and identity mapping, fees, confirmations, retries and duplicate prevention. Map reviewed observations to supported exports/commitments/attestations/publication. Model output never authorizes a transaction.
4. **IoT/environmental evidence:** supported peripherals and browser restrictions; imports; optional MQTT/HTTP gateways; bounded satellite context. Cover calibration, units, timestamps, device identity, provenance, missing data, tampering and maintenance. Measurements, interpretations and independently verified outcomes are different evidence classes. Label real peripherals, recorded inputs and synthetic fixtures.
5. **AT/mesh:** current privacy properties, PDS alternatives, synchronization, signed authoritative repositories, identity/signing/recovery, concurrent writes and availability. Distinguish browser-capable work, persistent publicly reachable services and optional native applications. Assess Automerge, Yjs, libp2p and atcute as options. Explain signaling, NAT/relays, browser lifecycle, publisher coordination and key custody. Private collaborative state, peer transport and public signed AT repositories are distinct. Disconnected writers do not automatically create one consistent repository; do not share one signing key among everyone. Application peer networks are not radio mesh. Public copies cannot reliably be recalled.

Produce architecture options and a threat model covering encrypted storage/transport, backup, shared devices, key recovery, malicious peers, prompt injection, untrusted sensor/import payloads and accidental disclosure. A publication preview reveals exactly what leaves the private workspace. Use only synthetic or authorized non-sensitive material; no real gardener evidence sent to external inference providers and no provider trial outside RESR-79 constraints.

Compare farmOS, OpenTEAM, Hylo, ODK/Kobo and GainForest/Taina through current primary sources. Verify Ma Earth, Hypercerts, 5th World and The BioFi Project's actual workflows and tools. Identify overlap, integration/contribution options and unknowns; do not claim novelty or savings from a feature checklist. Total costs include devices, distribution, connectivity, setup, calibration, maintenance, curation, translation, support, review and recovery.

Recheck the Green Goods MIT baseline and dependency exceptions. Investigate the relevant Regen Commons cooperative starting with:
- https://regencommons.discourse.group/t/model-for-decentralized-brand-stewardship-draft/23
- https://regencommons.discourse.group/t/request-for-proposals-facilitating-the-summoning-of-regen-commons/47
- https://forum.regen.network/t/agentic-organization-design-and-collaboration/610

Establish authority, versions, adoption status and accessible operative documents. Missing agreements remain missing; these discussions are not an adopted software license. Do not import terms from unrelated similarly named projects. Separate software/dependencies; data/observations; community knowledge/content; schemas/model weights/hardware; membership/contribution agreements; and trademarks/certification/hosted services. Compare MIT plus governed services, suitable copyleft and source-available/commercial options. Distinguish OSI-compatible openness from commercial/user restrictions. Audit contributor authority, agreements, compatibility and grant obligations to the extent accessible; identify qualified legal-review gates. Prior MIT permissions do not disappear on future relicensing. Membership grants neither data ownership nor training consent. Evaluate noncash contributions, entry/exit, appeals, portability and onward sharing; fees must buy a defined benefit.

Stage 1 outputs: evidence register; assumption/number audit; architecture options; threat model; licensing memo; cost assumptions; decision gates; source-backed assessment of customer problem and alternatives. Review contradictions before PRD drafting.

## Stage 2: PRD

Choose one land-management question and one supported sensor or clearly labeled recording after the focus decision. Define a narrow two-week prototype and a later, separately gated pilot. Preserve the original scope's test flow: local observations → source-linked local interpretation → human correction → deliberate sharing → supported Green Goods test/export and minimal approved AT record → useful retrieval/feedback in a second workspace.

Specify user and buyer separately, jobs, measurable pillar requirements, scope/exclusions, architecture, integration contracts, permissions, community authority, consent, recovery/exit, costs, failures, offline reconciliation and private-to-public canary tests. State what is real, simulated or deferred and what requires separate infrastructure authorization. Separate prototype, pilot and production readiness. Treat OS as a product metaphor to evaluate, not a claim to replace the device OS or every existing tool. Review feasibility and user usefulness before strategy conclusions.

## Stage 3: strategy and theory of change

For every causal step identify assumptions, failure mechanisms, attribution limits and measurable tests. Examine who does collection, curation, translation, maintenance and review; who pays; whose knowledge is recognized; how refusal and correction work; and what contributors receive. Test reciprocal value across similar and different contexts without stripping local meaning.

Explain where commitment pooling and endowments genuinely help, their actual lifecycle and availability, and their limits. Distinguish community delivery funding from Green Goods operating revenue and value recognition from tradable financial claims. No principal or yield guarantees.

Evaluate separately: compatible infrastructure/sensor packages; knowledge membership; professional services/education; recurring support/maintenance; protocol fees; and commercial licensing. For each specify payer, budget owner, benefit, demand evidence, acquisition, delivery/support cost, margin uncertainty, maintenance and validation experiment. Test membership for curation, expertise, translation, facilitation and introductions, never control over contributors' own records. Recommend a sequence based on paid usefulness and sustainable delivery; do not assume hardware sales or protocol volume will subsidize a commons.

Only present downside/base/upside scenarios whose assumptions the human has reviewed; keep hypothetical calculations visibly distinct from forecasts. Research current design-partner and funding opportunities with primary-source eligibility/deadlines. Do not infer interest, contact anyone, submit anything or count pending grants as runway. Review causal logic, business viability and numerical status before pitch work.

## Narrative review before Stage 4

Deliver a text storyboard for human review, with one clear claim, supporting evidence/status, audience takeaway, visual purpose and transition for each slide. The overall sequence is accepted; refine copy and evidence within it:

1. Vision: tools, infrastructure, knowledge and support within reach of communities worldwide regardless of economic circumstances.
2. Problem: unequal access makes regeneration harder; identify mechanisms and consequences.
3. Four settings, different constraints and valuable contributions.
4. Opportunity: connect useful local experience while preserving context and choice.
5. Green Goods as a whole: tools/infrastructure, shared learning and coordinated support; the proposed OS makes these accessible through a workspace.
6. One concrete learning/sharing workflow.
7. Value to stewards first, supporters downstream.
8. Pillars and how they become observable product requirements.
9. Reciprocal network value within and across bioregions.
10. Accountable commitments and multiple forms of capital; honest protocol boundaries.
11. Initial user/buyer and first market; sizing only if its evidence is ready.
12. Alternatives, integration and intended differentiation.
13. Business model, payer and sequencing.
14. Go-to-market and network bootstrapping.
15. Existing evidence, missing proof and pilot decision gates.
16. Specific partner/funder ask, costed only after scope review, and long-term vision.

The overall sequence is aligned, but final copy and visual compositions still need review. Tighten without losing the global Green Goods story. Do not turn every caveat into headline copy; retain essential qualifiers next to relevant claims and supporting detail in notes/appendix. Do not narrow the whole product to a synthetic moisture fixture, funder reporting or a U.S. buyer count. Return unresolved buyer and numeric decisions rather than silently choosing them; the pillar decision is accepted.

## Stage 4: visual direction and editable presentation

Begin only after narrative alignment. Read the design skill, root DESIGN.md and `packages/client/DESIGN.browser.md`; inspect the live website and actual image library. Reference files include `packages/client/public/images/hero-{home,garden,impact,actions,fund,cookie}.webp`, with routing in `packages/client/src/content/publicCuration.ts`. Existing reference assets may serve initial layouts, but the final visual story may require new designs and new images.

First propose an image/diagram plan: which slide needs an image, the idea it communicates, exact references, subject/action, setting, camera/framing, light/color/material, crop needs and evidence classification. Use photographic visual language consistent with the website; do not reuse the rejected gouache/panoramic treatment. Show technology as a practical tool only where it contributes to the story. Distinguish authentic documentary material, conceptual imagery and proposed UI. Avoid invented customer traction, stereotyped poverty/wealth, or generated results presented as evidence.

Review representative cover, problem and solution compositions before expanding the whole deck. Create new images only after their intended direction is aligned, with exact reference images supplied. Keep diagrams/data/native text editable; screenshots and images must not flatten the deck. Apply the supplied Fraunces/Inter, linen/charcoal and restrained green direction while checking readability and font portability. Include speaker notes and source references. Render and inspect every final slide and correct content, evidence, fit and design defects before delivery. Disclose meaningful native-application/font limitations.

## Boundaries and handoff

Create research/planning artifacts only. Do not implement product code, change licenses/issues/canonical instructions, install software/fonts, access personal hardware, process live sensitive data, deploy, spend, execute transactions, contact partners or submit applications. Keep private personnel assessments and personal finances out of artifacts. Produce no new images or slide changes while the narrative gate is pending.

Deliver editable artifacts, source-to-claim/number indexes, concise recommendations, major uncertainties and decisions required before implementation. Record stage reviews and observed phase boundaries without inventing times or human attention. The final deck must be both credible and comprehensible; structural validity and arithmetic correctness alone do not satisfy completion.
