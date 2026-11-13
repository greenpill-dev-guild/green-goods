# Sharing and export contract

The [shared architecture](../../../docs/docs/builders/reference/impact-sync-and-sharing-architecture.md)
owns snapshots, public pages, metadata, export artifacts and H1/H2 gates. The
[action crosswalk](../../../docs/docs/builders/reference/impact-integration-action-map.md) owns
source eligibility and the accepted observation/interpretation/recommended-work split.

## Required behavior

- Public snapshots allowlist fields and media, retain consent/source revisions and deduplicate Work.
- Targets, observed values, evaluator interpretations, missing data and coverage remain distinct.
- Public HTML metadata and permitted assets match the snapshot; a client-only route is insufficient for crawler proof.
- Native/composer/copy/download and cancellation have explicit outcomes; a handoff is not a confirmed post.
- Reports retain period, provenance, units, methods, uncertainty and correction/version labels.

## Open decisions

H1 covers public field/media rights, report claims, retention and correction policy. H2 covers
hosting, actual platform/file support, deterministic rendering and accessible output. RESR-77
blocks report exports; basic public-link sharing proceeds under its own accepted field/consent
rules. No blocker on Certified, GainForest, Silvi, Bloom or Regen exists.

Shared owns projections/hooks; existing Client/Admin journeys consume them. Select the existing
server/build owner for public pages and export endpoints. No dependency installation is authorized.
