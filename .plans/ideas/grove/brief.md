# Grove by Green Goods

**Slug:** `grove` · **Stage:** ideas · **Updated:** 2026-11-13

*Your garden’s living knowledge.*

**Coordinate locally. Govern together. Share by context. Publish by choice.**

**Linear:** [Grove — Garden Knowledge](https://linear.app/green-goods/project/grove-garden-knowledge-8582c2970974), a focused project within [Community Evidence Mesh](https://linear.app/green-goods/initiative/community-evidence-mesh-f7bdee530343). [RESR-103](https://linear.app/green-goods/issue/RESR-103/grove-by-green-goods-roadmap) remains the Backlog parent; this hub owns the implementation checkpoints. Five undated project milestones mirror A0–A4.

Grove helps place-based communities **capture → review → share** knowledge and evidence of their work. Capture on a phone or laptop, keep the source locally, review it with local AI when available, and choose what to share with named community members. Community review can produce a lesson, a report or a public contribution. Raw sources can stay private throughout.

Identity starts locally and is governed by the community. Only authorized member devices receive decryption keys; the hosting operator cannot grant itself access. **Solid is the preferred optional storage adapter**, with client-side encryption before upload; EDV remains a research alternative. Local/direct sharing needs neither. A community can later connect to ATProto/Certified, an Ethereum garden or other public destinations by choice. Neither a wallet nor a provider login is needed to begin.

The desktop extension provides capture, review and a living graph; a phone browser/PWA companion is the first mobile candidate. Dexie owns local knowledge, Pi Durable coordinates resumable processing, and Gemma supplies optional local suggestions. Direct transfer and encrypted files support device exchange. **Yjs is preferred when optional co-editing is needed**, with encrypted updates and verified writer permissions. Automerge + Keyhive remains an experimental research alternative. Existing-passkey reuse, offline unlock, device support and recovery still require proof before private use. KOI remains optional for semantic exchange.

## Read this plan

- [Two-device collaboration and passkey spike](collaboration-passkey-spike.md): Yjs versus Automerge + Keyhive; existing credential/RP reuse, offline unlock, device/credential loss and recovery. Planned, unrun.
- [Solid versus EDV comparison spike](storage-comparison-spike.md): two devices, local keys, recovery, permissions, host privacy and actual build burden.
- [Identity and role mapping](identity-role-mapping.md): separate community/member associations and scoped roles across local, Solid, ATProto/Certified and Ethereum contexts.
- [Local-first package research](local-first-options.md): Yjs, Automerge/Keyhive, Loro, RxDB and version-specific Jazz tradeoffs.
- [Community identity and encrypted sharing](community-sharing.md): current privacy, identity, key custody, storage and device-networking contract.
- [Capture → review → share diagrams](architecture-flows.md): initial flows for both knowledge and impact evidence, privacy contexts and publication gates.
- [Sharing research](sharing-research.md): Solid alternatives, inspected Coop patterns, browser limits and source-backed open questions.
- [Prototype: four parts, one loop](prototype.md): the smallest build that shows Gemma, KOI, Pi Durable and WebMCP together, with its decisions, code and demo checks.
- [Prototype architecture](prototype-architecture.md): packages, dependencies, where the code runs, module layers, the types that cross boundaries, UI components and data flows.
- [Prototype design brief](prototype-design.md): Grove as the cockpit's dialect on a graph; the shared core, the dials, the garden tone, the canvas legend, states, copy and the Storybook proof.
- [Mesh alignment and evidence boundary](mesh-alignment.md): accepted project relationship, authority mapping and conformance gates.
- [Continue in another session](handoffs/next-session.md): current state, next bounded step and portable source locations.
- [Interactive design demos](artifacts/demos/README.md): five standalone HTML studies, including public-safe TAS/Vida Verde scenarios and timelines.
- [Pi Durable execution contract](durable-execution.md): browser storage, task ownership, graph-command receipts, recovery and privacy.
- [KOI integration and evidence](koi-integration.md): partial/full-node boundary, identity, signatures, durable recovery and reuse limits.
- [Vida Verde and TAS spike](first-spike.md): public-source fixtures, walkthrough, scope and exit conditions.
- [Unified ontology proposal](ontology-alignment.md): one Grove language with traceable Green Goods and Commons meanings.
- [Learning loops and ingestion diagrams](architecture-flows.md): internal work, external knowledge, and their shared memory.
- [Dependencies by category](dependencies.md): responsibilities, reuse, candidates and deferred additions.
- [Visualizer references and design directions](visual-design.md): actual Sigma/Cytoscape screenshots and comparison.
- [Claude Code design prompt](handoffs/claude-design-exploration.md): a bounded exploration of three graph compositions.
- [Architecture and reuse](spec.md): scope, Coop and Green Goods components, ownership, ingestion and temporal contracts.
- [Implementation sequence](plan.todo.md): current community-sharing checkpoints C0–C6 and the preserved S/P/K graph/runtime baseline.
- [Acceptance gates](eval.md): domain, history, model, connection, graph, capacity and recovery criteria.
- [Execution state](status.json): idea-stage product work; a disposable G0 feasibility experiment exists, but the community-sharing layer is unbuilt.

## First success

Create a local community without a wallet. Capture a useful soil-care guide and a field observation on a phone, including source and consent context. Review them locally, pair a laptop, and explicitly share a selected encrypted copy with an authorized reviewer. The reviewer sees its origin, corrects or accepts it, and helps prepare a lesson or report. A second community receives only a newly approved summary. Reopen offline without losing the capture; show that the Pod operator and an uninvited device cannot decrypt it. No public upload is necessary for this success.

Repeat with a community learning/cultural record and with isolated Vida Verde/TAS fixtures. Reports are one possible share output. Community acceptance, evidence interpretation and protocol WorkApproval remain separate.

## Boundaries

The [24 October G0 report](reports/2026-10-24-g0-feasibility.md) proves limited synthetic desktop feasibility, not phone suitability, persistent Pi tab-close recovery or private sharing. Earlier graph/KOI prototypes remain useful baselines; the 13 November sharing contract takes precedence for identity, privacy and pilot scope. The earlier five Linear milestones have not been updated by this revision.

No dedicated hardware node or cloud inference is required. Always-on storage, sensors, live co-editing, multi-hop networking and public publication are optional later capabilities. This request updates the plan only: it does not authorize product implementation, dependency installation, deployment or external tracker changes.
