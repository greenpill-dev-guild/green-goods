# Agent Messaging Channels Evaluation Plan

## Release Gates

1. **Correctness:** A phone linked via the web flow can execute `submit` / `approve` / `reject` / `join` over SMS and WhatsApp, with on-chain txs signed by a scoped session key (never an agent-held EOA). `REVOKE` invalidates the session key on-chain and subsequent commands return "not linked".
2. **Security:** Tier-Y rate limits hold under concurrent writes; session key selector allowlist rejects off-allowlist calls; WhatsApp + SMS webhooks verify Twilio signatures; phone numbers are hashed in logs (PII hygiene). `SessionKeyValidator.sol` passes the shared Q2 audit alongside RWA work.
3. **Regression safety:** Existing Telegram adapter behavior is unchanged after refactor to `InboundMessage`; existing handler tests pass with new argument shape.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `platforms/_base.ts` normalizes all 3 channels into `InboundMessage` and dispatch is idempotent (duplicate externalId within 24h TTL dropped) | `state_api` | Unit tests in `packages/agent/src/platforms/__tests__/_base.test.ts` green |
| AC-2 | WA + SMS webhooks pass Twilio signature verification, normalize payload, reply via TwiML (SMS chunking at 160 chars) | `state_api` | `bun run test -- platforms/__tests__/{whatsapp,sms}.test.ts` green; Twilio sandbox replay recorded in `artifacts/` |
| AC-3 | `SessionKeyValidator.sol` enforces target + selector allowlist + expiry + revoke; invariant "revoked session can never validate" holds under fuzz | `contracts` | `bun run test -- --match-contract SessionKeyValidatorTest -vvv` green; fuzz run log in `artifacts/` |
| AC-4 | `services/sessionKeys.ts` encrypts session-key material via KMS and only decrypts in-memory for UserOp signing | `state_api` | Unit tests with mock KMS + mock bundler; no plaintext key in Postgres or logs (grep evidence) |
| AC-5 | Tier-Y limits hold under concurrent writes (Redis Lua or INCR+EXPIRE) — submit 10/day, approve/reject 20/day, join 3/day, anti-spam 1/s | `state_api` | `packages/agent/src/services/__tests__/rateLimit.test.ts` green; boundary + concurrency cases covered |
| AC-6 | Client `PhoneLinking/` flow: enter phone → 6-digit code → passkey-signed UserOp → linked; revoke via passkey works | `ui` | Playwright `packages/client/e2e/phoneLinking.spec.ts` green against Twilio sandbox |
| AC-7 | E2E: inbound SMS `SUBMIT <garden> <action>` → rate limit check → UserOp sent via bundler → reply with tx hash | `qa_pass_1` | `packages/agent/test/e2e/submitFlow.test.ts` + manual Twilio sandbox recording in `artifacts/` |
| AC-8 | Season One pilot garden runs one real work cycle (submit → approve) via SMS or WA end-to-end | `qa_pass_1` | `history[]` entry with operator confirmation + tx hashes; milestone #14 closed |

## Test Strategy

- Unit: agent platforms (`_base`, `whatsapp`, `sms`), services (`sessionKeys`, `linking`, `rateLimit`), shared hook (`usePhoneLinking`), `SessionKeyValidator.sol` (Forge).
- Integration: Fastify webhook harness with mock Twilio signer; bundler sandbox for UserOp signing; Redis in Docker for rate-limit concurrency.
- E2E / Playwright: full phone linking UX in `packages/client`; agent E2E against Twilio sandbox.
- Manual checks:
  - WhatsApp business verification submitted by **2026-05-10**.
  - Twilio funding top-up ≥ $200 before Phase 5.
  - Season One operator coordination before Phase 5.2.

## QA Sequence

### Claude QA Pass 1

- Run Playwright + agent E2E against Twilio sandbox.
- Validate i18n keys for all reply templates (no raw strings in `agentCommands.ts`).
- Chrome MCP spot-check of `PhoneLinking/` flow in admin/client preview.
- If blocked (e.g. WA verification not returned), record in `handoffs/claude-qa-pass-1.md` and ship SMS-only fallback per Phase 1.3.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed and `claude/qa-pass-1/agent-messaging-channels` exists.
- Re-run targeted validation: contract fuzz for `SessionKeyValidator`, rate-limit concurrency under load, revoke-path invariant.
- Verify PII-hygiene grep (no raw phone numbers in logs).
- Close the loop on any residual defects before pilot rollout in Phase 5.2.
