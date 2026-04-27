# Agent Messaging Channels Plan

**Feature Slug**: `agent-messaging-channels`
**Epic**: [#464](https://github.com/greenpill-dev-guild/green-goods/issues/464)
**Outcome Milestone**: [Outcome: Agent reachable on 2 non-web channels](https://github.com/greenpill-dev-guild/green-goods/milestone/14) (#14)
**Spec**: [spec.md](./spec.md)
**Status**: `BACKLOG`
**Created**: `2026-04-17`
**Last Updated**: `2026-04-17` (initial plan)
**Hard Deadline**: Twilio + WA business verification submitted **2026-05-10**; outcome milestone **2026-06-30**
**Branch Strategy**: `feature/agent-messaging-channels` with phase commits for independent rollback

## Scheduling Update — 2026-04-26

Afo deferred this out of the current active product-development push. Keep it in backlog for later sequencing after the current closeout set and the May product-development pause.

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Transactional agent with linked accounts (phone ↔ passkey account) | Users expect to act, not just read; preserves self-custody via passkey anchor. |
| 2 | Twilio as single provider for WhatsApp + SMS | One SDK, one bill, one support channel; cheapest path to 2 channels. |
| 3 | Tier-Y capability: read-only unlimited, transactional rate-limited | Caps blast radius on SIM swap / compromise without blocking normal usage. |
| 4 | ERC-4337 session keys scoped per-user, granted at phone linking | On-chain enforcement of permissions; agent backend never holds EOA keys. |
| 5 | Session TTL 30 days with auto-refresh via SMS confirmation | Forces periodic re-verification; rotation path without UX friction. |
| 6 | Rate limits: submit 10/day, approve/reject 20/day, join 3/day, status/pending/help unlimited | Tier-Y numbers tuned to realistic operator volume; revisited post-pilot. |
| 7 | Revoke via web (passkey) OR `REVOKE` keyword via messaging | Dual-path recovery: web for lost phone, SMS for compromised session. |
| 8 | `SessionKeyValidator.sol` audit-bundled with RWA epic (contract freeze 2026-05-30) | One audit engagement covers both Q2 contract epics — cost efficiency. |

## Requirements Coverage

| Spec Requirement | Planned Phase · Task | Status |
|---|---|---|
| Twilio accounts provisioned (WA + SMS) | 0.2 | ⬜ |
| WA business verification submitted by 2026-05-10 | 0.3 | ⬜ |
| `platforms/_base.ts` — shared parsing + dispatch | 1.1 | ⬜ |
| `platforms/whatsapp.ts` — Twilio WA webhook | 1.2 | ⬜ |
| `platforms/sms.ts` — Twilio Programmable SMS webhook | 1.3 | ⬜ |
| Unified `InboundMessage` normalization | 1.1 | ⬜ |
| `SessionKeyValidator.sol` (scoped per-user) | 2.1 | ⬜ |
| `services/sessionKeys.ts` — ERC-4337 session key mgmt | 2.2 | ⬜ |
| `services/linking.ts` — phone ↔ account linking flow | 2.3 | ⬜ |
| `services/rateLimit.ts` — tier-Y enforcement | 3.1 | ⬜ |
| Existing handlers refactored to `InboundMessage` arg | 3.2 | ⬜ |
| `shared/hooks/usePhoneLinking.ts` | 4.1 | ⬜ |
| `shared/modules/sessionKeys.ts`, `agentCommands.ts` | 4.1 | ⬜ |
| `client/views/Profile/PhoneLinking/` UX | 4.2 | ⬜ |
| Revoke UX (web + `REVOKE` keyword) | 4.2, 3.2 | ⬜ |
| E2E test (link → submit) via Twilio sandbox | 5.1 | ⬜ |
| Season One pilot garden live on messaging | 5.2 | ⬜ |
| Outcome milestone reached 2026-06-30 | 5.2 | ⬜ |

## CLAUDE.md Compliance

- ✅ All React hooks in `@green-goods/shared` (`usePhoneLinking` lives there, NOT in client)
- ✅ Barrel imports only (`import { usePhoneLinking, sessionKeys } from "@green-goods/shared"`)
- ✅ Agent package tests via `bun run test` (Vitest), contracts via `bun run test` (Forge) — never `bun test`
- ✅ Never raw `forge` — all contract commands via `bun build` / `bun run test` / `bun script/deploy.ts`
- ✅ `SessionKeyValidator.sol` frozen for audit 2026-05-30, bundled with RWA epic
- ✅ Logger from `@green-goods/shared` (no `console.log`)
- ✅ Error handling: `parseContractError()` + `USER_FRIENDLY_ERRORS` for contract errors; `createMutationErrorHandler()` in shared mutation hooks
- ✅ Query keys via `queryKeys.*` helpers
- ✅ `Address` type (not `string`) for phone-linked account addresses
- ✅ No indexer changes (messaging state is off-chain per spec)
- ✅ Single `.env` at root — Twilio + KMS + Redis credentials added to `.env.schema`
- ✅ Intent Priorities: Security #2 — rate limits + session key scope + audit gate are non-negotiable

## Phase 0 — Scaffolding + Provider Setup (2026-04-17 → 2026-05-10)

### 0.1 Branch + package scaffolding

- [ ] Create branch `feature/agent-messaging-channels` from `develop`
- [ ] Create `packages/agent/src/platforms/` (mkdir, `.gitkeep`)
- [ ] Create `packages/agent/src/services/` (mkdir, `.gitkeep`)
- [ ] Add empty files with license headers: `platforms/_base.ts`, `platforms/whatsapp.ts`, `platforms/sms.ts`
- [ ] Add empty files: `services/linking.ts`, `services/sessionKeys.ts`, `services/rateLimit.ts`
- [ ] Commit: `chore(agent): scaffold messaging platforms + services dirs`

### 0.2 Twilio account provisioning

- [ ] Create Twilio account (billing attached to Green Goods treasury)
- [ ] Purchase 1 WhatsApp-enabled sender number
- [ ] Purchase 1 SMS long-code per target region (US + 1 pilot region)
- [ ] Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WA_FROM`, `TWILIO_SMS_FROM` to `.env.schema`
- [ ] Document credentials in ops runbook (1Password)
- [ ] Commit: `chore(env): add Twilio credentials to env schema`

### 0.3 WhatsApp business verification

- [ ] Submit Meta Business Verification for WA sender (expect 1–3 week delay)
- [ ] Draft initial message templates (approval reply, reject reply, onboarding) — not needed for transactional but speeds any future opt-in marketing
- [ ] Fallback plan documented: ship SMS-only first if WA verification slips

### 0.4 Dependency check

- [ ] Verify `twilio` Node SDK compatible with Bun — add to `packages/agent/package.json`
- [ ] Verify Redis client (`ioredis` or `redis`) — add if not present
- [ ] Verify KMS SDK (`@aws-sdk/client-kms`) — add for session key encryption
- [ ] Commit: `chore(agent): add Twilio + Redis + KMS dependencies`

## Phase 1 — Platform Adapters + Unified Dispatch (2026-05-10 → 2026-05-25)

### 1.1 `_base.ts` — shared parsing + dispatch

**Files:**
- Create: `packages/agent/src/platforms/_base.ts`
- Create: `packages/agent/src/platforms/__tests__/_base.test.ts`

- [ ] Define `InboundMessage` interface per spec (channel, externalId, accountAddress?, sessionKey?, text, timestamp)
- [ ] Implement `parseCommand(text)` — keyword match (HELP/STATUS/PENDING/SUBMIT/APPROVE/REJECT/JOIN/LINK/REVOKE)
- [ ] Implement `dispatch(msg: InboundMessage)` — routes to existing handler by command
- [ ] Idempotency: cache message IDs in Redis with 24h TTL to drop duplicates
- [ ] Unit tests for parse + dispatch (mock handlers)
- [ ] Run: `cd packages/agent && bun run test -- platforms/__tests__/_base`
- [ ] Commit: `feat(agent): add unified message dispatch with InboundMessage`

### 1.2 `whatsapp.ts` — Twilio WhatsApp adapter

**Files:**
- Create: `packages/agent/src/platforms/whatsapp.ts`
- Create: `packages/agent/src/platforms/__tests__/whatsapp.test.ts`
- Modify: `packages/agent/src/server.ts` (register webhook)

- [ ] Fastify route `POST /webhook/whatsapp` — Twilio signature verification
- [ ] Normalize Twilio payload → `InboundMessage` (channel: 'whatsapp')
- [ ] Resolve `accountAddress` + `sessionKey` via `services/linking.ts` lookup
- [ ] Call `_base.dispatch`, format reply as Twilio TwiML
- [ ] Outbound rate limit (max N replies/min per user) to prevent Twilio cost DoS
- [ ] Tests with mock Twilio signature + payload
- [ ] Commit: `feat(agent): add WhatsApp platform adapter via Twilio`

### 1.3 `sms.ts` — Twilio Programmable SMS adapter

**Files:**
- Create: `packages/agent/src/platforms/sms.ts`
- Create: `packages/agent/src/platforms/__tests__/sms.test.ts`
- Modify: `packages/agent/src/server.ts` (register webhook)

- [ ] Fastify route `POST /webhook/sms` — Twilio signature verification
- [ ] Normalize payload → `InboundMessage` (channel: 'sms')
- [ ] Chunking helper: split replies > 160 chars into ordered parts
- [ ] Reply via Twilio TwiML
- [ ] Same outbound rate limit as WA
- [ ] Tests for chunking edge cases + signature verification
- [ ] Commit: `feat(agent): add SMS platform adapter via Twilio`

### 1.4 Telegram parity pass

**Files:**
- Modify: `packages/agent/src/platforms/telegram.ts` (existing)

- [ ] Refactor existing Telegram adapter to emit `InboundMessage` and use `_base.dispatch`
- [ ] Remove Telegram-specific context from existing handlers (move to `_base`)
- [ ] Existing Telegram tests pass unchanged
- [ ] Commit: `refactor(agent): route Telegram through unified dispatch`

## Phase 2 — Session Keys + Linking (2026-05-15 → 2026-05-30)

### 2.1 `SessionKeyValidator.sol` (scoped per-user)

**Files:**
- Create: `packages/contracts/src/validators/SessionKeyValidator.sol`
- Create: `packages/contracts/test/SessionKeyValidator.t.sol`

- [ ] Check if Pimlico ships a validator we can reuse — if yes, thin wrapper; if no, full implementation
- [ ] Storage: `mapping(address account => mapping(address sessionKey => Permission))`
- [ ] `Permission`: `{ targets, selectors, validUntil, revoked }`
- [ ] `validateUserOp` — check target + selector allowlist + expiry + not revoked
- [ ] `grantSession(sessionKey, targets, selectors, ttl)` — user-signed
- [ ] `revokeSession(sessionKey)` — user-signed OR agent-signed with valid `REVOKE` proof
- [ ] Tests: grant, revoke, expiry, wrong target rejected, wrong selector rejected
- [ ] Fuzz: invariant `revoked session can never validate`
- [ ] Run: `cd packages/contracts && bun run test -- --match-contract SessionKeyValidatorTest -vvv`
- [ ] Commit: `feat(contracts): add SessionKeyValidator for agent session keys`

### 2.2 `services/sessionKeys.ts` — ERC-4337 mgmt

**Files:**
- Create: `packages/agent/src/services/sessionKeys.ts`
- Create: `packages/agent/src/services/__tests__/sessionKeys.test.ts`

- [ ] Generate session key (random EOA) per linking
- [ ] Encrypt session key private material via KMS; store ciphertext in Postgres (or existing store)
- [ ] Decrypt in-memory only during UserOp signing
- [ ] `buildUserOp(account, sessionKey, target, calldata)` — fill nonce, gas, signature via bundler
- [ ] `revokeSessionKey(account, sessionKey)` — signs revoke UserOp
- [ ] Tests with mock KMS + mock bundler
- [ ] Commit: `feat(agent): add session key service with KMS encryption`

### 2.3 `services/linking.ts` — phone ↔ account flow

**Files:**
- Create: `packages/agent/src/services/linking.ts`
- Create: `packages/agent/src/services/__tests__/linking.test.ts`

- [ ] `startLinking(accountAddress, phoneNumber, channel)` — generate 6-digit code, SMS via Twilio
- [ ] `confirmLinking(accountAddress, code)` — verify code, return UserOp template for client to sign
- [ ] `completeLinking(accountAddress, signedUserOp)` — submit to bundler, persist phone ↔ account ↔ sessionKey
- [ ] `lookup(phoneNumber)` → `{ accountAddress, sessionKey }`
- [ ] `revokeByPhone(phoneNumber)` — for `REVOKE` keyword path
- [ ] PII hygiene: phone numbers hashed in logs
- [ ] Tests for happy path, wrong code, expired code, duplicate linking
- [ ] Commit: `feat(agent): add phone linking flow service`

## Phase 3 — Rate Limiting + Handler Refactor (2026-05-25 → 2026-06-10)

### 3.1 `services/rateLimit.ts` — tier-Y enforcement

**Files:**
- Create: `packages/agent/src/services/rateLimit.ts`
- Create: `packages/agent/src/services/__tests__/rateLimit.test.ts`

- [ ] Redis-backed counters per `(accountAddress, command)` with daily window
- [ ] Limits per spec table: submit 10/day, approve/reject 20/day, join 3/day
- [ ] Anti-spam 1/s on all commands (including unlimited ones)
- [ ] `check(account, command)` → `{ allowed, remaining, resetAt }`
- [ ] Enforce per-`accountAddress`, not per-phone (SIM swap evasion)
- [ ] Tests for boundary, concurrent writes (Lua script or INCR+EXPIRE), window reset
- [ ] Commit: `feat(agent): add tier-Y rate limiting service`

### 3.2 Handler refactor to `InboundMessage`

**Files:**
- Modify: `packages/agent/src/handlers/approve.ts`
- Modify: `packages/agent/src/handlers/reject.ts`
- Modify: `packages/agent/src/handlers/submit.ts`
- Modify: `packages/agent/src/handlers/join.ts`
- Modify: `packages/agent/src/handlers/pending.ts`
- Modify: `packages/agent/src/handlers/status.ts`
- Modify: `packages/agent/src/handlers/help.ts`
- Modify: `packages/agent/src/handlers/start.ts`
- Create: `packages/agent/src/handlers/revoke.ts`
- Create: `packages/agent/src/handlers/link.ts`

- [ ] Change signature to `(msg: InboundMessage) => Promise<Reply>`
- [ ] Inject `rateLimit.check` before transactional ops (submit/approve/reject/join)
- [ ] Build UserOp via `services/sessionKeys.ts` for transactional paths
- [ ] New `revoke.ts` handler — calls `services/linking.ts#revokeByPhone`
- [ ] New `link.ts` handler — SMS back a short-lived web URL
- [ ] Update / extend existing handler tests to use `InboundMessage` fixtures
- [ ] Run: `cd packages/agent && bun run test`
- [ ] Commit: `refactor(agent): route handlers through InboundMessage with rate limits`

### 3.3 i18n message catalogue

**Files:**
- Create: `packages/shared/src/modules/agentCommands.ts`
- Modify: `packages/shared/src/i18n/en.json` (add agent keys)

- [ ] `agentCommands.ts` — command vocab, help text, reply templates (i18n keys, not strings)
- [ ] Pull user's preferred language from account profile; fallback to `en`
- [ ] Export from shared barrel
- [ ] Commit: `feat(shared): add agent command vocabulary + i18n keys`

## Phase 4 — Client PWA Phone-Linking UX (2026-06-01 → 2026-06-20)

### 4.1 Shared hooks + modules

**Files:**
- Create: `packages/shared/src/hooks/usePhoneLinking.ts`
- Create: `packages/shared/src/modules/sessionKeys.ts`
- Modify: `packages/shared/src/index.ts` (barrel)

- [ ] `usePhoneLinking()` — TanStack Query + mutations: `startLink`, `confirmCode`, `submitSignedOp`, `revoke`, `status`
- [ ] `modules/sessionKeys.ts` — session key types, permission shape, TTL helpers
- [ ] All mutations via `createMutationErrorHandler()`
- [ ] Query keys via `queryKeys.phoneLinking(address)`
- [ ] Export from shared barrel
- [ ] Unit tests (mock fetch / mock signer)
- [ ] Run: `cd packages/shared && bun run test`
- [ ] Commit: `feat(shared): add usePhoneLinking hook + session key module`

### 4.2 Client `PhoneLinking/` view

**Files:**
- Create: `packages/client/src/views/Profile/PhoneLinking/index.tsx`
- Create: `packages/client/src/views/Profile/PhoneLinking/LinkForm.tsx`
- Create: `packages/client/src/views/Profile/PhoneLinking/ConfirmCode.tsx`
- Create: `packages/client/src/views/Profile/PhoneLinking/SignSessionKey.tsx`
- Create: `packages/client/src/views/Profile/PhoneLinking/Linked.tsx`
- Modify: `packages/client/src/views/Profile/index.tsx` (entry link)
- Modify: `packages/client/src/router.ts` (route)

- [ ] Form: enter phone, pick channel (WA / SMS / both)
- [ ] ConfirmCode: 6-digit input, resend with cooldown
- [ ] SignSessionKey: show permission summary (targets, selectors, 30d TTL); user signs via passkey
- [ ] Linked state: show phone, channel, expiry, "Revoke" button (passkey-confirmed)
- [ ] Errors via `parseContractError()` + `USER_FRIENDLY_ERRORS`
- [ ] i18n per `.claude/skills/ui/i18n.md`
- [ ] Commit: `feat(client): add phone linking UX in Profile`

## Phase 5 — E2E + Pilot Rollout (2026-06-20 → 2026-06-30)

### 5.1 E2E tests (Playwright + Twilio sandbox)

**Files:**
- Create: `packages/client/e2e/phoneLinking.spec.ts`
- Create: `packages/agent/test/e2e/submitFlow.test.ts`

- [ ] Playwright: passkey login → enter phone → confirm code (Twilio sandbox) → sign UserOp → linked state
- [ ] Agent E2E: inbound SMS `SUBMIT <garden> <action>` → rate limit check → UserOp sent → reply includes tx hash
- [ ] Revoke E2E: inbound SMS `REVOKE` → on-chain revoke → subsequent command returns "not linked"
- [ ] Run: `bun run test:e2e`
- [ ] Commit: `test(agent+client): add E2E messaging link + submit flows`

### 5.2 Pilot garden rollout

- [ ] Pick 1 Season One pilot garden (coordinate with operator)
- [ ] Link 3–5 gardener phones via staging
- [ ] Run one real work cycle via SMS or WA end-to-end (submit → approve)
- [ ] Monitor: messages per channel, linking conversion rate, command frequency (per spec observability)
- [ ] Post-pilot review: tune rate limits if needed
- [ ] Close Outcome milestone #14 when both channels have sent ≥1 successful transactional message in production

## Dependencies / Blockers

- WhatsApp business verification lead time (1–3 weeks from Meta) — submit 2026-05-10
- `SessionKeyValidator.sol` audit slot — bundled with RWA epic (audit firm engaged 2026-05-15)
- Redis infra — confirm provisioned on Fly.io before Phase 3.1
- AWS KMS (or equivalent) — confirm key provisioned before Phase 2.2
- Twilio funding — top up account with ~$200 USD for pilot traffic

## Risks (carry from spec)

1. WA business verification delay → SMS-only fallback ready to ship from Phase 1.3 completion
2. Session key validator complexity → reuse Pimlico's validator if available; otherwise ~1 week new contract work
3. Twilio SMS cost in African networks (~$0.05/msg) → ~$50/month at 1k messages; acceptable for pilot
4. SMS 160-char limits → chunking tested in 1.3; pilot feedback tunes UX copy
5. SIM swap attack → tier-Y rate limits + 30-day key TTL + dual revoke path
