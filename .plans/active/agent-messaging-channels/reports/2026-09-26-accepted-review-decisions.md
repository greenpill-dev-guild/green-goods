# Accepted review decisions — 26 September 2026

The user accepted the discussed remedies for PR #864 after review of head `cff3e68e792daf290b16be6e0dab5477180fab2b`.

## Ownership

- Afolabi, afo@wefa.world, is the accountable prototype support owner under WEFA's WhatsApp operations.
- Opus 5.5 (Claude) builds; Astra (Codex) independently reviews completed checkpoints and integrated proof.
- Local handoffs are reconciled to the current brief. Tracker/start-gate reconciliation remains before implementation. No agent was dispatched and no external tracker/comment was written by this update.

## Accepted corrections

1. Help, invitations and the browser Help sheet expose the named contact; rehearse support/deletion/incidents before real intake, without blocking synthetic fixtures.
2. Persist typed outcomes for terminal failures with no hash as well as broadcasts. Retry after reload and reauthentication, atomically record outcome/reservation/reply intent, and preserve uncertain attempts.
3. Enforce independent intake/publication/message switches at the actual owner/delegated dispatch boundaries; reconciliation continues during pauses.
4. Give channel subjects stable IDs with versioned HMAC lookup aliases and insertion-after-rotation/race proof. Correct optional operation parents and retain the database XOR invariant.
5. Scope root environment-schema/config validation and deployed proxy/header/cookie/log evidence explicitly.
6. Reconcile implementation/QA ownership, Shared exports, platform-neutral ceremony hooks and the research agenda. Put ownership/tracker prerequisites before the API harness. Synthetic Telegram-shaped fixtures remain required; a live Telegram adapter remains optional.

## Evidence boundary

This is an architecture and dispatch update. No runtime source, contract, configuration secret or dependency manifest was edited. Proposed modules/hooks and tests are implementation targets, not a claim that they already exist. Existing dated review reports remain historical; current acceptance is in the technical brief, eval.md and current handoffs. Live browser/provider/chain compatibility and merge-conflict resolution are not established here.

## Validation of this update

- `bun run check --plan -- --intent review --base HEAD --json` classified the 12 changed paths as sensitive Plan Hub work and selected no runtime checks. `bun run check -- --intent review --base HEAD` passed that selection.
- `node scripts/harness/plan-hub.mjs validate` passed for all 27 hubs. `git diff --check` passed; the changed status JSON was formatted with the installed Biome binary.
- Direct consistency checks passed for 129 local Markdown links, the current handoff owners, pending implementation evidence, contract anchors and optional ERD parents.
- All 21 Mermaid sources parsed. The HTML brief was regenerated from the canonical Markdown and existing wireframes; its DOM check passed for title order, diagram/wireframe presence, local links/anchors, JavaScript syntax and theme selection/persistence.
- A rendered check was attempted through the connected Brave extension. The browser tool rejected the local `file:` URL under its URL policy. No alternate transport was used to bypass that restriction; browser layout and PDF output remain unverified. These document checks are not runtime or live-account proof.
