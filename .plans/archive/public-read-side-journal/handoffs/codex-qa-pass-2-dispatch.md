# Codex Dispatch Prompt — `qa_pass_2` Lane

You are Codex running QA Pass 2 for the `public-read-side-journal` feature in
`/Users/afo/Code/greenpill/green-goods`. The previous lanes (`state_api`, `ui`,
`qa_pass_1`) are already on `develop`. Your job is final repo gates plus a
plan/design consistency review.

## Source of truth

Treat `.plans/active/public-read-side-journal` as authoritative. Read first:

- `status.json`
- `spec.md`
- `eval.md`
- `plan.todo.md`
- `handoffs/codex-qa-pass-2.md` ← **your full scope; this dispatch wraps it**
- `handoffs/codex-state-api.md`
- `handoffs/claude-ui.md`
- root `AGENTS.md` and the nearest package `AGENTS.md` files before touching
  anything

## Operating rules

1. **Branch.** Work on `develop`. Do not create a feature branch or worktree.
2. **No new lanes.** Do not add lanes to `status.json`.
3. **Read-only by default.** Run gates, validate contracts, then write a
   structured QA report. If you find a real bug, fix the smallest possible
   surface, run the focused validation that proves the fix, and call it out
   explicitly in the report.
4. **Fastify must be gone from `packages/agent`.** Confirm zero imports
   remain in source, tests, or `package.json`. Hono must preserve every
   pre-existing route/behavior listed in `handoffs/codex-state-api.md`
   (Hono compatibility checklist).
5. **Receipt-token safety.** Tokens never appear in query params, JSON
   bodies, logs, or analytics. URL form is exactly
   `/fund?intent=<id>#receiptToken=<token>`. API reads accept token only
   via `X-GG-Receipt-Token`. Receipt-bearing responses set
   `Cache-Control: no-store` and `Pragma: no-cache`.
6. **`@green-goods/shared/public-contracts`** is type/data only — no React,
   `import.meta`, browser globals, styles, providers, hooks, side effects.
   Agent must resolve it via package exports without pulling the shared root.
7. **FundingIntent is card-only for v1.** Wallet funding stays Reown/wagmi
   without Agent receipt tracking.
8. **Copy guard.** Donate copy must avoid tax-deductible / charitable /
   nonprofit / legal-receipt claims. Endow copy must use "designed to
   preserve" with explicit risk copy.
9. **i18n.** Every new user-facing string exists in `en`, `es`, and `pt`.
10. **Tooling.** `bun` scripts only; never raw `forge`. Remixicon (no
    lucide). `logger` from shared (no `console.log`).
11. **Don't touch unrelated dirty files.** None should be present, but if
    so, leave them.

## Validation ladder

Run all of these and report results in your final summary:

- `node scripts/harness/plan-hub.mjs validate`
- `node scripts/harness/plan-hub.mjs list --agent codex --lane state_api --json`
- `node scripts/harness/plan-hub.mjs list --agent claude --lane ui --json`
- `bun run --cwd packages/agent test`
- `bun run --cwd packages/agent typecheck`
- `bun run --cwd packages/agent test:coverage`
- `bun run test:client` (if `bun install` is needed first, that is fine)
- `bun run check:design-md`
- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`
- `bun run format:check`
- `bun lint`
- `VITE_CHAIN_ID=11155111 bun run build:client`

If `bun run test:client` or `ci-local --quick` hit restricted-network npm
fetches, run the narrowest honest Vitest subset that exercises the touched
client surfaces and document the gap explicitly — do not paper over it.

## Plan/design consistency checklist

Mirror the bullets in `handoffs/codex-qa-pass-2.md` § "Scope" — every line is
a check. Especially:

- `lanes.state_api.status === "completed"`,
  `lanes.ui.status === "completed"`, `lanes.qa_pass_1.status === "passed"`,
  `lanes.ui.manual_blocked === false`, and the unblock history note exists.
- `contract_stability_checklist.status === "complete"` with every required
  item `complete`.
- Public route paths `POST /public/subscribe`,
  `POST /public/funding-intents`, `GET /public/funding-intents/:id`, and
  `POST /webhooks/thirdweb` exist on the Hono server with the correct
  rate-limit thresholds (5/h, 10/10m, 60/10m, 300/m + 300/m).
- `clientRequestId` / canonical `availabilityKey` /
  `destinationAddress` recompute + drift checks land on the funding-intent
  create path; idempotency uses the pinned normalized fingerprint fields.
- `transactionAttempts[]` storage; only the confirmed funding/deposit
  becomes `fundingTxHash`.
- Abandoned intent expiry (provider expiry or `createdAt + 30 minutes`)
  through read-time reconciliation plus scheduled sweep.
- `expired -> funded_late` only when intent + provider session +
  Garden/destination/receiver/token/chain/min amount all match.
- `/impact` v1: shared EAS reads, page size 12, max 50 Gardens,
  max 100 records, sortedGardens deterministic, `partialData` and
  `sourceLimitReached` flags exposed.
- Provider proof registry: hidden by default, exact tuple keys, `live`
  requires proof reference; UI hides unproven card methods.
- SiteHeader nav order Gardens / Impact / Fund / Actions and CTA is
  `Install App` (`Open App` when installed).
- Browser `/` renders editorial homepage; `/landing` redirects to `/`;
  installed PWA `/` still routes to `/home`.
- New i18n keys exist in `en`, `es`, **and** `pt`.

## Final report

Write a structured Markdown report under
`.plans/active/public-read-side-journal/qa-pass-2-report.md` that includes:

1. Per-area pass/fail summary (Hono migration, public-contracts, /public/*,
   FundingIntent, /impact, UI lane, copy guard, i18n, design gates,
   build:client).
2. Validation commands run + outputs (or honest "skipped because…" lines).
3. Any bugs found and the smallest fix you applied (or proposed).
4. Status.json mutations you intend to make and the
   `node scripts/harness/plan-hub.mjs set-lane` commands to make them.
5. Whether `lanes.qa_pass_2.status` should be set to `passed` or
   `blocked` and why.

After writing the report, run the appropriate `set-lane` command(s) and add
a history note. Commit the report and any focused fixes you landed in one
or two cleanly scoped commits with Conventional Commits + Codex
co-authoring lines.

Stop after the report and lane updates land.
