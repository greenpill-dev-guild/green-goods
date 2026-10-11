# Grove by Green Goods

**Slug:** `grove` · **Stage:** ideas · **Updated:** 2026-10-11

*Your garden’s living knowledge.*

Grove preserves useful research and connects it to a garden’s work, evidence and resources. Its main interface is a living graph: inspect nodes and relationships, see what is new, filter and query, review suggested connections, and view earlier knowledge states.

The MVP serves one garden on one desktop browser profile. It connects through the Green Goods Admin Hub, stores versioned knowledge locally, and uses one local Gemma configuration for evidence-linked proposals. Local review remains distinct from protocol WorkApproval and community governance.

## Read this plan

- [Architecture and reuse](spec.md): scope, Coop and Green Goods components, ownership, ingestion and temporal contracts.
- [Implementation sequence](plan.todo.md): 13 unchecked checkpoints, with the first complete capture-to-graph-to-Hub slice.
- [Acceptance gates](eval.md): domain, history, model, connection, graph, capacity and recovery criteria.
- [Execution state](status.json): idea-stage work; no implementation has started.

## First success

Connect one garden, save one research page, receive an actual local-model relationship proposal, inspect its evidence, review it in the graph, compare earlier states, reopen offline and see the accepted item in the same-device Hub digest.

## Boundaries

`packages/extension` remains the proposed code package; Grove is the brand. Multi-user synchronization, private API credentials, onchain writes, autonomous crawling, sensor integration and public publishing are deferred. This PR publishes the plan only; dependencies and runtime work are not authorized by publishing it.
