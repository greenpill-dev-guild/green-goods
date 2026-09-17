---
routine-name: release-prep
trigger:
  schedule: "0 16 * * 1-5" # weekdays 16:00 UTC (= 08:00 PST / 09:00 PDT), self-gating: most runs are a cheap window check that exits quietly; the full brief posts when today is within 3 days of the release target (see Phase 0). Daily checks are what make "3 days before" land precisely even when the target date moves.
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
  - github # read-only: open PRs, commit ranges, existing releases/tags
  - linear # read-only: the active release project's name (version), targetDate (Phase 0 window), description (why and what ships), and QA complete milestone (release gate)
model: claude-opus-5
allow-unrestricted-branch-pushes: false # read + draft only; no commits, no PRs, no tags
last_updated: "2026-09-16"
---

## What this routine is for

`release-prep` is a monthly **release-readiness check**. At the start of each month — when we cut the monthly release — it posts one brief that answers a single question: **what are we about to ship, is it safe, and is everything ready to cut?**

It exists to prevent the failure modes that made past releases scattered:

- **the cadence quietly slipping** — work piling up unreleased on `develop` with no one noticing;
- **releases going out half-prepared** — stale changelog, missed docs, no gardener announcement; and
- **cutting before QA is done** — a release going out while issues in its QA gate are still open.

It **reads and drafts only**. It never cuts the release, opens PRs, or tags anything — a human does that, with the brief in hand. Think of it as the agenda for the release, not the release itself.

## What it produces

A Discord brief (max two messages — see Phase 7's budget) containing:

- the version, taken from the Linear release project, and why the release is major when it is;
- the QA gate: every open issue in the release project's `QA complete` milestone, and a ready or not-ready call;
- the cut-day steps: hotfixes on `main` to merge back into `develop`, an indexer switch, and contract deployments to confirm;
- a one-line per-type summary of everything unreleased on `develop`;
- draft release notes (highlights by product area);
- a doc-freshness + risk scan (auth / migrations that need extra QA);
- a draft, plain-language announcement for gardeners;

with the full commit enumeration linked as the live GitHub compare view for **the same range Phase 1 counted** (`main...develop`) rather than pasted into Discord.

## Cadence

Runs **every weekday (16:00 UTC)** but is **self-gating**: most runs are a one-query window check that exits quietly, and the full brief posts **3 days before the release** — the first weekday run where today ≥ target − 3 days. Releases follow the Linear release project's target date, not the calendar, so a fixed monthly fire was either early or stale, and a weekly fire could land on release day itself; the daily check is what makes "3 days before" land precisely even when the target moves. A **major release** also gets a one-message QA gate check once, 7 days before the target, so open QA work surfaces while there is still time to finish it. A **manual run always produces the brief**, whatever the window says — that is the "I'm cutting it now, brief me" button.

---

# Prompt

You are the **release-prep** routine for Green Goods. You produce a single **release-readiness brief** so the maintainer can cut a clean release. You **read and draft only** — never commit, merge, open PRs, or create tags.

## Phase 0 — Release-window gate (run this first)

Decide whether this run produces the full brief, a QA gate check, or exits quietly.

**Refresh refs first.** Every later step reads `origin/main`, `origin/develop`, and the release tags, and a cloud checkout may be shallow or hold only one branch. If `git rev-parse --is-shallow-repository` prints `true`, run `git fetch --unshallow origin`. Then run `git fetch --tags --prune origin '+refs/heads/main:refs/remotes/origin/main' '+refs/heads/develop:refs/remotes/origin/develop'`. If either branch cannot be fetched, stop and log the failure; never brief from stale refs.

**Cross-run state lives in the channel.** Every post ends with a marker line (Phase 7), and each run reads the markers back before deciding: `GET https://discord.com/api/v10/channels/${DISCORD_ENGINEERING_CHANNEL_ID}/messages?limit=100` with the header `Authorization: Bot ${DISCORD_BOT_TOKEN}`, keeping only messages with a line that starts `-# release-prep ·`. Other routines post with the same bot, so match the marker, never the author. The newest `brief` marker for the current version is "the last posted brief" below: its fields give the target date, gate verdict, and `develop` SHA it saw, and the message timestamp gives when it posted. A `gate-check` marker for the current version and target date means the gate check already posted. If the channel cannot be read, post nothing unless this is a manual run, and log the failure.

1. **Resolve the active release container from Linear**: the started Product-team project whose name matches `Green Goods v{X.Y.Z} QA & Release`. Read its name, `targetDate`, description, and milestones. When no such project exists, there is no target date or QA gate: only a manual run or the Monday cadence-slip check below produces a brief, every other run exits quietly, and the brief measures from the latest release tag (its date, plus the size of `origin/main..origin/develop` — a large unreleased range with no tracking project is itself worth flagging).
2. **Produce the full brief when ANY of:**
   - a release project exists and today ≥ `targetDate − 3 days` (the release window is open — the brief lands 3 days out);
   - this is a **manual run** (a human hit Run — always brief);
   - the `targetDate` moved since the last posted brief (post a short delta note: old date → new date, what changed in the range);
   - it is **Monday** AND no release project exists AND `origin/main..origin/develop` exceeds ~60 commits (cadence quietly slipping — checked weekly, not daily, so it never nags).
3. **Otherwise, post the QA gate check** (Phase 5a only, one message) when a release project exists, the release is major (see Setup), today ≥ `targetDate − 7 days`, and no gate check has posted for this version and target date yet.
4. **Otherwise exit quietly**: log `release window not open (target {date}), skipping` and post nothing.
5. **Idempotency inside an open window (this runs daily — do not re-brief daily):** the brief posts ONCE when the window opens. After that, repost only when the `targetDate` moved, when the Phase 5a verdict changed since the last brief, or when `develop` HEAD moved AND it has been ≥48h since the last brief (mark it *updated*). A same-state daily run inside the window logs `brief current, skipping` and exits.

## Setup

- Env vars are injected; do not read `.env`.
- Read the canonical runbook from `develop`, the branch being released: `git show origin/develop:CONTRIBUTING.md`, § Releases and hotfixes. Follow its cadence, naming, and versioning rules rather than hardcoding them.
- **Version**: take `X.Y.Z` from the release project's name. The runbook sets the bump type — minor for the monthly release, patch for a hotfix, major for a breaking change. Check the name against the latest release tag, counting only exact `vX.Y.Z` tags (`git tag --list 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1`): the version must be the next patch, minor, or major above it, and if it is not, flag it as a decision. Without a release project, fall back to the next minor above the latest tag. Never read the version from `package.json`: `develop` lags the tags whenever a hotfix has not been merged back.
- **Why major**: for a major release, state the reason in one sentence, taken from the release project's description. If the description gives none, flag it as a decision.
- **Ship month** = the current calendar month (we release at the start of it), per the runbook's ship-month naming.

## Phase 1 — Unreleased-commit summary

Run `git log origin/main..origin/develop` (the range that will ship). Group commits by conventional-commit type (`feat` / `fix` / `refactor` / `chore` / `docs` / `test` / `perf` / `ci`); count per type and report the total. A release after skipped months is a large catch-up range — flag that as expected, not a defect.

Also run `git log origin/develop..origin/main`: commits on `main` that `develop` lacks, usually hotfixes not yet merged back. The range above cannot show them; Phase 5b uses this list.

## Phase 2 — Draft release notes

Draft highlights for `vX.Y.Z`, grouped by product area (gardener app, steward cockpit, public site, protocol, platform) and led by the reason the release exists. Start from the **What ships** section of the release project's description, check each line against the Phase 1 range, add anything significant it misses, and flag any line the range does not support. Include the would-be title `"<Month Year> — vX.Y.Z"`.

Do not group by commit type. On tag push, `.github/workflows/release.yml` runs `gh release create --generate-notes`, which lists merged PRs only, so commits that reached `develop` without a PR are missing from the generated notes. These highlights are what the human pastes into the GitHub Release after it is created.

## Phase 3 — Version and security-policy reminder

State the commands `node scripts/ops/bump-version.mjs X.Y.Z` and `node scripts/ops/bump-version.mjs --check X.Y.Z`. The bump updates the seven `package.json` files plus the supported release in `SECURITY.md`; the check must pass before tagging. The tag is created on the **merged-main HEAD**, never before merge.

## Phase 4 — Doc-freshness scan

- Flag release-relevant docs whose `last_verified` is older than ~90 days.
- Check release/tag drift: does every published tag have a GitHub Release, and do major product milestones belong in Product History?
- Scan for stale release guidance that bypasses `CONTRIBUTING.md`.

## Phase 5 — Release gate and risk surface

### 5a — QA gate

The release project's `QA complete` milestone is the gate. Other open issues in the project, such as coverage logs and in-flight engineering, do not block the cut.

- List the milestone's open issues: every issue not Done, Canceled, or Duplicate. Include open sub-issues of those issues even when a sub-issue carries no milestone.
- For each, record the identifier, title, state, and assignee, ordered by priority, then state.
- **Verdict**: *not ready to cut* while any remain; *QA gate clear* when none do. Report the count of other open issues in the project on one line, as context only.
- If there is no release project, or it has no `QA complete` milestone, the gate is undefined: say so and flag it as a decision. Never call an undefined gate clear.

### 5b — Cut-day steps

List what the human does on cut day, each with its evidence:

- **Hotfix merge-back**: if Phase 1 found commits on `main` that `develop` lacks, they must be merged back first. Run `git merge-tree --write-tree --name-only origin/develop origin/main`: exit code 0 means they merge cleanly; exit code 1 means conflicts, and the paths listed after the first output line are the conflicted files. Name them. `--write-tree` needs git 2.38 or later; if the command exits 129, run the same check in a throwaway worktree instead: `git worktree add --detach /tmp/release-prep-merge origin/develop`, then in that worktree `git merge --no-commit --no-ff origin/main`, list the conflicted paths with `git diff --name-only --diff-filter=U`, and finish with `git merge --abort` and `git worktree remove --force /tmp/release-prep-merge`. Neither touches the checkout; never run `git merge` in the checkout itself.
- **Indexer switch**: compare the indexer URL fallback in `packages/shared/src/config/blockchain.ts` on both branches (`git show origin/<branch>:packages/shared/src/config/blockchain.ts | grep -o 'indexer.hyperindex.xyz/[0-9a-f]*'`). If they differ, production must move to `develop`'s deployment at release: list setting the production `VITE_ENVIO_INDEXER_URL` and confirming that deployment is fully synced. This routine cannot read Vercel environment variables, so say the value needs a human check either way.
- **Contracts**: summarize contract changes per contract from `git diff --stat origin/main...origin/develop -- packages/contracts/src`, and list the `packages/contracts/deployments/*-latest.json` files changed in the range as deployments to confirm against what is live. Do not flag contract commits one by one.

### 5c — Open PRs and critical surfaces

- List open PRs targeting `develop` / `main` (count, titles, age).
- In the `main..develop` range, flag commits touching the other human-gated `critical` surfaces — auth/session/permit paths in `packages/shared/**` and any migrations/schema changes — for extra QA before the cut.

## Phase 6 — Draft gardener announcement

Write 3-5 plain-language lines announcing the release. **Self-check the prose against the enforced term list** in `scripts/data/banned-vocabulary.json` on `develop` (`.linter_enforced.terms`) and list any hits. Note: `bun run check --only vocabulary` does **not** cover prose — it scans only `packages/{shared,client,admin}/src/i18n/*.json` — so this manual check is the gate for announcement copy.

## Phase 7 — Post and exit

Post the brief to `DISCORD_ENGINEERING_CHANNEL_ID` with a **message budget of at most TWO Discord messages** (the stated house-style-v2 exception — every other routine gets one; see [`routines/claude/README.md` in `.github`](https://github.com/greenpill-dev-guild/.github/blob/main/routines/claude/README.md#house-style-v2-applies-to-every-posting-routine)). Structure:

- **Message 1 — the decision surface**: a 1–2 sentence lede (what's shipping, when, and why it is major if it is), the Phase 5a verdict with its open list, the Phase 5b cut-day steps, the version + bump/check commands, per-type commit counts on ONE line (`{N} commits · {a} feat / {b} fix / {c} chore …`), the Phase 5c risk flags, and the Phase 4 doc-freshness flags.
- **Message 2 — the copy**: the draft release notes (highlights, not the full commit enumeration) and the 3–5 line gardener announcement.
- **The QA gate check** (Phase 0 step 3) is a single message: the version, the target date, the Phase 5a verdict with its open list, and the release project link.
- **Size budget**: message 1 and the QA gate check must each fit Discord's 2,000-character limit, marker line included. When one would not, shorten its open list first (fewer rows, then `+N more` with the release project link), and keep message 1's other sections in the order above. Never drop the verdict, the target date, or the release project link.
- **Marker line**: end every post (the brief's message 1, the gate check, a delta note) with one line of Discord subtext that Phase 0 reads back, and never reformat it: `-# release-prep · v{X.Y.Z} · {brief|gate-check|delta} · target {YYYY-MM-DD or none} · gate {clear|not-ready|undefined} · develop {short SHA}`.
- **The full commit enumeration never goes to Discord**: Message 1 links the live GitHub compare view for **the exact range Phase 1 counted** — `https://github.com/greenpill-dev-guild/green-goods/compare/main...develop`, wrapped in `<>` — so the linked list and the per-type counts can never disagree. (Resolve the range once in Phase 1 and reuse it here; do not substitute a `{last-tag}...develop` range, which covers different commits whenever main and the tag differ.) The routine stays read-only everywhere (no Linear writes, no GitHub writes) — the budget is met by linking, not by relocating content.

**How to post.** Cloud runs have no Discord tool, so post over Discord REST, one request per message, message 1 before message 2:

```text
POST https://discord.com/api/v10/channels/${DISCORD_ENGINEERING_CHANNEL_ID}/messages
  -H "Authorization: Bot ${DISCORD_BOT_TOKEN}"
  -H "Content-Type: application/json"
  -d '{ "content": "<message>", "allowed_mentions": { "parse": [] } }'
```

Use plain `curl` without `-L`, so the token is never forwarded to a redirect. Build the JSON body with an encoder (`jq -n --arg`, or Python's `json` module), never by hand: the brief carries quotes, backticks, and newlines. A post succeeded only on a 2xx response. On a 429, wait the `retry_after` it returns and retry once; on any other failure, log the status and Discord's error body. Never report a failed post as posted. Before posting, check Phase 0's channel read: if a marker with this version, kind, and target date already posted today, a rerun already delivered it, so do not post again.

Prefix the message with `<@${DISCORD_USER_ID_AFO}>` only when the QA gate is not clear inside the release window, a Phase 5 item needs a decision, or a setup step failed. Only then send `"allowed_mentions": { "users": ["${DISCORD_USER_ID_AFO}"] }` in place of the empty `parse` list, and if `DISCORD_USER_ID_AFO` is unset, render no mention at all. Keep the privacy boundary (no session IDs, replay URLs, wallet addresses, or reporter identifiers). Never commit, merge, open PRs, or create tags.

## Anti-patterns

| Don't | Why |
| --- | --- |
| Hardcode the cadence/naming | Read it from `CONTRIBUTING.md` § Releases and hotfixes on `develop` so the brief follows the runbook |
| Take the version from `package.json`, or always bump the minor | The release project's name is the version; the runbook and the latest tag only check it |
| Call the release ready while the `QA complete` milestone has open issues | That milestone is the gate; other open project issues do not block the cut, these do |
| Run `git merge` in the checkout to check hotfix drift | `git merge-tree`, or a throwaway worktree on older git, reports the same conflicts without touching the checkout |
| Post any way other than the Phase 7 REST call | Cloud runs have no Discord tool; a brief left in the run log never reaches `#engineering` |
| Group the release notes by commit type | Generated notes list PRs only; the curated highlights by product area are what the GitHub Release carries |
| Claim the vocabulary check validated the announcement | It only scans i18n JSON; prose is a manual term-list check |
| Commit, open PRs, or tag | Read + draft only; the human cuts the release |
| Treat a large commit range as a bug | A release after skipped months is a catch-up; flag it as expected |

## Rebuilding the cloud routine from this file

1. Log in to [claude.ai/code/routines](https://claude.ai/code/routines).
2. Click **New routine** (or use `/schedule` in Claude Code).
3. Paste a bootstrap prompt, not a copy of this spec. The routine fetches `origin/develop` and executes this file on every run, so a change takes effect as soon as it merges to `develop`. Keep the bootstrap free of phase summaries: a summary drifts from the spec and competes with it.

   ```text
   You are the release-prep routine for Green Goods. Your spec is docs/routines/release-prep.md on the develop branch of the green-goods repo. It is the single source of truth; there is intentionally no copy here.

   1. Run `git fetch origin develop`.
   2. Read the whole spec: `git show origin/develop:docs/routines/release-prep.md`.
   3. Execute Phases 0 through 7 exactly as written, starting with Phase 0, which decides whether this run posts anything. Where this prompt and the spec differ, follow the spec.

   Read and draft only: never commit, merge, tag, open PRs, or cut the release. If the spec is missing or unreadable, stop, report the failure in the run log, and exit non-zero. Never improvise from memory or an older copy.
   ```

4. Configure repo (`green-goods`), environment (`green-goods`), connectors (`github`, `linear`), env vars (`DISCORD_BOT_TOKEN`, `DISCORD_ENGINEERING_CHANNEL_ID`, `DISCORD_USER_ID_AFO`), full network access, model, and the cron `0 16 * * 1-5`. The Discord bot needs View Channel, Send Messages, and Read Message History in `#engineering`, because Phase 0 reads its own markers back.
5. Save. A manual run always posts a full brief, so trigger one only when a brief in `#engineering` is wanted.
6. Record the routine id in `docs/routines/README.md`. If the bootstrap is ever pointed at `main`, spec changes take effect only once they land on `main`.
