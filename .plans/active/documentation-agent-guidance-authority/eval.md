# Documentation and Agent Guidance Authority Evaluation Plan

## Release Gates

1. **Surface:** exactly 20 Community, 44 Builder, and 6 Reference source pages.
2. **Index:** exactly 79 indexed routes, including eight category indexes and search.
3. **Authority:** public pages do not own implementation behavior; all authority paths resolve.
4. **Generation:** 20 committed projections regenerate byte-for-byte with declared SHA-256 sources.
5. **Navigation:** no hidden or unreachable public page, broken anchor, false redirect, or orphan asset.
6. **Routing:** every core task maps to one existing skill or explicitly to no skill, with a defined mutation boundary and handoff.
7. **Deployment:** Vercel is READY for an exact `main` commit and retains a rollback-capable prior deployment; GitHub Actions has no deploy job.

## Acceptance Checks

| ID | Boundary | Check | Evidence |
|---|---|---|---|
| AC-1 | Deterministic projections | `bun run check:docs-generated` | Passed: 18 shared projections; ontology gate separately verifies 2 public projections and the agent manifest |
| AC-2 | Public authority and navigation | `bun run docs:audit:ci` | Passed with no hard findings; duplicated generated integration tables remain advisory |
| AC-3 | Ontology and persona contracts | `bun run check:ontology` | Passed: 21 entities, 47 vocabularies, 5 personas, QA roles, client anchors, and 3 deterministic artifacts |
| AC-4 | Skill routing and guidance | `bun run check:skill-behavior && bun run check:guidance-links && bun run check:codex-guidance` | Passed: 13 task routes, 62 guidance files, and Codex parity |
| AC-5 | Docs tests and build | `bun run test:docs && bun run build:docs` | Passed: 36 docs tests and clean Docusaurus production build |
| AC-6 | Dead-code and asset consumers | docs workspace dead-code scan plus targeted searches | Passed after removing the remaining unused docs barrel and model exports; no orphan public assets |
| AC-7 | Production deployment | Vercel inspect, browser checks, and sitemap receipt | Pending a successful preview and clean committed main revision |

## Baseline

- `bun format:check`: passed across 2,916 files.
- `bun lint`: passed with 0 blocking violations; existing Solidity advisory warnings remain.
- `bun run test`: stopped in the unrelated QA auth suite because the returned nonce is not yet in its expected object. This plan will not edit that concurrent QA surface.

## Local Sitemap Receipt

- Source pages: 20 Community, 44 Builder, and 6 Reference.
- Generated pages: 20; authored guides: 49; retained Revenue Explorer: 1.
- Indexed build routes: 79 — 70 source routes, eight generated category indexes, and search.
- Clean public slugs: `/community/green-goods-claims` and `/reference/ontology`; their former `.generated` routes redirect exactly.

## Local Rendered-Page Receipt

- The in-app browser loaded Welcome, Recovery and Sync, Agent Task Routing, Glossary, Design Rationale and Sources, and Search from the existing local docs server.
- Every representative content route rendered its expected H1, no route showed the not-found state, the generated glossary contained no `undefined` text, and Agent Task Routing produced no browser console errors.
- The clean production build contains exact static redirects from `/builders/glossary`, `/community/green-goods-claims.generated`, and `/reference/ontology.generated` to their selected successors. Docusaurus client redirects are build artifacts and do not execute in the development server.

## Semantic Evaluation

`bun run eval:skills` remains blocked: the external Claude runner returned no complete parseable routing response after two attempts. The deterministic local behavior gate still passes all 13 core routes and 15 scenarios; this is not treated as a substitute for the external semantic evaluation.

## Vercel Configuration Finding

No documentation migration commit has been pushed, so the absent production routes are not a deployed regression. The 2026-08-30 `green-goods-docs` preview for commit `0a3782d` failed because the project built from the monorepo root, ignored `docs/vercel.json`, selected Turbo's default build, and ran Vite under Node 24. The repository contract intentionally remains scoped to `docs/vercel.json` because other Vercel projects share the monorepo root. The live `green-goods-docs` project must use Root Directory `docs` with source access outside that directory; `docs/package.json#engines.node` then selects Node 22 and the checked-in build command runs the authority gates before Docusaurus.

## Local Vercel Build Receipt

The checked-in Vercel build contract passes in the working tree under Node 22.22.1 and Bun 1.3.14. Its six build-stage commands—docs audit, generated-output check, ontology check, skill-behavior check, docs tests, and docs build—all passed. Docusaurus wrote `docs/build`, the strict docs dead-code scan returned no findings, and the built sitemap contains 79 routes: 20 Community, 44 Builder, 6 Reference, eight category indexes, and search. This proves the repository configuration and artifact shape; it does not prove the live Vercel project setting or a remote deployment.

## Remaining External Gate

Production is not claimed. The authenticated browser reached GitHub's credential screen before the project setting could be changed. After signing in, set Root Directory to `docs`, enable source access outside that directory, and obtain a READY preview from `green-goods-docs`. Then a clean commit must reach `main`, `docs.greengoods.app` must resolve to the READY deployment, and a previous successful deployment must be retained for rollback. Record the commit, deployment URL, browser proof, and production sitemap here before archiving the Plan Hub.

## Evidence Rules

- Do not record commit-attributed passing evidence while any validated path is dirty.
- A local green result proves the working tree only.
- The production receipt must name the exact commit and deployment URL/status.
- An unavailable semantic model or authenticated browser remains `BLOCKED`, not inferred green.
