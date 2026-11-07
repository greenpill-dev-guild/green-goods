# Impact Sharing and Report Exports plan

**Feature Slug**: `impact-sharing-report-exports`
**Stage**: backlog
**Status**: BACKLOG — independent delivery track; runtime not started
**Created / Last Updated**: 2026-10-16 / 2026-10-16

## Decisions and ownership

This track owns social/public sharing and report exports. It has no dependency on Certified
account linking, provider grants or provider pilots. The [architecture](./spec.md) and
[Linear map](./linear-map.md) define its authorities and issue mirrors. This is a thin checkpoint
mirror; local scope/proof and native scheduling/dependencies are reconciled explicitly.

## H1 — public snapshot and consent

- [ ] Accept the public field/media, source revision, disclosure and correction rules.
- [ ] Implement the Shared projection with source-focused tests for missing/target/observed values,
  unique Work counts, consent and private-field exclusion.

Verify: only accepted public data appears in a versioned snapshot; invalid or stale consent blocks it.

## H2 — public page and preview

Depends on H1. Select hosting before implementation.

- [ ] Implement a bounded public HTML/metadata and permitted-asset path using the existing owner.
- [ ] Prove crawler-visible per-record metadata, sanitization, access and correction behavior.

Verify: the person and crawler receive the same approved snapshot and stale versions remain legible.

## H3 — share controls

Depends on H2. Split Shared contracts/hooks and Client/Admin wiring into separate bounded sessions.

- [ ] Add the Share entry point for eligible Work, commitments, assessments and certificates.
- [ ] Verify supported X/LinkedIn/Facebook/native, copy and download behavior with honest outcomes.

Verify: cancel/copy/handoff never reports a confirmed social post; unsupported targets have a usable fallback.

## H4 — impact report exports

Depends on H2 and accepted report claims from RESR-77. It can proceed independently of H3.

- [ ] Implement deterministic HTML, PNG, accessible PDF and caption/alt-text outputs.
- [ ] Add period preview, unique counts, units/methods, source manifest and correction labels.

Verify: failed rendering is recoverable and reproducible fixtures distinguish targets, observations,
interpretations and unavailable data. Downloads do not claim a destination publication.

## Validation and activation

Use the root validation selector and focused tests at the owning interface. Meaningful runtime
RED/GREEN and labeled rendered/browser proof are required when the selected implementation
changes those behaviors. No runtime proof or lane completion is claimed by this planning update.
Preserve the root environment, dependency-approval and Shared hook/export rules.
