# Builder Documentation Authority Evaluation

## Acceptance Criteria

1. Exactly 44 Markdown/MDX files remain under `docs/docs/builders`.
2. The migration ledger contains exactly 84 unique original paths with the approved classification
   totals: keep 1, shrink 26, generate 17, move 15, archive 11, delete 14.
3. The 17 generated pages contain valid deterministic metadata and reproduce byte-for-byte.
4. No authored live page relies on a historical specification for current implementation truth.
5. Every local authority, generated source, sidebar ID, redirect destination, and relative link exists.
6. Broken authority and stale output fixtures exit nonzero; editorial warnings remain advisory.
7. The existing Docs workflow owns projection checks, build, artifact upload, and deploy.
8. Revenue Explorer remains available and authored.

## Proof

- Local production sitemap and file inspection return 44 live builder routes/pages: 17 generated,
  26 thin authored, and one retained Revenue Explorer specification. All 84 ledger rows are marked
  completed with the approved classification totals.
- Generator unit tests cover normalization, hashing, missing/malformed inputs, deployment-address
  validation, dynamic authority discovery, workflow routing, and stale/missing/orphan outputs.
- The docs audit has fixtures for broken authored authority paths and redirect fragments. The
  combined generator/audit suite passes 17 fixtures; docs pass 31 tests; ontology passes 62
  fixtures plus every guard; and the validation system passes all 175 fixtures.
- Docs audit reports zero hard errors and two advisory duplicate-table findings. All 17 generated
  pages reproduce byte-for-byte, and the production Docusaurus build passes.
- Built sitemap inspection excludes every archive/delete/move source route. The first deployed
  sitemap remains a post-merge Pages check because this implementation did not deploy.
- The five requested delivery changes were implemented in one shared working tree, so their
  sequential merge history remains open and is not represented as completed evidence.
- Broader package validation is not green because of concurrent repository debt: WalletConnect's
  `uint8arrays` export fails test collection in shared/client/admin, one admin funding-refresh
  assertion is red, source structure flags the concurrently edited client Work Dashboard, and
  direct-seam fingerprints are stale. None of those files is part of this migration fix.

## Privacy and Safety

- Generators read only checked-in allowlisted paths and never read `.env`.
- Workflow projections omit secrets, environment values, and action inputs.
- QA projections contain scenario definitions only, never results, owners, session identifiers,
  wallet addresses, replay links, or defect records.
