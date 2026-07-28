# Commitment Pooling: Diagrams

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (source of truth for every contract name, function, event, and state), `settlement-spec.md` (SettlementModule + Celo Safe topology, D8–D10), `uiux-spec.md` (surface flows), `wireframes.md` (screens). These diagrams are execution reference for implementers and reviewers; they introduce nothing the specs do not already define.

**Docs-site promotion**: these diagrams live here until the August release ships. Promotion into `docs/docs/builders/architecture/` (sequence-diagrams, ERD, plus a commitment journey doc) rides [PRD-727](https://linear.app/greenpill-dev-guild/issue/PRD-727) (historical label PRD-680); see §8 for the two *edits* to existing docs diagrams that ship at the same time.

**Role vocabulary (decision 2026-07-18)**: these diagrams say **Garden steward** (protocol pool: **Protocol steward**) for the pool-authority role — the holder of the garden's operator/owner Hats (`_requirePoolSteward`). The shipped app and community glossary still say "Operator"; the app-wide rename is a recorded follow-up, so treat steward = operator/owner Hats wherever the two vocabularies meet.

**Vocabulary source (2026-07-26)**: every state and enum label below is drawn from the machine-readable ontology sidecar, `packages/shared/src/ontology/green-goods-ontology.json` (human-readable render: `docs/docs/reference/ontology.generated.mdx`), which became repo canon with the ontology foundation. The twelve commitment-pooling vocabularies carry `status: "spec"` and are transcribed member-for-member from `contract-spec.md` §6.1/§6.2: `commitment-pool-type`, `pool-state`, `cycle-type`, `cycle-state`, `commitment-direction`, `commitment-type`, `commitment-state`, `claim-type`, `claim-mode`, `dispute-resolution`, `reward-rail`, `accounting-state`. Display copy may prettify — a diagram may write `APPROVAL_GATED` where the indexer's GraphQL mirror does, or "accepted (creator)" as an edge label — but **every label must map 1:1 onto a canonical member**; nothing here may introduce a term the sidecar does not carry. `bun run check:ontology` guards the code layers and does not parse Markdown or images, so this file is the manual leg of that contract.

## Visual coverage matrix

This is the cross-hub inventory of 29 assets, not a table of contents for this file: 23 named D-diagram sections (D1–D16, including D1b, D7b, D7c, D7d, D10b, D11b, and D13b) render as **34 Architecture Mermaid blocks** below, because five sections split into sub-blocks — four as an overview plus zoom-ins (D2 overview + three acts, D6 overview + three acts, D7 entity map + two field blocks, D9 healthy path + idempotency + retries) and D16 as **three peer views** with no overview (the error, where it manifests, how the person responds) — D13 adds a capability-separation mini-diagram, and D13b is a semantic table rather than Mermaid. **Every D-section has exactly one row** — D3 and D8 were previously missing, and the commitment-pooling ERD was previously counted twice.

**Why sub-blocks are `####` and not `###`.** The heading level is load-bearing, not styling: `renderMd` turns every heading at level ≤ 3 into a gallery *section* and every `####` into a *sub-block* inside one, which is what gives D2/D6/D7/D9 their overview-plus-zoom shape, what makes D16's three views peers, and what the 24-section / 34-block assertions count (the gallery routes this preamble, the coverage matrix, and the appendix to its Reference tab, so the Architecture pane asserts 24 sections, not 26). Promoting them to `###` would convert 17 sub-blocks into sections and dismantle the anchor and nav design. markdownlint's MD001 flags the `##` → `####` jump in this source file, but the *rendered* gallery emits `<h3>` for a `##` section and `<h4>` for its sub-blocks — a correct single-step increment — so there is no heading-order defect in the artifact a reader or screen reader actually receives. The rows naming Community assets resolve to `.plans/active/community-interface/` (`diagrams.md`, `wireframes.md`, `journeys.md`), and rows 15–16 resolve to the two `wireframes.md` files. “Ready” means the implementation question is answered in the named repo-native artifact; it does **not** mean the feature is live. Every Mermaid block is parsed in the final validation pass, while text frames and permission tables are checked against their owning spec and route contract.

| # | Asset | Audience | Question answered | Source of truth | Current status | Correction needed | Validation method |
|---:|---|---|---|---|---|---|---|
| 1 | Unified system context | all lanes | Which users, apps, chains, read models, Safes, CCIP routes, and token participate? | CP `contract-spec.md` §4; `settlement-spec.md` §2–5; Community `spec.md` §3 | Ready: D1 | None; keep planned/live labels current | Mermaid parse + architecture cross-read |
| 2 | Module topology and trust boundaries | contracts, security, ops | Which component may queue, authorize, attest, index, execute, or verify? | CP `contract-spec.md` §4–7; `settlement-spec.md` §3–4 | Ready: D1b | Split CP jobs, EAS jobs/actions, and Celo transfer; include the upgraded existing AssessmentResolver, net-new CommunityTestimonyResolver, and the deployment timelock | Mermaid parse + interface/event cross-read |
| 3 | Capability responsibility summary | contracts, stewards, QA | Which capability groups belong to each role? | CP `contract-spec.md` §6.1; `settlement-spec.md` §3.1.3 | Ready: D13 | Keep distinct from the exact action table | Matrix cross-read + Mermaid parse |
| 4 | Commitment-pooling ERD, including claim requests | indexer, shared, contracts | What is stored, how do composite IDs relate, where do count-safe/exact-label summaries live, and how are stored terms, direct lookup, decline, and supersession represented? | CP `contract-spec.md` §5.3, §8.2 | Ready: D7.0 entity map + D7.1/D7.2 field blocks | Ten pooling entities. Split 2026-07-25 so shape and cardinality read without 98 attribute rows. Previously listed twice — one ERD, one row | Mermaid parse + GraphQL field and handler cross-read |
| 5 | Settlement ERD | settlement, indexer, admin | How do accounts, immutable batches, members, and command/acknowledgment messages relate? | `settlement-spec.md` §3, §6 | Ready: D7b | "Verification attempts" wording (Chainlink-Functions era) corrected 2026-07-27 — the transport re-freeze (Decision Log #46) retired that model; D7b's drawn entities were already current | Mermaid parse + event/entity cross-read |
| 6 | Community EAS/Envio joined-read ERD | Community, indexer, evaluator | Which system owns Needs records versus protocol progress? | Community `spec.md` §4–7 | Ready: Community `diagrams.md` D3 | None | Mermaid parse + four-schema cross-read |
| 7 | Pool/cycle/commitment/NeedStatus/disbursement state machines | contracts, UI, QA | Which states are stored, derived, terminal, or recoverable? | both specs; `settlement-spec.md` §3.1.2 | Ready: D4–D6, D10; Community D4–D5 | None | Mermaid parse + transition-table cross-read |
| 8 | Offer/request → work → approval → confirmation → fulfillment | member, provider, implementers | How do direction, provider garden, Work, and confirmer defaults interact? | CP `contract-spec.md` §5.3, §6.1 | Ready: D2.0 overview + D2.1/D2.2/D2.3 acts | Split 2026-07-25 on the same act boundaries as D6; ApprovalGated is D11's subject and is no longer duplicated here | Mermaid parse + happy-path acceptance |
| 9 | Analog capture + lightweight evidence | member, steward, QA | How is an off-app promise recorded without moving authorship, and when is the counterparty's confirmation the review? | CP `contract-spec.md` §5.3, §6.1; `uiux-spec.md` §6.5 | Ready: D3 | None; previously absent from this matrix | Mermaid parse + review-is-confirmation acceptance |
| 10 | Approval-gated request/accept/decline/supersede | steward, contracts, indexer | Which stored terms are consumed, and how do competing requests end? | CP `contract-spec.md` §5.3, §6.1, §8.2 | Ready: D11 | None | Mermaid parse + named claim tests |
| 11 | Protocol-to-garden funding route (HoA stream upstream) | settlement, treasury, ops | What does Green Goods authorize, and what remains upstream? | `settlement-spec.md` §2–3 | Ready: D12 | None | Mermaid parse + derived-route tests |
| 12 | CCIP command/ack settlement | settlement, admin, QA | How do command retry, idempotent Celo execution, and acknowledgment retry converge? | `settlement-spec.md` §3.1.3 | Ready: D9.0/D9.1/D9.2 + D10 | Split 2026-07-25 into healthy path, idempotency, and the three retry lifecycles | Mermaid parse + command/ack acceptance |
| 13 | G$ funding topology, Safe recovery, and CCIP boundary | settlement, security, treasury | Where does canonical G$ live, who may recover a garden Safe, and what actually crosses the chain boundary? | `settlement-spec.md` §2–4 | Ready: D8 | None; previously absent from this matrix | Mermaid parse + Safe/Roles and peer cross-read |
| 14 | Need → operator triage → commitment seed | member, steward | How does community intent become protocol work without changing authorship? | Community `spec.md` §6, §8 | Ready: Community D9 | None | Mermaid parse + route/spec cross-read |
| 15 | Community offline/waiting-for-membership | member, shared, research | How does the September Community queue specialize the shared substrate? | Community `spec.md` §8 | Ready: Community D8 | Companion detail; CP core is D14 | Mermaid parse + offline acceptance |
| 16 | Cross-surface flow map | product, frontend | What stays in Community, admin `/community`, and existing public client surfaces? | Community `spec.md` §3; CP `uiux-spec.md` | Ready: `wireframes.md` §1 | None | Mermaid parse + monorepo/route cross-read |
| 17 | Low-fidelity frames | member, steward, evaluator, funder | Are entry, state, failure, and recovery screens defined without decorative polish? | both UI specs | Ready: both `wireframes.md` files | None | frame inventory + accessibility review |
| 18 | Persona journeys | research, product, QA | Can every named role reach completion and recovery? | Community `journeys.md` | Ready | None | persona/role checklist |
| 19 | Customer/community journey | research, operators | What happens from discovery through withdrawal or verified outcome? | Community `journeys.md` | Ready | None | stage/recovery checklist |
| 20 | Operator service blueprint | operations, research | Which frontstage, backstage, support, and failure-recovery steps must connect? | Community `journeys.md` | Ready | None | Mermaid parse + handoff cross-read |
| 21 | Research/onboarding/review/rehearsal timeline | research, delivery leads | Who must decide what, by when, before implementation and gathering rehearsal? | Community `research-plan.md`; `journeys.md` | Ready: Community `journeys.md` timeline | None | Mermaid parse + owner/date review |
| 22 | Exact sensitive-action permissions | contracts, settlement, security, QA | Which named function can each actor call, with which gates? | CP `contract-spec.md` §6.1; `settlement-spec.md` §3.1.3 | Ready: D13b | Generated by cross-reading both canonical tables; the settlement-account registration, recovery-update, member-delivery, dispatcher, fee-floor, Celo fee, and both resolver-config rows were added 2026-07-25 | Function-by-function table diff |
| 23 | Hypercert cut-over and indexer delta | indexer, shared, admin | How do fulfilled commitments replace Work as the bundle without migrating legacy certificates? | CP `contract-spec.md` §9 | Ready: D7c | Keep legacy and commitment bundles readable | Mermaid parse + metadata/schema cross-read |
| 24 | Commitment offline job lifecycle | shared, client, QA | How do the five membership-gated field jobs and the sixth per-device settlement attempt queue, retry, reconcile, block, or exhaust? | CP `uiux-spec.md` §5.11 | Ready: D14 | Self-contained CP view; Community D8 remains companion | Mermaid parse + queue acceptance |
| 25 | Indexer pipeline and Garden.id cut-over | indexer, shared | How does an event become an entity, and what does the breaking ID migration require? | CP `contract-spec.md` §8.3 | Ready: D7d | Added 2026-07-25; D7/D7b showed the result shape but never the pipeline | Mermaid parse + handler/replay cross-read |
| 26 | Settlement status derivation (5 stored, 9 rendered) | member, client, QA | Which member-visible states are stored, which are derived, and which has no on-chain counterpart? | `settlement-spec.md` §3.1.2; CP `uiux-spec.md` §5.9 | Ready: D10b | Added 2026-07-25; the derivation was a single prose row | Mermaid parse + W2 state cross-read |
| 27 | Claim-request state machine | contracts, indexer, client | What are the four request states and which resolution code ends each one? | CP `contract-spec.md` §5.3, §8.2 | Ready: D11b | Added 2026-07-25; D11 is a sequence, not a machine | Mermaid parse + resolutionCode cross-read |
| 28 | Deployment and upgrade topology | contracts, release ops, security | In what order do the PR chains run, how long does pooling stay paused, and where can it roll back? | CP `contract-spec.md` §7.3–7.4; `settlement-spec.md` §7.1 | Ready: D15 | Added 2026-07-25; previously prose only, and the ordering had already drifted once (corrections-log §23) | Mermaid parse + activation-order cross-read |
| 29 | Error taxonomy and recovery map | client, admin, QA | Where does each error family surface, and what recovery may that surface offer? | CP `contract-spec.md` §5.5, §6.2; `settlement-spec.md` §3.1.2 | Ready: D16.0 families + D16.1 surfaces + D16.2 recovery | Added 2026-07-25; split 2026-07-27 into the error, where it manifests, and how the person responds — the combined graph buried the recovery column | Mermaid parse + surface/recovery cross-read |

**Keep subgraph titles short.** Mermaid wraps a cluster title at a fixed width (~200 px) but reserves height for a single line, so a longer title's second line renders *on top of* the nodes inside its own cluster. D1, D1b, D10b, and D16.0 each shipped that way once. Keep every `subgraph … ["…"]` label to roughly **22 characters** and let the reading guide carry the qualifier — that is why the boundary clusters in D1b read "Application boundary" rather than "Application boundary — queues intent, authorizes nothing". The gallery's render audit checks every cluster label against every node box and is the gate for this.

**Visual status contract**: three treatments, and only three.

| Treatment | Stroke + fill | Means |
|---|---|---|
| **Built/live** | solid green stroke, green-tint fill (`#50784a` / `#edf3e8`) | ships today, in production |
| **Planned/gated** | dashed stone stroke, paper fill (`#6e6857` dashed `6 4` / `#fbf8f2`) | does not exist yet, or is gated |
| **Existing surface, planned delta** | solid green stroke, paper fill (`#50784a` / `#fbf8f2`) | the component is live today and this work adds a planned capability to it — the client PWA, editorial website, Admin, and the Envio read model are all in this class |

The third treatment is why the Architecture tab and the story assets agree: the story assets label *actions* Built or Planned, and a live surface carrying a planned action is exactly this class. Dashes never mean read, boundary, derived, or app-only. Relationship meaning is written on the arrow. One palette per semantic, everywhere — a fill never means two different things in two diagrams.

**State provenance is not decoration.** The sidecar's `state_machines` section flags every state `on-chain`, `derived`, or `off-chain`, and the state machines below must render that distinction so a derived state never reads as a chain write:

| Sidecar `storage` | Treatment | Means |
|---|---|---|
| `on-chain` | paper fill, no class | the module stores it; a transaction moved it here |
| `derived` | amber (`#b98a3e` / `#f6ecdc`), `class … derived` | the indexer computes it from events — **no transaction writes this state** |
| `off-chain` | grey (`#8a8a8a` / `#ececec`), `class … appOnly` | app-side only; `Draft` lives in IndexedDB and has no chain presence at all |

Derived across the spec machines: `Active`, `EvidenceSubmitted`, `PartiallyApproved`, `Reconciled` (commitment) and `InProgress`, `Reviewing` (cycle). Off-chain: `Draft` (commitment and cycle).

**One name, two storages — do not "fix" this.** `Reconciled` is **derived** in the commitment machine (D6c computes it from `CycleClosed`) but **on-chain** in the cycle machine (D5, where `closeCycle` is the reconcile act that writes it). The two diagrams therefore style the same word differently, and both are correct.

**Label glossary**: one name per thing, across every diagram below. Where two labels used to compete, the left column is now the only one used.

| Canonical label | Node/participant id | Not | Note |
|---|---|---|---|
| Envio read model | `ENV` / `IDX` | ~~Indexer~~, ~~Envio handler~~, ~~Envio boundary~~ | one component; "indexing boundary" is a role of it, not a second name |
| CommitmentPoolingModule | `CPM` (`M` in sequences) | ~~CPM2~~, ~~MOD~~ | D1 draws module + register fused as `MOD` **only** in the system-context view, and says so |
| CommitmentRegister | `REG` (`R` in sequences) | — | counts units for the module only |
| CeloSettlementExecutor | `CE` | ~~EXEC~~, ~~EX~~ | one subtitle style: what it may do, then what it may never be |
| Green Goods protocol Safe | `PS` | ~~GG~~ | `GG` collided with "Green Goods" everywhere else |
| Garden Celo Safe | `GS` | — | per garden, 2-of-3 recovery |
| Chainlink CCIP | `CCIP` | — | payload is always **data-only**, never "message-only" |
| Deployment timelock | `TL` | — | gates exactly four settlement setters (D13b) |

**Two vocabularies share one Solidity identifier — never collapse them.** `PoolType` names two different things and the sidecar keeps them as separate vocabularies on purpose:

| Vocabulary | Members | What it is |
|---|---|---|
| `commitment-pool-type` *(spec)* | `Garden`, `Protocol` | the commitment-pooling pool anchor kind — the only one these diagrams draw |
| `signal-pool-type` *(live)* | `ActionSignal`, `HypercertSignal` | the **Gardens V2 conviction signal pool** attached to a garden — out of scope here |

Write `CommitmentPoolType` in full wherever the type is named (D7.1 does). A bare "PoolType" is ambiguous, and labelling a Gardens V2 signal pool with the commitment members — or the reverse — is a vocabulary error, not a shorthand.

**Entity definitions come from the sidecar, not from these diagrams.** Two matter most for the flows drawn here. **Work** is one documented instance of an Action performed by a gardener — media, notes, and metadata *submitted as an EAS Work attestation for operator review*; approval records a **separate Work Approval attestation** (which is why D2.2 draws the submission and the approval as two distinct EAS interactions, not one round trip). **Assessment** is an *up-front* baseline and strategy — domain, diagnosis, SMART outcome targets, selected Actions, reporting period — authored before work begins and mirrored to a Karma GAP milestone **only when that module is active**; it is explicitly *not* a review of submitted Work. A commitment is deliberately **not** an EAS attestation: it is a module-native record.

**MDR is ambiguous and unused here.** In client surfaces MDR means the **Media–Details–Review** capture wizard; in evaluation contexts it means the **Monitoring–Data–Reporting** pipeline (v1-0 §16.1 disambiguates the two). No diagram or asset in this hub uses the abbreviation, and none should — spell whichever one is meant.

**Steward names are deliberately distinct, not drift.** They are different *resolutions* of the same Hats-based authority, and D13b is the exact gate for each: **commitment-pool steward** (the resolved authority of the commitment's pool), **protocol steward** (the root/protocol pool's steward specifically — one of the two authorities, alongside the `SettlementModule` owner, that may `queueFunding` for a discretionary non-commitment seed/top-up), **settlement steward** (the resolved steward for a settlement subject), and **batch steward** (the resolved steward for an immutable batch's executor garden). Where a diagram says only "steward", the resolution is whichever of these the function's D13b row names. `operatorBps` keeps its GraphQL field name because that is canonical in `contract-spec.md` §8.2; its label reads "steward share" everywhere it is drawn.

---

## D1. Unified system context

**How to read this**: top to bottom — people use surfaces; surfaces write into the Arbitrum protocol layer; Envio turns explicit Green Goods protocol events into the read model every surface queries; value moves only on Celo. CCIP carries data-only commands and acknowledgments, never G$. Node outlines encode built/live versus planned/gated status; arrow labels state whether an edge is a write, read, event, protocol message, or value movement. The client is ONE codebase with two presentations — the **installed PWA** and the **editorial website** — and the docs site is a separate Docusaurus app; the planned Community PWA is a third, independent app.

```mermaid
flowchart TB
  subgraph people["People"]
    MEM["Community member"]
    PROV["Gardener / provider"]
    STW["Garden steward"]
    EVA["Evaluator"]
    FUND["Funder / collaborator"]
  end
  subgraph surfaces["Green Goods surfaces"]
    COM["Community PWA (planned)<br/>Needs · Create · Profile"]
    PWA["Client — installed PWA<br/>member commitments · work · wallet"]
    WEB["Client — editorial website<br/>public garden + funding stories"]
    ADMIN["Admin<br/>steward pools · evaluator export · Operations"]
    DOCS["Docs site (Docusaurus)<br/>builder + user reference"]
  end
  subgraph arb["Arbitrum protocol layer"]
    MOD["CommitmentPoolingModule + Register"]
    SET["SettlementModule"]
    EAS["EAS + Green Goods resolvers"]
  end
  ENV["Envio read model<br/>Green Goods protocol events only"]
  subgraph celo["Celo — value execution"]
    HOA["GoodDollar pool<br/>(House of Alignment)"]
    PS["Green Goods protocol Safe<br/>receipt evidence pending"]
    GS["Per-garden 2-of-3 Safes"]
    GD["Canonical G$"]
  end
  CE["CeloSettlementExecutor<br/>bounded Zodiac Roles member"]
  CCIP["Chainlink CCIP<br/>data-only command + acknowledgment"]

  MEM -->|"needs · promises"| COM
  MEM -->|"commitments · wallet"| PWA
  PROV -->|"work · evidence"| PWA
  STW -->|"seed · accept · approve · queue"| ADMIN
  EVA -->|"assessments · export"| ADMIN
  FUND -->|"stories · funding"| WEB
  COM -->|"Need attestations"| EAS
  PWA -->|"commitment · claim · evidence jobs"| MOD
  ADMIN -->|"pool + cycle control"| MOD
  ADMIN -->|"queue · dispatch · recovery controls"| SET
  MOD -->|"attestation checks"| EAS
  MOD -->|"events"| ENV
  SET -->|"events"| ENV
  ENV -->|"joined reads"| COM
  ENV -->|"queries"| PWA
  ENV -->|"queries"| WEB
  ENV -->|"queries"| ADMIN
  HOA -->|"G$ stream (upstream fact)"| PS
  PS -->|"ProtocolToGarden funding"| GS
  CE -->|"protocol-pool and garden disbursements"| GD
  SET -->|"versioned command, no token amounts"| CCIP
  CCIP -->|"authenticated command"| CE
  CE -->|"versioned acknowledgment, no token amounts"| CCIP
  CCIP -->|"authenticated success/failure"| SET
  DOCS -->|"built / planned / CCIP-confirmed disclosure"| people

  classDef built fill:#edf3e8,stroke:#50784a,stroke-width:2px,color:#2a2722
  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  classDef existingPlannedDelta fill:#fbf8f2,stroke:#50784a,stroke-width:2px,color:#2a2722
  class DOCS,EAS,HOA,GD built
  class COM,MOD,SET,GS,CE,CCIP,PS planned
  class PWA,WEB,ADMIN,ENV existingPlannedDelta
```

Notes:

- The installed PWA and the editorial website are the same client app in two presentation modes (`getClientPresentationMode`); the docs site is separate. Every surface carries built / planned / queued / dispatched / confirming / confirmed status labels so a reader never mistakes a plan for a live feature.
- The GoodDollar House of Alignment pool streams G$ directly into the Green Goods protocol Safe; Green Goods models only the ProtocolToGarden route onward (corrections-log §9). The protocol Safe is drawn **planned**, not built: its mechanism, address confirmation, and live receipt evidence are still pending partner evidence (`settlement-spec.md` §2), which is the same status D8 and D12 give it.
- The client PWA, editorial website, Admin, and the Envio read model carry the **existing surface, planned delta** treatment — they are live today, and this work adds planned pooling capability to each. That is why the story assets can label the same rails BUILT at the action level without contradicting this diagram.
- EAS and raw Celo transfers are outside Envio. The joined Community read is owned in shared/query composition, not fabricated in an Envio handler.
- The indexer records only SettlementModule and CeloSettlementExecutor protocol events. A Celo execution is visible before its acknowledgment, but only an authenticated success acknowledgment marks the Arbitrum attempt `Confirmed`.

## D1b. Contract/module topology and trust boundaries

**How to read this**: four trust boundaries, one job each — the application boundary queues intent and authorizes nothing, the Arbitrum boundary owns source state, Envio restates explicit events from both Green Goods contracts, and the Celo executor moves value under a reviewed Safe + Zodiac scope, stores its idempotent outcome, then uses CCIP to acknowledge it. Two presentation choices worth naming: **both Work-rail resolvers are drawn** — `WorkResolver` validates the Work attestation itself and `WorkApprovalResolver` validates the approval; the non-blocking `onWorkApproved` bridge from that resolver into the pooling module is a **planned** upgrade (register #5) and is drawn as a dashed edge, not a live one — and **the four Community resolvers are drawn as one group**, because each validates exactly one schema and they share a single status and trust position. The boundary rules below still name each one individually.

```mermaid
flowchart TB
  subgraph APP["Application boundary"]
    CPJOBS["CP offline jobs (planned)<br/>commitment · claim · evidence · workLink · confirmation"]
    EASJOBS["Community offline EAS jobs (planned)<br/>need · needSignal · testimony"]
    EASACTIONS["Online EAS actions (planned)<br/>NeedStatus · FundingAttribution"]
    TRANSFER["Online Celo wallet action (planned)<br/>canonical G$ send · never queued"]
  end
  subgraph ARB["Arbitrum trust boundary"]
    HATS["HatsModule<br/>membership and scoped roles"]
    GT["GardenToken<br/>optional non-blocking pool hook"]
    CPM["CommitmentPoolingModule<br/>state + access + EAS checks"]
    REG["CommitmentRegister<br/>onlyModule unit accounting"]
    SM["SettlementModule<br/>immutable route/source/executor scope"]
    WR["WorkResolver<br/>validates the Work attestation"]
    WAR["WorkApprovalResolver<br/>live resolver · pooling bridge is<br/>a planned upgrade (register #5)"]
    EAS["EAS + SchemaRegistry"]
    RESV["Community EAS resolvers (Sept)<br/>one resolver per schema:<br/>Need · NeedSignal · NeedStatus<br/>FundingAttribution"]
    V3["AssessmentResolver (existing UUPS, upgraded)<br/>v2 preserved · AssessmentV3 schema added"]
    CTR["CommunityTestimonyResolver (planned)<br/>Community Hat only"]
    TL["Deployment timelock<br/>gates route, batch limit,<br/>dispatcher, and fee-floor changes"]
  end
  ENV["Envio read model — indexing boundary<br/>only Green Goods contract events"]
  subgraph CELO["Celo trust boundary"]
    SAFE["2-of-3 recovery Safes<br/>owners != Roles executors"]
    GD["Canonical G$ transfers"]
  end
  CCIP["Chainlink CCIP routers<br/>data-only command + acknowledgment"]
  CE["CeloSettlementExecutor<br/>immutable peer + bounded route"]

  CPJOBS -->|"module writes after on-chain revalidation"| CPM
  EASJOBS -->|"attestations after resolver checks"| EAS
  EASACTIONS -->|"online attestations"| EAS
  TRANSFER -->|"chain 42220 wallet transaction"| GD
  HATS --> CPM
  HATS --> SM
  GT -->|"try/catch"| CPM
  CPM --> REG
  CPM --> EAS
  EAS --> WR
  EAS --> WAR
  WAR -.->|"planned: onWorkApproved try/catch"| CPM
  EAS --> RESV
  EAS --> V3
  EAS --> CTR
  CPM -->|"events"| ENV
  REG -->|"events"| ENV
  SM -->|"events"| ENV
  TL -->|"timelocked config only"| SM
  SM -->|"versioned command; no token amounts"| CCIP
  CCIP --> CE
  CE -->|"typed canonical-G$ route only"| SAFE
  SAFE --> GD
  CE -->|"stored outcome + versioned acknowledgment"| CCIP
  CCIP --> SM

  classDef built fill:#edf3e8,stroke:#50784a,stroke-width:2px,color:#2a2722
  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  classDef existingPlannedDelta fill:#fbf8f2,stroke:#50784a,stroke-width:2px,color:#2a2722
  class HATS,GT,WR,WAR,EAS,GD built
  class CPJOBS,EASJOBS,EASACTIONS,TRANSFER,CPM,REG,SM,RESV,CTR,SAFE,CCIP,CE,TL planned
  class V3,ENV existingPlannedDelta
```

Boundary rules:

- **Application**: drafts and queued jobs are intent, never authority — every write is re-validated on-chain; nothing trusts a client claim.
- **Arbitrum**: HatsModule decides who may act; the pooling module owns state machines and EAS checks; the register counts units only for the module; the settlement module records value authorization but never custodies or calls Celo. The existing Work rail is validated by two live resolvers — **WorkResolver** (the Work attestation: garden membership, registered active Action, enabled domain, required metadata) and **WorkApprovalResolver** (the separate approval attestation). The `onWorkApproved` try/catch bridge from that resolver into the pooling module is **not shipped**: today's `WorkApproval.sol` carries only the GAP side effect it will be modelled on, and register #5 defines the bridge as a resolver upgrade. The edge is drawn dashed for that reason. Each Community resolver validates exactly one schema — **NeedResolver** (Need records), **NeedSignalResolver** (member signals on a Need), **NeedStatusResolver** (steward status updates), **FundingAttributionResolver** (receipt-checked funding references); the diagram groups those four into one node because they are identical in status and trust position. Attestation authorship rules are not drawn here — D13b carries them.
- **Deployment timelock**: four settlement configuration changes — `setCcipRoute`, `setBatchSizeLimit`, `setDispatcher`, `setFeeReserveMinimum` — are reachable only through the timelock, and all four additionally require the module to be paused. Dependency wiring, `setPaused`, and `_authorizeUpgrade` are owner-direct with no timelock. D13b is the exact gate for each.
- **Envio**: restates emitted events into the read model — explicit fields only, no actor inference from `transaction.from`.
- **Celo + CCIP**: the executor validates its immutable source chain/sender and empty token amounts, then calls only the typed canonical-G$ route. Recovery owners are never executor owners. An authenticated Celo acknowledgment, not a human report or timeout, finalizes Arbitrum state.

Trust rules: no provider may confirm their own delivery, including steward fallback; no recovery owner may be a Safe executor; no human can verify a receipt; no handler infers an actor from `transaction.from`; no contract enumerates all cycles or claims to make a transition.

## D2. Offer/request → work → approval → confirmation → fulfillment

**How to read this**: the full happy path of one promise, left to right in time — created, claimed, delivered through the existing Work → WorkApproval rail, confirmed by the counterparty, and rewarded. The steward performs every one of their steps in the Admin app (Hub work stage + garden Pool tab — W7/W13); the member acts in the client PWA. The payout lane at the end covers **non-G$ declared rewards only** — G$ rewards leave this diagram and queue on the SettlementModule (D9, D12).

Preconditions: pool `Open`; an optional cycle exists, belongs to the pool, and is `Open`. For an Offer, the creator is provider and accepted recipient confirms. For a Request, the accepted claimant is provider and the creator confirms. The stored `providerGarden` controls DomainImpact Work and assessment validation even when the commitment remains in the root protocol pool. Provider self-confirmation fails on every path.

The single all-steps diagram was accurate but carried 32 messages across ten participants, so it is drawn as one compact overview plus three acts on the **same act boundaries as D6** — D2.1 is D6a, D2.2 is D6b, D2.3 is D6c, seen from the message side instead of the state side. The acts zoom into the overview and never disagree with it.

#### D2.0 Overview — one promise, end to end

```mermaid
sequenceDiagram
  autonumber
  actor A as Creator
  actor B as Counterparty
  actor OP as Commitment-pool steward
  participant M as CommitmentPoolingModule
  participant R as CommitmentRegister

  A->>M: createCommitment — Offered or Requested
  M->>R: registerClass — the class exists, no units yet
  B->>M: claim accepted (act 1 · D2.1)
  M->>R: commitUnits — one provider slot taken
  B->>M: work linked and approved (act 2 · D2.2)
  Note over M: every per-action required count met<br/>and assessment satisfied → ReadyForConfirmation
  A->>M: counterparty confirms (act 3 · D2.3)
  M->>R: fulfillUnits — units converted, the one slot released
  alt cycle-scoped (cycleId != 0)
    OP->>M: closeCycle → CycleClosed derives Reconciled
  else cycle-less (cycleId == 0)
    OP->>M: closePool → PoolClosed derives Reconciled
  end
```

#### D2.1 Act 1 — Creation and acceptance

```mermaid
sequenceDiagram
  autonumber
  actor A as Creator
  actor B as Claimant
  participant PWA as Client PWA + offline queue
  participant M as CommitmentPoolingModule
  participant R as CommitmentRegister
  participant IDX as Envio read model

  A->>PWA: create Offer or Request (Draft in IndexedDB)
  PWA->>M: createCommitment(params) on sync
  M->>R: registerClass(commitmentId, poolId, cycleId, unitLabel, targetUnits)
  R-->>IDX: ClassRegistered (no units committed yet)
  M-->>IDX: CommitmentCreated (Offered or Requested)
  B->>M: claimCommitment(commitmentId, kind, gardenContext)
  Note over M,R: ClaimMode.Open — the garden campaign default.<br/>ApprovalGated is D11's whole subject and is not redrawn here
  Note over M,R: provider is creator for Offer, claimant for Request<br/>providerGarden is the pool garden for Offer, validated gardenContext for Request<br/>confirmer is claimant for Offer, creator for Request
  M->>R: commitUnits(class, provider, units)
  R-->>IDX: UnitsCommitted (one provider slot acquired)
  M-->>IDX: CommitmentAccepted
```

#### D2.2 Act 2 — Delivery, work, and approval

```mermaid
sequenceDiagram
  autonumber
  actor A as Creator
  actor B as Counterparty
  actor OP as Commitment-pool steward (via Admin)
  participant M as CommitmentPoolingModule
  participant EAS as EAS
  participant WAR as WorkApprovalResolver
  participant IDX as Envio read model

  alt individual claim
    Note over M,EAS: Work attester must equal the stored provider<br/>(Offer creator / Request counterparty)
  else garden claim
    Note over M,EAS: Work attester must be a gardener or steward<br/>of the stored providerGarden
  end
  Note over M,EAS: protocol-pool Work and assessment recipient = providerGarden<br/>while the commitment pool remains the root protocol pool
  alt Offer
    A->>EAS: provider submits Work matching a required action
  else Request
    B->>EAS: provider submits Work matching a required action
  end
  B->>M: linkWork(commitmentId, workUID)
  M->>EAS: check schema, action ∈ requirements, attester, providerGarden recipient
  M-->>IDX: WorkLinked (derived state flips to Active)
  OP->>EAS: attest WorkApproval (existing approval flow, in Admin Hub)
  EAS->>WAR: onAttest — full existing validation
  WAR->>M: onWorkApproved(workUID, approvalUID, garden) in try/catch
  M-->>IDX: ApprovedWorkCounted(requirementIndex, approvedWorkCount, approvedUnits, newlyApprovedUnits, …) — 7 params, contract-spec §5
  opt approval landed before linkWork
    OP->>M: syncApprovedWork(commitmentId, approvalUIDs) — bounded recovery
    Note over M,EAS: each UID is EAS-verified and deduped through approvalCounted
  end
  Note over M,EAS: every per-action required count met (requirementIndex credits<br/>exactly one requirement) and assessment satisfied → auto-flip
  M-->>IDX: CommitmentReadyForConfirmation
```

#### D2.3 Act 3 — Confirmation, fulfillment, reward, and close

```mermaid
sequenceDiagram
  autonumber
  actor A as Creator
  actor B as Counterparty
  actor OP as Commitment-pool steward (via Admin)
  participant M as CommitmentPoolingModule
  participant R as CommitmentRegister
  participant RAILS as Existing payout rails (jar / treasury)
  participant IDX as Envio read model

  alt Offer
    B->>M: confirmFulfillment(commitmentId)
  else Request
    A->>M: confirmFulfillment(commitmentId)
  end
  Note over M,R: the accepted provider is excluded on every path —<br/>acceptance reverts if the threshold becomes unreachable.<br/>Steward fallback also rejects the provider and records a reason
  M-->>IDX: ConfirmationRecorded (n of N)
  M->>R: fulfillUnits(class, derived provider, units)
  R-->>IDX: UnitsFulfilled (the provider slot is released once)
  M-->>IDX: CommitmentFulfilled (client hero moment fires)
  opt reward.rail == ArbitrumExternal
    OP->>RAILS: execute payout on an existing rail (jar / treasury)
    OP->>M: recordRewardPaid(commitmentId, payoutRef)
    M-->>IDX: RewardPaid(derived source, provider, token, amount)
    Note over RAILS,IDX: CeloSettlement rewards never use this lane —<br/>they queue on the SettlementModule (D9, D12)
  end
  OP->>M: closeCycle(cycleId)
  M-->>IDX: CycleClosed (derived Reconciled for the cycle's commitments)
```

## D3. Analog capture + lightweight evidence (review-is-confirmation)

**How to read this**: the lightweight alternative to D2. There is no Work rail and no approval step, because for these kinds the counterparty's confirmation *is* the review. Watch the authorship line: the steward types the record, but the member remains the named promise source — `recordedBy` marks the steward as scribe and never as owner. The evidence step is offline-first: it queues in IndexedDB and may sync hours later.

The SupportService / StewardCaptured path: no Work/WorkApproval rails, no work requirement, counterparty confirmation IS the review (register #20). The member stays the named promise source; the steward is metadata (`recordedBy`).

**When this happens (use cases)**: an elder gardener makes a promise in conversation and the steward records it from a paper field log; a member offers childcare, meals, or transport for a community work day — help that has no Work/approval rail; a field visit is captured fully offline and the evidence photos sync hours later. In every case the member stays the named promise source (`recordedBy` marks the steward as scribe, never as owner), and because these kinds carry no work requirement, the counterparty's confirmation *is* the review — no separate approval step exists.

```mermaid
sequenceDiagram
  autonumber
  actor MEM as Member (promise source)
  actor OP as Commitment-pool steward
  actor CP as Counterparty (confirmer)
  participant ADM as Admin capture flow
  participant PWA as Client PWA + offline queue
  participant M as CommitmentPoolingModule
  participant IDX as Envio read model

  MEM--)OP: promise made off-app (conversation, field visit)
  OP->>ADM: analog capture — member, kind, terms
  ADM->>M: createCommitment(StewardCaptured, onBehalfOf = member)
  M-->>IDX: CommitmentCreated(creator = member, recordedBy = steward)
  Note over ADM,M: member's detail shows<br/>"Recorded by your steward on your behalf.<br/>The promise stays yours."
  MEM->>PWA: attach evidence offline (photo, link, note)
  Note over ADM,PWA: evidence job queued in IndexedDB,<br/>media serialized, survives restart
  PWA->>M: attachEvidence(commitmentId, cid) on sync
  M-->>IDX: EvidenceAttached (derived EvidenceSubmitted)
  MEM->>M: submitForConfirmation(commitmentId)
  Note over PWA,IDX: allowed because the commitment carries no work requirement,<br/>at least one evidence is attached,<br/>and the declared assessment is attached — the same<br/>assessment predicate D6b applies · DomainImpact is rejected
  M-->>IDX: CommitmentReadyForConfirmation
  CP->>M: confirmFulfillment(commitmentId)
  M-->>IDX: ConfirmationRecorded → CommitmentFulfilled
  Note over CP,M: provider self-confirmation is blocked on-chain.<br/>Steward fallback also rejects the provider<br/>and always carries a visible reason
```

## D4. Pool state machine

**How to read this**: six on-chain states and the exact call that moves between them. Two of them are easy to confuse and mean opposite things — `Paused` is the emergency freeze that stops new promises, while `Composted` is archival rest that keeps the full history readable and can wake again through `reopenPool`. Every transition is a rare, deliberate steward console action; nothing here happens automatically.

Every pool transition is on-chain. One pool per garden, idempotent registration; the protocol pool is the root garden's pool (tokenId 1).

```mermaid
stateDiagram-v2
  direction LR
  [*] --> NotReady : onGardenMinted / registerPool
  NotReady --> Ready : markPoolReady (charter CID + non-zero open-commitment cap)
  Ready --> Open : openPool
  Open --> Paused : pausePool(reasonCID) — reason mandatory
  Paused --> Open : resumePool
  Open --> Closed : closePool
  Paused --> Closed : closePool
  Closed --> Composted : compostPool
  Composted --> Ready : reopenPool(toOpen = false)
  Composted --> Open : reopenPool(toOpen = true)
```

**What each state allows**:

| State | What it means | What's allowed | Who acts |
|---|---|---|---|
| NotReady | garden minted, pool registered, onchain charter/cap predicate not yet met or app Baseline preflight still missing | configuration only | steward |
| Ready | onchain charter + non-zero provider open-commitment cap are present; the app offered the write only after a current non-revoked Baseline preflight | seed cycles; open the pool | steward |
| Open | promises can flow | create / claim / confirm commitments; seed and open cycles | members + steward |
| Paused | **the emergency freeze** | create, claim, Ready-submit, and confirm are disabled; browse, evidence/work linkage, cancellation, expiry, and dispute recovery remain available | steward (resume); existing actors keep allowed evidence/recovery paths |
| Closed | wind-down | no new activity; terminal cleanup of open commitments | steward |
| Composted | **archival rest — history + "ready for the next season"** | read everything; `reopenPool` back to Ready or Open; nothing else | steward |

Composting is archival, not deletion and not the freeze — `Paused` is the freeze. A composted pool keeps its full promise history visible and can wake for a new season via `reopenPool`. Pool-level `Paused` blocks new commitments, claims, and confirmations on that pool only; module-wide `setPaused` blocks operational mutations but keeps owner configuration, unpause, `cancelCommitment`, `expireCommitment`, and `resolveDispute` available for safe wind-down.

## D5. Cycle state machine (types: Season, Campaign)

**How to read this**: the chain stores only five states. The three extra boxes are provenance, not new chain states — grey `Draft` lives in admin IndexedDB, and amber `InProgress`/`Reviewing` are indexer-derived overlays of on-chain `Open`, which is why transitions leave them that the on-chain table lists once under `Open`. There is deliberately no loop back: a cycle ends, and the next round is a fresh `seedCycle` on the same pool.

On-chain enum stores `Seeded / Open / Reconciled / Composted / Cancelled`. `Draft` is app-only; `InProgress` and `Reviewing` are derived overlays of on-chain `Open`.

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e
  classDef appOnly fill:#ececec,stroke:#8a8a8a

  Draft: Draft (admin IndexedDB only)
  InProgress: InProgress (derived)
  Reviewing: Reviewing (derived)

  [*] --> Draft
  Draft --> Seeded : seedCycle — metadata and window only
  Seeded --> Open : openCycle(allocation) — validate, lock, emit six-role snapshot
  Open --> InProgress : first CommitmentAccepted, or startTime reached
  InProgress --> Reviewing : endTime passed, or all commitments terminal / ready
  Reviewing --> InProgress : new evidence, work link, or approval count
  Reviewing --> Reconciled : closeCycle (the reconcile act)
  InProgress --> Reconciled : closeCycle (underlying Open)
  Open --> Reconciled : closeCycle
  Reconciled --> Composted : compostCycle
  Seeded --> Cancelled : cancelCycle(reasonCID)
  Open --> Cancelled : cancelCycle(reasonCID)
  InProgress --> Cancelled : cancelCycle(reasonCID) on underlying Open
  Reviewing --> Cancelled : cancelCycle(reasonCID) on underlying Open
  Composted --> [*] : succession = fresh seedCycle on the same pool

  class InProgress derived
  class Reviewing derived
  class Draft appOnly
```

`InProgress` is on-chain `Open`, so `cancelCycle` covers it; Draft cancels are an off-chain discard. Succession is derived by pool ordering — no on-chain predecessor pointer. Opening validates **pool `Open`**, cycle existence, pool ownership, `Seeded` state, and an allocation whose basis points sum to exactly 10,000. Because `InProgress` and `Reviewing` are derived overlays of on-chain `Open`, the four edges leaving them (`→ Cancelled`, `→ Reconciled`) are the spec's single `Open →` rows drawn at overlay resolution — the diagram is deliberately a superset of the on-chain transition table, and no transition here exists that the chain does not allow. `Pool.openSeasonCycleId` permits exactly one open Season in O(1); any number of Campaigns may be open concurrently and no transition enumerates cycles.

**Reading the middle of the machine**: `InProgress` and `Reviewing` are indexer-derived overlays of on-chain `Open` — the chain never stores them. A cycle sits `Open`, starts reading as `InProgress` at the first accepted commitment (or when `startTime` arrives), flips to `Reviewing` when the window ends or every commitment is terminal/ready, and flips back whenever new evidence lands. `closeCycle` is the reconcile act.

**There is deliberately no loop here**: `Composted` is terminal *for a cycle*. The loop lives at the pool — a fresh `seedCycle` (Season or Campaign) on the same pool is how the next round begins, and the composted cycle's aggregates roll into pool history. (The pool machine, D4, is the one that can reopen.)

**Allocation split**: the six role percentages — gardeners / treasury / steward / evaluator / community / funder, stored on-chain as basis points where 10000 bps = 100% — are supplied atomically to `openCycle`, validated, stored as the immutable cycle snapshot, emitted in `CycleOpened`, and become the cycle's impact-certificate allowlist allocation at close (contract-spec §9.4; default Model 1: 60 / 15 / 10 / 5 / 5 / 5). `seedCycle` carries no allocation.

## D6. Commitment state machine (overview + three acts)

**How to read this**: one promise's whole life. Read D6.0 first — five boxes, the entire arc. The three acts then zoom in without ever contradicting the overview: act 1 is how a promise gets a provider, act 2 is how delivery becomes provable, act 3 is every way it ends. Colour is provenance, not status: paper = stored on-chain, amber = derived by the indexer, grey = app-only. D2 is the same three acts drawn as messages instead of states.

On-chain enum stores `Offered / Requested / Accepted / ReadyForConfirmation / Fulfilled / Cancelled / Expired / Disputed`. `Draft` is app-only; `Active`, `EvidenceSubmitted`, `PartiallyApproved`, and `Reconciled` are derived. The single all-states diagram was accurate but hard to digest, so it is drawn as one compact overview plus three lifecycle acts — the acts zoom into the overview and never disagree with it.

#### D6.0 Overview — the whole life at a glance

```mermaid
stateDiagram-v2
  direction LR
  state "Created (Offered / Requested)" as CRE
  state "Accepted - delivery underway" as ACC
  state "ReadyForConfirmation" as RFC
  state "Disputed - recoverable" as DSP
  state "Ended (Cancelled / Expired)" as END
  [*] --> CRE : createCommitment
  CRE --> ACC : claim accepted (act 1)
  ACC --> RFC : delivery proven (act 2)
  RFC --> Fulfilled : counterparty confirms (act 3)
  CRE --> END : cancel / expire
  ACC --> END : cancel / expire (act 3)
  RFC --> END : expire (act 3)
  ACC --> DSP : dispute (act 3)
  RFC --> DSP : dispute (act 3)
  END --> DSP : dispute — from Expired only, never from Cancelled (act 3)
  DSP --> ACC : RestorePrevious
  DSP --> RFC : RestorePrevious
  DSP --> END : cancel / expire resolution
  DSP --> Fulfilled : fulfill resolution when allowed
  Fulfilled --> [*] : reconciled at cycle close
  END --> [*] : reconciled at cycle close
```

#### D6a. Act 1 — Claim & acceptance

```mermaid
stateDiagram-v2
  direction TB
  classDef appOnly fill:#ececec,stroke:#8a8a8a
  Draft: Draft (client/admin IndexedDB)
  [*] --> Draft
  Draft --> Offered : create · Offer
  Draft --> Requested : create · Request
  Offered --> Accepted : accepted (creator)
  Requested --> Accepted : accepted (claimant)
  Offered --> Cancelled : cancel
  Requested --> Cancelled : cancel
  Offered --> Expired : expire
  Requested --> Expired : expire
  class Draft appOnly
```

Exact gates for these four calls (D13b is authoritative): `createCommitment` by a pool member for their own Offer/Request; **cancel** is `cancelCommitment(id, reasonCID)` by the **creator or steward** before acceptance; **expire** is `expireCommitment(id)`, **permissionless** once past the due date or cycle end; and acceptance is `claimCommitment` under `ClaimMode.Open` or `acceptClaim` under `ApprovalGated`.

An approval-gated `claimCommitment` stores a PendingClaim and leaves the on-chain state untouched; `declineClaim` clears only that claimant; acceptance consumes the stored terms, derives provider and providerGarden, and commits units exactly once. Competing pending claims resolve by supersession — the full decline/accept/supersede choreography is D11.

#### D6b. Act 2 — Delivery & evidence (`Accepted` → `ReadyForConfirmation`)

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e
  Active: Active (derived)
  EvidenceSubmitted: EvidenceSubmitted (derived)
  PartiallyApproved: PartiallyApproved (derived)
  [*] --> Accepted
  Accepted --> Active : first WorkLinked or EvidenceAttached
  Active --> EvidenceSubmitted : EvidenceAttached / WorkLinked
  EvidenceSubmitted --> PartiallyApproved : ApprovedWorkCounted — some per-action counters below quota
  PartiallyApproved --> EvidenceSubmitted : new evidence or work
  EvidenceSubmitted --> ReadyForConfirmation : (a) first counted approval completes every requirement + assessment
  PartiallyApproved --> ReadyForConfirmation : (a) every per-action required count met + assessment satisfied
  Accepted --> ReadyForConfirmation : (b) submitForConfirmation — eligible evidence-only kind · no work requirement · at least 1 evidence · declared assessment attached · (c) steward override with reason
  ReadyForConfirmation --> [*]
  class Active derived
  class EvidenceSubmitted derived
  class PartiallyApproved derived
```

While the derived overlays are showing, the on-chain state remains `Accepted` — so the cancel/expire/dispute transitions in act 3 apply to all of them. The two delivery styles by kind: **DomainImpact** runs the full Work → WorkApproval rail with per-action required counts (`requirementIndex` credits exactly one requirement per approval — amendment 2026-07-18); **SupportService / StewardCaptured / SeasonCampaign** seeded with no work requirement go through path (b), where the counterparty's confirmation IS the review (D3).

#### D6c. Act 3 — Resolution (confirmation, endings, disputes, reconciliation)

```mermaid
stateDiagram-v2
  classDef derived fill:#f6ecdc,stroke:#b98a3e
  Reconciled: Reconciled (derived)
  [*] --> Accepted
  Accepted --> ReadyForConfirmation : act 2
  ReadyForConfirmation --> Fulfilled : confirmFulfillment reaches threshold N / steward fallback with reason
  Accepted --> Cancelled : cancelCommitment (steward) — committed units released
  Accepted --> Expired : expireCommitment
  ReadyForConfirmation --> Expired : expireCommitment
  Accepted --> Disputed : raiseDispute(reasonCID)
  ReadyForConfirmation --> Disputed : raiseDispute(reasonCID)
  Expired --> Disputed : raiseDispute(reasonCID)
  Disputed --> Accepted : resolveDispute (RestorePrevious)
  Disputed --> ReadyForConfirmation : resolveDispute (RestorePrevious)
  Disputed --> Expired : resolveDispute (RestorePrevious or Expired)
  Disputed --> Fulfilled : resolveDispute (never from pre-dispute Expired)
  Disputed --> Cancelled : resolveDispute (Cancelled)
  Fulfilled --> Reconciled : CycleClosed
  Cancelled --> Reconciled : CycleClosed
  Expired --> Reconciled : CycleClosed
  class Reconciled derived
```

The module stores `preDisputeState` before entering `Disputed`; `RestorePrevious` restores that exact state. There is no `Reconciled` dispute resolution. Unit accounting is exact:

This ledger *is* the register's `accounting-state` vocabulary — the sidecar's fourth commitment-pooling state family, whose members are `Registered`, `Committed`, `Released`, `Fulfilled`. Each bullet below names the transition that moves a class between them, and the enum is single-shot per class: a slot is claimed once and released once, which is what `ClassAccountingStateMismatch` enforces.

- create **registers** the class (`Registered`) but commits no units;
- cancellation or expiry from `Offered`/`Requested` releases nothing — the class stays `Registered`;
- acceptance **commits** units (`Committed`) and acquires one provider open-commitment slot once, regardless of `targetUnits`;
- cancellation or expiry from `Accepted`/`ReadyForConfirmation` **releases** those committed units and that one slot once (`Released`);
- fulfillment converts committed units with `fulfillUnits` (`Fulfilled`) and releases that one slot;
- raising or restoring a dispute has no unit or slot effect;
- resolving to `Fulfilled`, `Cancelled`, or `Expired` applies the same conversion/release only when units and the slot are still held; a pre-dispute `Expired` record cannot become `Fulfilled` and never releases twice.

Cycle-less commitments (`cycleId == 0`) derive `Reconciled` from `PoolClosed`; cycle-scoped terminal commitments derive it from `CycleClosed`.

## D7. Indexer entity delta (ERD)

Ten NET-NEW pooling entities, all derived exclusively from module + register events (`chainId-identifier` composite IDs). `GARDEN` is the existing entity; settlement entities are shown separately in D7b. The docs-site ERD gains this delta at ship via PRD-727 (historical label PRD-680).

**Count-safe units model**: every commitment keeps its own exact `unitLabel`, `targetUnits`, and per-commitment `approvedUnits`. Pool/cycle totals never add unlike labels. `CommitmentUnitSummary` groups only exact UTF-8 label matches (`hours` and `Hours` are distinct), while `CommitmentProviderExposure` counts concurrent accepted commitments regardless of their quantities:

- `promiseKeptRate = commitmentsFulfilled / commitmentsDue` is the only cross-commitment percentage;
- `openCommitmentCount` is a count, not a unit total, and the provider cap consumes one slot per accepted commitment;
- exact-label summaries keep `expectedUnits`, `approvedUnits`, `fulfilledUnits`, and `openUnits` for operational detail;
- active-cycle surfaces show state counts plus exact-label groups, never a synthetic mixed-unit progress rate.

#### D7.0 Entity map — names and relationships only

**How to read this**: eleven boxes and their cardinality, with no fields. Read this first to check trust and shape; the two blocks below carry the field detail. `GARDEN` is the existing entity — the other ten are NET-NEW. Nothing here is a storage layout: these are indexer read-model entities derived from module and register events.

```mermaid
erDiagram
  GARDEN ||--o| COMMITMENT_POOL : "at most one pool per garden; backfilled for pre-upgrade gardens"
  COMMITMENT_POOL ||--o{ COMMITMENT_CYCLE : "cycles"
  COMMITMENT_POOL ||--o{ COMMITMENT : "commitments"
  COMMITMENT_CYCLE |o--o{ COMMITMENT : "cycle-scoped, optional"
  COMMITMENT ||--o{ COMMITMENT_REQUIREMENT : "per-action progress rows"
  COMMITMENT_POOL |o--o{ COMMITMENT_EVENT : "audit trail; poolId is null for pool-less authority and configuration events"
  COMMITMENT_CYCLE |o--o{ COMMITMENT_EVENT : "cycle events"
  COMMITMENT |o--o{ COMMITMENT_EVENT : "commitment events"
  COMMITMENT ||--o{ COMMITMENT_CLAIM_REQUEST : "approval-gated requests"
  COMMITMENT ||--o| COMMITMENT_CLAIM_REQUEST_INDEX : "direct handler lookup"
  COMMITMENT_CLAIM_REQUEST_INDEX ||--o{ COMMITMENT_CLAIM_REQUEST : "requestIds for direct supersession"
  COMMITMENT_POOL ||--o{ COMMITMENT_UNIT_SUMMARY : "exact-label pool groups"
  COMMITMENT_CYCLE |o--o{ COMMITMENT_UNIT_SUMMARY : "exact-label cycle groups"
  COMMITMENT_POOL ||--o{ COMMITMENT_PROVIDER_EXPOSURE : "one current count per provider"
  NEED_COMMITMENT_INDEX |o--o{ COMMITMENT : "zero or many commitments for one non-zero needUID"
```

#### D7.1 Commitment core — pool, cycle, commitment, requirements, audit

**How to read this**: the six entities carrying a commitment's own identity, state, and accounting. Every field is event-derived; derived overlays such as `Active` and `PartiallyApproved` are computed in shared selectors and never stored.

```mermaid
erDiagram
  GARDEN ||--o| COMMITMENT_POOL : "at most one pool per garden; backfilled for pre-upgrade gardens"
  COMMITMENT_POOL ||--o{ COMMITMENT_CYCLE : "cycles"
  COMMITMENT_POOL ||--o{ COMMITMENT : "commitments"
  COMMITMENT_CYCLE |o--o{ COMMITMENT : "cycle-scoped, optional"
  COMMITMENT ||--o{ COMMITMENT_REQUIREMENT : "per-action progress rows"
  COMMITMENT_POOL |o--o{ COMMITMENT_EVENT : "audit trail; poolId is null for pool-less authority and configuration events"
  COMMITMENT_CYCLE |o--o{ COMMITMENT_EVENT : "cycle events"
  COMMITMENT |o--o{ COMMITMENT_EVENT : "commitment events"

  GARDEN {
    ID id "chainId-address"
    Int chainId "required on every entity"
    String address "normalized garden account"
  }

  COMMITMENT_POOL {
    ID id "chainId-poolId"
    String garden "garden account address"
    CommitmentPoolType poolType "GARDEN or PROTOCOL"
    CommitmentPoolState state "NOT_READY to COMPOSTED, the D4 vocabulary"
    BigInt providerOpenCommitmentCap "non-zero concurrent-count readiness gate"
    BigInt openCommitmentCount "accepted commitments not released or fulfilled"
    BigInt commitmentsDue "accepted minus cancelled"
    BigInt commitmentsFulfilled "numerator for promiseKeptRate"
  }

  COMMITMENT_CYCLE {
    ID id "chainId-cycleId"
    CommitmentCycleType cycleType "SEASON or CAMPAIGN"
    CommitmentCycleState state "on-chain vocabulary only; InProgress-Reviewing derived"
    Int gardenersBps "allocation snapshot from CycleOpened; 10000 bps = 100%"
    Int treasuryBps "garden-regeneration share; 1500-2000 bps floor guidance"
    Int operatorBps "steward share of the cycle certificate"
    Int evaluatorBps "evaluator share"
    Int communityBps "community share"
    Int funderBps "funder share"
  }

  COMMITMENT {
    ID id "chainId-commitmentId"
    String creator "social source of the promise"
    String recordedBy "differs for StewardCaptured: steward as scribe"
    String counterparty "null until accepted"
    String provider "Offer creator or Request counterparty"
    String providerGarden "EAS recipient and role scope"
    CommitmentDirection direction "OFFER or REQUEST"
    CommitmentKind commitmentType "DOMAIN_IMPACT, SUPPORT_SERVICE, OPERATOR_CAPTURED, SEASON_CAMPAIGN"
    CommitmentOnchainState state "derived overlays computed in shared selectors"
    CommitmentClaimType claimType "INDIVIDUAL or GARDEN eligibility"
    CommitmentClaimMode claimMode "OPEN or APPROVAL_GATED"
    Int domains "optional array, unique, max 4"
    BigInt requiredActionUIDs "optional array, positional with domains"
    Int requiredApprovedWorkCounts "per-action quotas, positional (amendment 2026-07-18)"
    Int approvedWorkCounts "per-action counters, positional"
    Boolean requiresAssessment "creation fact"
    String metadataCID "creation terms"
    String needUID "optional community Need this promise answers"
    String unitLabel "exact stored bytes define summary identity"
    BigInt targetUnits "class quota in unitLabel units, immutable at creation"
    BigInt approvedUnits "per-commitment only"
    Int confirmationCount "recorded confirmations"
    String confirmers "resolved eligible group"
    Int confirmationThreshold "N of named group; 1 under counterparty default"
  }

  COMMITMENT_REQUIREMENT {
    ID id "chainId-commitmentId-requirementIndex"
    Int requirementIndex "position in requiredActionUIDs"
    Int domain "positional domains entry"
    BigInt actionUID "the required action"
    Int requiredCount "approved works needed for this action"
    Int approvedCount "credited by ApprovedWorkCounted requirementIndex"
  }

  COMMITMENT_EVENT {
    ID id "chainId-txHash-logIndex"
    CommitmentEventType eventType "one row per event"
    BigInt poolId "nullable for every pool-less authority/config event"
    String actor "nullable; explicit event field only"
    Int configurationKey "dependency/schema ordinal; nullable"
    String previousValue "normalized address/bytes32/bool"
    String newValue "normalized address/bytes32/bool"
    BigInt units "UNITS_COMMITTED / UNITS_RELEASED / UNITS_FULFILLED rows only"
    String data "reason / CID / payoutRef"
    Int timestamp ""
  }
```

#### D7.2 Claims, counts, and lineage

**How to read this**: the five entities that exist so a handler never scans the database — claim-request rows plus their direct index, the exact-label unit summaries, the per-provider concurrent count, and the Need lineage index. `COMMITMENT`, `COMMITMENT_POOL`, and `COMMITMENT_CYCLE` appear here as bare boxes; their fields are in D7.1.

```mermaid
erDiagram
  COMMITMENT ||--o{ COMMITMENT_CLAIM_REQUEST : "approval-gated requests"
  COMMITMENT ||--o| COMMITMENT_CLAIM_REQUEST_INDEX : "direct handler lookup"
  COMMITMENT_CLAIM_REQUEST_INDEX ||--o{ COMMITMENT_CLAIM_REQUEST : "requestIds for direct supersession"
  COMMITMENT_POOL ||--o{ COMMITMENT_UNIT_SUMMARY : "exact-label pool groups"
  COMMITMENT_CYCLE |o--o{ COMMITMENT_UNIT_SUMMARY : "exact-label cycle groups"
  COMMITMENT_POOL ||--o{ COMMITMENT_PROVIDER_EXPOSURE : "one current count per provider"
  NEED_COMMITMENT_INDEX |o--o{ COMMITMENT : "zero or many commitments for one non-zero needUID"

  COMMITMENT_CLAIM_REQUEST {
    ID id "chainId-commitmentId-claimant"
    Int chainId "required"
    BigInt commitmentId "relationship key"
    String claimant "normalized address"
    String requestedBy "authenticated caller; differs for Garden claims"
    CommitmentClaimType claimType "INDIVIDUAL or GARDEN"
    String gardenContext "stored request / eligibility context"
    String gardenContextId "chainId-address relationship"
    Int requestedAt "event timestamp"
    CommitmentClaimRequestState state "PENDING ACCEPTED DECLINED SUPERSEDED"
    String reasonCID "decline only"
    String resolutionCode "five codes — enumerated in D11b"
    Int resolvedAt "nullable"
  }

  COMMITMENT_CLAIM_REQUEST_INDEX {
    ID id "chainId-commitmentId"
    BigInt commitmentId "handler lookup key"
    String requestIds "stable unique ID array"
    Int updatedAt ""
  }

  COMMITMENT_UNIT_SUMMARY {
    ID id "chainId-scope-scopeId-unitLabelHash"
    CommitmentUnitScope scope "POOL or CYCLE"
    BigInt scopeId "poolId or cycleId"
    BigInt poolId "required parent"
    BigInt cycleId "nullable for POOL scope"
    String unitLabel "exact stored UTF-8 label"
    String unitLabelHash "keccak256 exact label bytes"
    BigInt expectedUnits "accepted targetUnits in this label only"
    BigInt approvedUnits "approval deltas in this label only"
    BigInt fulfilledUnits "fulfilled units in this label only"
    BigInt openUnits "committed minus released minus fulfilled in this label only"
  }

  COMMITMENT_PROVIDER_EXPOSURE {
    ID id "chainId-poolId-provider"
    BigInt poolId "relationship key"
    String provider "normalized address"
    BigInt openCommitmentCount "current concurrent commitment count"
    Int updatedAt "event timestamp"
  }

  NEED_COMMITMENT_INDEX {
    ID id "chainId-needUID"
    String needUID "non-zero Need attestation UID"
    String commitmentEntityIds "unique composite commitment IDs"
    String cycleEntityIds "unique composite cycle IDs"
    String fulfilledCommitmentEntityIds "fulfilled lineage"
    String hypercertEntityIds "certificate lineage"
  }
```


On acceptance, the handler loads `COMMITMENT_CLAIM_REQUEST_INDEX` by `chainId-commitmentId`, marks the accepted request `ACCEPTED`, and marks every other still-pending indexed request `SUPERSEDED`. Pre-acceptance commitment cancellation or expiry uses the same indexed IDs to supersede every pending row with its resolution code. Decline updates only the named request. `ModuleUpdated` creates one pool-less `COMMITMENT_EVENT` with normalized old/new module addresses and no accounting mutation; it never invents pool `0`. No handler performs a database-wide scan, and no audit-event actor is inferred from `transaction.from`. `Garden.id` migration requires a full replay/backfill and shared-query cutover; every relationship uses `chainId-*` IDs.

Full field lists: contract-spec §8.2. The ERD intentionally shows the key identity, relationship, state, and accounting fields needed to review trust and cardinality; it is not a substitute for the canonical GraphQL block. Only `promiseKeptRate` divides across commitments. Exact-label unit rows and provider count rows remain integer event-derived facts.

## D7b. Settlement ERD

**How to read this**: `SettlementConfiguration` always identifies the exact indexed
source/executor contract and local CCIP facts. Peer selector/address/EVM identity remain nullable
and `peerConfigured = false` for an independent component rehearsal; only a verified supported
lane may populate a route-ready peer. `SettlementAccount` is the Arbitrum-owned garden account;
`SettlementGardenRoute` is its Celo Safe/Roles execution route.
`Disbursement` and `SettlementBatch` are Arbitrum-owned subjects, `SettlementMessage` stores each
command or acknowledgment by event chain and CCIP message ID, and `SettlementExecution` stores
the idempotent Celo result by execution key. The joins distinguish a Celo execution from an
Arbitrum acknowledgment without deriving an EVM chain ID from a CCIP selector or indexing raw
G$ transfers.

```mermaid
erDiagram
  SETTLEMENT_CONFIGURATION ||--o{ SETTLEMENT_MESSAGE : "local-chain transport configuration"
  SETTLEMENT_CONFIGURATION ||--o{ SETTLEMENT_EXECUTION : "executor chain config"
  SETTLEMENT_ACCOUNT ||--o| SETTLEMENT_GARDEN_ROUTE : "source identity maps to Celo route"
  SETTLEMENT_ACCOUNT ||--o{ DISBURSEMENT : "owning source garden"
  SETTLEMENT_GARDEN_ROUTE ||--o{ DISBURSEMENT : "executor garden route"
  SETTLEMENT_GARDEN_ROUTE ||--o{ SETTLEMENT_EXECUTION : "bounded Safe execution route"
  DISBURSEMENT }o--o| SETTLEMENT_BATCH : "optional immutable batch membership"
  DISBURSEMENT ||--o{ SETTLEMENT_MESSAGE : "unbatched command and acknowledgment"
  SETTLEMENT_BATCH ||--o{ SETTLEMENT_MESSAGE : "batch command and acknowledgment"
  SETTLEMENT_EXECUTION ||--o{ SETTLEMENT_MESSAGE : "command and acknowledgment IDs"

  SETTLEMENT_CONFIGURATION {
    ID id "eventChainId-settlement-config"
    Int chainId "source or executor event chain"
    String role "SOURCE or EXECUTOR"
    String localContract "indexed module or executor"
      String localRouter "immutable CCIP router"
      BigInt localChainSelector "exact CCIP identity"
      BigInt remoteChainSelector "nullable configured peer selector"
      Int remoteEvmChainId "nullable verified peer EVM chain"
      String activePeer "nullable configured remote contract"
      String previousPeer "nullable bounded predecessor during rotation"
      Int previousPeerExpiresAt "nullable; no later than rotation plus 30 days"
    Boolean peerConfigured "readiness fact"
    Boolean memberDeliveryEnabled "owner gate on individual G$ delivery; never gates Garden rewards or funding"
    Boolean paused "event-owned state"
  }
  SETTLEMENT_ACCOUNT {
    ID id "sourceChainId-garden"
    Int chainId "source chain"
    String garden "Arbitrum Garden account"
    Int accountChainId "Celo execution chain"
    String account "registered Celo Safe"
    String rolesModifier "bounded executor authority"
    String roleKey "exact bytes32 Roles key"
    String allowanceKey "exact bytes32 native allowance key"
    String recoveryOwners "exactly 3, sorted and unique; none is a current executor"
    Int recoveryThreshold "fixed at 2"
    String recoveryConfigHash "owner-set integrity"
    String permissionsConfigHash "immutable reviewed permission tree"
    Boolean active "source registration status"
  }
  SETTLEMENT_GARDEN_ROUTE {
    ID id "executorChainId-garden"
    Int chainId "executor chain"
    Int sourceChainId "Garden identity chain"
    String gardenId "sourceChainId-garden"
    String settlementAccountId "sourceChainId-garden"
    String safe "Celo Safe"
    String rolesModifier "one Roles modifier"
    String roleKey "exact bytes32 Roles key"
    String allowanceKey "exact bytes32 native allowance key"
    String permissionsConfigHash "reviewed permission tree"
    Boolean active "executor route status"
  }
  DISBURSEMENT {
    ID id "sourceChainId-disbursementId"
    BigInt disbursementId "source subject"
    String gardenId "source settlement account"
    String executorGardenId "authenticated source-chain Garden identity"
    BigInt commitmentId "nullable for funding"
    DisbursementKind kind "reward or funding"
    FundingRoute fundingRoute "none or protocol-to-garden"
    DisbursementState state "Arbitrum canonical state"
    String source "derived owning-pool Celo Safe"
    String recipient "derived member AA or garden Safe"
    String token "always the configured canonical G exact dollar"
    BigInt amount "exact-net recipient promise"
    Int failureCode "bounded authenticated failure"
    String reasonCID "cancellation reason"
    DisbursementState cancelledFromState "cancel origin"
    Int attempt "current logical attempt"
    String executionKey "current key"
  }
  SETTLEMENT_BATCH {
    ID id "sourceChainId-batchId"
    BigInt batchId "source subject"
    String disbursementEntityIds "immutable member IDs"
    DisbursementState state "atomic batch state"
    Int attempt "current logical attempt"
    String executionKey "current key"
  }
  SETTLEMENT_MESSAGE {
    ID id "eventChainId-messageId"
    String messageId "CCIP transport identity"
    String executionKey "subject relation"
    String direction "command or acknowledgment"
    Boolean isBatch "subject domain"
    BigInt subjectId "disbursement or batch ID"
    Int protocolVersion "decoded version"
    String status "transport status"
  }
  SETTLEMENT_EXECUTION {
    ID id "executorChainId-executionKey"
    String executionKey "idempotency key"
    String commandMessageId "authenticated command"
    String executorGardenId "authenticated source-chain Garden identity"
    Boolean isBatch "subject domain"
    BigInt settlementId "decoded subject ID"
    Int attempt "decoded attempt"
    SettlementExecutionStatus status "success or failed"
    Int failureCode "bounded executor result"
    String acknowledgmentMessageId "nullable until the acknowledgment is submitted"
    Boolean acknowledgmentSent "false plus a stored result is the executed, ack-pending read"
    Int acknowledgmentDeferralCode "None QuoteFailed FeeReserveLow SendFailed"
  }
```

The diagram shows all seven canonical settlement entities. Full field lists and exact handler
rules remain normative in `settlement-spec.md` §6. None are claims about currently deployed or
indexed state.

## D7c. Fulfilled-commitment Hypercert cut-over and indexer delta

**How to read this**: the existing Work-attestation certificate path stays intact for legacy work. Commitment Pooling adds a second input only after a commitment is `Fulfilled`: its immutable terms, Need lineage, approved Work/evidence, and six-share BPS class allocation are composed into the existing IPFS → Merkle → mint pipeline. The certificate indexer stores the bundle kind and Commitment/Need lineage; it does not reinterpret promise state or combine unit labels.

```mermaid
flowchart LR
  subgraph LIVE["Built / live certificate path"]
    WORK["Approved Work bundle<br/>bundleKind=WORK_LEGACY"]
    IPFS["IPFS metadata"]
    MERKLE["Merkle tree"]
    MINT["Hypercert mint"]
  end

  subgraph PLANNED["Planned / gated Commitment Pooling delta"]
    FUL["Fulfilled Commitment<br/>immutable terms + exact unitLabel"]
    LINEAGE["NeedCommitmentIndex<br/>Need UID + fulfilled lineage"]
    EVIDENCE["Approved Work + evidence links"]
    COMPOSE["Commitment certificate composer<br/>bundleKind=COMMITMENT"]
    BPS["Six BPS classes<br/>expanded to recipient allowlist"]
    HCIDX["Hypercert read-model delta<br/>commitmentIds · needUIDs · bundleKind"]
  end

  WORK --> IPFS
  FUL -->|"stored Fulfilled state"| COMPOSE
  LINEAGE -->|"indexed lineage"| COMPOSE
  EVIDENCE -->|"approved evidence"| COMPOSE
  BPS -->|"class quotas total 10,000 BPS"| COMPOSE
  COMPOSE -->|"canonical metadata"| IPFS
  IPFS --> MERKLE
  MERKLE --> MINT
  MINT -->|"mint event"| HCIDX

  classDef built fill:#E4EFE2,stroke:#426A45,color:#2A2722,stroke-width:2px
  classDef planned fill:#F4EFE6,stroke:#6E6857,color:#2A2722,stroke-width:2px,stroke-dasharray:6 4
  class WORK,IPFS,MERKLE,MINT built
  class FUL,LINEAGE,EVIDENCE,COMPOSE,BPS,HCIDX planned
```

---

## D7d. Indexer pipeline and the `Garden.id` cut-over

**How to read this**: D7 and D7b show the entities that come *out*; this shows how they are produced. Three rules govern every handler and none of them is optional: an entity is created-if-not-exists so an out-of-order event never drops a row, unit events converge regardless of arrival order because each one is an integer delta rather than a recomputed total, and no handler ever infers an actor from `transaction.from` or scans the database. The bottom lane is the one-time migration: `Garden.id` becomes a `chainId-address` composite, which is a breaking change and therefore a **full replay** with a single shared-query cutover — there is deliberately no mixed-ID period.

```mermaid
flowchart TB
  subgraph SRC["1 · Events"]
    EV1["CommitmentPoolingModule events"]
    EV2["CommitmentRegister events<br/>ClassRegistered · UnitsCommitted<br/>UnitsReleased · UnitsFulfilled"]
    EV3["SettlementModule events"]
    EV4["CeloSettlementExecutor events"]
  end

  subgraph H["2 · Envio handlers"]
    HMERGE["create-if-not-exists merge<br/>an out-of-order event never drops a row"]
    HUNITS["integer unit deltas<br/>converge in any arrival order"]
    HIDX["direct index lookup<br/>claim requests by chainId-commitmentId"]
  end

  subgraph OUT["3 · Read model"]
    E1["Pooling entities"]
    E2["Settlement entities"]
  end

  NOSCAN["No database-wide scan<br/>No actor inferred from transaction.from"]

  EV1 --> HMERGE
  EV2 --> HUNITS
  EV3 --> HMERGE
  EV4 --> HMERGE
  EV1 --> HIDX
  HMERGE --> E1
  HUNITS --> E1
  HIDX --> E1
  HMERGE --> E2
  NOSCAN -.->|"invariant on every handler"| H

  subgraph MIG["Garden.id cut-over"]
    M1["Garden.id: address"] --> M2["full replay + backfill<br/>every relationship becomes chainId-*"]
    M2 --> M3["shared-query cutover<br/>no mixed-ID period"]
  end
  E1 -.->|"breaking migration, once"| MIG

  classDef built fill:#edf3e8,stroke:#50784a,stroke-width:2px,color:#2a2722
  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  class EV1,EV2,EV3,EV4,HMERGE,HUNITS,HIDX,E1,E2,M1,M2,M3,NOSCAN planned
```

The pipeline itself is the existing Envio runtime, which is live; every box above is the planned pooling delta to it. `ModuleUpdated` creates one pool-less `COMMITMENT_EVENT` and never invents pool `0`. EAS attestations and raw Celo G$ transfers are outside this pipeline entirely — the joined Community read is composed in shared query code, not fabricated in a handler.

---

## D8. G$ funding topology, Safe recovery, and CCIP boundary

**How to read this**: canonical G$ stays on Celo. Arbitrum sends a data-only command; the Celo executor derives the Safe/token call, executes through a bounded Zodiac role, stores the outcome, and sends a data-only acknowledgment. The executor is never a Safe owner. A message timeout never creates a second payment attempt. **Three edge meanings, three arrow styles** — a thick solid arrow is G$ actually moving between accounts, a plain arrow carries a protocol message, read, or **instruction**, and a dotted arrow is an ownership relation, never a transfer. The executor's edges into the Safes are plain on purpose: it is a bounded Zodiac Roles member that *instructs* the source Safe to pay, and never custodies or funds one. The only value paths are the thick ones — HoA into the protocol Safe, protocol Safe to garden Safe, and either Safe out to members.

```mermaid
flowchart TD
  HOA["GoodDollar pool — House of Alignment<br/>G$ stream (Celo)"]
  PS["Green Goods protocol Safe (Celo, designated account)<br/>mechanism, address confirmation, and live receipt evidence pending<br/>settlement account of the PROTOCOL pool"]
  GS["Garden Celo Safes NET-NEW<br/>one per garden<br/>exactly 2-of-3 recovery"]
  MEM["Members<br/>same-address smart accounts (Celo)"]

  subgraph OWN["Each garden Safe recovery owners — ownership, not value"]
    PM["Protocol recovery multisig"]
    DM["Dev Guild recovery multisig"]
    GR["Named garden recovery delegate"]
  end
  CE["CeloSettlementExecutor<br/>CCIP receiver/sender · Zodiac Roles member<br/>never Safe owner · no arbitrary calldata"]

  subgraph ARB["Arbitrum command/ack control plane"]
    HATS["Hats<br/>steward gates"]
    CPM["CommitmentPoolingModule<br/>Fulfilled commitments"]
    SM["SettlementModule<br/>derived command · native ETH fees<br/>authenticated acknowledgment receiver"]
  end
  CCIP["Chainlink CCIP<br/>data-only both directions<br/>no token amounts"]

  HOA ==>|"G$ stream — upstream fact,<br/>not a queued action"| PS
  PS ==>|"ProtocolToGarden<br/>source + recipient derived"| GS
  PS ==>|"protocol-pool disbursements"| MEM
  GS ==>|"garden disbursements"| MEM
  CE -->|"instructs the exact-net G$ transfer<br/>bounded Zodiac Roles allowance + fee/gross caps<br/>never custodies, never funds the Safe"| PS
  CE -->|"instructs the exact-net G$ transfer<br/>bounded Zodiac Roles allowance + fee/gross caps<br/>never custodies, never funds the Safe"| GS

  HATS --> SM
  CPM -->|"Fulfilled read at queue time"| SM
  SM -->|"versioned command tuple<br/>isBatch-domain key · same-key retry"| CCIP
  CCIP -->|"authenticated command"| CE
  CE -->|"ack tuple<br/>independent retry"| CCIP
  CCIP -->|"authenticated success/failure"| SM

  PM -.->|"is a recovery owner of"| GS
  DM -.->|"is a recovery owner of"| GS
  GR -.->|"is a recovery owner of"| GS

  classDef built fill:#edf3e8,stroke:#50784a,stroke-width:2px,color:#2a2722
  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  class HOA,HATS built
  class PS,GS,MEM,CE,CPM,SM,CCIP,PM,DM,GR planned
```

The Safe owner set remains exactly protocol recovery multisig, Dev Guild recovery multisig, and one named garden recovery delegate, threshold 2. The `CeloSettlementExecutor` is installed only as the reviewed Zodiac Roles v2 member with an exact `bytes32` role key, native `WithinAllowance(allowanceKey)`, canonical G$ transfer conditions, and per-transfer/batch/fee/period caps; there is no separate Allowance Module. Every amount is an exact-net recipient promise, receiver-pays fails closed, and source/recipient balance deltas are checked. Source commands and automatic acknowledgments are sponsored from monitored native reserves; a permissionless acknowledgment retry may instead supply the exact CELO quote without reducing the reserve. Protocol-Safe inflow remains an external treasury fact; the command path models ProtocolToGarden and commitment rewards only.

## D9. Settlement sequence with failure/retry

**How to read this**: three separate concerns used to share one canvas, so they are drawn separately — the path a healthy settlement takes (D9.0), what stops a second payment when a message arrives twice (D9.1), and the three independent retry lifecycles (D9.2). Across all three: one immutable execution key, and only the authenticated success acknowledgment for the subject's **current key and attempt** turns Arbitrum state into `Confirmed`.

The signed-in app's device-local settlement attempt queues a fully derived commitment reward permissionlessly; no commitment-pool steward approval is involved. The permanent onchain commitment pointer, not IndexedDB, coordinates competing apps and prevents a second reward. **Protocol steward** below means the protocol steward or module owner and applies only to the explicit non-commitment funding exception. D13b remains the exact gate for every call. Dispatch and command retry accept the stored steward, module owner, or configured `dispatcher`; resolved settlement-steward authority applies to requeue and cancellation recovery instead. Acknowledgment retry is permissionless to anyone supplying the exact CELO fee.

#### D9.0 The healthy path — queue, dispatch, execute, acknowledge

```mermaid
sequenceDiagram
  autonumber
  participant APP as Signed-in app attempt
  actor OP as Settlement steward
  actor PST as Protocol steward
  participant SM as SettlementModule (Arbitrum)
  participant CPM as CommitmentPoolingModule
  participant AR as CCIP Router (Arbitrum)
  participant CE as CeloSettlementExecutor
  participant CR as CCIP Router (Celo)
  participant SAFE as Owning-pool Celo Safe
  participant IDX as Envio read model

  alt CommitmentReward — one fulfilled commitment
    IDX-->>APP: queue-ready Fulfilled reward + pointer state
    Note over APP,SM: before every send/retry, re-read eligibility + permanent pointer<br/>exact/terminal pointer reconciles or suppresses the local attempt
    APP->>SM: queueDisbursement(commitmentId) — permissionless/idempotent
    SM->>CPM: read canonical eligible facts for that commitment
    Note over SM,SAFE: Garden claim uses registered providerGarden Safe<br/>Individual claim uses provider AA and requires memberDeliveryEnabled
  else Funding — discretionary ProtocolToGarden seed/top-up, commitmentId is 0
    PST->>SM: queueFunding(garden, amount) — protocol steward or owner only
    Note over SM,CPM: no commitment is read because this is not an earned reward<br/>source, recipient and token derive from funding config
  end
  SM-->>IDX: DisbursementQueued ("support is queued")
  OP->>SM: dispatchDisbursement or dispatchBatch
  SM->>AR: ccipSend(command tuple, no tokens, snapshotted peer/version/gas)
  SM-->>IDX: SettlementCommandDispatched (key, messageId, peer, payloadHash)
  AR-->>CR: CCIP delivery
  CR->>CE: authenticated command
  CE->>SAFE: fixed G$ transfer/batch through Zodiac Roles native allowance
  CE-->>IDX: SettlementExecutionStored(Success) ("confirming arrival")
  Note over CE: the outcome is always stored before the acknowledgment
  CE->>CR: ccipSend(ack tuple, no tokens)
  CE-->>IDX: AcknowledgmentSent(reserveFunded)
  CR-->>AR: CCIP delivery
  AR->>SM: authenticated acknowledgment
  SM-->>IDX: SettlementAcknowledged(success=true) → Confirmed
```

#### D9.1 Idempotency — why a repeated message never pays twice

```mermaid
sequenceDiagram
  autonumber
  participant CR as CCIP Router (Celo)
  participant CE as CeloSettlementExecutor
  participant SAFE as Owning-pool Celo Safe
  participant GD as G$ token (Celo)
  participant SM as SettlementModule (Arbitrum)
  participant IDX as Envio read model

  CR->>CE: authenticated command
  alt executionKey already has a stored terminal outcome
    CE-->>IDX: DuplicateSettlementMessage
    Note over CE,SAFE: the stored outcome is reused —<br/>the Safe route is not called again
  else new executionKey
    CE->>GD: quote getFees + snapshot balances
    CE->>CE: enforce exact-net fee and gross-debit policies
    CE->>SAFE: fixed G$ transfer/batch through Zodiac Roles native allowance
    alt bounded Safe execution succeeds
      SAFE->>GD: canonical G$ transfers
      CE-->>IDX: SettlementExecutionStored(Success, originating module/version)
    else authenticated policy or bounded execution fails
      CE-->>IDX: SettlementExecutionStored(Failed, failureCode)
    end
    Note over CE: store the outcome before acknowledging, always
  end
  Note over SM,IDX: the same rule holds on the Arbitrum side —<br/>a duplicate or stale acknowledgment is emitted and ignored, never applied
  SM-->>IDX: DuplicateAcknowledgmentIgnored / StaleAcknowledgmentIgnored
```

#### D9.2 Three independent retry lifecycles

```mermaid
sequenceDiagram
  autonumber
  actor DSP as Stored steward, owner, or configured dispatcher
  actor STW as Resolved settlement steward only
  actor ANY as Anyone (permissionless)
  participant SM as SettlementModule (Arbitrum)
  participant AR as CCIP Router (Arbitrum)
  participant CE as CeloSettlementExecutor
  participant CR as CCIP Router (Celo)
  participant SAFE as Owning-pool Celo Safe
  participant IDX as Envio read model

  rect rgb(244, 239, 230)
  Note over DSP,IDX: 1 · command retry — the command may not have arrived
  DSP->>SM: retryCommand(disbursementId) / retryBatchCommand(batchId)
  SM->>AR: ccipSend(same tuple + same destination snapshot, new messageId)
  SM-->>IDX: SettlementCommandRetried (same key, same attempt, new messageId)
  Note over CE,SAFE: a duplicate executionKey reuses the stored outcome —<br/>no second G$ execution
  end

  rect rgb(244, 239, 230)
  Note over ANY,IDX: 2 · acknowledgment retry — the outcome exists but was not reported
  CE-->>IDX: AcknowledgmentDeferred(QuoteFailed / FeeReserveLow / SendFailed)
  ANY->>CE: quote + retryAcknowledgment{value: exact CELO fee}(executionKey)
  CE->>CR: resend the stored outcome
  Note over CE,SAFE: caller-funded, never consumes the reserve ·<br/>the Safe route is not called again
  end

  rect rgb(244, 239, 230)
  Note over STW,IDX: 3 · requeue — an authenticated failure earns a new attempt
  STW->>SM: requeue(disbursementId)
  SM-->>IDX: DisbursementRequeued (attempt incremented)
  Note over STW,SM: steward only — a configured dispatcher may dispatch and retry an<br/>unchanged command but may never requeue, because requeue increments the<br/>attempt and creates fresh payment authority after a failure
  end

  Note over SM,CE: a submitted-but-slow message is not a deferral and needs no retry.<br/>Delay alone never cancels, never creates an attempt, and never pays twice
```

## D10. Disbursement state machine (all module-native, on-chain)

**How to read this**: five stored states, and the one rule that governs all of them — **delivery is not confirmation**. `Dispatched` self-loops for every kind of waiting (command retry, delivery delay, Celo executed with the acknowledgment still pending), and only an authenticated acknowledgment for the current key and attempt leaves it. Cancellation is reachable from `Queued` or an authenticated `Failed`, never from `Dispatched` — lateness alone is not a terminal outcome. The diagram carries states and transitions only; the exact function names, arguments, and batch rules are in the table directly below it. D10b maps these five onto the nine states a member actually sees.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Queued : queue
  Queued --> Dispatched : dispatch command
  Dispatched --> Dispatched : retry · delay · ack pending
  Dispatched --> Confirmed : authenticated success ack
  Dispatched --> Failed : authenticated failure ack
  Failed --> Queued : requeue as a new attempt
  Queued --> Cancelled : cancel
  Failed --> Cancelled : cancel
  Confirmed --> [*]
  Cancelled --> [*]
```

**What each state allows**:

| State | What it means | What's allowed next | Who acts |
|---|---|---|---|
| Queued | canonical eligible facts are queued; nothing dispatched. Two distinct entry authorities: permissionless, app-driven `queueDisbursement(commitmentId)` for an indexed eligible Fulfilled reward, and `queueFunding(garden, amount)` by the **protocol steward or module owner** only for a discretionary non-commitment seed/top-up | dispatch through the frozen entrypoint (`executionKey` + `messageId`); `cancelDisbursement(unbatched disbursementId, reasonCID)`, or cancel the whole immutable batch | queueing: app settlement job / anyone for a derived commitment reward; protocol steward or owner for treasury seeding · dispatch: stored steward, module owner, or configured dispatcher · cancel: resolved settlement steward |
| Dispatched | command sent; execution or acknowledgment may still be pending | wait; retry same command; retry stored acknowledgment from Celo | resolved steward / anyone for destination ack retry |
| Confirmed | authenticated success acknowledgment for the current key/attempt received | terminal — “support arrived” | Celo executor through CCIP |
| Failed | authenticated current execution-failure acknowledgment received | `requeue(disbursementId)` — **each failed member individually**, `attempt++`, as a new next attempt — or terminally cancel; the immutable failed batch is never rewritten or requeued as a batch | resolved settlement steward |
| Cancelled | withdrawn while Queued, or closed after authenticated Failed delivery, via `cancelDisbursement(disbursementId, reasonCID)` | terminal for the disbursement and commitment reward; the permanent commitment pointer prevents every fresh queue | resolved settlement steward |

For a Queued batch, the `Queued -> Cancelled` transition is
`cancelBatch(batchId, reasonCID)`: one atomic transition over the immutable member
set. `cancelDisbursement` rejects a Queued member whose `batchId != 0`, so no
partial queued-batch state can exist.

A failed Celo leg never changes Commitment Pooling state. `SettlementExecutionStored(Success)` without the Arbitrum acknowledgment derives “confirming arrival” while stored Arbitrum state remains `Dispatched`. A delivery timeout cannot cancel or create a new attempt. Cancellation is allowed from Queued or an authenticated Failed result, never from Dispatched; a Failed member may instead be explicitly requeued as a new attempt.

## D10b. Settlement status the member sees (5 stored, 9 rendered)

**How to read this**: the chain stores five states; the member surface (W2) renders nine. This is the map between them, and the reason the two vocabularies never contradict each other. Read the middle column as the *extra input* that splits one stored state into several rendered ones — Celo executor events and a delay timer. Two facts matter most: **`support-delayed` has no on-chain counterpart at all** — it is a client-side timer over the `Dispatched` timestamp and it changes no authority, no state, and no eligibility — and **only an authenticated success acknowledgment produces "support arrived"**. Nothing a human observes, and no elapsed time, can move a member into the arrived state.

```mermaid
flowchart LR
  subgraph ON["Stored on Arbitrum (D10)"]
    Q["Queued"]
    D["Dispatched"]
    C["Confirmed"]
    F["Failed"]
    X["Cancelled"]
  end

  subgraph UI["Rendered to the member"]
    S1["support-queued<br/>“support is queued”"]
    S2["support-en-route<br/>“support on its way”"]
    S3["support-delayed<br/>“taking longer than usual”"]
    S4["support-executed<br/>“confirming arrival”"]
    S5["support-confirming<br/>“confirming arrival”"]
    S6["support-arrived<br/>“support arrived”"]
    S7["support-failed"]
    S8["support-cancelled-queued<br/>“withdrawn before sending”"]
    S9["support-cancelled-failed<br/>“closed after a failed attempt”"]
  end

  Q -->|"stored"| S1
  D -->|"stored"| S2
  D -->|"client delay timer only —<br/>no state change, no authority change"| S3
  D -->|"SettlementExecutionStored"| S4
  D -->|"AcknowledgmentSent, not yet received"| S5
  C -->|"authenticated success only"| S6
  F -->|"authenticated failure"| S7
  X -->|"cancelledFromState = Queued"| S8
  X -->|"cancelledFromState = Failed"| S9

  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  classDef derived fill:#f6ecdc,stroke:#b98a3e,stroke-width:2px,color:#2a2722
  class Q,D,C,F,X,S1,S2,S6,S7,S8,S9 planned
  class S3,S4,S5 derived
```

Amber marks everything derived rather than stored; the arrow label is the derivation input. `support-executed` and `support-confirming` share the same member-facing sentence deliberately: the member does not need to distinguish "the Celo transfer happened" from "we are waiting for the receipt", only that arrival is not yet certified. Settlement-record-first precedence applies throughout — the settlement record, never the commitment state, determines which of the nine renders.

## D11. Approval-gated claim request, decline, acceptance, and supersession

**How to read this**: two people want the same commitment. Each `claimCommitment` stores its own PendingClaim (the on-chain commitment state does not move). The steward may decline one claimant without touching the others, or accept one — at which point every other pending request reads as superseded. Declines and supersessions carry distinct member-facing meanings via `resolutionCode`.

```mermaid
sequenceDiagram
  autonumber
  actor A as Claimant A
  actor B as Claimant B
  actor OP as Commitment-pool steward
  actor ANY as Anyone (permissionless)
  participant M as CommitmentPoolingModule
  participant IDX as Envio read model
  participant RI as CommitmentClaimRequestIndex

  A->>M: claimCommitment(id, kind, gardenContext)
  M-->>IDX: ClaimRequested(id, claimantA, requestedByA, kind, gardenContext, requestedAt)
  IDX->>RI: append request A to chainId-id index
  B->>M: claimCommitment(id, kind, gardenContext)
  M-->>IDX: ClaimRequested(id, claimantB, requestedByB, kind, gardenContext, requestedAt)
  IDX->>RI: append request B
  alt steward declines A
    OP->>M: declineClaim(id, A, reasonCID)
    Note over M,IDX: clear only A's stored PendingClaim
    M-->>IDX: ClaimDeclined(id, A, reasonCID)
    Note over IDX,RI: A=DECLINED and B remains PENDING
  else steward accepts B
    OP->>M: acceptClaim(id, B)
    Note over M,IDX: consume B's stored claimant, requestedBy, kind,<br/>gardenContext, requestedAt, and active terms —<br/>then derive provider and providerGarden
    M-->>IDX: CommitmentAccepted(id, B, counterparty, kind, gardenContext, provider, providerGarden)
    IDX->>RI: load request IDs by chainId-id
    Note over IDX,RI: B=ACCEPTED and every other<br/>pending request=SUPERSEDED
  end
  opt separate path: commitment cancelled or expired before acceptance
    OP->>M: cancelCommitment(id, reasonCID) — creator or steward before acceptance
    ANY->>M: expireCommitment(id) — permissionless once past due
    M-->>IDX: CommitmentCancelled or CommitmentExpired
    IDX->>RI: load request IDs by chainId-id
    Note over IDX,RI: every pending row=SUPERSEDED<br/>resolutionCode names cancellation or expiry
  end
```

There is no numeric sentinel or database-wide query. A later request after a decline is a fresh active request with a new timestamp; acceptance is deterministic because it cannot substitute caller-provided terms. Superseded copy distinguishes another accepted provider from commitment cancellation/expiry through `resolutionCode`.

## D11b. Claim-request state machine

**How to read this**: D11 is the choreography between people; this is the machine each individual request runs. One request per claimant, four states. A `PENDING` row holds its own stored terms and moves no commitment state. Every terminal state carries a `resolutionCode` so the member sees *why* it ended rather than just that it did — the machine below shows the shape, and the table under it names the code and the sentence each one produces.

Note the state a claim request never has: there is no "withdrawn". A claimant does not retract a request — it resolves when the steward acts or when the commitment ends.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> PENDING : claimCommitment (ApprovalGated only)
  PENDING --> ACCEPTED : acceptClaim
  PENDING --> DECLINED : declineClaim
  PENDING --> SUPERSEDED : commitment accepted, cancelled, or expired
  ACCEPTED --> [*]
  DECLINED --> [*]
  SUPERSEDED --> [*]

  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  class PENDING,ACCEPTED,DECLINED,SUPERSEDED planned
```

| End state | `resolutionCode` | What the member is told |
|---|---|---|
| `ACCEPTED` | `CLAIM_ACCEPTED` | this request was taken up; `acceptClaim` consumed the stored terms exactly once |
| `DECLINED` | `CLAIM_DECLINED` + steward `reasonCID` | the steward declined this request, with a reason; only this claimant is cleared |
| `SUPERSEDED` | `COMMITMENT_ACCEPTED` | someone else was accepted |
| `SUPERSEDED` | `COMMITMENT_CANCELLED` | the commitment was withdrawn before acceptance |
| `SUPERSEDED` | `COMMITMENT_EXPIRED` | the commitment passed its due date before acceptance |

A `DECLINED` row is never reopened: a later request from the same claimant is a fresh `PENDING` row with a new timestamp. Supersession is written by the indexer, not the contract: acceptance, cancellation, and expiry each load the request IDs through `CommitmentClaimRequestIndex` and mark every still-`PENDING` sibling in one bounded pass. `ClaimMode.Open` commitments never create a row here — the claim is immediate and the commitment moves straight to `Accepted` (D2.1).

## D12. Protocol-to-garden funding route

**Protocol-pool parity amendment (Decision Log #30)**: this section now draws both the ordinary
earned-reward entry and the narrower discretionary treasury entry that share the route.

**How to read this**: the topology treats a verified House of Alignment stream into the protocol
Safe as an upstream treasury fact that Green Goods never queues, executes, or verifies. Its
mechanism, receiving-address confirmation, and live receipt evidence remain pending. The planned
root-garden protocol pool otherwise behaves like every garden pool: an indexed eligible Fulfilled
`CeloSettlement` commitment becomes queue-ready and a signed-in app may submit the normal derived
reward call through a device-local attempt coordinated by the permanent pointer. `queueFunding` is the narrower treasury exception for a discretionary seed or
top-up that is not earned by a commitment. Both routes share the same CCIP command → bounded Celo
execution → acknowledgment discipline as D9 and cannot be enabled until the production Safe/Zodiac
route is approved.

```mermaid
sequenceDiagram
  autonumber
  actor HOA as GoodDollar House of Alignment
  actor OP as Protocol steward
  participant CPM as CommitmentPoolingModule
  participant IDX as Envio read model
  participant APP as Signed-in app attempt
  participant SM as SettlementModule (Arbitrum)
  participant CCIP as CCIP routers
  participant CE as CeloSettlementExecutor
  participant PS as GG protocol Safe (Celo)
  participant DST as Derived Garden Safe or member AA

  HOA->>PS: G$ stream lands in the protocol Safe (upstream fact)
  alt Fulfilled protocol-pool commitment reward
    CPM-->>IDX: Fulfilled with CeloSettlement reward
    IDX-->>APP: queue-ready commitment + no historical pointer
    APP->>IDX: re-read eligibility and permanent pointer
    APP->>SM: queueDisbursement(commitmentId)
    SM->>CPM: derive source, beneficiary, token and amount
    Note over SM,DST: Garden uses providerGarden Safe without member AA gate<br/>Individual uses provider AA with memberDeliveryEnabled
  else Discretionary non-commitment garden seed or top-up
    OP->>SM: queueFunding(garden, amount)
    Note over SM,DST: protocol steward or module owner only<br/>not the protocol-pool reward path
  end
  SM->>CCIP: data-only command
  CCIP->>CE: authenticated command
  CE->>PS: execute bounded canonical-G$ transfer
  PS->>DST: canonical G$ arrives at derived beneficiary
  CE->>CCIP: stored outcome acknowledgment
  CCIP->>SM: authenticated success/failure acknowledgment
```

If the Celo AA/paymaster spike fails, Garden-claim rewards and discretionary Safe-to-Safe garden
seeding remain available while `memberDeliveryEnabled` stays false. Individual rewards and member
sends remain blocked. There is no garden-custody member-claim fallback.

## D13. Capability responsibility summary

**How to read this**: this is a capability summary for audience orientation, not the function-level authorization source. One row appears per capability-bearing role and one column per capability group — ✓ means the role may act within the listed scope, — means no access, ✗ marks an enforced prohibition. "Garden steward" = holder of the garden's operator/owner Hats; the protocol pool resolves stewardship to the root garden. The scoped executor is the `CeloSettlementExecutor` contract itself, never a human steward or Safe owner. D13b carries the exact function-level permission table.

| Role | Pool & cycle control | Create / claim promises | Evidence & work | Approve work | Confirm fulfillment | Queue & execute value | Confirm settlement | Configure protocol |
|---|---|---|---|---|---|---|---|---|
| **Module owner** | ✓ fallback steward | — | — | — | — | ✓ queue protocol funding · dispatch/retry within frozen routes | — | ✓ pause · peer/module wiring · measured limits · UUPS upgrade |
| **Garden steward** | ✓ seed / open / pause / compost · accept / decline claims | ✓ seed SeasonCampaign · StewardCaptured (`onBehalfOf`) | ✓ attach for members | ✓ WorkApproval (existing flow) | fallback only, with reason, never as provider | ✓ permissionless derived-reward queue like any signed-in caller · dispatch/retry/requeue/cancel only within resolved settlement scope | — | — |
| **Member / gardener** | — | ✓ own Offer / Request · claim open commitments | ✓ own evidence · link work | — | ✓ when eligible confirmer | — | — | — |
| **Accepted provider** | — | — | ✓ deliver + evidence | — | ✗ never own delivery | — | — | — |
| **Evaluator** | — | — | ✓ assessments (baseline / delta / technical) | — | ✓ when named confirmer | — | — | — |
| **Community member** | — | ✓ needs + signals (Community PWA) | ✓ testimony | — | ✓ when named confirmer | — | — | — |
| **CeloSettlementExecutor (Zodiac Roles member)** | — | — | — | — | — | ✓ typed canonical-G$ transfer only | ✓ sends CCIP acknowledgment | — |
| **Recovery owner (2-of-3)** | — | — | — | — | — | ✗ execution | — | ✓ recover / rotate Safe modules only |
| **CCIP routers** | — | — | — | — | — | — | transports authenticated protocol messages only | — |
| **Envio read model (handlers)** | — | — | — | — | — | — | — | read model from explicit event fields only |

**Hard prohibitions (the red lines)**:

- No provider may confirm their own delivery — including through steward fallback.
- No recovery owner may be a Safe executor, and no executor may be a recovery owner; deployment
  and registration-time verification both reject overlap.
- No human report, timeout, or Celo transfer log can mark a source attempt `Confirmed` or `Failed`; only the authenticated Celo executor acknowledgment can do so.
- No handler infers an actor from `transaction.from`.
- No contract enumerates all cycles or claims to make a transition.

**Capability separation (why value stays bounded)**:

```mermaid
flowchart LR
  OWN["SettlementModule owner<br/>queues / dispatches / pauses"] -->|"data-only command"| SM["SettlementModule"]
  SM -->|"CCIP command"| EX["CeloSettlementExecutor<br/>typed G$ route only"]
  EX -->|"CCIP acknowledgment"| SM
  RO["Recovery owners<br/>rotate Safe modules, never executor owners"] -->|"reviewed no-overlap gate"| EX
```

The Arbitrum module owner and the Celo executor owner are separate implementation roles. The production route must prove that the Celo executor is a narrowly scoped Zodiac Roles member, never a Safe owner; external Safe authority configuration remains a Release gate. No human capability or timeout can certify a source settlement outcome.

## D13b. Exact sensitive-action permission table

**How to read this**: the function-level authorization source, and the only place in this file that is exact about who may call what. A caller must satisfy **both** the named role **and** every listed gate — a broad capability in D13 never widens a row here, and where a sequence diagram and this table disagree, this table wins. Rows are grouped in lifecycle order: pool and cycle control, then commitments, then settlement, then configuration and upgrades.

This table is the Architecture-tab copy of the two canonical permission matrices in `contract-spec.md` and `settlement-spec.md`.

| Function or family | Authorized caller | Non-negotiable gate |
|---|---|---|
| `onGardenMinted` | GardenToken only | Idempotent; creates one Garden pool in NotReady |
| `registerPool` | Protocol: module owner; Garden: garden operator/owner or module owner | One pool per garden |
| `setPoolCharter`, `markPoolReady` | Resolved pool steward | Ready requires non-empty charter and a previously configured non-zero provider open-commitment cap; Baseline remains an app preflight |
| `openPool`, `pausePool`, `resumePool`, `closePool`, `compostPool`, `reopenPool` | Resolved pool steward | Exact D4 transition; pause reason mandatory |
| `seedCycle`, `openCycle`, `closeCycle`, `compostCycle`, `cancelCycle` | Resolved pool steward | Exact D5 transition; allocation exists only on open and totals 10,000 BPS; cancel reason mandatory |
| `createCommitment` | Pool member for own Offer/Request; steward for SeasonCampaign/StewardCaptured; root steward or owner in protocol pool | Pool/cycle accepts; stored authorship and `onBehalfOf` determine provider; DomainImpact arrays are valid |
| `setDeclaredReward`, `setConfirmerRule` | Resolved pool steward | Pre-acceptance only; named confirmer input is bounded by `MAX_CONFIRMERS = 32` before mutation |
| `claimCommitment` | Garden member; or protocol-pool garden operator/owner / individual garden member according to stored `claimType` | Runtime kind equals stored type; canonical claimant and `requestedBy` are derived, not substituted |
| `acceptClaim`, `declineClaim` | Resolved pool steward | Named pending claimant exists; acceptance consumes stored terms and one provider count slot; decline reason mandatory |
| `linkWork` | Accepted canonical claimant/counterparty or steward | Accepted; schema/action/provider authorship/provider-garden recipient checks pass |
| `unlinkWork`, `syncApprovedWork` | Resolved pool steward | Unlink only before counting; sync verifies EAS and dedupes |
| `onWorkApproved` | WorkApprovalResolver only | Non-blocking; unlinked/already-counted approval is a no-op |
| `attachEvidence` | Creator, counterparty, or steward | Commitment state allows attachment; offline-queueable |
| `attachAssessment` | Steward or evaluator of `providerGarden` | Resolver/schema/kind/recipient valid; Ready predicate re-evaluated |
| `submitForConfirmation` | Creator, counterparty, or steward | Evidence-only eligible kind; no Work requirement; evidence and declared assessment present |
| `markReadyForConfirmation` | Resolved pool steward | Override reason mandatory and emitted |
| `confirmFulfillment` | Named confirmer, Offer counterparty, or Request creator | ReadyForConfirmation; provider excluded; once per confirmer |
| `confirmFulfillmentAsFallback` | Resolved pool steward | Mandatory reason; provider-steward excluded |
| `cancelCommitment` | Creator or steward before acceptance; steward after acceptance | Allowed state only; accepted record releases units and one slot once |
| `expireCommitment` | Anyone | Past due date/cycle end; accepted record releases units and one slot once |
| `raiseDispute`, `resolveDispute` | Creator/counterparty/named confirmer/steward may raise; steward resolves | Allowed state and mandatory reason; prior slot state preserved; expired prior state cannot resolve Fulfilled |
| `recordRewardPaid` | Resolved pool steward | Fulfilled; `reward.rail == ArbitrumExternal`; one record; earned-reward facts derive from storage; every other rail reverts |
| `setGardenToken`, `setHatsModule`, `setActionRegistry`, `setCommitmentRegister`, `setWorkApprovalResolver`, `setEAS`, `setSchemaUIDs` | Module owner | Module initialized paused and must remain paused for dependency/schema changes; dependencies reject zero; all four schema UIDs reject zero/collision; every real change emits old/new facts |
| Pooling-module `setPaused` | Module owner | Pause always available; unpause requires every dependency plus four non-zero, pairwise-distinct schema UIDs |
| `setProviderOpenCommitmentCap` | Resolved pool steward | Non-zero concurrent commitment count; module forwards to the register; required before Ready |
| `registerClass`, register `setProviderOpenCommitmentCap`, `commitUnits`, `releaseUnits`, `fulfillUnits` | Commitment Pooling module only | Class quota is immutable; zero caps revert; slot changes are single-shot/state-guarded and bounded, and repeated calls revert before mutation |
| Register `setModule`; pooling/register/resolver `_authorizeUpgrade` | Respective protocol-multisig owner | Register zero→non-zero wiring is one-time; later module replacement requires current pooling module paused and emits old/new; owner-only UUPS path |
| Assessment v3, Community Testimony, Need, NeedSignal, NeedStatus, FundingAttribution attestations | Exact evaluator/steward/community/funder attester named by the resolver matrix. **Assessment authorship split**: Baseline by evaluator **or** operator; delta, re-assessment, and technical by Evaluator Hat only; community testimony by Community Hat only | Resolver-specific Hat, schema, recipient, reference, and receipt checks |
| Assessment config: existing `setSchemaUID`, existing `setKarmaGAPModule`, new `setAssessmentV3SchemaUID` | Existing AssessmentResolver owner (protocol multisig) | v2 selector/event and the deployment-window zero value stay compatible; KarmaGAP zero disables its optional hook; v2/v3 UID equality is rejected; the v3 UID rejects zero and emits old/new |
| Community Testimony config: `setSchemaUID`, `setCommitmentModule` | CommunityTestimonyResolver owner (protocol multisig) | UID rejects zero, pins once, treats an exact repeat as a no-op, and rejects conflict; module rejects zero and an unpinned UID. Preparation pins the deterministic UID while module is zero, finalization reconciles the exact EAS record, and verified module activation is last |
| `registerSettlementAccount`, `updateSettlementRecovery`, `setAccountActive` | Steward or `SettlementModule` owner | Registration is write-once for garden/account/Roles modifier/`roleKey`/`allowanceKey` and the immutable permissions hash; `chainId == DESTINATION_EVM_CHAIN_ID()`; the three recovery owners are sorted, unique, non-zero, and **none is a current executor**; threshold fixed at 2. A recovery update may change only owners and the recovery hash. Replacing the immutable target/selector/condition tree requires a paused new executor/route registration and re-verification |
| `setMemberDeliveryEnabled` | `SettlementModule` owner | Enabling requires the recorded Celo AA/paymaster exit evidence; disabling blocks new **Individual** commitment-reward queues and member sends but never blocks Garden-claim rewards or the funding route |
| `queueDisbursement` | Anyone; normally a signed-in app's per-user/per-device `settlement` attempt | Module unpaused; indexed Fulfilled commitment; `reward.rail == CeloSettlement`; canonical G$ source/token/non-zero amount; active owning-pool source account; Individual derives provider AA and requires `memberDeliveryEnabled`, while Garden derives active providerGarden Safe without that gate; no caller-selected recipient/token/amount; every attempt re-reads the permanent pointer, reconciles a competing exact pointer, and suppresses every terminal pointer |
| `queueFunding` | Protocol steward or `SettlementModule` owner | Discretionary non-commitment ProtocolToGarden seed/top-up only; active source/destination accounts; no caller-selected token/Safe/target/calldata; never the normal protocol-pool commitment reward path |
| `createBatch` | Resolved settlement steward for the immutable executor garden | Unique Queued members share executor garden/source/token/kind/funding route; membership is immutable; measured configured limit is non-zero and at or below hard ceiling 24 |
| `dispatchDisbursement`, `dispatchBatch`, `retryCommand`, `retryBatchCommand` | Stored steward, `SettlementModule` owner, or configured dispatcher | Frozen data-only payload; adequate native fee reserve; initial dispatch snapshots destination selector/executor/gas/version/payload hash; retry preserves the snapshot, attempt, execution key, and payload while producing only a new message ID |
| `requeue` | Resolved settlement steward | Authenticated `Failed` member only; increments the individual attempt; immutable failed batch is never rewritten |
| `cancelDisbursement` | Resolved settlement steward | unbatched `Queued` or authenticated `Failed` only, with reason; dispatched work cannot be cancelled for a timeout or missing acknowledgment |
| `cancelBatch` | Resolved batch steward | whole immutable batch while `Queued`, with reason; no partial-member cancellation |
| `fundFees` / `withdrawExcessFees` | Anyone / `SettlementModule` owner | Native ETH only; owner withdrawal preserves the configured reserve minimum |
| Celo `fundAcknowledgmentFees` / `withdrawExcessAcknowledgmentFees` | Anyone / `CeloSettlementExecutor` owner | Native CELO only; guarded withdrawal preserves the onchain acknowledgment reserve minimum |
| `setCcipRoute`, `setBatchSizeLimit`, `setDispatcher`, `setFeeReserveMinimum` | `SettlementModule` owner **behind the deployment timelock** | All four require pause. Route: immutable implementation router unchanged, non-zero values, same-selector/same-version rotation may store one prior peer expiring no later than +30 days; selector or version change requires a drained cutover with zero grace. Batch limit 0–24 (zero disables batching) and source/destination limits must match before any non-zero release. Zero dispatcher disables delegated dispatch, and a dispatcher may dispatch/retry only. A new fee floor is immediately observable and every dispatch/retry/withdrawal must preserve it |
| Dependency wiring (`setHatsModule`, `setCommitmentPoolingModule`), `setPaused`, `_authorizeUpgrade` | `SettlementModule` owner (no timelock) | Initialized paused; dependencies reject zero and emit old/new only while paused; unpause requires complete route, active protocol account, and reserve floor; the router is immutable per implementation and replacement requires disposition of old-router in-flight messages plus a verified UUPS implementation upgrade |
| `configureGardenRoute`, amount/fee/period-cap setters, reserve/peer-rotation setters, `setPaused` | `CeloSettlementExecutor` owner | Initialized paused; configuration requires pause; unpause requires source peer, caps, period policy, and reserve floor; Safe/Role changes require live one-to-one Safe, avatar/target, executor membership, exact `bytes32` role/allowance keys, reviewed permissions hash, and non-owner proof; fee policy uses both absolute and BPS limits; one previous peer may expire after a bounded grace period; no mutable router setter |
| Celo command receive | Immutable implementation CCIP router only | Exact active/unexpired Arbitrum selector/sender peer, versioned tuple with `isBatch`, no token amounts, one-recipient unbatched or enabled/bounded batch shape, caps; stored result includes originating module/version and prevents duplicate G$ execution |
| `retryAcknowledgment` / sponsored variant | Anyone with exact quoted CELO fee / executor owner | Stored result exists; resends use the stored originating module/version even after peer rotation; caller-funded path never consumes reserve, sponsored path preserves the onchain minimum, and neither calls the Safe route |
| Arbitrum acknowledgment receive | Immutable implementation CCIP router only | Selector/executor/version equal the command's stored destination snapshot and remain active/unexpired globally; known originating command message, empty token amounts, consistent success/bounded failure code; terminal duplicates are emitted and ignored |

## D14. Commitment offline job lifecycle

**How to read this**: offline-safe writes are explicit local jobs, not optimistic state mutations. The five field jobs may wait for the required membership Hat indefinitely without spending a retry. The sixth `settlement` kind is a per-user, per-device submission attempt: it bypasses Hat waiting, is created only from indexed queue-ready facts, and coordinates globally through the permanent onchain commitment pointer. A local fifth failure exhausts only that device's attempt. Manual retry always re-enters the eligibility/pointer check.

```mermaid
stateDiagram-v2
  direction LR
  waiting_for_hat: waiting_for_hat — UI label "Waiting for membership"
  settlement_check: settlement eligibility + permanent-pointer check
  settlement_blocked: blocked — no local attempt or retry
  settlement_queued: device-local settlement attempt queued
  settlement_syncing: submitting permissionless queueDisbursement
  settlement_retryable: local retryable failure
  settlement_exhausted: local attempt exhausted
  settlement_reconciled: exact winning pointer reconciled
  settlement_suppressed: terminal pointer — permanently suppressed

  [*] --> Draft : save offline-capable action
  Draft --> Queued : enqueue commitment / claim / evidence / workLink / confirmation
  Queued --> waiting_for_hat : required Hat is absent
  waiting_for_hat --> waiting_for_hat : poll or reconnect / retries unchanged
  waiting_for_hat --> Queued : membership observed
  Queued --> Syncing : network + membership ready
  Syncing --> Completed : transaction and indexed confirmation
  Syncing --> RetryableFailure : submission failed and attempts less than 5
  RetryableFailure --> Queued : retry with backoff / attempts incremented once
  Syncing --> Exhausted : fifth submission failure
  Exhausted --> Queued : manual retry
  Exhausted --> Discarded : explicit user discard
  Completed --> [*]
  Discarded --> [*]

  [*] --> settlement_check : signed-in app observes Fulfilled Celo reward
  settlement_check --> settlement_blocked : module/account/reward/route/gate prerequisite false
  settlement_blocked --> settlement_check : indexed prerequisite changes
  settlement_check --> settlement_reconciled : exact nonterminal pointer already exists
  settlement_check --> settlement_suppressed : terminal pointer already exists
  settlement_check --> settlement_queued : queue-ready + no pointer + no active queued/syncing attempt
  settlement_queued --> settlement_syncing : network ready; re-check still passes
  settlement_syncing --> settlement_reconciled : transaction indexed
  settlement_syncing --> settlement_reconciled : duplicate race; refetch exact winning pointer
  settlement_syncing --> settlement_retryable : transient submit failure; attempts less than 5
  settlement_retryable --> settlement_check : retry with backoff
  settlement_syncing --> settlement_exhausted : fifth transient submit failure
  settlement_exhausted --> settlement_check : manual retry
  settlement_reconciled --> [*]
  settlement_suppressed --> [*]

  classDef derived fill:#f6ecdc,stroke:#b98a3e,color:#2a2722,stroke-width:2px
  classDef appOnly fill:#ececec,stroke:#8a8a8a,color:#2a2722,stroke-width:2px
  class Draft,Queued,waiting_for_hat,Syncing,RetryableFailure,Exhausted,Discarded,settlement_check,settlement_blocked,settlement_queued,settlement_syncing,settlement_retryable,settlement_exhausted appOnly
  class Completed,settlement_reconciled,settlement_suppressed derived
```

Commitment creation, claim, evidence attachment, Work linking, and eligible confirmation use the membership-gated branch. The `settlement` branch is separate and never enters `waiting_for_hat`; its local key is `(chainId, commitmentId, userAddress)`, and blocked prerequisites create no attempt. The first eligible transition creates that key only when absent; backoff and manual retries reuse the existing retryable/exhausted attempt after the same readiness and pointer checks, so the local uniqueness guard never dead-ends recovery. Accept/decline, assessment attachment, steward override, dispute actions, and value transfer stay online-only because their authorization or freshness cannot be safely deferred. `waiting_for_hat` is app-only provenance, not an on-chain state and not a failed attempt. `Completed`, `settlement_reconciled`, and `settlement_suppressed` are derived from indexed chain truth, not states stored in IndexedDB as protocol truth.

---

## D15. Deployment and upgrade topology

**How to read this**: the only diagram here about *getting to* the system rather than the system itself, and the one where an ordering mistake is hardest to undo. Read the shaded band as a single invariant: **the pooling module is deployed paused and stays paused until both reverse links exist and every readiness fact passes.** Unpausing early is the exact contradiction corrections-log §23 was written to close.

Two other rules the picture encodes: every chain gate is a *rehearsal-then-mainnet* pair — Arbitrum Sepolia evidence must pass before the same sequence runs on Arbitrum One — and schema UID pinning is **one-way**, so a wrong pin is not recoverable by re-pinning.

```mermaid
flowchart TB
  subgraph C1["PR chain 1"]
    A1["Commit pre-change generated baselines<br/>AssessmentResolver · WorkApprovalResolver · GardenToken"]
    A2["Rehearse the in-place AssessmentResolver upgrade<br/>on Arbitrum Sepolia"]
    A3["Deploy CommunityTestimonyResolver<br/>register AssessmentV3 · set v3 UID · verify v2/v3 parity"]
    A4["One-way pin the Community Testimony UID<br/>while its module is still zero"]
    A1 --> A2 --> A3 --> A4
  end

  subgraph C2["PR chain 2"]
    B1["Deploy CommitmentRegister + CommitmentPoolingModule proxies<br/>initialized PAUSED"]
    B2["Wire module-side references<br/>reconcile the exact Testimony record, activate its module last"]
    B3["setSchemaUIDs — four non-zero, pairwise-distinct values"]
    B4["Verify dependency and schema events + module-side wiring"]
    B1 --> B2 --> B3 --> B4
  end

  subgraph C3["PR chain 3"]
    D1["Upgrade GardenToken (§6.3)<br/>and WorkApprovalResolver (§6.5)"]
    D2["Establish BOTH reverse links<br/>setCommitmentPoolingModule · setCommitmentModule"]
    D3["Verify updater preservation, post-upgrade storage/ownership,<br/>and both-direction wiring — while still paused"]
    D4["UNPAUSE the pooling module"]
    D5["registerPool on the root garden<br/>then backfill the 13 live gardens"]
    D1 --> D2 --> D3 --> D4 --> D5
  end

  C4["Indexer cut-in — replace zero-address placeholders<br/>in config.yaml and bump start_block"]

  REHEARSE["Arbitrum Sepolia 421614 rehearsal<br/>chain-local bytecode and code-hash proof first;<br/>never copy an 11155111 address here"]
  MAINNET["Arbitrum One 42161<br/>same sequence, only after rehearsal evidence passes"]
  ROLLBACK["Rollback point after every stage<br/>separate authorization, receipt, artifact, post-verification"]

  C1 --> C2 --> C3 --> C4
  REHEARSE -.->|"gates"| MAINNET
  MAINNET -.->|"applies to chains 1-3"| C1
  ROLLBACK -.->|"available at each stage boundary"| C3

  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  classDef paused fill:#f7ebdd,stroke:#b66a3c,stroke-width:2px,color:#2a2722
  class A1,A2,A3,A4,C4,REHEARSE,MAINNET,ROLLBACK planned
  class B1,B2,B3,B4,D1,D2,D3 paused
  class D4,D5 planned
```

Amber marks every step that runs **while pooling is paused** — the whole of chain 2 and the first three steps of chain 3. The storage-layout and UUPS proof gate (§7.4) covers all eight touched contracts and runs before any broadcast. Deployment artifacts remain the source of truth for addresses: pre-broadcast zero or missing addresses mean pending broadcast; post-broadcast they are blockers.

---

## D16. Error taxonomy — surface and recovery map

**How to read this**: errors reach people, so this taxonomy answers three questions in order — **what went wrong**, **where does someone meet it**, and **what may they do about it**. Each question gets its own view below, because the single combined graph made the last question — the one that matters most — the hardest to read. The rule the three views exist to protect: an error whose recovery is "nothing the member can do" must never be rendered as if it were retryable.

#### D16.0 The error — five families, grouped by where each one is decided

`FailureCode` is the only family that crosses the chain boundary: twelve bounded values decided on Celo, carried back through an authenticated acknowledgment, and collapsed into a small number of member-facing sentences on Arbitrum.

```mermaid
flowchart TB
  subgraph ONARB["Raised on Arbitrum"]
    E1["CommitmentPoolingModule<br/>~40 named errors<br/>state · authorization · EAS validity"]
    E2["CommitmentRegister<br/>13 named errors<br/>quota · slot · onlyModule"]
  end
  subgraph ONCELO["Decided on Celo"]
    E3["FailureCode — 12 values<br/>route · recipient · caps · fee · balance delta<br/>the only family that crosses the boundary"]
    E4["AcknowledgmentDeferralCode — 4 values<br/>None · QuoteFailed · FeeReserveLow · SendFailed<br/>the report did not go out; says nothing<br/>about whether value moved"]
  end
  subgraph INAPP["Raised in the app"]
    E5["Offline job failure<br/>5 attempts, then Exhausted"]
  end

  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  class E1,E2,E3,E4,E5 planned
```

#### D16.1 Where it manifests — each family reaches exactly one set of surfaces

```mermaid
flowchart LR
  F1["CommitmentPoolingModule errors"]
  F2["CommitmentRegister errors"]
  F3["FailureCode"]
  F4["AcknowledgmentDeferralCode"]
  F5["Offline job failure"]

  S1["Client PWA<br/>parseContractError + USER_FRIENDLY_ERRORS"]
  S2["Admin — steward console and Operations"]
  S3["Member settlement row (D10b)"]
  S4["Ops only — never member-facing"]

  F1 --> S1
  F1 --> S2
  F2 --> S2
  F3 --> S3
  F4 --> S4
  F5 --> S1

  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  class F1,F2,F3,F4,F5,S1,S2,S3,S4 planned
```

#### D16.2 How the person responds — the recovery each surface may offer

```mermaid
flowchart LR
  S1["Client PWA"]
  S2["Admin — steward console<br/>and Operations"]
  S3["Member settlement row"]
  S4["Ops only"]

  R1["Fix the input and resubmit"]
  R3["Retry the same job, or discard it"]
  R4["Requeue as a new attempt,<br/>or cancel with a reason"]
  R2["Wait — a steward or<br/>the protocol must act"]
  R5["Nothing to do — the outcome<br/>is terminal and explained"]
  R6["Retry the stored acknowledgment<br/>permissionless, caller-funded ·<br/>the Safe is not called again"]

  S1 --> R1
  S1 --> R3
  S2 --> R1
  S2 --> R4
  S3 --> R2
  S3 --> R5
  S4 --> R6

  classDef planned fill:#fbf8f2,stroke:#6e6857,stroke-width:2px,stroke-dasharray:6 4,color:#2a2722
  class S1,S2,S3,S4,R1,R2,R3,R4,R5,R6 planned
```

Three rules this taxonomy exists to enforce. A register error is a protocol invariant breach, not member input — it surfaces to the steward, never as "try again" to a gardener. `AcknowledgmentDeferralCode` is operational: it says the *report* did not go out, never that value moved or failed, so it must not appear in member copy at all — **and its recovery is retrying the stored acknowledgment, never requeue**. Requeue is reachable only from an authenticated execution *failure*; offering it after a deferral would invite a second payment attempt for an outcome that is already stored. And a `waiting_for_hat` job (D14) is not an error and consumes no attempt — it never enters this taxonomy.

---

## Appendix: Edits to EXISTING docs diagrams at ship (PRD-727 scope; historical PRD-680)

Not performed now — the docs site describes what is live. Flagged on the Linear issue so they ship with the release:

1. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Work submission and approval**: after WorkApprovalResolver validation, add the optional bridge step — `WorkApprovalResolver → CommitmentPoolingModule.onWorkApproved (try/catch, non-blocking)` with a one-line note that approvals count toward pre-linked commitments only.
2. **`docs/docs/builders/architecture/sequence-diagrams.mdx` § Assessment flow**: add the v3 authorship split — baseline by evaluator OR operator; delta/re-assessment and technical by Evaluator Hat only; community testimony (Community Hat) as its own thin sequence.
3. **`docs/docs/builders/architecture/erd.mdx`**: append the D7 entity delta and the two new contract blocks to the contract-to-indexer event mapping.
