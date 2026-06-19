# Codex State/API Handoff

Date: 2026-06-19
Lane: `state_api`
Linear: `PRD-599`
Branch signal: `codex/state-api/resend-email-signup-migration`

## What Changed

- Replaced the Luma public subscriber adapter with a provider-neutral subscription client backed by Resend Contacts.
- Added Resend contact create/update behavior with Green Goods metadata: `source`, optional `locale`, `consented_at`, and `green_goods_signup`.
- Added Resend routing support for configured Green Goods segment and topic IDs.
- Renamed the Agent public route dependency from `lumaClient` to `subscriptionClient`.
- Preserved `POST /public/subscribe` validation and guard order: origin checks, body-size limits, email validation, consent validation, rate limiting, honest missing-provider failure, and generic upstream failure.
- Replaced the public `luma_import_failed` contract/copy path with the existing provider-neutral `provider_unavailable` error.
- Updated root env/config docs and Agent deployment docs for `RESEND_API_KEY`, `RESEND_GREEN_GOODS_SEGMENT_ID`, and `RESEND_GREEN_GOODS_TOPIC_ID`.
- Hardened the client social-preview build hook so route shells are generated from `writeBundle` after `dist/index.html` is emitted; this addresses the Vercel preview blocker found while preparing the PR for merge.

## TDD Proof

- RED:
  - Command:
    `OPENSSL_CONF=/dev/null TMPDIR=/Users/afo/.codex/worktrees/59b3/green-goods /Users/afo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../../node_modules/vitest/vitest.mjs run resend public-api`
  - Evidence:
    Vitest ran `public-api` and `resend`. `resend.test.ts` failed because `../services/subscriptions` did not exist. `public-api.test.ts` failed because the route still returned `luma_import_failed` and still ignored the new `subscriptionClient` dependency.
- GREEN:
  - Command:
    `OPENSSL_CONF=/dev/null TMPDIR=/Users/afo/.codex/worktrees/59b3/green-goods /Users/afo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../../node_modules/vitest/vitest.mjs run resend public-api`
  - Evidence:
    `packages/agent`: `public-api.test.ts` 23 passed, `resend.test.ts` 4 passed, 27 tests passed total.
- Proof limit: none for local adapter/API behavior.

## Validation Run

- `bun run format:check`
  - Passed: 1772 files checked, no fixes needed after formatting `status.json`.
- `git diff --check`
  - Passed: no whitespace errors.
- `bun run --filter @green-goods/agent test -- resend public-api config`
  - Passed: `public-api.test.ts` 24 tests, `resend.test.ts` 4 tests, `config.test.ts` 17 tests; 45 tests total.
- `bun run --filter @green-goods/client test -- PublicGetInTouch`
  - Passed: `PublicGetInTouch.test.tsx` 6 tests.
- `bun run --filter @green-goods/shared test -- public-contracts`
  - Passed: `public-contracts.test.ts` 9 tests and `public-contracts/upload-signing.test.ts` 4 tests; 13 tests total.
- `bun run lint:vocab`
  - Passed: no banned vocabulary in 3 i18n files.
- `node scripts/harness/plan-hub.mjs validate`
  - Passed: 22 feature hubs validated.
- `bun run --filter @green-goods/client build`
  - Passed locally with Bun 1.3.10 after moving public social-preview shell generation to `writeBundle`: Vite transformed 11847 modules, emitted `packages/client/dist/index.html`, and generated the PWA worker.
- `OPENSSL_CONF=/dev/null TMPDIR=/Users/afo/.codex/worktrees/59b3/green-goods /Users/afo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../../node_modules/vitest/vitest.mjs run resend public-api`
  - Passed: 27 tests.
- `OPENSSL_CONF=/dev/null TMPDIR=/Users/afo/.codex/worktrees/59b3/green-goods /Users/afo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../../node_modules/vitest/vitest.mjs run PublicGetInTouch`
  - Passed: 6 tests.
- `bash scripts/design/check-vocab.sh`
  - Passed: no banned vocabulary in 3 i18n files.
- `OPENSSL_CONF=/dev/null /Users/afo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`
  - Passed from `packages/agent`.
- `OPENSSL_CONF=/dev/null node_modules/.bin/biome format ...`
  - Passed focused touched source/i18n files after one formatting fix.
- `OPENSSL_CONF=/dev/null /Users/afo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/.bun/oxlint@1.48.0/node_modules/oxlint/dist/cli.js ...`
  - Passed focused lint: 0 warnings, 0 errors.
- `node scripts/dev/ci-local.js --quick`
  - Ran after implementation. Format, client tests, admin hub tests, and agent tests passed. The aggregate remained non-zero because `packages/shared/src/__tests__/hooks/vault/useVaultOperations.test.ts` timed out in the existing two-step vault deposit test; this is outside the Resend/public subscribe migration surface.
- GitHub PR #577 Vercel preview check `Vercel - green-goods`
  - Blocked on the first pushed implementation head `7a6e4ed`: Vercel failed in the client social-preview closeBundle hook with `ENOENT: no such file or directory, open '/vercel/path0/packages/client/dist/index.html'`. The same client production build passed locally on this branch; develop's client Vercel check is green. Merge is blocked until the branch preview check is green.
  - Reproduced again on refreshed head `7258e13`, then fixed by moving the social-preview generation hook from `closeBundle` to `writeBundle`.
  - Confirmed remote checks green on PR head `998935a`: `Vercel - green-goods`, `Vercel - green-goods-admin`, `Vercel - green-goods-design`, and `CodeRabbit`.

## Remaining Work

- Live Resend provider QA should be run after the PR branch is deployed with the production/staging Resend secrets. The user reported the secrets were set on 2026-06-19; this handoff does not claim a live contact write until API/UI proof is captured.
- No historical Luma subscriber import was added; that remains explicitly out of scope.
- No contracts, indexer, admin, wallet, payment, or CRM UI work was included.

## Notes

- The client TSX touch was comment-only; no rendered JSX, layout, or interaction changed. Focused `PublicGetInTouch` tests passed.
- Resend API shape was checked against current Resend docs for Contacts, Segments, and Topics; deprecated Audiences APIs were not used.
