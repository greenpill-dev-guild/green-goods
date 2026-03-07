---
name: agent
user-invocable: false
description: Multi-platform bot development - Telegram handlers, platform adapters, crypto services, rate limiting. Use for bot features, command handlers, and platform integrations.
---

# Agent Skill

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

Handlers are testable pure functions — inject only what needs mocking:

```typescript
// Define explicit dependency interface
export interface StartDeps {
  generatePrivateKey: () => `0x${string}`;
}

export async function handleStart(
  message: InboundMessage,
  deps: StartDeps
): Promise<HandlerResult> {
  // Use singletons directly for non-mockable services
  const user = await db.getUser(message.platform, message.sender.platformId);

  if (user) {
    return { response: { text: "Welcome back!" } };
  }

  const privateKey = deps.generatePrivateKey();
  const encrypted = prepareKeyForStorage(privateKey);
  await db.createUser(message.platform, message.sender.platformId, encrypted);

  return { response: { text: "Welcome! Your wallet has been created." } };
}
```

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

1. Create handler file in `src/handlers/`:
```typescript
// src/handlers/status.ts
export interface StatusDeps {
  getOnChainBalance: (address: Address) => Promise<bigint>;
}

export async function handleStatus(
  message: InboundMessage,
  deps: StatusDeps
): Promise<HandlerResult> {
  const user = await db.getUser(message.platform, message.sender.platformId);
  if (!user) return { response: { text: "Please /start first" } };

  const balance = await deps.getOnChainBalance(user.address);
  return {
    response: {
      text: `Your balance: ${formatEther(balance)} ETH`,
    },
  };
}
```

2. Register in handler router (index.ts)
3. Write tests with injected mocks

## Part 3: Platform Adapters

### Adapter Interface

Each platform provides 4 functions:

```typescript
// platforms/{platform}.ts

// Convert platform-specific event → universal format
export function toInboundMessage(event: PlatformEvent): InboundMessage | null;

// Convert universal response → platform-specific format
export function toResponse(response: OutboundResponse): PlatformFormat;

// Create and configure the bot instance
export function createBot(config: BotConfig, handleMessage: MessageHandler): Bot;

// Optional: voice processing
export function createVoiceProcessor(config: VoiceConfig): VoiceProcessor;
```

### Adding a New Platform

1. Create `platforms/{platform}.ts` with the adapter functions
2. Add webhook route in `api/server.ts`
3. Initialize in `index.ts` based on `BOT_MODE`
4. Add platform to the `Platform` union type in `types.ts`

## Part 4: Services

### Singleton Pattern

```typescript
// Services use lazy initialization singletons
let _db: DB | null = null;

export function initDB(path: string): DB {
  if (!_db) _db = new DB(path);
  return _db;
}

export function getDB(): DB {
  if (!_db) throw new Error("DB not initialized");
  return _db;
}

// Convenience re-exports for common operations
export const getUser = (platform: Platform, id: string) =>
  getDB().getUser(platform, id);
```

### Crypto Service (MANDATORY Security)

**Never store plaintext private keys:**

```typescript
import { prepareKeyForStorage, getPrivateKey } from "./services/crypto";

// Encrypt before storage (AES-256-GCM + PBKDF2)
const encrypted = prepareKeyForStorage(privateKey);
await db.storeKey(userId, encrypted);

// Decrypt for use
const { privateKey } = getPrivateKey(user.encryptedKey);
```

### Rate Limiting

```typescript
import { rateLimiter } from "./services/rate-limiter";

const result = rateLimiter.check(userId, "submission");
if (!result.allowed) {
  return { response: { text: `Rate limit: ${result.message}` } };
}
```

| Action | Limit | Window |
|--------|-------|--------|
| messages | 10 | 1 min |
| voice | 3 | 1 min |
| submissions | 5 | 5 min |
| commands | 20 | 1 min |
| approvals | 30 | 1 min |

## Part 5: Testing

### Handler Tests

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { handleStart, type StartDeps } from "../handlers/start";
import { initDB } from "../services/db";

describe("handleStart", () => {
  beforeAll(() => initDB(":memory:"));

  const mockDeps: StartDeps = {
    generatePrivateKey: () => ("0x" + "a".repeat(64)) as `0x${string}`,
  };

  it("creates new user on first /start", async () => {
    const message = createTestMessage({ command: "start" });
    const result = await handleStart(message, mockDeps);
    expect(result.response.text).toContain("Welcome");
  });

  it("recognizes returning user", async () => {
    const message = createTestMessage({ command: "start", platformId: "existing" });
    const result = await handleStart(message, mockDeps);
    expect(result.response.text).toContain("Welcome back");
  });
});
```

### Test Utilities

```typescript
// __tests__/utils/factories.ts
function createTestMessage(overrides?: Partial<InboundMessage>): InboundMessage {
  return {
    id: "test-1",
    platform: "telegram",
    sender: { platformId: "user-123" },
    content: { type: "command", name: "start", args: [] },
    timestamp: Date.now(),
    ...overrides,
  };
}
```

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

```bash
# Deploy
railway up --service agent

# Required env vars
NODE_ENV=production
TELEGRAM_BOT_TOKEN=<token>
ENCRYPTION_SECRET=<64-char-secret>
BOT_MODE=webhook
WEBHOOK_URL=https://agent.greengoods.app
DB_PATH=/data/agent.db

# Health check
node -e 'fetch("https://agent.greengoods.app/health").then(r=>r.text()).then(console.log)'
```

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
- `deployment` — Railway deployment for production bot
- `contracts` — Smart contract ABIs and interfaces
