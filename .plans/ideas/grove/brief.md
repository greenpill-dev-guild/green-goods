# Grove by Green Goods

**Slug:** `grove` · **Stage:** ideas · **Updated:** 2026-11-14

*Your garden’s living knowledge.*

**Coordinate locally. Govern together. Share by context. Publish by choice.**

**Linear:** [Grove — Garden Knowledge](https://linear.app/green-goods/project/grove-garden-knowledge-8582c2970974), a focused project within [Community Evidence Mesh](https://linear.app/green-goods/initiative/community-evidence-mesh-f7bdee530343). [RESR-103](https://linear.app/green-goods/issue/RESR-103/grove-by-green-goods-roadmap) remains the Backlog parent; this hub owns the implementation checkpoints. Its five undated project milestones still mirror the earlier A0–A4 sequence and have not been reconciled with the order below.

Grove helps place-based communities **capture → review → share** knowledge and evidence of their work. People capture on a phone or a laptop, keep the source on their own device, review it by hand, and choose what to share with named members of their community. Community review can lead to a lesson, a report for a partner, or later a public contribution. Raw sources can stay private throughout. A report is one possible output; not every capture becomes an impact claim or a public record.

Identity starts on the device and is governed by the community. Nobody needs a wallet, a provider account, a model or a connection to begin. Shared records are encrypted for named members' devices, and the design requirement is that whoever stores or relays them cannot read them. That requirement is unbuilt and untested, and it covers storage and relay hosts, not Green Goods as the publisher of the app's code.

Two clients ship together: a phone web app for capture, review and sharing, and a desktop extension that adds page capture, a graph of what the community holds, and a local agent. The agent brings in relevant knowledge and resources as a person browses, guided by the focus the steward writes, and assesses each item before the person reviews it. People keep every decision. Records travel between devices as encrypted files. An existing Green Goods passkey can unlock the local vault where its provider supports that; a passphrase does otherwise.

## Read this plan

**The current contract**

- [MVP contract and decision log](spec.md): who the MVP is for, what it includes and excludes, how it is judged done, and every decision, recommendation, assumption and open question.
- [Community identity and encrypted sharing](community-sharing.md): terms, audiences, who approves, the member list, encryption, unlock, recovery and carriers.
- [Capture → review → share flows](architecture-flows.md): the four audiences and the sequences for capture, review, sharing, correction, removal, recovery and later publication.
- [Identities and roles](identity-role-mapping.md): who controls which account and key, what the passkey does, and how the six Green Goods roles relate.
- [Implementation sequence](plan.todo.md): the MVP order, each checkpoint's exit, the next lanes and research.
- [Acceptance gates](eval.md): which gates the MVP needs and what passes each.
- [Interactive architecture](artifacts/demos/grove-architecture.html): the same model as one page to step through.

**Experiments designed and not run**

- [Passkey unlock and recovery on two devices](collaboration-passkey-spike.md): an MVP gate. Its second half, a co-editing comparison, is backlog research.
- [Hosted mailbox and Solid](storage-comparison-spike.md): the next lane after the MVP.

**The laptop workspace**

- [Pi Durable execution contract](durable-execution.md): where Pi runs investigations, and what it never gates.
- [Dependencies by category](dependencies.md): roles, candidates, versions and licenses.
- [Unified ontology proposal](ontology-alignment.md), [visualizer references](visual-design.md) and the [design brief](prototype-design.md).

**Research and alignment**

- [Sharing research](sharing-research.md): standards, Coop patterns and browser limits, with sources.
- [Local-first package research](local-first-options.md): Yjs, Automerge + Keyhive, Loro, RxDB and Jazz.
- [Mesh alignment and evidence boundary](mesh-alignment.md): the relationship to Community Evidence Mesh.

**Earlier baselines, kept as history**

- [Prototype: four parts, one loop](prototype.md) and its [architecture](prototype-architecture.md): the October plan. Its investigation slice is the workspace lane; its Hub connection, KOI exchange and agent tools are next lanes.
- [Vida Verde and TAS spike](first-spike.md) and the [KOI contract](koi-integration.md).
- [G0 feasibility report, 24 October](reports/2026-10-24-g0-feasibility.md): the one experiment that has run.
- [Interactive design demos](artifacts/demos/README.md) and the [Claude Code design prompt](handoffs/claude-design-exploration.md).

**State**

- [Continue in another session](handoffs/next-session.md): current state and the next bounded step.
- [Execution state](status.json): idea stage; a disposable G0 experiment exists and nothing else is built.

## First success

A steward creates a community with no wallet. A member captures a useful soil-care guide and a field observation on a phone, with source and consent context, and reviews them by hand. They pair their laptop and carry the captures across as an encrypted file. They share a selected, encrypted copy with a reviewer, who sees where it came from and corrects it. The author approves the corrected version, and the steward sends a separately approved summary to a named partner community. Reopening offline loses nothing, and a device that was not named cannot read the file. On the laptop, the agent brings in a funding call that fits the community's focus while the member browses, and shows why it was brought in, where it came from and what to check before sharing; the member keeps it and shares it. A local AI investigation proposes a connection, survives a closed tab, and the member accepts it in the graph. No public upload, hosted storage or provider account is involved.

Repeat with a community learning or cultural record. Community acceptance, evidence interpretation and protocol WorkApproval remain separate.

## Boundaries

The [24 October G0 report](reports/2026-10-24-g0-feasibility.md) proves limited synthetic desktop feasibility. It does not show phone suitability, Pi recovery across a closed tab on persistent storage, or private sharing. Records are synthetic or non-sensitive until the loop's gates pass, a second controller exists and the owner has decided what limits code updates to the phone app (O8).

No dedicated hardware node or cloud inference is required. Hosted storage, the Admin Hub connection, KOI exchange, co-editing, sensors and public publication are next lanes or later work. This revision updates the plan only: it authorizes no product implementation, dependency installation, deployment or tracker change.
