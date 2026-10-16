# Grove by Green Goods

**Slug:** `grove` · **Stage:** ideas · **Updated:** 2026-10-16

*Your garden’s living knowledge.*

Grove preserves useful research and connects it to a garden’s work, evidence and resources. Its main interface is a living graph: inspect nodes and relationships, see what is new, filter and query, review suggested connections, and view earlier knowledge states.

The MVP serves one active garden view on one desktop browser profile, with isolated Vida Verde and TAS workspaces in the first spike. Grove acts as a partial KOI node; an optional full node supports explicit exchange without owning the local graph. It connects through the Green Goods Admin Hub, stores versioned knowledge locally, and uses one local Gemma configuration for evidence-linked proposals. Local review remains distinct from protocol WorkApproval and community governance.

## Read this plan

- [KOI integration and evidence](koi-integration.md): partial/full-node boundary, identity, signatures, durable recovery and reuse limits.
- [Vida Verde and TAS spike](first-spike.md): public-source fixtures, walkthrough, scope and exit conditions.
- [Unified ontology proposal](ontology-alignment.md): one Grove language with traceable Green Goods and Commons meanings.
- [Learning loops and ingestion diagrams](architecture-flows.md): internal work, external knowledge, and their shared memory.
- [Dependencies by category](dependencies.md): responsibilities, reuse, candidates and deferred additions.
- [Visualizer references and design directions](visual-design.md): actual Sigma/Cytoscape screenshots and comparison.
- [Claude Code design prompt](handoffs/claude-design-exploration.md): a bounded exploration of three graph compositions.
- [Architecture and reuse](spec.md): scope, Coop and Green Goods components, ownership, ingestion and temporal contracts.
- [Implementation sequence](plan.todo.md): 15 unchecked checkpoints, with the first complete capture-to-graph-to-Hub slice.
- [Acceptance gates](eval.md): domain, history, model, connection, graph, capacity and recovery criteria.
- [Execution state](status.json): idea-stage work; no implementation has started.

## First success

Connect Vida Verde, receive a KOI resource and save its source, open Soil care, follow a suggested connection to its evidence and return easily. Review it, distinguish a planned trial from recorded activity, rewind knowledge time and reopen offline. Explicitly share one approved public-safe projection with a controlled peer, then repeat for TAS and prove workspace isolation.

## Boundaries

`packages/extension` remains the proposed code package; Grove is the brand. A controlled full-node exchange is included in the spike; general multi-user synchronization, private API credentials, onchain writes, autonomous crawling, sensor integration and public Commons publishing are deferred. This PR publishes the plan only; dependencies and runtime work are not authorized by publishing it.
