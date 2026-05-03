# Codex Review Report - Public Read-Side Journal

Date: 2026-04-27
Branch: `develop`
Reviewed scope: `989c921e..HEAD`

## Final Verdict

`done_with_followups`

The plan is functionally done after the fixes in this review pass. The remaining follow-ups are not release-blocking for the public-read-side-journal surface: exact `bun run test:client` is blocked by local restricted-network npm registry access, exact agent coverage is blocked by the local Node/Bun runtime, and `format:check` is blocked by unrelated dirty backlog-plan formatting drift.

Scope note: the prompt said 12 commits were in scope, but `git log --oneline 989c921e..HEAD` returned 9 commits:

- `383d11ff` state_api lane
- `f9370f0b`, `df7dcad5`, `27649682`, `8c3f28a1` UI lane
- `09754d24` QA pass 2 follow-ups
- `b8869b02`, `099ae29b`, `dff8c3c5` plan/report closure commits

## Area Results

### A. State API - Pass After Fixes

Pass after this audit's patches.

Confirmed:

- Hono migration is complete for the checked surface. `rg "fastify|@fastify|Fastify" packages/agent/src packages/agent/package.json` returns no matches.
- `/health`, `/ready`, platform webhooks, bearer-protected `/api/*`, startup, polling, and close/shutdown behavior remain implemented in `packages/agent/src/api/server.ts`.
- `@green-goods/shared/public-contracts` is type/data only. `rg "import\.meta|window\.|document\.|React" packages/shared/src/public-contracts/` returns no matches after removing the stale comment wording at `packages/shared/src/public-contracts/index.ts:1`.
- The shared subpath is exported and resolved in client TypeScript/Vite config: `packages/shared/package.json:26`, `packages/client/tsconfig.app.json:37`, `packages/client/vite.config.ts:375`.
- Public rate limits match the spec thresholds: `packages/agent/src/api/public-protection.ts:32-38`. Trusted proxy semantics keep direct socket identity unless trusted hops are configured: `packages/agent/src/api/public-protection.ts:54-81`.
- SQLite funding tables and unique indexes exist for funding tx hash, provider session/payment/event ids: `packages/agent/src/services/db.ts:229-306`.
- Idempotency fingerprint uses the pinned normalized fields: garden id, destination type/address, funding intent, method, canonical amount, chain id, token, availability key, provider, and optional email hash: `packages/agent/src/services/funding-intents.ts:182-203`.
- Public proof registry is hidden by default, and `live` entries require proof reference: `packages/shared/src/public-contracts/index.ts:304-368`.
- `/impact` v1 caps and deterministic ordering are implemented: `packages/shared/src/public-contracts/index.ts:459-547`.

Fixed gaps:

- `spec_violation`: receipt read rejected query tokens but did not reject JSON body tokens. The spec requires `GET /public/funding-intents/:id` to accept the token only through `X-GG-Receipt-Token` and reject query or JSON body tokens: `.plans/active/public-read-side-journal/spec.md:88-95`. Fixed by adding `hasReceiptTokenBody` and checking it in the receipt route: `packages/agent/src/api/server.ts:190-201`, `packages/agent/src/api/server.ts:808-815`. Covered at `packages/agent/src/__tests__/public-api.test.ts:226-241`.

### B. UI Lane - Pass After Fixes

Pass after this audit's patches.

Confirmed:

- Browser `/` renders the public `Home` view, `/landing` redirects to `/`, and installed PWA `/` redirects to `/home` while honoring `?redirectTo=`: `packages/client/src/router.config.tsx:35-49`, `packages/client/src/views/Public/Home.tsx:19-27`.
- SiteHeader nav order is Gardens, Impact, Fund, Actions; the public header does not expose wallet connect as a header CTA: `packages/client/src/components/Navigation/SiteHeader.tsx:7-23`.
- The requested public components live under `packages/client/src/components/Public/`.
- `/fund?garden=` exact id/address match, unique slug match, stale fallback, and ambiguous fallback are implemented: `packages/client/src/views/Public/Fund.tsx:29-52`.
- `/fund?intent=<id>` mounts `PublicFundingReceipt`, which reads the scrubbed in-memory/session token and uses the `X-GG-Receipt-Token` header: `packages/client/src/views/Public/Fund.tsx:147-151`, `packages/client/src/components/Public/PublicFundingReceipt.tsx:36-55`.
- Receipt-token fragment scrubbing runs before pageview tracking and `usePageView` redacts sensitive hash/search keys: `packages/client/src/routes/Root.tsx:6-33`, `packages/client/src/routes/receipt-token.ts:3-20`, `packages/shared/src/hooks/analytics/usePageView.ts:83-151`.
- Spot-checked i18n keys are present in `en`, `es`, and `pt`: nav labels, install/open CTA, Donate/Endow labels, Get in Touch submit, and impact partial-data message.

Fixed gaps:

- `correctness_bug`: public install CTAs passed `useInstallGuidance` arguments in the wrong order. The hook signature is `(platform, isInstalled, wasInstalled, deferredPrompt, isMobile)`: `packages/shared/src/hooks/app/useInstallGuidance.ts:102-108`. Fixed in the header, hero, and install CTA: `packages/client/src/components/Navigation/SiteHeader.tsx:29-36`, `packages/client/src/components/Public/PublicHero.tsx:15-22`, `packages/client/src/components/Public/PublicInstallCta.tsx:18-25`. The header test now locks the call shape: `packages/client/src/__tests__/components/SiteHeader.test.tsx:84-86`.
- `style_or_doc`: `SiteHeader` still had a raw `bg-black/40` overlay. Fixed to `bg-static-black/40` and removed the stale design-token baseline entry: `packages/client/src/components/Navigation/SiteHeader.tsx:136-139`, `scripts/data/design-token-usage-baseline.tsv:175-178`. `rg "text-white|bg-black" packages/client/src/components/Public packages/client/src/views/Public packages/client/src/components/Navigation/SiteHeader.tsx` now returns no matches.

Follow-up:

- `coverage_gap`: `PublicFundingMethodSelector` currently resolves card availability with `ZERO_ADDRESS` and `chainId: 0`, so the empty proof registry keeps card hidden: `packages/client/src/components/Public/PublicFundingMethodSelector.tsx:67-84`. This is acceptable for v1, but when proof entries land the UI must resolve the real destination tuple from indexer-backed reads instead of placeholders.

### C. QA Pass 2 Follow-Ups - Pass After Fixes

Pass after this audit's patches.

Confirmed:

- `confirmFundingTransaction` checks chain id before receipt lookup, decodes ERC-20 `Transfer` logs, matches token/destination/min amount, and returns structured `tuple_mismatch` reasons: `packages/agent/src/services/blockchain.ts:341-445`.
- `sweepFundingIntents`, `MemoryFundingIntentStore.listPending`, and SQLite `listPendingFundingIntents` are wired: `packages/agent/src/services/funding-intents.ts:48-64`, `packages/agent/src/services/funding-intents.ts:107-153`, `packages/agent/src/services/db.ts:767-776`.
- `createServer` schedules the sweep with `setInterval`, calls `unref`, and clears the timer on `app.close()`: `packages/agent/src/api/server.ts:503-524`.

Fixed gaps:

- `correctness_bug`: the webhook treated missing `txRole` as funding. Claude's resolution log even described `txRole` as defaulting to `funding`: `.plans/active/public-read-side-journal/qa-pass-2-report.md:128-140`. The route now requires `event.eventType === "transaction_submitted"` and `event.txRole === "funding"` before strict tuple confirmation can fund the intent: `packages/agent/src/api/server.ts:867-880`. Covered for missing role, tuple mismatch, and expired-to-funded_late precedence: `packages/agent/src/__tests__/public-api.test.ts:389-537`.
- `coverage_gap`: tests were missing for the new tuple matcher and sweep. Added `packages/agent/src/__tests__/blockchain-funding.test.ts:38-110` and `packages/agent/src/__tests__/funding-intents.test.ts:32-62`.

### D. Suspect Surfaces - Pass With Follow-Ups

Pass with one accepted v1 follow-up.

- Chain mismatch is deliberate: `Blockchain` pins `this.chainId` at construction and `confirmFundingTransaction` rejects expected chain ids that differ before reading the receipt: `packages/agent/src/services/blockchain.ts:125-128`, `packages/agent/src/services/blockchain.ts:341-351`.
- Late onchain success can still move `expired -> funded_late`; covered by the webhook test at `packages/agent/src/__tests__/public-api.test.ts:488-537`.
- Receipt-token JSON exposure is consistent with the spec: creation returns a receipt URL/token to the browser, while subsequent reads use the header only. Spec/handoff support this: `.plans/active/public-read-side-journal/spec.md:88-95`, `.plans/active/public-read-side-journal/handoffs/codex-state-api.md:251-263`.
- Dev server proof remains environment-dependent under restricted network. Expected public/dev envs include `VITE_API_BASE_URL`, `VITE_GOOGLE_APPOINTMENT_URL`, `VITE_THIRDWEB_CLIENT_ID`, `LUMA_*`, `THIRDWEB_WEBHOOK_SECRET`, `AGENT_PUBLIC_ALLOWED_ORIGINS`, and trusted-proxy settings.

## Gaps Found That Claude Missed

| Severity | Gap | Fix |
|---|---|---|
| `spec_violation` | Receipt read did not reject body-carried receipt tokens, despite spec requiring header-only reads and query/body rejection. | Added body-token detection and route rejection; covered in `public-api.test.ts`. |
| `correctness_bug` | Thirdweb webhook defaulted missing `txRole` to funding, allowing strict tuple confirmation for events that were not explicitly funding-role events. | Require `txRole === "funding"`; added missing-role, mismatch, and late-funding tests. |
| `correctness_bug` | Public install guidance callers passed `isMobile` where `isInstalled` belongs and passed a boolean where `deferredPrompt` belongs. | Corrected call order in SiteHeader, PublicHero, and PublicInstallCta; expanded SiteHeader test. |
| `coverage_gap` | No direct tests covered `confirmFundingTransaction` tuple behavior or scheduled funding-intent sweep behavior. | Added focused agent tests for both. |
| `style_or_doc` | Public/header static token scan still found raw `bg-black/40`. | Swapped to `bg-static-black/40` and removed the stale baseline entry. |

## Validation Ladder

| Command | Result |
|---|---|
| `node scripts/harness/plan-hub.mjs validate` | Passed. `Validated 20 feature hubs.` |
| `bun run --cwd packages/agent test` | Passed after fixes. 9 files, 89 tests. |
| `bun run --cwd packages/agent typecheck` | Passed. |
| `bun run --cwd packages/agent test:coverage` | Exact command failed in this local runtime: `No such built-in module: node:inspector/promises`. Fallback with bundled Node passed: 9 files, 89 tests, coverage emitted. |
| `bun run test:client` | Failed on restricted network: npm registry `ECONNREFUSED` while fetching `node`. |
| Public client Vitest subset | `bun --bun vitest ...` exposed a Bun/Vitest `zod` interop import failure. Bundled Node fallback passed the requested public subset: 7 files, 45 tests. SiteHeader was rerun after the token fix: 1 file, 6 tests. |
| `bun run check:design-md` | Passed with existing warnings only: root DesignMD has unused `amber` and `sky` colors. |
| `bun run check:design-generated` | Passed. |
| `bun run check:design-tokens` | Passed after removing the stale `SiteHeader` raw-token baseline entry. |
| `bun run lint:vocab` | Passed. |
| `bun run format:check` | Failed only on unrelated dirty `.plans/backlog/developer-experience-proof-pass/status.json` formatting at lines 34-72. I did not modify that backlog plan. |
| `bun lint` | Passed with warnings only: oxlint reported 636 warnings / 0 errors; solhint reported 164 warnings / 0 errors. |
| `VITE_CHAIN_ID=11155111 bun run build:client` | Passed after final UI token fix. Build still emits existing Rollup/chunk warnings. |

Additional targeted checks:

- `rg "fastify|@fastify|Fastify" packages/agent/src packages/agent/package.json` returned no matches.
- `rg "import\.meta|window\.|document\.|React" packages/shared/src/public-contracts/` returned no matches.
- `rg "text-white|bg-black" packages/client/src/components/Public packages/client/src/views/Public packages/client/src/components/Navigation/SiteHeader.tsx` returned no matches.
- i18n spot-check across `en`, `es`, and `pt` returned all present for 10 public keys.

## Suggested Commit Shape

Smallest clean commit set:

1. `fix(agent): tighten public funding receipt and webhook reconciliation`
   - `packages/agent/src/api/server.ts`
   - `packages/agent/src/__tests__/public-api.test.ts`
   - `packages/agent/src/__tests__/blockchain-funding.test.ts`
   - `packages/agent/src/__tests__/funding-intents.test.ts`

2. `fix(client): correct public install guidance and token overlay`
   - `packages/client/src/components/Navigation/SiteHeader.tsx`
   - `packages/client/src/components/Public/PublicHero.tsx`
   - `packages/client/src/components/Public/PublicInstallCta.tsx`
   - `packages/client/src/__tests__/components/SiteHeader.test.tsx`
   - `scripts/data/design-token-usage-baseline.tsv`

3. `chore(shared): keep public contracts guard literal-clean`
   - `packages/shared/src/public-contracts/index.ts`

These could also be squashed into one `fix(agent,client,shared): close public journal review gaps` commit if a single audit commit is preferred.
