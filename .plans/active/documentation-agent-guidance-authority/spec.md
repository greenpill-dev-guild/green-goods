# Documentation and Agent Guidance Authority Spec

## Summary

Finish the Builder authority migration, establish Vercel as the sole deployment owner, reduce the Community and Reference surfaces, and make task-to-skill routing a deterministic internal contract. Code and configuration own implementation facts; ontology owns shared semantics; public authored docs explain current flows, rationale, recovery, and navigation.

## Users

- Community members using Green Goods as gardeners, stewards/evaluators, or funders.
- Builders and coding agents navigating the repository and its public interfaces.
- Maintainers reviewing documentation authority, deployment, and generated-output drift.

## Functional Requirements

1. Publish 20 Community, 44 Builder, and 6 Reference source routes with no hidden pages.
2. Generate 20 deterministic references, including one task-routing page and one shared glossary.
3. Keep 49 concise authored guides and the Revenue Explorer specification.
4. Deploy docs through Vercel Git integration; keep GitHub Actions validation-only.
5. Validate task routing, ontology personas, QA roles, generated output, links, navigation, redirects, anchors, authority direction, and public asset consumers.
6. Delete the named stale pages, support files, components, artifacts, scripts, and unused assets.

## Authority Model

1. Code, manifests, exports, routes, configuration, workflows, deployment artifacts, and package guides own implementation behavior.
2. `green-goods-ontology.json` owns entities, personas, relationships, vocabulary, constraints, schemas, and lifecycle semantics.
3. `green-goods-projections.json` owns evidence-backed maturity and non-derivable wording.
4. DesignMD owns visual language and surface dialects while consuming ontology terminology.
5. The QA catalog owns scenarios; external workbooks and run artifacts own results.
6. Skill frontmatter owns activation; `.claude/context/task-routing.json` owns cross-skill routing.
7. Plan Hubs own accepted future decisions and rejected alternatives.
8. Authored public docs explain current flows and stable rationale. Generated public docs project volatile facts and semantic inventories.

## Research Evidence

- Current implementation base: `c881230a82a9d10c915ad060ed2b593f694af129`.
- Builder predecessor: `.plans/active/builder-docs-authority/` already selects 44 live pages.
- Existing generator: `scripts/docs/generate.mjs` with five deterministic scopes and 17 Builder projections.
- Existing ontology generator: `scripts/quality/check-ontology.mjs` and `scripts/quality/ontology-render.mjs`.
- Existing docs audit: `docs/scripts/docs-audit.mjs` plus its deterministic tests.
- Current dirty tree also contains unrelated PWA, Commitment Pooling, QA, contract, and workflow changes; these remain outside this plan's ownership.

## Human Judgment Points

- Live Vercel project linking, production-branch selection, domain assignment, promotion, and rollback require a clean committed revision and verified project ownership.
- Root DesignMD changes, token decisions, and vocabulary policy changes remain maintainer decisions; this migration only moves the selected policy file and removes derivative prose.
- Redirects are added only where the successor preserves user intent.

## Non-Functional Constraints

- No new dependency, runtime API, contract, indexer schema, or protocol type.
- Static generation only; no application-module execution and no `.env` reads.
- Stable ordering, normalized line endings, explicit sources, and SHA-256 source digests.
- Git history is the archive. No `docs/archive` directory.
- Existing concurrent work is preserved without stash, reset, checkout, or broad formatting.

## Predecessors

- `builder-docs-authority`
- `agent-research-grounding`
- `codebase-architecture-skills`

The latter two stay open until their own external-evaluation and scheduled-coverage gates close.

## Risks

- Removing a page that still has a runtime or public anchor consumer. Mitigation: exact consumer, redirect, and anchor checks before deletion.
- A generated glossary breaks client anchor links. Mitigation: preserve explicit IDs and test them.
- Vercel and GitHub both deploy. Mitigation: remove Pages only after project ownership and production readiness are verified.
- A concurrent change overlaps a selected file. Mitigation: inspect the current diff and preserve the existing lines; do not claim a clean commit receipt from a dirty path.
