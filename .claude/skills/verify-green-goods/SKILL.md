---
name: verify-green-goods
user-invocable: true
description: Drive the Green Goods App (client PWA) or the Green Goods Hub (admin) the way a user does and capture labeled proof, from a checkout with dependencies installed and no live services. Launches Vite in test mode on its own ports, drives Chromium with the strict Playwright mock backend and the dev mock-auth seam, and keeps ARIA snapshots, screenshots at 375 and 1280 wide, and a transcript under .cache/verify/. Use to prove a UI change or a mapped feature works, or when asked to verify, demo, or show a flow in the app. Not for authenticated-class proof (wallet, passkey, installed PWA), which needs authenticated Brave.
argument-hint: "[<feature-id>] [--app client|admin] [--run <id>]"
---

# verify-green-goods

Prove a user-facing behavior by driving the real app, not by reading code. Every command below runs
from the repository root. The helper is `scripts/dev/verify-control.ts`; its header lists every
step kind.

Label the proof `mock-auth localhost` (AGENTS.md § Browser Evidence). It is not authenticated proof:
wallet and passkey signing, session providers, the installed PWA, the service worker and the job
queue's offline uploads need authenticated Brave, and this skill never stands in for that.

## Launch

Preconditions: dependencies installed (`bun install` done; the pre-push hook and CI assume the
same). No `.env` value is needed: the server runs on Sepolia in Vite's `test` mode with telemetry
off, and the browser answers indexer, EAS and RPC reads from fixtures.

```bash
bun scripts/dev/verify-control.ts launch client --run <run-id>
bun scripts/dev/verify-control.ts launch admin --run <run-id>
```

- The client listens on port 3101 and the Hub on 3102, apart from the dev defaults (3001, 3002), so a
  run never drives a server someone else started. Launch refuses a port that already serves an app.
- Ready means the page answers with the app's HTML (`verify-control: client ready at https://localhost:3101`),
  usually 10 to 40 seconds on a cold Vite cache. Locally Vite serves HTTPS with mkcert; in CI it
  serves HTTP. The helper records whichever answered.
- Server output goes to `.cache/verify/<run-id>/<app>.server.log`.

## Doctor

Run it first, and again whenever a step fails for no obvious reason:

```bash
bun scripts/dev/verify-control.ts doctor --run <run-id>
```

Each launched app must print `ok`: its own pid alive, its URL answering, and the commit it started
at. A commit other than HEAD means the server predates your change: clean up and launch again.

## Drive

One `drive` call is one browser page: it installs the fixtures, signs in through `?mockAuth`
(`user` for the client, `steward` for the Hub, or `--role`), then runs each `--step` in order.

```bash
bun scripts/dev/verify-control.ts drive client --run <run-id> --feature <feature-id> --width 375 \
  --step "goto:/home/explore?presentation=pwa" \
  --step "expect:heading:Test Community Garden" \
  --step "click:heading:Test Community Garden" \
  --step "expect-url:/home/0x1234567890abcdef1234567890abcdef12345678" \
  --step "expect-hidden:heading:Explore Gardens" \
  --step "snapshot:detail-375.aria.txt" \
  --step "screenshot:detail-375.png"
```

- Find elements by ARIA role and accessible name (`click:button:Save`), never by CSS or position.
  Read the names from a `snapshot` step first.
- After a navigation, wait for the old page to leave (`expect-hidden`) or for something only the new
  page has, before capturing: the URL changes before the new route renders.
- Add `?presentation=pwa` to client paths to get the installed-app shell on a desktop browser.
- The client fixtures (`tests/helpers/mock-backend.ts`) answer one garden, one action and the
  attestations a scenario names; any other indexer, EAS or RPC request throws in the page, and the
  transcript lists it under console errors. A journey that needs other data needs a fixture change,
  not a weaker journey.
- Run every journey at `--width 375` and `--width 1280`.

`features/README.md` is the map: one file per feature with its entry points, its exact steps and
its traps. Drive the matching file's recipe; when a feature you are proving is missing, add its file.

## Evidence

Everything a run produces stays in `.cache/verify/<run-id>/<feature-id>/` (ignored by Git):
`transcript-<width>.txt` (each step, its time, the URL, console errors), the ARIA snapshots and
screenshots the steps named, and `failure.png` when a step fails.

- Capture the action and the state it produced: a snapshot before and after, not only the final
  screen.
- Prove persistence or a side effect from a second view (reload, another route), not from a toast.
- Quote the transcript lines and attach the screenshots in the PR body under Verification, labeled
  `mock-auth localhost, verify-green-goods, <date>`.
- A step that cannot run because the fixtures lack its data is a failure to report with the
  request the transcript names, not a step to drop.

## Cleanup

```bash
bun scripts/dev/verify-control.ts cleanup --run <run-id>
```

It stops only the process groups this run launched (from `<app>.server.json`), never anything found
by name or port, and keeps every evidence file. Run it after every failed attempt too, then confirm
the evidence is still in `.cache/verify/<run-id>/`.

## Gotchas

- The Hub has no shared fixture yet: its indexer mocks live inside `tests/specs/admin.smoke.spec.ts`,
  so `drive admin` installs only the shared RPC mock and indexer reads fail in the page. Hub
  features in the map say so until that fixture moves to `tests/helpers`.
- Two console 403s and a refused `localhost:3005` appear on client runs: avatar and API requests the
  fixtures do not answer. They do not change the journeys mapped today.
- `bun test` is never the command; the helper runs with `bun scripts/dev/verify-control.ts`.
