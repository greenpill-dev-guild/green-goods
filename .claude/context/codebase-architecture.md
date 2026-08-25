# Codebase Architecture

This is the canonical agent-facing model for architecture work in Green Goods. The `plan`,
`review`, `audit`, and `module-seams-review` skills share it. Product and package invariants still
come from `AGENTS.md`, `CLAUDE.md`, the nearest package guide, and the other files in this directory.

The model adapts Matt Pocock's
[`codebase-design`](https://github.com/mattpocock/skills/tree/main/skills/engineering/codebase-design),
[`DEEPENING`](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/DEEPENING.md),
[`DESIGN-IT-TWICE`](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/DESIGN-IT-TWICE.md),
and
[`improve-codebase-architecture`](https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture)
guidance. It keeps their deep-module vocabulary while fitting Green Goods' Plan Hub, validation,
package, trust, and deployment contracts.

## Vocabulary

- **Module**: code with an interface and an implementation, at any scale from a function to a
  package-spanning domain slice.
- **Interface**: everything a caller must understand to use a module correctly: types, invariants,
  ordering, errors, configuration, and meaningful performance behavior.
- **Depth**: leverage delivered through the interface. A deep module hides substantial coherent
  behavior behind a small, stable interface; a shallow one makes callers learn nearly as much as
  its implementation contains.
- **Seam**: a location where behavior can vary without editing the caller at that location.
- **Adapter**: a concrete implementation occupying a seam.
- **Locality**: how strongly related change, knowledge, failure, and verification stay together.
- **Leverage**: how much useful behavior callers and tests gain per unit of interface they learn.

## Boundary and seam are different

A **boundary** separates ownership, package direction, trust, deployment, process, or protocol. A
**seam** is a substitution or behavior-control point. A legitimate boundary does not automatically
need an injected seam, and adding a seam does not create a legitimate package or trust boundary.

- An **external seam** is the interface callers use.
- An **internal seam** varies a dependency inside the module without leaking that dependency into
  the public interface.

Keep real package, process, trust, chain, and deployment boundaries. Do not merge them merely to
make a module look deeper.

## Dependency categories

Classify a candidate's behavior-bearing dependencies before choosing a test or adapter strategy:

1. **In-process**: pure computation or in-memory state. Test the module directly; no adapter is
   required.
2. **Local-substitute**: local I/O with a faithful local stand-in, such as IndexedDB plus
   fake-indexeddb or a local database. Keep the seam internal and use the stand-in where it
   preserves semantics.
3. **Owned-remote**: a Green Goods-controlled service or process. Define a port at the actual
   network/process seam; production and local adapters must obey the same observable contract.
4. **True-external**: a third-party chain, wallet, provider, or API. Inject a narrow port and use a
   faithful fake or mock adapter for deterministic tests, plus conformance or integration proof
   where local substitution cannot prove compatibility.

One hypothetical adapter is weak evidence for a seam. Two real adapters—commonly production plus
a behaviorally meaningful test/local adapter—are evidence that behavior actually varies there.
Do not expose an internal port solely because a test wants access to implementation detail.

## Design rules

- **Deletion test**: imagine removing the proposed module. If its complexity disappears, it is
  probably pass-through indirection. If the complexity returns across several callers, the module
  is creating locality and earning its interface.
- **Interface as test surface**: direct behavior tests and callers should cross the same interface.
  Tests beyond it need a risk-specific reason, such as adapter conformance or integration proof.
- **Accept dependencies, return results**: default to supplied behavior-bearing dependencies and
  explicit outcomes. Construct concrete defaults at composition roots and keep unavoidable side
  effects behind named adapters.
- **Replace obsolete tests**: after deepening a module, remove tests that only lock its retired
  internal structure. Do not layer new interface tests on top of redundant implementation tests.
- **Leaf exports are graph controls**: declared leaf specifiers can reduce import and mock graphs,
  but they do not prove depth, ownership, useful behavior, or a sound seam.

## Export taxonomy

Every declared public specifier belongs to one category:

- **Stable domain**: supported caller-facing domain interface with deliberate compatibility.
- **Composition**: default adapter, provider, runtime singleton, or root wiring intended for a
  narrow composition edge.
- **Compatibility**: temporary or legacy route with named consumers and a deletion condition.
- **Internal candidate**: useful implementation detail that is not yet a supported public
  interface. Keep it private until a real consumer and stability decision justify an export.

Exports control the dependency graph. They do not turn an internal candidate into a stable domain
module by themselves.

## Architecture candidate workflow

Architecture opportunity work follows this lifecycle:

`OBSERVED -> CANDIDATE -> SELECTED -> IMPLEMENTED -> CERTIFIED`

`DEFERRED` is available before selection. Keep observations and unselected candidates in the owning
Plan Hub. Only a human-selected critical module or hotspot enters
`scripts/data/module-seam-registry.json`; certification requires fresh checker evidence.

Each candidate card records:

1. concrete friction and affected paths;
2. the current interface and its callers;
3. the deletion-test result;
4. dependency category and real adapters;
5. before and after interface shapes;
6. expected locality and leverage effect;
7. test replacement or migration;
8. runtime, compatibility, and delivery risk;
9. confidence and evidence;
10. rejected overarchitecture, including why a smaller change is insufficient or preferable.

The `plan` skill presents three to six ranked cards and stops for human selection. It designs only
the selected candidate and routes accepted implementation through the owning Plan Hub.

## Design it twice, selectively

Explore two materially different interface shapes only when the selected seam is protected,
cross-package, or caller-facing and both shapes are genuinely viable. Compare them on depth,
locality, leverage, seam placement, migration cost, and compatibility. A routine internal refactor
does not need this ceremony.

Green Goods does not adopt mandatory HTML reports, mandatory subagents, or a blanket rejection of
package, trust, protocol, process, or deployment boundaries. Markdown candidate cards and the
repository's normal human scope lock are canonical.

## Proof categories

Do not collapse these signals:

- **Direct test**: imports the subject outside mocks, never mocks it, and exercises its interface.
- **Conformance test**: proves multiple adapters obey the same observable contract.
- **Consumer wiring**: proves a real caller imports and invokes the interface.
- **Production composition**: proves the default adapter/runtime identity is assembled at the
  intended root.
- **Coverage**: measures executed code. It is an outer-loop regression floor, not proof of a sound
  interface, faithful adapter, real consumer, or production composition.

Architecture certification requires the applicable proof categories and a fresh deterministic
registry fingerprint. A checker can verify declared evidence and graph facts; it cannot prove that
an interface is deep or that a design choice is wise.
