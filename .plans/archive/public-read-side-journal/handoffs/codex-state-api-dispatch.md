# Codex Dispatch Prompt — `state_api` Lane

This is the copy-paste-ready prompt to launch Codex on the `state_api` lane of
`public-read-side-journal`. The full scope is in `handoffs/codex-state-api.md`; this file
adds only the operating rules the orchestrator needs preserved across the dispatch boundary.

## Why this file exists

The orchestrator (Claude) cannot launch Codex directly — `codex` CLI is not on `PATH` in the
current environment. Per the orchestration directive *"If you cannot launch or coordinate
Codex directly, prepare the exact Codex handoff prompt and stop for human handoff instead of
pretending delegation happened"*, this dispatch prompt was prepared as a durable artifact so a
human (or any agent with `codex exec` access) can fire it without losing context.

## Launch

The Codex CLI ships inside the Codex.app bundle at
`/Applications/Codex.app/Contents/Resources/codex` on this machine. Pipe this dispatch via
stdin so the full prompt reaches the agent:

```bash
/Applications/Codex.app/Contents/Resources/codex exec --full-auto \
  -C /Users/afo/Code/greenpill/green-goods \
  - < .plans/active/public-read-side-journal/handoffs/codex-state-api-dispatch.md
```

---

## Dispatch Prompt

You are Codex implementing the `state_api` lane of the
`public-read-side-journal` feature in the Green Goods monorepo at
`/Users/afo/Code/greenpill/green-goods`.

### Source of truth

Treat `.plans/active/public-read-side-journal` as authoritative. Read first:

- `status.json`
- `spec.md`
- `plan.todo.md`
- `brief.md`
- `eval.md`
- `discovery-notes.md`
- `handoffs/codex-state-api.md` ← **your full scope; this dispatch is a wrapper, not a replacement**
- root `AGENTS.md`
- `packages/agent/AGENTS.md`
- `packages/shared/AGENTS.md`
- `packages/client/AGENTS.md` (touched only for state/API plumbing, never for UI pages/components)

### Operating rules (do not violate)

1. **Lane ownership.** You own `state_api` only. Do not start `ui`, `qa_pass_1`, or
   `qa_pass_2`. Do not add new plan-hub lanes.
2. **Manual UI block.** `lanes.ui.manual_blocked` stays `true` until you complete every
   required item in `status.json.contract_stability_checklist` AND run the explicit unblock
   command (see Checkpoint 8). UI does not auto-unblock from dependency satisfaction alone.
3. **Status integrity.** Update `status.json.contract_stability_checklist.items[*].status`
   as work progresses (`planned` → `in_progress` → `complete`). Use only the allowed item
   statuses: `planned`, `in_progress`, `complete`, `blocked`. Add a history entry on each
   substantive transition.
4. **No fake proof.** Never mark a card rail `live`, an onchain confirmation success, a
   subscription `subscribed`, or a public metric without backing evidence. Unproven card rails
   stay hidden by default.
5. **Receipt-token safety.** Tokens never appear in query params, JSON bodies, logs, or
   analytics. Receipt URL form is exactly
   `/fund?intent=<id>#receiptToken=<token>`. API reads accept the token only via
   `X-GG-Receipt-Token`. Receipt-bearing responses set `Cache-Control: no-store` and
   `Pragma: no-cache`.
6. **Public contracts subpath rules.** `@green-goods/shared/public-contracts` is type/data
   only — no React, no `import.meta`, no browser globals, no styles, no providers, no hooks,
   no side effects. Agent must resolve it through `packages/shared/package.json` exports
   without pulling the shared root.
7. **Wallet vs card scope.** Reown AppKit + wagmi/viem stays the wallet baseline.
   `FundingIntent` creation is **card-only** for v1; wallet funding does not create Agent
   intents. thirdweb is scoped to direct-card funding only.
8. **Hono migration first.** Migrate Agent HTTP from Fastify to Hono *before* adding
   `/public/*` or `/webhooks/thirdweb`. Preserve every existing endpoint and behavior listed
   in the compatibility checklist (`/health`, `/ready`, `/webhook/telegram`, platform
   webhook allowlist, `/api/feedback`, `/api/notify`, polling/webhook startup modes,
   graceful shutdown, `/api/*` bearer auth). Migrate route tests from Fastify inject to Hono
   request testing. Remove Fastify only after no imports remain in source, tests, or
   `package.json`.
9. **Donate copy guard.** No tax-deductible, charitable-status, nonprofit, or legal-receipt
   claims unless separately configured and reviewed.
10. **Endow copy.** Use "designed to preserve" language with explicit smart contract / token
    / yield / provider / wallet recovery risk copy.
11. **i18n.** Every new user-facing string lives in `en`, `es`, **and** `pt`.
12. **Tooling.** Use `bun` scripts; never raw `forge`. Use Remixicon, never lucide. Use
    `logger` from shared, never `console.log`.
13. **Don't touch unrelated dirty files.** `env.d.ts` has unrelated whitespace drift; leave
    it alone.
14. **Do not update root `DESIGN.md`** for this pass.
15. **Public browser components stay in `packages/client`** — never `packages/shared`.
16. **No new Agent public API base URL.** Reuse existing `VITE_API_BASE_URL`. Do not add
    `VITE_AGENT_PUBLIC_API_URL`.
17. **viem RPC resolver is server-only.** `resolveAgentRpcUrl(chainId, env)` reads
    chain-specific env first (`ETHEREUM_RPC_URL`, `SEPOLIA_RPC_URL`, `ARBITRUM_RPC_URL`,
    `CELO_RPC_URL`, `OPTIMISM_RPC_URL`, test-only `VITE_RPC_URL_11155111`), then falls back
    to `getNetworkConfig(chainId, ALCHEMY_API_KEY || ALCHEMY_KEY || "demo").rpcUrl`. Inject
    into `initBlockchain` and the confirmation client.

### Branch

**All work commits directly to `develop`** per orchestrator instruction — do not create a
feature branch, do not use a worktree. The `lanes.state_api.branch` field in `status.json`
is documentation of the default convention; this run overrides it. Make small, logical
commits as you go (Conventional Commits with scope, e.g. `feat(agent): migrate http server
to hono`).

### Checkpoints (no new plan-hub lanes)

Use `status.json.contract_stability_checklist.items[*]` to track contract stability;
checkpoint structure below organizes the implementation sequence without adding lanes.

1. **Hono migration with parity.** Replace Fastify in `packages/agent`. Preserve every
   route, behavior, startup mode, shutdown, and bearer-auth semantic in the Hono
   compatibility checklist. Migrate tests to Hono request testing. Do not remove Fastify
   until no imports remain.
2. **Server-safe shared public contracts + seeded fixtures.** Create
   `packages/shared/src/public-contracts/` with the framework-free types from
   `handoffs/codex-state-api.md` (Address, PublicLocale, PublicApiError, PublicSubscribe*,
   FundingIntent*, ClientCheckout*, ThirdwebNormalizedFundingEvent, FundingTransactionAttempt,
   PublicFundingReceipt, canonical `availabilityKey` v1 builder). Add the
   `./public-contracts` export to `packages/shared/package.json`. Wire client
   TypeScript/Vite resolution. Confirm Agent can import the subpath without pulling the
   shared root or browser-only modules. Seed handoff fixtures under
   `.plans/active/public-read-side-journal/artifacts/fixtures/` for funding availability,
   funding intents, contact subscription, `/fund?garden`, and `/impact`. Mark
   `route_paths` and `public_types_and_fixtures` checklist items `complete` when stable.
3. **Public subscription route + Luma honesty.** `POST /public/subscribe` with single-
   opt-in consent, server-side Luma Calendar People import, preconfigured Green Goods tag,
   honest `subscribed` / confirmed `already_subscribed` / safe-failure responses. No fake
   success on Luma outage. Mark `contact_endpoint_behavior` complete when stable.
4. **Funding availability + provider proof registry + `/fund?garden` resolution.**
   `PublicFundingAvailability` shared-read helper with `live` / `comingSoon` / `hidden` /
   `disabled`, full `reasonCode` enum (`no_destination`, `proof_pending`,
   `provider_unavailable`, `chain_unsupported`, `token_unsupported`, `config_missing`,
   `disabled`), state/params semantics, and amount validation split (amount errors are
   `PublicApiErrorCode`, not base availability `reasonCode`). Code-owned provider proof
   registry keyed by exact tuple, hidden-by-default, `live` requires proof reference.
   `/fund?garden=` exact id/address first, then unique-slug match via
   `publicGardenHelpers.deriveSlug`, with stale/missing/zero-match/ambiguous fallback to
   normal Fund + localized non-blocking message. Tests cover case-insensitivity,
   punctuation normalization, empty-name address fallback, stale references, slug
   collisions. Mark `availability_reason_semantics`, `provider_proof_registry`, and
   `fund_garden_resolution` complete when stable.
5. **FundingIntent ledger + idempotency + receipt-token transport + no-store headers +
   public receipt redaction.** SQLite migration via `PRAGMA user_version` or `schema_meta`.
   `funding_intents` + `funding_intent_events` (or equivalent history table) with unique
   indexes on provider session id, payment id, event id, and tx hash. Card-only v1.
   `clientRequestId` idempotency keyed by the pinned normalized fingerprint. Canonical
   `availabilityKey` recomputed server-side. `transactionAttempts[]` for allowance reset /
   approval / funding / share verification; only confirmed funding/deposit becomes
   `fundingTxHash`. Public receipt redaction (no payerEmail, no provider ids, no event
   history, no raw failure detail, no webhook payload). Receipt-token verifier stored as
   hash, never logged. Receipt URL form `/fund?intent=<id>#receiptToken=<token>`. API reads
   require `X-GG-Receipt-Token`; reject query/body tokens. Receipt-bearing create/read
   responses set `Cache-Control: no-store` and `Pragma: no-cache`. Allowlisted
   `ClientCheckoutPayload` only — durable provider ids, raw payloads, receipt tokens, and
   unknown nested checkout fields are rejected from public responses. Mark
   `public_receipt_shape` complete when stable.
6. **thirdweb webhook + rate limits + trusted-proxy + onchain confirmation.**
   `POST /webhooks/thirdweb` reads/verifies raw body before parsing JSON, then normalizes
   to `ThirdwebNormalizedFundingEvent`. Two-stage throttling: pre-verification IP/origin
   bucket `300/min`, post-verification provider-account bucket `300/min`. Public route
   limits: subscribe `5/hour`, funding-intent create `10/10min`, receipt read `60/10min`.
   Shared `publicRateLimitKey` helper hashes email/intent material, normalizes origin,
   derives IP from socket by default; trusts `X-Forwarded-For`/`Forwarded` only when
   server-only `AGENT_TRUSTED_PROXY_HOPS` (and optional `AGENT_TRUSTED_PROXY_CIDRS`) are
   set. Spoofed/untrusted proxy headers ignored (tested). Agent-side viem receipt/log
   polling is the v1 onchain confirmation source. Status transitions: `started` →
   `pending_provider` → `pending_onchain` → `funded`; `expired` → `funded_late` only on
   matching late confirmation; older pending events cannot overwrite terminal states.
   Abandoned `started`/`pending_provider` expire at provider checkout expiry or
   `createdAt + 30 minutes`; read-time reconciliation + scheduled sweep. Cookie Jar Donate
   reconciliation matches Garden/chain/token/receiver/destination ≥ `minAssetAmount`.
   Vault Endow reconciliation additionally verifies share ownership by intended receiver.
   Provider success alone never marks an intent funded.
7. **`/impact` visitor-safe public data contract.** Dedicated public assessment/evidence
   hook over current shared EAS reads. Default page size `12`, candidate Gardens sorted by
   latest activity desc then stable id/address asc, fetch caps of `50` Gardens and `100`
   records, finite client-side slicing. `partialData` and `sourceLimitReached` flags.
   Explicit loading / empty / partialData / sourceLimitReached / EAS-failure states.
   Newest-first sorting only within fetched slice. Prefer finite per-Garden EAS read
   option; otherwise document per-Garden overfetch as accepted v1 limit, apply local 100
   cap, preserve `sourceLimitReached`. Visitor-safe fields only. Mark `impact_hook_shape`
   complete when stable.
8. **Checklist completion + UI unblock.** Confirm every required checklist item is
   `complete`, set `contract_stability_checklist.status` to `complete`, then run **exactly**:
   ```
   node scripts/harness/plan-hub.mjs set-lane --feature public-read-side-journal --lane ui --status ready --actor codex --note "contract stability checklist complete"
   ```
   Then add a `status.json.history` note recording the transition. UI does not move from
   `blocked` to `ready` any other way.

### Validation ladder

Use the lightest honest subset while iterating. Run the full ladder before marking the lane
done:

- `node scripts/harness/plan-hub.mjs validate`
- `node scripts/harness/plan-hub.mjs list --agent codex --lane state_api --json`
- `bun run --cwd packages/agent test`
- `bun run --cwd packages/agent typecheck`
- `bun run --cwd packages/agent test:coverage` (security-sensitive routes)
- `bun run test:client` (when client touch-up tests for receipt fragment / public-contracts
  resolution are added)
- `bun run check:design-md && bun run check:design-generated && bun run check:design-tokens`
  (only if `.env.schema` or DesignMD-touched files change)
- `bun run lint:vocab` (only if i18n strings change)
- `bun run format:check && bun lint`
- `node scripts/dev/ci-local.js --quick` (cross-package shared changes)
- `VITE_CHAIN_ID=11155111 bun run build:client` (final gate)

### Final report

When done, report:

1. Per-checkpoint summary (what landed, what tests cover it).
2. Files changed by package (agent, shared, client).
3. Validation commands run + results.
4. Any honest proof limits (e.g., thirdweb spike still pending for Vault Endow) — never
   bury this.
5. Confirmation that `lanes.ui.status` is now `ready` and the unblock history note exists.
6. Next handoff: `claude/ui/public-read-side-journal`.

### Out of scope

- UI pages, components, layouts in `packages/client/src/views/` or
  `packages/client/src/components/Public*` (claude/ui lane).
- `packages/client/DESIGN.browser.md` updates (claude/ui lane).
- root `DESIGN.md` changes.
- Admin, contracts, indexer runtime changes.
- Public-side conviction voting, public withdrawals, new public route families beyond
  browser `/`.
- Replacing Reown AppKit / wagmi / viem.

---

## Memory note for the orchestrator

`feedback_claude_orchestrated_codex.md` says Claude dispatches Codex via
`codex exec --full-auto`. The CLI is not on `PATH` directly on this machine but ships inside
the Codex.app bundle at `/Applications/Codex.app/Contents/Resources/codex`. Update the
memory with that absolute path so future dispatches don't stall.
