---
title: Agent on WhatsApp & SMS — Design
epic: Epic — Agent on WhatsApp & SMS
outcome: Agent reachable on 2+ non-web channels
quarter: Q2 2026
due: 2026-06-30
status: Draft
owner: afo
last_updated: 2026-04-17
---

# Agent on WhatsApp & SMS — Design

## Goal

Extend the existing Telegram-only agent to **WhatsApp + SMS**, enabling rural gardeners and operators to read status and perform transactional actions (submit/approve/reject work, join gardens) by texting a phone number.

Outcome metric: E2E flow live on both channels with at least one Season One pilot garden using messaging for a real work cycle.

## Decisions (locked during brainstorm)

| # | Decision | Value |
|---|---|---|
| 1 | Identity + capability | Transactional with linked accounts (phone ↔ passkey account) |
| 2 | Provider | Twilio for both WhatsApp + SMS (single SDK, single bill) |
| 3 | Capability tier | Tiered (Y) — read-only unlimited; transactional rate-limited |
| 4 | Transaction model | ERC-4337 session keys scoped per-user, granted at phone linking |
| 5 | Session TTL | 30 days with auto-refresh via SMS confirmation |
| 6 | Revoke | Web (primary passkey) OR `REVOKE` keyword via messaging |

## Architecture

```
┌─ packages/agent ────────────────────────────────────────────────┐
│                                                                 │
│  Fastify server (existing)                                      │
│                                                                 │
│  platforms/                                                     │
│    telegram.ts      EXISTING                                    │
│    whatsapp.ts      NEW · Twilio WhatsApp webhook               │
│    sms.ts           NEW · Twilio Programmable SMS webhook       │
│    _base.ts         NEW · shared message parsing + dispatch     │
│                                                                 │
│  services/                                                      │
│    linking.ts       NEW · phone ↔ account linking flow          │
│    sessionKeys.ts   NEW · ERC-4337 session key mgmt             │
│    rateLimit.ts     NEW · tier-Y enforcement (per-user, per-day)│
│                                                                 │
│  handlers/ (existing) — no changes                              │
│    approve, reject, submit, join, pending, status, help, start  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─ packages/shared ───────────────────────────────────────────────┐
│  hooks/usePhoneLinking                NEW  · web-side linking   │
│  modules/sessionKeys.ts               NEW  · session key types  │
│  modules/agentCommands.ts             NEW  · command vocab      │
└─────────────────────────────────────────────────────────────────┘

┌─ packages/client ───────────────────────────────────────────────┐
│  views/Profile/PhoneLinking         NEW · link/unlink UX        │
└─────────────────────────────────────────────────────────────────┘

┌─ packages/contracts ────────────────────────────────────────────┐
│  validators/SessionKeyValidator.sol  NEW · scoped permissions   │
│    (or reuse existing AA validator if Pimlico provides one)     │
└─────────────────────────────────────────────────────────────────┘
```

## Phone Linking Flow

```
1. User opens web (packages/client) with passkey session
2. Navigates to Profile → Link Messaging
3. Enters phone number + picks channel (WA / SMS / both)
4. Backend sends 6-digit code to phone
5. User enters code on web
6. User signs a UserOperation granting session key to agent backend
   Session key is scoped:
     - target: GreenGoodsRegistry + MultistrategyVault + HatsV2 + EAS
     - selectors: whitelist (submit/approve/reject/join)
     - valid for: 30 days
     - rate limits: enforced off-chain by agent (tier-Y numbers below)
7. Agent registers phone ↔ account ↔ sessionKey mapping
8. User texts "HELLO" to agent number → receives greeting
```

## Capability Limits (tier Y)

| Action | Limit | Enforcement |
|---|---|---|
| `status`, `pending`, `help`, `list` | Unlimited | Off-chain rate-limit only (1/s anti-spam) |
| `submit` | 10/day per user | `services/rateLimit.ts` + Redis |
| `approve` / `reject` | 20/day per user | Same |
| `join` | 3/day per user | Same |
| Session key TTL | 30 days, auto-refresh on SMS confirm | `validators/SessionKeyValidator.sol` |
| Revoke | Web UI or `REVOKE` keyword | Revokes session key on-chain |

## Message Dispatch

All channels normalize into a single internal format:

```typescript
interface InboundMessage {
  channel: 'telegram' | 'whatsapp' | 'sms';
  externalId: string;           // phone number or telegram chat id
  accountAddress?: Address;     // resolved via linking
  sessionKey?: Address;
  text: string;
  timestamp: number;
}
```

Platforms normalize → `_base.ts` dispatches to existing handler → handler returns reply → platform-specific formatter sends reply.

Existing handlers (`approve.ts`, `submit.ts`, etc.) get a new first argument: `InboundMessage` (replaces Telegram-specific context). This is a **small refactor** — handlers stay where they are, context gets typed.

## Commands (unified across all channels)

```
HELP                  → list commands
STATUS                → my gardens, my pending submissions
PENDING               → submissions I need to approve (operator only)
SUBMIT <garden> <action>  → start work submission flow (text-based Q&A)
APPROVE <id>          → approve submission
REJECT <id> <reason>  → reject with reason
JOIN <garden>         → request to join a garden
LINK                  → send me a link to web for account linking
REVOKE                → revoke messaging access
```

i18n: messages localized per user's preferred language (stored on account); fallback to English.

## Security Considerations

1. **SIM swap risk** — tier-Y rate limits cap blast radius. 30-day key expiry forces periodic re-verification. User can revoke via web at any time.
2. **Session key scope** — contract-level validator enforces allowed targets + selectors. Even if agent backend compromised, attacker can't drain vaults (no transfer capability in session key scope).
3. **Replay protection** — UserOps have nonce; agent backend enforces idempotency on message IDs.
4. **Rate limit evasion** — enforced per-user via `accountAddress`, not per-phone, so attacker can't spin up new phones.
5. **Key storage** — session key encrypted at rest (KMS); decrypted only in memory during UserOp signing.
6. **Cost DoS** — Twilio outbound replies rate-limited per-user (max N replies/min). Prevents a hostile user from draining Twilio credits.

## Testing Strategy

| Layer | Runner | Scope |
|---|---|---|
| Unit | Vitest via `bun run test` | Handlers with mock platform context; `rateLimit.ts`; `linking.ts` |
| Integration | Vitest | Message dispatch through `_base.ts` to handlers |
| Contract | Forge via `bun run test` | `SessionKeyValidator.sol` permission enforcement |
| E2E | Playwright + Twilio test sandbox | Full link + submit flow from web linking through SMS send |

## Observability

Log every inbound message at INFO (with PII redaction — phone numbers hashed). Log outbound reply with delivery status (Twilio webhook). Track:
- Messages per channel per day
- Linking conversion rate (SMS code sent → link completed)
- Per-user command frequency (to tune rate limits)
- Session key revocation frequency

No changes to Envio indexer (messaging state is off-chain).

## Deployment

- Agent package runs on same infra as today (Fly.io / existing host)
- Twilio account + phone numbers (1 WA-enabled, 1 SMS long-code per region)
- Redis (rate limiting) — add to infra if not already present
- KMS (session key encryption) — AWS KMS or equivalent

## Out of Q2 Scope

- Voice (IVR) — Q3+
- USSD (for feature phones) — would need regional provider partnership
- Proactive outbound messages (reminders, alerts) — opt-in in Q3
- Multilingual NLU — Q2 uses keyword commands only
- Chat memory / context ("approve the last one") — Q3+
- WhatsApp templates for marketing — not needed for transactional
- Group chats — Q3+ for operator coordination

## Timeline

| Date | Gate |
|---|---|
| 2026-04-17 | Design locked |
| 2026-05-10 | Twilio accounts provisioned, WA business verification submitted |
| 2026-05-30 | `SessionKeyValidator.sol` frozen for audit (bundled with RWA audit) |
| 2026-06-15 | All handlers routing through unified dispatch |
| 2026-06-25 | E2E test with one Season One pilot garden |
| 2026-06-30 | Outcome milestone reached |

## Risks

1. **WA business verification delay** — Meta takes 1–3 weeks. Submit 2026-05-10 to buffer. Fallback: ship SMS-only first, WA follows.
2. **Session key validator complexity** — reuse Pimlico's if available; otherwise ~1 week of new contract work (audit-bundled with RWA freeze).
3. **Twilio cost in rural regions** — SMS to African networks is ~$0.05/msg; 1k messages/month = $50. Acceptable for pilot.
4. **SMS character limits (160)** — long replies chunked; UX tested for clarity.
