# Green Goods, fully local, with Grove

**Slug:** `grove` · **Stage:** ideas · **Updated:** 2026-11-14

**Coordinate locally. Govern together. Share by context. Publish by choice.**

**Linear:** [Grove — Garden Knowledge](https://linear.app/green-goods/project/grove-garden-knowledge-8582c2970974), a focused project within [Community Evidence Mesh](https://linear.app/green-goods/initiative/community-evidence-mesh-f7bdee530343). [RESR-103](https://linear.app/green-goods/issue/RESR-103/grove-by-green-goods-roadmap) remains the Backlog parent; this hub owns the implementation checkpoints. Its five undated project milestones still mirror the earlier A0–A4 sequence and have not been reconciled with the order below.

This project makes Green Goods work in a fully local environment, with just a phone, a browser and an extension. All current Green Goods functionality works there in essence, with no server, chain or account: the gardener app and the steward cockpit both run as separate local builds. A steward defines Actions and writes the assessment. A gardener reports the work they did and makes promises, on the screens that exist today or in their own words with photos. A steward approves, and sends a funder the report. Everything follows one loop, **capture → review → share**, among the devices of the garden's named members. Money and certificates are prepared and approved locally and settle when a device connects. Publishing to the chain is a separate choice, and raw sources can stay private throughout.

**Grove is the extension, and only the extension.** *Your garden’s living knowledge.* It adds knowledge capture and agentic flows on the laptop: a graph of what the garden holds, and a local agent with three jobs. It brings in relevant knowledge and resources as a person browses, guided by the garden's assessment. It assesses each item before the person reviews it. And when a free-form work report or promise is reviewed, it proposes the structured version in the shape Green Goods already uses, beside the app's own screen. People keep every decision.

Identity starts on the device and is governed by the garden. Nobody needs a wallet, a provider account, a model or a connection to begin. Shared records are encrypted for named members' devices, and the design requirement is that whoever stores or relays them cannot read them. That requirement is unbuilt and untested, and it covers storage and relay hosts, not Green Goods as the publisher of the app's code. Records travel between devices as encrypted files. An existing Green Goods passkey can unlock the local vault where its provider supports that; a passphrase does otherwise.

This framing was corrected on 14 November. The revisions of 13 and 14 November had used the name Grove for the whole local system, with its own phone app and a "community" kept apart from the Garden. Decisions D31 to D33 in the [decision log](spec.md#decision-log) replace that.

## Read this plan

**The current contract**

- [MVP contract and decision log](spec.md): who the MVP is for, what it includes and excludes, how it is judged done, and every decision, recommendation, assumption and open question.
- [Green Goods functions, working locally](spec.md#green-goods-functions-working-locally): each function's local form, what waits for a connection, and its block in the plan.
- [Community identity and encrypted sharing](community-sharing.md): terms, audiences, who approves, the member list, encryption, unlock, recovery and carriers.
- [Capture → review → share flows](architecture-flows.md): the four audiences and the sequences for capture, review, sharing, correction, removal, recovery and later publication.
- [Identities and roles](identity-role-mapping.md): who controls which account and key, what the passkey does, and how the six Green Goods roles relate.
- [Implementation sequence](plan.todo.md): the MVP order, each checkpoint's exit, the next lanes and research.
- [Acceptance gates](eval.md): which gates the MVP needs and what passes each.
- [Interactive architecture](artifacts/demos/grove-architecture.html): the same model as one page to step through.

**Experiments designed and not run**

- [Passkey unlock and recovery on two devices](collaboration-passkey-spike.md): an MVP gate. Its second half, a co-editing comparison, is backlog research.
- [Hosted mailbox and Solid](storage-comparison-spike.md): a later lane, after direct sync between open devices.

**Grove, the extension**

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

A steward starts a garden with no wallet, defines two Actions and writes the assessment in the cockpit's local build. On a phone, a gardener reports a morning of composting in their own words, with two photos, and promises a workshop for next month. They pair their laptop and carry both records across as an encrypted file. On the laptop, Grove's agent proposes each record's structured version beside the app's screen, and the gardener checks every value against the words it came from. They share the report with the steward, who reviews it in the cockpit, corrects one detail and approves it. The gardener approves the corrected version, and the steward sends a separately approved report to a named funder. A cookie-jar claim is approved offline and settles only once a device connects. Reopening offline loses nothing, and a device that was not named cannot read the file. While the gardener browses, the agent brings in a funding call that fits the garden's focus and shows why it was brought in, where it came from and what to check before sharing; the gardener keeps it and shares it. A local AI investigation proposes a connection, survives a closed tab, and the gardener accepts it in the graph. No public upload, hosted storage or provider account is involved.

Repeat with the existing work screen in place of free-form words, and with a knowledge capture such as a soil-care guide or a community lesson. A steward's local acceptance is not a published WorkApproval, and neither settles how the evidence is interpreted.

## Boundaries

The [24 October G0 report](reports/2026-10-24-g0-feasibility.md) proves limited synthetic desktop feasibility. It does not show phone suitability, Pi recovery across a closed tab on persistent storage, or private sharing. Records are synthetic or non-sensitive until the loop's gates pass, a second controller exists and the owner has decided what limits code updates to the Green Goods app (O8).

No dedicated hardware node or cloud inference is required. Direct sync between open devices is the next lane; hosted storage, the Admin Hub snapshot, KOI exchange, co-editing, sensors and publishing to the chain come after it. Still open: how local records map onto the onchain ones when published (O16), which side holds a garden's keys on a laptop (O17), and whether a small local model structures reports well enough (O18). This revision updates the plan only: it authorizes no product implementation, dependency installation, deployment or tracker change.
