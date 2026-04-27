# QA Pass 2 Report - Public Browser Editorial UI

Date: 2026-04-27
Lane: `qa_pass_2`
Verdict: `blocked`

## Per-Area Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Hono migration | Pass | `packages/agent` has no Fastify imports or package dependency. Hono server owns `/health`, `/ready`, `/webhook/:platform`, `/api/feedback`, `/api/notify`, `/public/*`, and `/webhooks/thirdweb`. Agent tests passed. |
| `@green-goods/shared/public-contracts` | Pass with receipt-token caveat | Subpath export exists and the file is type/data only. Agent imports the subpath through package exports. However the contract still includes `receiptToken` in the create response. |
| `/public/*` routes | Blocked | Required paths and rate-limit thresholds exist, but create responses include raw receipt tokens in JSON bodies, conflicting with this dispatch's receipt-token safety rule. |
| FundingIntent | Blocked | Creation has `destinationAddress`, canonical `availabilityKey`, `clientRequestId`, card-only validation, idempotency fingerprinting, transaction attempt storage, and read-time expiry. Missing locked sweep and strict onchain match gates before `funded` / `funded_late`. |
| `/impact` | Pass with test-runner gap | Shared public impact contract exposes page size 12, max 50 Gardens, max 100 records, deterministic slicing, `partialData`, and `sourceLimitReached`. Client/shared Vitest could not execute under restricted network. |
| UI lane | Pass with test-runner gap | Router/design files align: browser `/`, `/landing` redirect, installed PWA `/` -> `/home`, SiteHeader nav order, Install/Open App CTA, no browser bottom AppBar. Some legacy client tests still assert old Connect Wallet/old Impact behavior and should be cleaned before the client suite can be trusted. |
| Copy guard | Pass | Donate/support copy is explicit that funding is direct support and not tax-deductible/charitable/nonprofit-backed unless separately configured. Endow copy uses "designed to preserve" plus risk copy. |
| i18n | Pass | Public `en` keys checked against `es` and `pt`: 0 missing in each locale, 179 public keys checked. `lint:vocab` passed. |
| Design gates | Pass | `check:design-md`, `check:design-generated`, `check:design-tokens`, and `lint:vocab` passed. DesignMD reported 0 errors and 2 existing root warnings for unused amber/sky colors. |
| `build:client` | Pass | `VITE_CHAIN_ID=11155111 bun run build:client` completed successfully with existing Rollup/chunk-size warnings. |

## Blocking Findings

1. Receipt tokens still appear in JSON responses.

   The dispatch says receipt tokens must never appear in JSON bodies. The shared public contract exposes `receiptToken` on `CreateFundingIntentResponse`, and the Hono create route returns both `receiptToken` and `receiptUrl` with `#receiptToken=...` in the JSON body. Evidence:

   - `packages/shared/src/public-contracts/index.ts:130` includes the create response shape.
   - `packages/shared/src/public-contracts/index.ts:138` includes `receiptToken: string`.
   - `packages/agent/src/api/server.ts:691` and `packages/agent/src/api/server.ts:714` return `receiptToken`.
   - `packages/agent/src/api/server.ts:692` and `packages/agent/src/api/server.ts:715` return a receipt URL containing the token fragment.

   This needs a contract decision. Either the dispatch rule should be softened, or the create flow should move token delivery out of JSON.

2. Onchain confirmation does not prove the destination tuple before marking funding success.

   The webhook path maps any confirmed submitted transaction to `funded`; the confirmation helper checks only transaction receipt success/failure and does not decode or match Cookie Jar/Vault logs, Garden, destination, receiver, token, chain, or `minAssetAmount`. Evidence:

   - `packages/agent/src/api/server.ts:782-788` maps confirmed submission to `funded`.
   - `packages/agent/src/api/server.ts:803-810` stores funded amount/hash from the event without tuple validation.
   - `packages/agent/src/services/blockchain.ts:270-278` only checks receipt status.

   This violates the locked rule that provider success alone never marks funding complete and that `expired -> funded_late` requires an exact intent/provider/Garden/destination/receiver/token/chain/min amount match.

3. Abandoned-intent expiry has read-time reconciliation but no scheduled sweep.

   `expireIfAbandoned` implements provider expiry / `createdAt + 30 minutes`, and receipt reads call it. I found no scheduled Agent sweep for visitors who never return. Evidence:

   - `packages/agent/src/services/funding-intents.ts:195-211` implements expiry.
   - `packages/agent/src/api/server.ts:745-749` runs it only during receipt reads.
   - `rg "sweep|scheduled.*expire|expire.*scheduled" packages/agent/src` found no scheduled sweep.

4. Client Vitest gate is not currently executable in this sandbox, and static review found stale client tests.

   The required `bun run test:client` and the narrowed client/shared Vitest subsets failed before executing tests because npm tried to fetch `node` from `registry.npmjs.org` and network is restricted. Static review also found legacy tests that still expect old Connect Wallet/header and old Impact behavior:

   - `packages/client/src/__tests__/components/SiteHeader.test.tsx:67-76` expects `Connect Wallet` in `SiteHeader`; current `SiteHeader` intentionally renders Gardens / Impact / Fund / Actions plus Install/Open App at `packages/client/src/components/Navigation/SiteHeader.tsx:7-11` and `:100-108`.
   - `packages/client/src/__tests__/views/fund.test.tsx:99-143` expects Deposit/Cookie Jar/Connect Wallet buttons from the old Fund page.
   - `packages/client/src/__tests__/views/PublicImpact.test.tsx:36-49` mocks `useGardens`, while current `ImpactPage` uses `usePublicStats` and `usePublicImpactEvidence`.

## Validation Commands

| Command | Result |
| --- | --- |
| `node scripts/harness/plan-hub.mjs validate` | Pass: `Validated 20 feature hubs.` |
| `node scripts/harness/plan-hub.mjs list --agent codex --lane state_api --json` | Pass, but output lists ready Codex state_api lanes for other features only: `fix-garden-domain-ui`, `agent-upload-signer`. It does not list this completed lane. |
| `node scripts/harness/plan-hub.mjs list --agent claude --lane ui --json` | Pass, but output lists ready Claude UI lanes for other features only: `fix-garden-domain-ui`. It does not list this completed lane. |
| `bun run --cwd packages/agent test` | Pass: 7 files, 83 tests. |
| `bun run --cwd packages/agent typecheck` | Pass: `tsc --noEmit` exited 0. |
| `bun run --cwd packages/agent test:coverage` | Pass: 7 files, 83 tests. Coverage summary: all files 43.08% statements / 33.95% branches / 48.42% funcs / 44.77% lines. |
| `bun run test:client` | Failed before tests: npm fetch to `https://registry.npmjs.org/node` returned `ECONNREFUSED`. |
| Narrow client Vitest subset | Failed before tests with the same npm registry fetch for `node`. Command targeted Root/PublicShell/SiteHeader/PublicFund/PublicImpact. |
| Narrow shared Vitest subset | Failed before tests: npm registry lookup for `node` returned `ENOTFOUND`. Command targeted `public-contracts.test.ts` and `usePageView.test.tsx`. |
| `bun run check:design-md` | Pass: 0 errors. Root `DESIGN.md` reported 2 warnings for unused `colors.amber` and `colors.sky`; other DesignMD files had 0 warnings/errors. |
| `bun run check:design-generated` | Pass: exit 0. |
| `bun run check:design-tokens` | Pass: runtime tokens present, generated radius outputs present, no new raw token literals, token version coupled at `2.3.0`. |
| `bun run lint:vocab` | Pass: no banned vocabulary in `en`, `es`, `pt`. |
| `bun run format:check` | Pass: 1529 files checked, no fixes applied. |
| `bun lint` | Pass with warnings: oxlint found 636 warnings / 0 errors; contracts lint found 164 warnings / 0 errors. Also printed an update-check network warning. |
| `VITE_CHAIN_ID=11155111 bun run build:client` | Pass: built in 27.30s. Existing warnings: Rollup pure annotation warnings, circular chunk warnings, dynamic/static import chunk warnings, sourcemap warning, and large chunks. |

Additional static checks:

- `rg "fastify|@fastify|Fastify" packages/agent/src packages/agent/package.json package.json` returned no matches.
- Public i18n coverage script: `es: 0 missing public keys`, `pt: 0 missing public keys`, `en public keys checked: 179`.
- `git status --short` was clean before report creation.

## Status.json Mutation

Applied lane update:

```bash
node scripts/harness/plan-hub.mjs set-lane \
  --feature public-read-side-journal \
  --lane qa_pass_2 \
  --status blocked \
  --actor codex \
  --note "QA Pass 2 blocked: receipt-token JSON exposure, FundingIntent onchain tuple/sweep gaps, and client Vitest gate blocked by restricted npm fetch"
```

This set `lanes.qa_pass_2.status` to `blocked`, set `lanes.qa_pass_2.manual_blocked` to `true`, and added the history note.

Post-mutation validation:

- `node scripts/harness/plan-hub.mjs validate` passed with `Validated 20 feature hubs.`

## Final Verdict

`lanes.qa_pass_2.status` is `blocked`.

The repo gates that could run are mostly green, and the public browser build is healthy. The lane cannot honestly pass until the receipt-token transport rule is reconciled, FundingIntent confirmation enforces the locked destination/onchain match and scheduled sweep, and the client test gate can execute with aligned tests.
