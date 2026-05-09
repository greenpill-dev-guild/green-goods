# Cloud Routines Actions — 2026-05-08 reset

> **What this is.** A copy-paste checklist for manually reconfiguring the cloud Claude routines at [claude.ai/code/routines](https://claude.ai/code/routines) so the cloud state matches the docs in this repo. The repo edits landed across two turns on 2026-05-07 + 2026-05-08; the cloud surface is web-only and cannot be modified from the Claude Code CLI.
>
> **Order matters.** Delete first (frees up name slots and stops noise), then update bug-intake, then create the four new routines. Each create step references a `.md` file in this repo for the prompt body.

## 1. Deletions (delete cron only — keep prompt for reference)

For each routine below, log into [claude.ai/code/routines](https://claude.ai/code/routines), find the routine, and **either delete the routine entirely OR clear its trigger cron** depending on what the surface allows. The repo prompt files retain a `> **PAUSED**` banner instructing the agent to exit if a stale cron fires anyway.

| Routine name | Action | Reason |
|---|---|---|
| `drift-watch` | Delete cron | Folded into `engineering-pulse` |
| `metrics` | Delete cron | Split: digest+growth → `growth-pulse`, anomaly → `engineering-pulse` |
| `plan-executor` | Delete cron, keep routine | On-demand only — most empty-queue runs were pure overhead |
| `hotfix` | Delete cron, keep routine | Same — on-demand for true emergencies |
| `guild-daily-synthesis` | Delete cron | Folded into `guild-weekly-synthesis` |
| `research-synthesis` | Delete cron | Folded into `weekly-insights` |
| `routine-issue-cleanup` | Delete cron | Sweep folds into `routine-self-audit` Phase 3 upgrade |

**Pending — do after concurrent prompt-quality edits commit upstream:**

| Routine name | Action | Reason |
|---|---|---|
| `design-synthesis` | Delete cron | Folded into `weekly-insights` |
| `guild-product-development-synthesis` | Delete cron | Folded into `growth-pulse` (GG numbers) |
| `guild-weekly-checkin` | Delete cron | Folded into `guild-weekly-synthesis` (cross-project) + `growth-pulse` (GG numbers) |

## 2. Update — `bug-intake`

Change the cron from `0 4 * * 1-5` (daily M-F) to `0 4 * * 1,3,5` (M/W/F). Everything else stays the same.

Reason: gives triage time between runs without missing reports.

## 3. New routines (create from scratch in the web UI)

For each, click **New routine**, fill the fields below, then paste the prompt body from the referenced `.md` file (everything after the `# Prompt` heading in that file).

### 3a. `engineering-pulse` (Green Goods repo)

| Field | Value |
|---|---|
| Routine name | `engineering-pulse` |
| Cron | `0 2 * * 0` (Sunday 02:00 local) |
| Repos | `green-goods` |
| Environment | `green-goods-routines-extended` |
| Network access | full |
| Model | `claude-opus-4-7[1m]` |
| Allow unrestricted branch pushes | false |
| Env vars | `ARBITRUM_RPC_URL`, `ENVIO_INDEXER_URL`, `POSTHOG_PROJECT_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST`, `DISCORD_BOT_TOKEN`, `DISCORD_ENGINEERING_CHANNEL_ID`, `DISCORD_USER_ID_AFO` |
| Connectors | `posthog` |
| Prompt body source | [docs/routines/engineering-pulse.md](docs/routines/engineering-pulse.md) (everything after `# Prompt`) |

### 3b. `growth-pulse` (Green Goods repo)

| Field | Value |
|---|---|
| Routine name | `growth-pulse` |
| Cron | `0 9 * * 1` (Monday 09:00 local) |
| Repos | `green-goods` |
| Environment | `green-goods-routines-extended` |
| Network access | full |
| Model | `claude-opus-4-7[1m]` |
| Allow unrestricted branch pushes | true (digest PR to `develop`) |
| Env vars | `DUNE_API_KEY`, `POSTHOG_PROJECT_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST`, `ENVIO_INDEXER_URL`, `ARBITRUM_RPC_URL`, `DISCORD_BOT_TOKEN`, `DISCORD_PRODUCT_CHANNEL_ID`, `DISCORD_FUNDING_CHANNEL_ID`, `DISCORD_USER_ID_AFO`, `LINEAR_API_KEY` |
| Connectors | `posthog`, `linear`, `google-calendar` |
| Prompt body source | [docs/routines/growth-pulse.md](docs/routines/growth-pulse.md) (everything after `# Prompt`) |

### 3c. `guild-weekly-synthesis` (guild repo)

| Field | Value |
|---|---|
| Routine name | `guild-weekly-synthesis` |
| Cron | `0 18 * * 1` (Monday 18:00 local) |
| Repos | `greenpill-dev-guild/network-website`, `greenpill-dev-guild/coop`, `greenpill-dev-guild/green-goods`, `greenpill-dev-guild/cookie-jar`, `Greenpill9ja/TAS-Hub` |
| Environment | `guild-routines` |
| Network access | full |
| Model | `claude-opus-4-7[1m]` |
| Allow unrestricted branch pushes | false |
| Env vars | `DISCORD_BOT_TOKEN`, `DISCORD_COMMUNITY_CHANNEL_ID`, `DISCORD_LEAD_COUNCIL_CHANNEL_ID`, `DISCORD_USER_ID_AFO` |
| Connectors | `google-drive`, `google-calendar` |
| Prompt body source | [`~/Code/greenpill/.github/routines/claude/guild-weekly-synthesis.md`](https://github.com/greenpill-dev-guild/.github/blob/main/routines/claude/guild-weekly-synthesis.md) (after the file is committed and pushed; otherwise paste from local) |

### 3d. `weekly-insights` (guild repo)

| Field | Value |
|---|---|
| Routine name | `weekly-insights` |
| Cron | `0 17 * * 5` (Friday 17:00 local) |
| Repos | (none — reads via APIs only) |
| Environment | `guild-routines` |
| Network access | full |
| Model | `claude-opus-4-7[1m]` |
| Allow unrestricted branch pushes | false |
| Env vars | `DISCORD_BOT_TOKEN`, `DISCORD_RESEARCH_CHANNEL_ID`, `DISCORD_DESIGN_CHANNEL_ID`, `DISCORD_USER_ID_AFO`, `LINEAR_API_KEY` |
| Connectors | `google-drive`, `linear` |
| Prompt body source | [`~/Code/greenpill/.github/routines/claude/weekly-insights.md`](https://github.com/greenpill-dev-guild/.github/blob/main/routines/claude/weekly-insights.md) (after commit/push; otherwise paste from local) |

## 4. Verification

After all changes:

1. **Confirm the schedule list** at claude.ai/code/routines shows exactly:
   - **Daily M-F:** `health-watch` (07:30)
   - **M/W/F:** `bug-intake` (04:00)
   - **Sun:** `engineering-pulse` (02:00) + `routine-self-audit` (23:00)
   - **Mon:** `growth-pulse` (09:00) + `guild-weekly-synthesis` (18:00)
   - **Wed:** `guild-grant-scout` (19:00)
   - **Fri:** `weekly-insights` (17:00)
   - **Event:** `pr-review` (PR open)
   - **On-demand:** `plan-executor`, `hotfix`
2. **Manually trigger one new routine** (e.g. `engineering-pulse`) to confirm env vars resolve and the connector is wired. Inspect the Discord output against the routine's stated output schema.
3. **Privacy spot-check** on the first run: any Linear writes from `growth-pulse` should contain only allow-listed PostHog fields (per `posthog-questions/SKILL.md`'s privacy table). Replay URLs, session IDs, distinct IDs, wallet addresses, reporter identifiers must not appear.

## What this delivers

- **From ~36 weekly cloud-routine runs to ~9** (1 daily M-F + 1 M/W/F + 6 weekly + 1 event-driven + 2 on-demand).
- **From 15 active scheduled routines to 7 active scheduled** (plus 1 event + 2 on-demand + 6-8 paused).
- Issue creation lands on the right tracker per the partial-migration policy: Linear for product/strategy signals (`bug-intake`, `growth-pulse`, `weekly-insights`), GitHub Project #4 for code-local audit findings (`engineering-pulse`, `health-watch`).
