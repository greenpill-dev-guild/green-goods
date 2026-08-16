# App Profile Avatars Evaluation

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

## Acceptance

- Public reads return the current URI, version, and timestamp.
- Only the mapped primary account can set, replace, or clear its pointer.
- Expired, forged, stale, replayed, wrong-chain, and malformed mutations fail safely.
- Wallet, embedded-wallet, deployed smart-account, and counterfactual passkey paths are covered.
- Client and admin expose upload, replace, clear, loading, error, offline, and fallback states.
- JPEG, PNG, and WebP become 512×512 WebP output no larger than 1 MB.
- Durable drafts never store signatures and do not replace published query state before success.
- Authenticated Brave proves client, admin desktop, and admin mobile behavior.

## Proof

- Same-turn command output is attached in
  [`reports/2026-07-30-pr-review.md`](reports/2026-07-30-pr-review.md). Historical summaries
  without retained output are not treated as current proof.
- Fresh targeted proof: shared avatar/runtime 23/23, client avatar 18/18, admin avatar 17/17, and
  agent avatar 13/13 tests pass.
- Fresh Repo Quick Gate: shared 291 files / 3,392 passed + 1 skipped; client 84 / 658; admin hub
  13 / 102; agent 22 passed + 1 skipped / 245 passed + 1 skipped.
- Passed: agent and shared typechecks, deterministic Sepolia client and admin builds, format, lint,
  source structure, vocabulary, DesignMD, generated design, design tokens, shared story coverage
  (201/201), and story quality (173 files).
- Blocked outside the changed surfaces: the full build stops in unchanged contracts because checked-out Foundry submodules are missing.
- Blocked outside the changed surfaces: the full test run reaches unchanged indexer tests that cannot bind loopback ports in this sandbox. Shared, client, and agent full suites passed; the one admin guard failure caused by this feature was corrected, and the full admin suite then passed.
- Blocked: `agentic:check` reaches the repository browser-policy guard, which reports four required phrases missing from unchanged `CLAUDE.md`; agent operating docs are outside PRD-762.
- Blocked before execution locally: the Storybook interaction runner cannot launch its checked-in
  Chromium process because macOS denies its Mach rendezvous registration. No local Storybook
  interaction test ran; GitHub Actions is the authoritative runner.
- Blocked before execution locally: Admin Playwright cannot write its mkcert output under
  `~/.vite-plugin-mkcert`. No local Admin Playwright test ran; GitHub Actions is the authoritative
  runner.
- Blocked: authenticated Brave proof cannot start local client/admin HTTPS without an unapproved machine trust-store mutation, and the local agent cannot start without `TELEGRAM_BOT_TOKEN`. No isolated-browser result is substituted for authenticated proof.

## Review Remediation

- Fixed canonical pointer validation by parsing the CID and requiring its canonical string form; malformed base32-looking values, paths, query strings, and fragments are rejected.
- Fixed durable recovery so persisted upload and clear drafts expose Continue and Discard after a reload, not only while the editor remains in its transient offline stage.
- Fixed the rendered Profile FAQ in English, Spanish, and Portuguese, and removed the unused duplicate avatar FAQ keys.
- Replaced the admin remove confirmation with `AdminConfirmDialog`, including the public-IPFS disclosure and a guarded loading state.
- Replaced remote Unsplash story assets with deterministic checked-in data fixtures.
- Split the profile-avatar protocol/publisher/transport/draft/normalization implementation into scoped modules, exposed narrow package subpaths, and split the agent database and admin canvas internals so every changed production source stays within the source-structure ceilings.
- Moved counterfactual passkey factory-argument resolution behind durable draft persistence. A rejected factory lookup now leaves a retryable unsigned draft, with regression tests proving the ordering.
- Regenerated the client PWA token audit, replaced the profile story asset's raw color literals with an existing deterministic fixture, and kept the design-generation/token guards green.
- Corrected the admin initials-fallback story so only the published-avatar story seeds an app avatar. Added real stories for each extracted CanvasLayout component without widening the story exception list.
- Updated every admin shell test seam to mock the scoped profile-avatar export. The admin hub suite and Repo Quick Gate now pass from the final tree.
