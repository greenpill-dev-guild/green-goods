# Grove within Community Evidence Mesh

**Decision accepted:** 23 October 2026. Grove is a focused project within the existing initiative. Keep Community Evidence Mesh as the broader direction; give Grove a clear product identity and delivery boundary.

The [Grove project](https://linear.app/green-goods/project/grove-garden-knowledge-8582c2970974) has five undated milestones matching A0–A4. [RESR-103](https://linear.app/green-goods/issue/RESR-103/grove-by-green-goods-roadmap) remains the Backlog parent. This hub preserves the 18 earlier S/P/K checkpoints and adds C0–C6 for the 13 November local/shared direction. The order was revised on 14 November; see the [MVP order](plan.todo.md#mvp-order). Existing Linear milestones remain the earlier baseline; this revision makes no external tracker changes or implementation claims.

## Ownership

| Owner | Responsibility | Boundary |
|---|---|---|
| Grove | Local community identity, protected capture, knowledge history, personal/community review and explicitly encrypted sharing; optional graph/KOI integration | Community review does not approve protocol Work or certify impact; external publishing retains its owner |
| Community Evidence Mesh | Shared evidence origin, privacy, consent, review authority and correction principles | Coordinates projects; does not absorb their execution plans |
| Impact Framework v0.1 Refresh | Impact, metric, evaluator and methodology definitions | Grove consumes accepted definitions; it does not invent an equivalent registry |
| Agent Messaging Channels | Familiar-channel capture, identity, consent and delivery gates | Grove may consume an authorized projection; it does not replace the messaging pilot |
| Certified/Ma Earth and Report Exports | Approved external publication and versioned reporting | A Hub digest or KOI share is not authorization for external publication |
| Regen Coordination Knowledge Commons | Its ontology draft and eventual editorial authority | Grove's application profile is a proposed mapping, not upstream ratification |

The initiative remains Proposed, with a 31 July 2027 planning horizon. The 18 December 2026 Framework definition review and explicitly provisional 31 January 2027 TAS Telegram pilot retain their existing ownership and gates. Grove's milestones introduce no delivery dates and do not reorder those commitments.

## Evidence mapping to implement

This table is a contract proposal for S2 and subsequent integration, **not a claim that Grove already implements Evidence Envelope v0**. The [Mesh evidence/privacy document](https://linear.app/green-goods/document/community-evidence-mesh-evidence-model-privacy-and-trust-0045b35a9939) and accepted ADR/Framework definitions remain authoritative. Pin the accepted versions before claiming conformance; preserve unresolved fields explicitly.

| Mesh concern | Grove representation / integration requirement |
|---|---|
| Origin and custody | Immutable source revision, canonical source reference, source class/channel, content digest, capture time and known source time. Preserve original human/device origin; AI is a transformation. |
| Transformation | Derived assertion links input revisions/spans and records model/artifact version, process location and uncertainty. Pi run/command receipts identify execution, not evidence truth. |
| Measurement meaning | Ordinary articles need no invented metric. When entering an impact-evidence path, reference the applicable accepted metric/version, unit, observation grain and method. Reject missing required measurement fields; never insert zero or inferred units. |
| Authority | Personal review is separate from Commons editorial workflow, community review, protocol WorkApproval and methodology/claim review. Imports preserve each authority's identity and status without upgrading it. |
| Privacy and use | Capture scope, controller, audience, purpose, consent, retention and applicable bystander/collective/secondary-use constraints must be explicit at the relevant boundary. Missing permission prevents disclosure; a generic local “accepted” flag grants none. |
| Sharing | The [community-sharing contract](community-sharing.md) governs selected encrypted sharing to named members/partners and separately approved public releases. A KOI signature grants neither membership nor publication authority. Raw notes remain excluded unless explicitly selected for that audience. |
| Correction and withdrawal | New revisions retain correction/supersession links and provenance. Revocation/erasure invalidates pending tasks and prepared commands, prevents late resurrection and propagates authorized withdrawals. Already public copies cannot be guaranteed recalled. |
| Time | Keep source/activity time, local knowledge sequence, review time and execution/transport sequence distinct. A late import does not imply the garden knew it earlier. |

The Mesh lifecycle is private observation → candidate → community-reviewed evidence → protocol record → methodology/claim. That lifecycle describes how far a piece of evidence has matured. Grove's four audiences describe who may read it. The two are independent: a record can be community-reviewed and still belong to one community, and nothing moves to a wider audience because it matured. Grove's local source and relevance states sit alongside that lifecycle. Not every graph node participates in it: a saved article or funding listing may remain ordinary knowledge indefinitely. Do not make a mandatory impact form part of saving research.

Application-level encryption is now required by the [sharing contract](community-sharing.md) and is unbuilt and untested. A sensitive-data pilot waits for that contract's gates, a second controller and a retention rule. Browser-local storage and references-only Pi state do not establish device confidentiality.

## Concrete acceptance examples

| Event | Correct result | Rejected interpretation |
|---|---|---|
| Accept a guide's relevance to a planned Vida Verde trial | A personally accepted relationship; activity remains Planned | Community approved the trial, or planting happened |
| Pi finishes a TAS investigation | A completed investigation with traceable proposals | Work completed or its impact was verified |
| Import an authentic WorkApproval record | Preserve the protocol record, chain, source and coverage | All related statements, metrics or ecological outcomes are certified |
| Receive a signed KOI resource | Validate target, publisher, digest and authorized scope | Publisher is a garden member or content is true |
| Save an agroforestry article | A source and optional topic links, with no fabricated metrics | A measured agroforestry outcome |
| Withdraw consent while inference is pending | Block disclosure and invalidate affected commands; do not restore erased text | Retry is permission to resend or recreate content |

Extend E1/E5/E11/E14 with these examples during implementation. Keep source rights and model licensing unresolved until checked; design fixtures cannot establish permission to reuse real community data.

## Sequence and completion boundary

1. Follow the [MVP order](plan.todo.md#mvp-order): device durability, passkey unlock, the vault and file format, identity and the member list, recovery, then the whole loop on a phone and a laptop. This is feasibility on synthetic records, not a community evidence pilot or a replacement for the Mesh phase gates.
2. Alongside it, build the laptop workspace on synthetic records and prove P0, which the G0 spike left owed.
3. Implement the minimal S2 profile and authority fields against accepted definitions. Record any remaining mapping gaps before claiming Mesh conformance.
4. Admit real sensitive evidence only when the loop's gates have passed, a second controller exists, and the applicable privacy, metric, review and correction requirements are satisfied. The Hub import, KOI exchange and both named gardens follow as next lanes.

The [Mesh thesis](https://linear.app/green-goods/document/community-evidence-mesh-thesis-architecture-and-narrative-35af454d4501) and [roadmap](https://linear.app/green-goods/document/community-evidence-mesh-12-month-roadmap-dependencies-and-measures-a51e5ecc2c1a) now describe this relationship. This alignment adds no new product scope for sensors, edge hardware, onchain writes or public publishing.
