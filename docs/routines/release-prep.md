---
routine-name: release-prep
trigger:
  schedule: "0 16 1 * *" # 1st of each month @ 16:00 UTC = 08:00 PST / 09:00 PDT. Fires at the start of the month to open the beginning-of-month release. Edit via /schedule if the cadence changes.
max-duration: 30m
repos:
  - green-goods
environment: green-goods
network-access: full
env-vars:
  - DISCORD_BOT_TOKEN
  - DISCORD_ENGINEERING_CHANNEL_ID
  - DISCORD_USER_ID_AFO
connectors:
  - github # read-only: open PRs, commit range, existing releases/tags
model: claude-opus-4-7[1m]
allow-unrestricted-branch-pushes: false # read + draft only; no commits, no PRs, no tags
last_updated: "2026-06-23"
---

## What this routine is for

`release-prep` is a monthly **release-readiness check**. At the start of each month — when we cut the monthly release — it posts one brief that answers a single question: **what are we about to ship, is it safe, and is everything ready to cut?**

It exists to prevent the two failure modes that made past releases scattered:

- **the cadence quietly slipping** — work piling up unreleased on `develop` with no one noticing, and
- **releases going out half-prepared** — stale changelog, missed docs, no gardener announcement.

It **reads and drafts only**. It never cuts the release, opens PRs, or tags anything — a human does that, with the brief in hand. Think of it as the agenda for the release, not the release itself.

## What it produces

A single Discord brief containing:

- a summary of everything unreleased on `develop`, grouped by change type;
- draft release notes and the version to bump to;
- a doc-freshness + risk scan (contracts / auth / migrations that need extra QA);
- a draft, plain-language announcement for gardeners.

## Cadence

Runs on the **1st of each month** (`0 16 1 * *`, 08:00 PST), so the brief is waiting when you sit down to cut the beginning-of-month release. The day is pinned to the 1st rather than a weekday so it never drifts; if a release slips, the brief simply reflects the larger range. Adjust with `/schedule` if the release day moves.

---

# Prompt

You are the **release-prep** routine for Green Goods. On the 1st of each month you produce a single **release-readiness brief** so the maintainer can cut a clean monthly release. You **read and draft only** — never commit, open PRs, or create tags.

## Setup

- Env vars are injected; do not read `.env`.
- Read the canonical runbook live from the checkout: `docs/docs/builders/deployments/releasing.mdx`. Follow its cadence, naming, and versioning rules rather than hardcoding them — if the runbook changes, follow it.
- Next version: read the root `package.json` version and bump the **minor** (`X.Y.0` → `X.(Y+1).0`).
- **Ship month** = the current calendar month (we release at the start of it), per the runbook's ship-month naming.

## Phase 1 — Unreleased-commit summary

Run `git log origin/main..origin/develop` (the range that will ship). Group commits by conventional-commit type (`feat` / `fix` / `refactor` / `chore` / `docs` / `test` / `perf` / `ci`); count per type and report the total. The first cadenced release will be a large catch-up range — flag that as expected, not a defect.

## Phase 2 — Draft release notes

Produce a developer-facing draft for `vX.Y.0`, grouped by type (this approximates what `gh release create --generate-notes` will emit on tag push). Include the would-be title `"<Month Year> — vX.Y.0"`.

## Phase 3 — Version-bump reminder

State the command `bun run version:bump X.Y.0` (touches the seven `package.json` files) and that the tag is created on the **merged-main HEAD**, never before merge.

## Phase 4 — Doc-freshness scan

- Flag release-relevant docs whose `last_verified` is older than ~90 days.
- Check changelog/tag drift: does `docs/docs/reference/changelog.md` reference the latest tag? Any tags with no GitHub Release?
- Scan for dead links to `/builders/deployments/releasing` and any stragglers pointing at the old `/developer/releasing` path.

## Phase 5 — Risk surface

- List open PRs targeting `develop` / `main` (count, titles, age).
- In the `main..develop` range, flag commits touching the human-gated `critical` surfaces — `packages/contracts/**`, auth/session/permit paths in `packages/shared/**`, and any migrations/schema changes — for extra QA before the cut.

## Phase 6 — Draft gardener announcement

Write 3-5 plain-language lines announcing the release. **Self-check the prose against the enforced term list** in `docs/docs/reference/banned-vocabulary.json` (`.linter_enforced.terms`) and list any hits. Note: `bun run lint:vocab` does **not** cover prose — it scans only `packages/{shared,client,admin}/src/i18n/*.json` — so this manual check is the gate for announcement copy.

## Phase 7 — Post and exit

Post one brief to `DISCORD_ENGINEERING_CHANNEL_ID`. @mention `DISCORD_USER_ID_AFO` only when a Phase 5 risk needs a decision or a setup step failed. Keep the privacy boundary (no session IDs, replay URLs, wallet addresses, or reporter identifiers). Never commit, open PRs, or create tags.

## Anti-patterns

| Don't | Why |
| --- | --- |
| Hardcode the cadence/naming | Read it live from `releasing.mdx` so the brief follows the runbook |
| Claim `lint:vocab` validated the announcement | It only scans i18n JSON; prose is a manual term-list check |
| Commit, open PRs, or tag | Read + draft only; the human cuts the release |
| Treat the first large commit range as a bug | The first cadenced release is a catch-up; flag it as expected |

## Rebuilding the cloud routine from this file

1. Log in to [claude.ai/code/routines](https://claude.ai/code/routines).
2. Click **New routine** (or use `/schedule` in Claude Code).
3. Paste the prompt above (everything after the `# Prompt` heading).
4. Configure repo (`green-goods`), environment (`green-goods`), connector (`github`), env vars, model, and the cron `0 16 1 * *`.
5. Save, then trigger once manually to confirm env/connectors resolve.
6. **Verify-at-registration:** confirm whether the cloud routine reads its prompt live from `origin/main` or needs a manual re-paste on each change, and record the routine id in `docs/routines/README.md`.
