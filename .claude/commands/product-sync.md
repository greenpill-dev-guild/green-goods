# Product Sync Transcript Extraction

You are processing a product sync call transcript for Green Goods. Extract every bug, feature, and polish item discussed and format each as a GitHub issue matching our exact templates.

## Context Loading

Before extraction, read these files to ground your understanding:
- `.github/ISSUE_TEMPLATE/bug.yml` — Bug report structure
- `.github/ISSUE_TEMPLATE/feature.yml` — User Story structure
- `.github/ISSUE_TEMPLATE/polish.yml` — Polish structure
- `.github/ISSUE_TEMPLATE/task.yml` — Task structure (for decomposing features)
- `.claude/context/intent.md` — Organizational intent and decision heuristics
- `.claude/agents/triage.md` — Severity scale (P0-P4) and routing rules

## Extraction Rules

1. **Read the full transcript** before extracting anything
2. **Categorize** each item as: Bug, Feature (User Story), or Polish
3. **Triage** each item using the P0-P4 severity scale from `triage.md`
4. **Scope** each item to the correct package(s): contracts, shared, client, admin, agent, indexer
5. **Map to grants** when possible using the grant table in `intent.md`
6. **Flag assumptions** with [ASSUMPTION] when inferring details not explicitly stated
7. **Group related items** — if multiple items form one User Story, show the story with decomposed tasks
8. **Cross-reference known issues** — check if the item matches something already tracked (e.g., the vault withdraw shares/assets bug, the CreateGarden infinite re-render loop)

## Output Format

### For each item, output:

---

#### [TYPE EMOJI] Title
<!-- Bug = BUG | Feature = FEATURE | Polish = POLISH -->

**Severity**: P0-P4
**Labels**: `bug` | `enhancement` | `polish`
**Scope**: package name(s)
**Branch**: `type/short-description`
**Grant**: grant name or "Unscoped"

Then fill the matching template fields:

**BUG issues must include**: Bug Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Environment
**FEATURE issues must include**: Story Title (As a [user], I want...), Context, Done State (checkboxes), PRD Links, Relevant Details, Primary Scope
**POLISH issues must include**: Current State, Desired State, Component/Area, Figma Reference

For features large enough to decompose, add:
**Suggested Tasks**:
- Task 1: [description] — Package: `___`, Complexity: low/medium/high
- Task 2: [description] — Package: `___`, Complexity: low/medium/high

---

### End with a Summary Table:

| # | Title | Type | Severity | Scope | Branch | Grant | Notes |
|---|-------|------|----------|-------|--------|-------|-------|

## Conventions

- **Branch format**: `type/description` (e.g., `feature/offline-queue`, `bug/vault-withdraw`)
- **Commit scopes**: contracts, indexer, shared, client, admin, agent, claude
- **Architectural rules to watch for**:
  - ALL hooks must live in `@green-goods/shared`
  - Offline-first is non-negotiable (field workers in LATAM during power outages)
  - Single chain, single `.env` at root
  - Never use blockchain vocabulary in Gardener-facing copy

## Priority Inference

- **P0 (Critical)**: Blocking users, data loss, fund/security risk
- **P1 (High)**: Major feature broken, no workaround, frequently emphasized
- **P2 (Medium)**: Degraded behavior, workaround exists, agreed upon in call
- **P3 (Minor)**: Minor defect, mentioned briefly
- **P4 (Enhancement)**: Nice-to-have, mentioned in passing

## Transcript

$ARGUMENTS
