# Codebase Architecture Skills and Seam Governance Spec

## Summary

This follow-up turns the completed seam work into a closed architecture practice: discover concrete
friction, let a human select the opportunity, design a deeper interface, prove it at the subject and
composition boundaries, and retain only bounded current evidence. It strengthens existing skills
instead of adding competing trigger surfaces.

## Users

- Primary: maintainers and coding agents changing Green Goods architecture.
- Secondary: reviewers evaluating testability, public imports, and agentic coding velocity.

## Functional Requirements

1. `.claude/context/codebase-architecture.md` is the canonical architecture model.
2. `plan` owns candidate discovery/design; `review` owns change soundness; `audit` owns concrete
   drift; `module-seams-review` owns certification; `clean` remains unchanged.
3. Candidate cards record friction, current interface, deletion-test result, dependency category,
   before/after interface, locality/leverage effect, test migration, risk, confidence, and rejected
   overarchitecture.
4. `scripts/data/module-seam-registry.json` contains only certified critical seams and selected
   hotspots. Unselected candidates stay in this hub.
5. The direct-seam checker resolves real package exports, validates registry evidence, rejects
   self-mocking or missing direct proof, and fails stale fingerprints.
6. The existing 13-entry direct-test baseline reaches zero through real test fixes or proven
   inference corrections.
7. Evidence-review selection for architecture guidance returns exactly `agent-guidance`,
   `test-quality`, and `validation-system-test` unless explicit focused tests are supplied.
8. Builder docs describe declared leaf exports, Node/DOM projects, seam proof, scheduled coverage,
   and separate velocity measures accurately.
9. Linear uses one parent-only Product issue. PRD-831 closes with a successor reference.

## Architecture Model

The canonical model paraphrases and attributes:

- <https://github.com/mattpocock/skills/tree/main/skills/engineering/codebase-design>
- <https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/DEEPENING.md>
- <https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/DESIGN-IT-TWICE.md>
- <https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture>

Green Goods keeps Markdown output, human scope locks, repo-owned validation, and legitimate
package/trust/deployment boundaries. It does not copy Matt's HTML output contract, require
subagents, or convert every boundary into a substitution seam.

## Candidate Lifecycle

| State | Durable location | Meaning |
|---|---|---|
| `OBSERVED` | current review response | Evidence exists; no backlog claim yet. |
| `CANDIDATE` | this Plan Hub | Candidate card is complete; not selected. |
| `DEFERRED` | this Plan Hub | Human intentionally parked the candidate. |
| `SELECTED` | Plan Hub + seam registry | Human approved interface design work. |
| `IMPLEMENTED` | Plan Hub + code/tests | New seam exists but awaits certification. |
| `CERTIFIED` | seam registry | Export, production composition, consumers, proof, and fingerprint pass. |

## Initial Registry and Candidate Set

Certified seed entries: JobQueue default composition, Auth/session composition, Work
provider-command composition, and commitment-pooling read/controller composition.

Deferred candidate cards, retained outside the registry: Agent `HandlerServices`, Telegram adapter
separation, and blockchain-client injection. They require a future human selection before design or
implementation.

## Registry Contract

Each entry records a stable ID, owner, lifecycle, criticality, module path, public specifier,
interface summary, dependency category, production composition roots, direct consumers, direct,
conformance, and integration proof paths, review date, and deterministic fingerprint. Version 1
governs TypeScript/JavaScript only. Solidity retains its Bun/Foundry review and deployment contract.

## Human Judgment Points

- New architecture candidates require human selection; an audit or certification cannot select one.
- Design-it-twice runs only for protected, cross-package, or caller-facing interfaces with two
  materially different viable shapes.
- Coverage is an outer-loop floor, never a substitute for direct or production-composition proof.
- The client-guide plan owns AGENTS/CLAUDE consolidation. This hub does not edit those files.

## Risks

- Registry staleness: bounded to four certified seams and selected hotspots; fingerprints fail
  closed when evidence changes.
- Trigger overlap: semantic and deterministic fixtures distinguish discovery, review, audit,
  certification, and cleanup.
- Guidance overgrowth: shared concepts live once in the architecture context; skills link to it.
- False direct-test positives: inference corrections require a focused fixture proving the prior
  match was not a subject test.
