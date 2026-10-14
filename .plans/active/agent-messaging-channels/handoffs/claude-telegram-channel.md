# Agent reporting — Telegram channel handoff

## Lane

- Owner: Opus 5.5 (Claude)
- Branch: `feature/agent-reporting-telegram` (PR #3), stacked on `feature/agent-reporting-core` (#934)
- Status: in progress. The Telegram channel is implemented and fixture-tested; the live demo run is
  Afolabi's. Independent review by Astra has not happened yet.
- Linear: PRD-1010 (Connect the reporting agent to Telegram for the buildathon demo)

## Why

The WhatsApp Business account is disabled (reported 29 September), so reporting runs on Telegram,
on the Agent's existing bot. Decisions and the way back to WhatsApp:
[Telegram-first report](../reports/2026-09-29-telegram-first-whatsapp-outlook.md).

## What changed in PR #3

- `packages/agent/src/platforms/telegram-reporting.ts`: update normalization (private chats only,
  slash commands to the core's command words, button presses as reply IDs), the outbound transport
  (buttons, link buttons for public links, local links in the text, 4096-character parts, Telegram
  error mapping) and the `getFile` media fetcher (core limits, no redirects, Telegram's API host only).
- `packages/agent/src/platforms/telegram.ts`: reporting's middleware runs first; its storage failures
  are rethrown so the webhook answers 500; optional `apiRoot` for a local Bot API. The command menu
  loop and the named reply options type keep the file under its frozen ceiling (586 of 590 lines).
- `packages/agent/src/runtime/reporting-startup.ts`: the `telegram` adapter registers when the Agent
  runs its Telegram runtime; `startReporting` reports its channels.
- `packages/agent/src/index.ts`: reporting starts before the bot; polling starts after the HTTP
  server, because Telegraf's polling `launch()` settles only when polling stops.
- `packages/client/vite.config.ts`: `REPORTING_AGENT_URL` points the dev proxy at a running Agent.

## What remains

- The live demo on the production bot, the webhook restore afterwards, and the first real Telegram
  messages through this code (Afolabi; runbook in the Telegram-first report).
- Retiring the bot's old private-chat commands and its command menu once reporting keeps them.
- The WhatsApp adapter, once the account works again (capability record section 6).

## TDD Proof

- RED: in `packages/agent`, with `bot.use(reporting.middleware)` disabled,
  `AGENT_SQLITE_INTEGRATION=true bun --bun run vitest run src/__tests__/reporting/telegram-channel.sqlite.test.ts`
  fails all three tests (the bot's own handler ran for reporting's chats; a failed update resolved).
  With only the rethrow disabled it fails "does not acknowledge an update it could not store". With
  local links allowed on buttons, `node ../../scripts/dev/node-cli.js vitest run src/__tests__/reporting/telegram-channel.test.ts`
  fails "sends choices as buttons, a public link as a button and a local link in the text".
- GREEN: both files pass (13 unit and 3 SQLite tests).
- These are mutation checks on behavior written with the tests, not tests written before the code.
- The polling-launch fix has no automated test: `main()` is not unit-tested. It rests on Telegraf
  4.16.3's `launch()`, which awaits the polling loop.

## Rendered proof

None. The only Client change is a dev-server proxy option; the ceremony pages are unchanged from #934.

## Validation Receipt

- Tested implementation commit SHA: `beb6afec733bcb030711019e3d7c11d1142138c8`
- Run at (UTC): 2026-09-30T05:10:48Z
- Exact command(s): `bun run check -- --intent push --reuse-passing-receipts --no-fail-fast`
  (critical push plan against `origin/develop`, 265 changed paths across the stack);
  `node scripts/docs/generate.mjs --check`;
  `PLAN_REPORTS_BASE_REF=origin/feature/agent-reporting-core node scripts/quality/check-immutable-plan-reports.mjs`
- Result: every automated check passed: format, lint, validation-system-test, test-quality,
  abi-artifacts, the Shared, Client, Admin, Agent and Indexer typecheck, test and build legs,
  contracts-build, contracts-test, contracts-verify-fast, docs-authority, docs-test, docs-build,
  staged-modules, source-structure, design-guardrails, agent-guidance, supply-chain, story-quality
  and review-guardrails-test. The Client and Agent test legs re-ran; the Shared and Admin legs
  replayed Turbo's cached passes for unchanged inputs. Generated docs (20 projections) are current
  and existing dated reports are unchanged. `browser-proof` stays pending (manual, advisory).
- Validated paths: everything outside `.plans/`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- . ':!.plans'` → empty
- Evidence-only diff command and result (if applicable): `git diff --stat beb6afec7..HEAD` → only
  files under `.plans/active/agent-messaging-channels/`
- Evidence-only worktree-status command and result (if applicable):
  `git status --porcelain=v1 --untracked-files=all` → empty after the receipt commit

## Risks / Blockers

- Nothing here has been live-tested against Telegram.
- Running the demo on the production bot moves its webhook to the laptop until the production Agent
  restarts; see the report for the window's effects.
- Telegram can deliver webhook updates over parallel connections (up to 40 by default), so photos
  sent together may be stored in a different order than sent; a polling batch keeps its order.
