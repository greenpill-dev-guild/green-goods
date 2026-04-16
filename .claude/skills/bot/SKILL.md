---
name: bot
description: Multi-platform bot development - Telegram handlers, platform adapters, crypto services, rate limiting. Use for bot features, command handlers, and platform integrations.
version: "1.0.0"
status: active
packages: ["agent"]
dependencies: []
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Bot Skill

Multi-platform bot development guide: handler patterns, platform adapters, security, and deployment.

---

## Activation

When invoked:
- Check `packages/agent/` for existing handler patterns.
- Load `.claude/context/agent.md` for full package-specific patterns.
- All types live in `src/types.ts` — single source of truth.
- Handlers are pure functions with dependency injection.

## Part 1: Architecture

### Project Structure

```
packages/agent/
├── src/
│   ├── index.ts           # Entry point (polling or webhook mode)
│   ├── types.ts           # ALL type definitions (single source of truth)
│   ├── handlers/          # Message/command handlers (pure functions)
│   ├── services/          # DB, crypto, rate limiter (singletons)
│   ├── platforms/         # Platform adapters (Telegram)
│   ├── api/               # Webhook server
│   └── __tests__/         # Vitest tests
└── vitest.config.ts
```

### Data Flow

```
User Message → Platform API → toInboundMessage() → Handler Router
                                                         ↓
                                                    HandlerResult
                                                         ↓
Platform API ← toResponse() ← OutboundResponse ← Handler
```

### Commands

| Command | Purpose |
|---------|---------|
| `bun dev` | Start in polling mode (local) |
| `bun start` | Start in webhook mode (production) |
| `bun run test` | Run tests |
| `bun run test:watch` | Watch mode |
| `bun run test:coverage` | Tests with coverage |

## Part 2: Handler Patterns

### Pure Functions with Dependency Injection

Handlers are testable pure functions. Each handler defines an explicit dependency interface for anything that needs mocking. Singletons (DB, etc.) are accessed directly. The handler receives an `InboundMessage` and its deps, returns a `HandlerResult`.

### HandlerResult Interface

```typescript
interface HandlerResult {
  response: OutboundResponse;
  sideEffects?: Array<() => Promise<void>>;
}

interface OutboundResponse {
  text: string;
  parseMode?: "HTML" | "Markdown";
  replyMarkup?: InlineKeyboard | ReplyKeyboard;
}
```

### Adding a New Command Handler

1. Create handler file in `src/handlers/` with an explicit dependency interface and pure function
2. Register in handler router (index.ts)
3. Write tests with injected mocks

## Part 3: Platform Adapters

### Adapter Interface

Each platform adapter provides 4 functions: `toInboundMessage()` (platform event to universal format), `toResponse()` (universal response to platform format), `createBot()` (configure bot instance), and optionally `createVoiceProcessor()`.

### Adding a New Platform

1. Create `platforms/{platform}.ts` with the 4 adapter functions
2. Add webhook route in `api/server.ts`
3. Initialize in `index.ts` based on `BOT_MODE`
4. Add platform to the `Platform` union type in `types.ts`

## Part 4: Services

Services use lazy initialization singletons (`initX()` / `getX()` pattern with convenience re-exports).

### Crypto Service

**MANDATORY: AES-256-GCM + PBKDF2. Never store plaintext private keys.** Use `prepareKeyForStorage()` before writing and `getPrivateKey()` before use.

### Rate Limiting

| Action | Limit | Window |
|--------|-------|--------|
| messages | 10 | 1 min |
| voice | 3 | 1 min |
| submissions | 5 | 5 min |
| commands | 20 | 1 min |
| approvals | 30 | 1 min |

## Part 5: Testing

Test handlers by injecting mock dependencies and using an in-memory DB (`initDB(":memory:")`). Use `createTestMessage()` factory from `__tests__/utils/factories.ts` for test inputs.

### Coverage Targets

| Component | Target |
|-----------|--------|
| Crypto | 80%+ |
| Rate Limiter | 80%+ |
| Handlers | 70%+ |
| Storage | 70%+ |
| Overall | 70%+ |

## Part 6: Deployment

### Modes

| Mode | Use Case | Command |
|------|----------|---------|
| **Polling** | Local dev | `BOT_MODE=polling bun dev` |
| **Webhook** | Production | `BOT_MODE=webhook bun start` |

### Railway Production

Deploy with `railway up --service agent`. Required env vars: `NODE_ENV`, `TELEGRAM_BOT_TOKEN`, `ENCRYPTION_SECRET` (64-char), `BOT_MODE=webhook`, `WEBHOOK_URL`, `DB_PATH`.

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/health` | Basic uptime |
| `/ready` | Service readiness |

## Anti-Patterns

- **Never store plaintext private keys** — always encrypt with AES-256-GCM
- **Never leak internal errors to users** — use generic error messages
- **Never skip rate limiting** — all user actions must be rate-limited
- **Never put types outside `types.ts`** — single source of truth
- **Never use platform-specific types in handlers** — use InboundMessage/OutboundResponse
- **Never access DB without initialization check** — use getDB() which throws

## Quick Reference Checklist

### Before Adding a New Handler

- [ ] Dependencies defined as explicit interface
- [ ] Handler is a pure function (no side effects in main logic)
- [ ] Rate limiting checked before processing
- [ ] Input validated (addresses, lengths, formats)
- [ ] Error messages are generic (no internal details)
- [ ] Tests with mocked dependencies
- [ ] Registered in handler router

## Decision Tree

```
What bot work?
│
├─► New command? ──────────────► Part 2: Handler Patterns
│                                 → Define dependency interface
│                                 → Pure function handler
│                                 → Register in router
│                                 → Write tests
│
├─► New platform? ─────────────► Part 3: Platform Adapters
│                                 → Implement 4 adapter functions
│                                 → Add webhook route
│                                 → Add to Platform union type
│
├─► Crypto/wallet operation? ──► Part 4: Services
│                                 → Use crypto service (AES-256-GCM)
│                                 → Never store plaintext keys
│
├─► Rate limiting concern? ────► Part 4: Rate Limiting
│                                 → Check action-specific limits
│                                 → Return user-friendly message
│
├─► Deploying bot? ────────────► Part 6: Deployment
│                                 → Polling (local) vs webhook (prod)
│                                 → Railway for production
│
└─► Testing? ──────────────────► Part 5: Testing
                                  → Inject mock dependencies
                                  → In-memory DB for isolation
```

## Related Skills

- `web3` — Contract interaction patterns used by bot
- `testing` — Vitest patterns for handler tests
- `ops` (deployment sub-file) — Railway deployment for production bot
- `contracts` — Smart contract ABIs and interfaces
