# Documentation and Agent Guidance Authority

**Slug**: `documentation-agent-guidance-authority`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-08-30`

## Problem

Public documentation, internal agent guidance, and generated references overlap in ways that make authority difficult to resolve. Community pages include hidden and future-facing material, Builder pages are being migrated from duplicated prose, and skill support files sometimes point back to public docs as implementation contracts. The docs also have two deployment owners.

## Desired Outcome

- One public surface with 20 Community, 44 Builder, and 6 Reference source pages.
- Generated references project volatile facts from code, ontology, configuration, and workflows.
- Internal guidance routes tasks to skills without making public docs an implementation authority.
- Vercel owns deployment; GitHub Actions validates only.
- Removed content remains recoverable through Git history without a repository archive.

## Scope Notes

- In scope: `docs/**`, docs generators and audits, ontology doc projections, skill routing metadata, named skill support files, vocabulary policy, docs workflow filters, and direct guidance consumers.
- Out of scope: production runtime behavior, contracts, indexer schemas, protocol types, PWA work, Commitment Pooling, live QA data, and unrelated concurrent working-tree changes.

## Success Signal

The committed production sitemap contains exactly 79 indexed routes, every page and asset is reachable or intentionally redirected, generated output is reproducible, and authority checks reject downstream public-doc contracts.
