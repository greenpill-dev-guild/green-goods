# Codex State/API Handoff

Date: 2026-05-04
Branch: `develop` per user instruction
Scope: existing `packages/agent` hardening only

## Scope Shipped

Completed the existing-agent hardening pass for the `state_api` lane.

- Auth-path coverage and guards: `approve` / `reject` now require local `operator` role before side effects; `submit` text/voice/confirm paths now require gardener role; `join` covers malformed/missing garden paths.
- Idempotency: `approve`, `reject`, and `confirm_submission` use message-scoped DB idempotency keys derived from `handler + platform + platformId + externalMessageId`; duplicates return completed or in-progress responses before stale pending/session checks.
- Error sanitization: `join`, `approve`, `reject`, and `confirm_submission` route internal failures through `classifyError()` and keep raw details in structured logs.
- Rate limits: externally triggered action tiers now align with `agent-messaging-channels` Decision #6: submit `10/day`, approve/reject `20/day`, join `3/day`; status/pending/help stay unlimited.
- Crypto flow: `packages/agent/AGENTS.md` now documents the key-material boundary and confirms handlers/logs must not persist or emit raw private keys.

Files touched:
- `packages/agent/AGENTS.md`
- `packages/agent/src/handlers/idempotency.ts`
- `packages/agent/src/handlers/index.ts`
- `packages/agent/src/handlers/approve.ts`
- `packages/agent/src/handlers/reject.ts`
- `packages/agent/src/handlers/join.ts`
- `packages/agent/src/handlers/submit.ts`
- `packages/agent/src/services/db.ts`
- `packages/agent/src/services/rate-limiter.ts`
- `packages/agent/package.json`
- `packages/agent/scripts/run-coverage.mjs`
- `packages/agent/src/__tests__/handlers.test.ts`
- `packages/agent/src/__tests__/rate-limiter.test.ts`
- `packages/agent/src/__tests__/setup.ts`

Out of scope for this slice:
- SMS, WhatsApp, phone linking, session keys, or new platform adapters.
- New Redis/KMS/Twilio dependencies.

## TDD Proof

RED:

Command:

```bash
bun run test -- src/__tests__/handlers.test.ts
```

Evidence:

```text
FAIL src/__tests__/handlers.test.ts src/__tests__/rate-limiter.test.ts
Failed tests covered:
- join leaked raw lookup errors
- operator accounts could submit gardener work
- confirm_submission duplicated side effects for the same external message id
- approve/reject allowed non-operators to reach side effects
- approve duplicated onchain side effects for the same external message id
- status/pending were blocked by generic command-rate exhaustion
- RATE_LIMITS did not expose join and did not match submit/approval daily tiers
Test Files 2 failed (2)
Tests 12 failed | 25 passed (37)
```

GREEN:

Command:

```bash
bun run test -- src/__tests__/handlers.test.ts
```

Evidence:

```text
PASS src/__tests__/handlers.test.ts (19 tests)
PASS src/__tests__/rate-limiter.test.ts (18 tests)
Test Files 2 passed (2)
Tests 37 passed (37)
```

## Validation

```bash
bun run format
# Formatted 44 files in 16ms. Fixed 1 file.

bun run format:check
# Checked 44 files in 16ms. No fixes applied.

bun run test
# Test Files 11 passed (11)
# Tests 114 passed (114)

bun run typecheck
# tsc --noEmit

bun run lint
# Found 0 warnings and 0 errors.

bun run test:coverage -- --coverage.reporter=text-summary
# Test Files 11 passed (11)
# Tests 114 passed (114)
# Statements 57.72% (1027/1779)
# Branches 50.19% (659/1313)
# Functions 62.17% (194/312)
# Lines 60.01% (992/1653)
```

Coverage runner fix:

```bash
bun run test:coverage -- --coverage.reporter=text-summary
# Error: No such built-in module: node:inspector/promises

node -p "process.versions.node"
# 18.18.2

/Users/afo/.local/share/mise/installs/node/22.22.1/bin/node ../../node_modules/vitest/vitest.mjs run --coverage --coverage.reporter=text-summary
# Test Files 11 passed (11)
# Tests 114 passed (114)
# Coverage report from v8
```

`packages/agent/scripts/run-coverage.mjs` now rejects Bun and Node runtimes that cannot use `node:inspector/promises`, resolves the repo's Node 22 runtime, and invokes Vitest with the same arguments. This keeps `bun run test:coverage` usable from `packages/agent` while preserving V8 coverage.

Final review addendum:

```bash
bun run test -- src/__tests__/handlers.test.ts src/__tests__/rate-limiter.test.ts
# Test Files 2 passed (2)
# Tests 39 passed (39)
```

The closeout review found and fixed an idempotency in-progress edge where duplicate deliveries could hit stale pending/session state before a completed response existed. Regression coverage now asserts in-progress responses before `getPendingWork()` / `getSession()` lookups.

## Notes For QA

- The idempotency backing store is SQLite for this pre-SMS pass. The SMS/Redis work can swap backing storage behind `handlers/idempotency.ts` without changing handler behavior.
- `rg -n "privateKey|ENCRYPTION_SECRET|prepareKeyForStorage|getPrivateKey|log\\.|auditLog|private key" packages/agent/src packages/agent/AGENTS.md` was used for the crypto spot-check. Source truth: `db.createUser()` encrypts before insert, `db.getUser()` decrypts through crypto helpers and migrates legacy plaintext on read, and logs/audit calls do not emit raw `privateKey` fields.
- Optional observability: production pino remains structured JSON through `services/logger.ts`; no request-id propagation was added because it was not needed for the hardening checklist.
