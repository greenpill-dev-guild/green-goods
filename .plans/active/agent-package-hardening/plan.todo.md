# Agent Package Hardening (Pre-SMS Polish Pass)

**Slug**: `agent-package-hardening`
**Status**: `ACTIVE`
**Created**: `2026-04-25`
**Priority**: `p2`
**Branch**: `chore/agent-package-hardening`

## Why this exists

The full SMS + WhatsApp build is already scoped in `.plans/active/agent-messaging-channels/plan.todo.md` (Twilio + ERC-4337 session keys + phone↔passkey linking, target outcome 2026-06-30). That plan is the **3-month goal**: SMS as the primary onboarding channel for operators bringing gardeners in by phone number.

This plan is the **lighter pre-work**: tighten the existing telegram-bound agent and its services so the SMS plan has a clean platform to build on. Telegram is the durable issue/onboarding ingress channel and stays — this isn't deprecation, it's polish. Implementation lands in May polish window; the heavy SMS lift starts late May / June per Afo.

## Relationship to `agent-messaging-channels`

This plan is **scoped strictly to existing code** (`packages/agent/`). Anything that touches new platform adapters (`platforms/whatsapp.ts`, `platforms/sms.ts`), session keys, phone linking, or `SessionKeyValidator.sol` belongs to `agent-messaging-channels` and is **out of scope here**. If a hardening item naturally extends a service that the SMS plan also touches (`services/rate-limiter.ts`, `services/crypto.ts`), keep the change minimal and forward-compatible — don't refactor service shapes the SMS plan will rewrite.

## Background

`packages/agent/`:
- Fastify webhook + Telegraf (telegram only currently).
- Handlers: `approve`, `feedback`, `help`, `join`, `pending`, `reject`, `start`, `status`, `submit`, `utils`.
- Services: `ai` (xenova/transformers, local model), `blockchain` (viem), `content-filter`, `crypto`, `db`, `errors`, `logger` (pino), `rate-limiter`.
- Stated non-negotiables (`packages/agent/AGENTS.md`):
  - Pure handlers with injected deps for testing.
  - Never store plaintext private keys.
  - Rate-limit externally triggered actions.
  - Generic user-facing errors — no internal detail leakage.
- Coverage explicitly permissive — "correctness depends more on targeted tests than on threshold."

## Hardening surface area

### A. Test coverage on auth-implicating handlers
Handlers `approve`, `reject`, `submit`, `join` carry on-chain or trust-bearing consequences. Coverage today is permissive. This pass:
- Inventory current coverage per handler (`bun run test:coverage --reporter=text-summary` per file).
- Add unit tests around: authorization checks (only Operator can approve, only Gardener can submit, role read failures), idempotency on retries, malformed input rejection, error path behavior (verify generic user reply, internal log captures detail).
- Goal is meaningful coverage, not threshold theatre — Afo: "we can figure out a threshold later."

### B. Idempotency on side-effecting handlers
Telegram delivery can retry; if `submit` or `approve` runs twice for the same external message ID, on-chain state can desync from agent state.
- Audit `submit` and `approve` for idempotency keys (likely external message ID + handler name).
- If missing, add deduplication via existing db service (or a small in-memory LRU if db round-trip is too costly).
- Forward-compatible: SMS plan also needs idempotency (Phase 1.1 in `agent-messaging-channels` adds `Redis`-backed dedup). If existing dedup mechanism is db-based, document the migration path so the SMS plan can swap the backing store without changing handler logic.

### C. Error sanitization at the platform boundary
Stated non-negotiable: no internal error details leaked to users. Verify by:
- Reading every `try/catch` boundary in handlers.
- Confirming user-facing replies route through a sanitization layer (likely `services/errors.ts`).
- Adding tests that intentionally trigger internal errors (db down, blockchain RPC error) and assert the user-facing message stays generic while logger captures the structured detail.

### D. Rate-limit coverage audit
Stated non-negotiable: rate-limit externally triggered actions. Verify by:
- Listing every public handler entry point.
- Confirming each is wrapped or invokes `rate-limiter.ts`.
- Adding a test matrix: spec each handler's rate limit and assert enforcement.
- Note: `agent-messaging-channels` Decision Log #6 sets tier-Y limits (submit 10/day, approve/reject 20/day, join 3/day, status/pending/help unlimited). Align telegram limits with these tiers now so SMS inherits parity.

### E. Crypto flow spot-check
Stated non-negotiable: never store plaintext private keys.
- Read `services/crypto.ts` end-to-end.
- Trace every call site for any agent-managed key material.
- Confirm encryption-at-rest, KMS/secret-manager integration (if any), no logging of key material in any pino field.
- Document the flow in `packages/agent/AGENTS.md` — short paragraph on how key material moves so future agents don't violate the invariant by accident.

### F. Observability tighten (optional, ship if cheap)
- Confirm pino is structured, not pretty-formatted, in production.
- Add request-id propagation through handler → service calls so log lines are joinable.
- Document log-key vocabulary (`gardenId`, `accountAddress`, `handler`, `externalMessageId`) so SMS plan inherits a consistent shape.

## Constraints

- All shared imports via barrel (`@green-goods/shared`); internal agent imports relative.
- No `console.log` — use `logger` (already enforced; verify).
- `Address` type for any address fields.
- No new external dependencies in this plan; SMS plan adds Twilio/Redis/KMS.
- Validation: `cd packages/agent && bun run test && bun run typecheck && bun run lint`. Shared impact: from repo root `node scripts/dev/ci-local.js --quick`.

## Success

- Auth-implicating handlers have meaningful unit coverage on auth paths and idempotency.
- Submit/approve idempotency demonstrably handles double-delivery.
- User-facing error replies verified generic by test; logger captures structured detail.
- Every public handler has rate-limit enforcement with tier-aligned numbers.
- Crypto flow documented in `AGENTS.md`; no plaintext key material in logs or db.
- `bun run test && bun run typecheck` green; coverage report shows movement on the targeted handlers (no formal threshold required).

## Out of scope

- Twilio / WhatsApp / SMS integration → `agent-messaging-channels`.
- Phone↔passkey linking → `agent-messaging-channels`.
- ERC-4337 session keys → `agent-messaging-channels`.
- New AI service direction.
- New platform adapters of any kind.

## Checklist

- [ ] A. Coverage inventory + auth-path tests on `approve` / `reject` / `submit` / `join`.
- [ ] B. Idempotency audit + dedup on side-effecting handlers; forward-compat note for SMS plan.
- [ ] C. Error sanitization audit + boundary tests.
- [ ] D. Rate-limit coverage audit + tier alignment with `agent-messaging-channels` Decision #6.
- [ ] E. Crypto flow spot-check + AGENTS.md documentation.
- [ ] F. (Optional) Pino structure + request-id propagation.
- [ ] Validation suite green.
