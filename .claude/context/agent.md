# Agent Package Context

Loaded when working in `packages/agent/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun dev` | Start in polling mode (local) |
| `bun start` | Start in webhook mode (production) |
| `bun test` | Run tests |
| `bun test --coverage` | Tests with coverage |

## Architecture

```
packages/agent/src/
├── index.ts           # Entry point
├── types.ts           # ALL type definitions
├── handlers/          # Message/command handlers
├── services/          # DB, crypto, rate limiter
├── platforms/         # Platform adapters (Telegram)
├── api/               # Webhook server
└── __tests__/         # Tests
```

## Data Flow

```
User → Platform API → Agent → Handler Router → Services
                                    ↓
                              HandlerResult
                                    ↓
Platform API ← toResponse() ← Agent
```

## Critical Patterns

### Layer Architecture

| Layer | Purpose | Pattern |
|-------|---------|---------|
| **types.ts** | ALL types | Single source of truth |
| **handlers/** | Message processing | Pure functions with deps injection |
| **services/** | DB, crypto, rate limiter | Singleton pattern |
| **platforms/** | Platform adapters | One file per platform |

### Handler Pattern

Handlers are pure functions with injected dependencies:

```typescript
// Inject only what needs mocking
export interface StartDeps {
  generatePrivateKey: () => `0x${string}`;
}

export async function handleStart(
  message: InboundMessage,
  deps: StartDeps
): Promise<HandlerResult> {
  // Use services directly
  const user = await db.getUser(message.platform, message.sender.platformId);

  // Return response
  return {
    response: {
      text: "Welcome!",
    },
  };
}
```

### Services as Singletons

```typescript
let _db: DB | null = null;

export function initDB(path: string): DB {
  if (!_db) _db = new DB(path);
  return _db;
}

// Convenience exports
export const getUser = (platform: Platform, id: string) => getDB().getUser(platform, id);
```

### Platform Adapters

One file per platform with all platform-specific code:

- `toInboundMessage()` — Convert platform event → InboundMessage
- `toResponse()` — Convert OutboundResponse → platform format
- `create{Platform}Bot()` — Bot setup and lifecycle
- `createVoiceProcessor()` — Voice handling (if supported)
- `createNotifier()` — Outbound notifications

## Security Patterns (MANDATORY)

### Private Key Encryption

**Never store plaintext keys:**

```typescript
import { prepareKeyForStorage, getPrivateKey } from './services/crypto';

// Encrypt before storage
const encrypted = prepareKeyForStorage(privateKey);

// Decrypt for use
const { privateKey } = getPrivateKey(user.privateKey);
```

**Algorithm:** AES-256-GCM with PBKDF2 (100k iterations)

### Rate Limiting

```typescript
import { rateLimiter } from './services/rate-limiter';

const result = rateLimiter.check(userId, 'submission');
if (!result.allowed) {
  return textResponse(`Rate limit: ${result.message}`);
}
```

**Limits:**

| Action | Limit | Window |
|--------|-------|--------|
| messages | 10 | 1 min |
| voice | 3 | 1 min |
| submissions | 5 | 5 min |
| commands | 20 | 1 min |
| approvals | 30 | 1 min |

### Input Validation

```typescript
import { isValidAddress } from './services/crypto';

if (!isValidAddress(address)) {
  return { response: { text: 'Invalid address' } };
}
```

### Safe Error Messages

```typescript
// ✅ Correct - generic message
catch (error) {
  console.error('Decrypt error:', error);
  return { response: { text: 'Request failed. Please try again.' } };
}

// ❌ Wrong - leaks details
catch (error) {
  return { response: { text: `Error: ${error.message}` } };
}
```

## Deployment

### Modes

| Mode | Use Case | Command |
|------|----------|---------|
| **Polling** | Local dev | `BOT_MODE=polling bun dev` |
| **Webhook** | Production | `BOT_MODE=webhook bun start` |

### Railway Deployment

**Required Environment Variables:**

```bash
NODE_ENV=production
TELEGRAM_BOT_TOKEN=<token>
ENCRYPTION_SECRET=<64-char-secret>  # openssl rand -base64 48
BOT_MODE=webhook
WEBHOOK_URL=https://agent.greengoods.app
DB_PATH=/data/agent.db
```

**Setup Steps:**

1. Create service: `railway up --service agent`
2. Add volume: Mount `/data` for SQLite persistence
3. Set domain: `railway domain create agent.greengoods.app`
4. Register webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
     -d "url=https://agent.greengoods.app/telegram/webhook" \
     -d "secret_token=${WEBHOOK_SECRET}"
   ```

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/health` | Basic uptime |
| `/ready` | Service readiness |

## Testing

### Coverage Targets

| Component | Target |
|-----------|--------|
| Crypto | 100% |
| Rate Limiter | 100% |
| Handlers | 90%+ |
| Storage | 85%+ |
| Overall | 80%+ |

### Handler Tests

```typescript
describe("handleStart", () => {
  beforeAll(() => initDB(":memory:"));
  afterAll(() => closeDB());

  it("creates new user", async () => {
    const message: InboundMessage = {
      id: "1",
      platform: "telegram",
      sender: { platformId: "123" },
      content: { type: "command", name: "start", args: [] },
      timestamp: Date.now(),
    };

    const result = await handleStart(message, {
      generatePrivateKey: () => "0x" + "a".repeat(64),
    });

    expect(result.response.text).toContain("Welcome");
  });
});
```

### Crypto Tests (100% coverage)

```typescript
it("encrypts and decrypts correctly", async () => {
  const encrypted = await encryptPrivateKey(key, secret);
  const decrypted = await decryptPrivateKey(encrypted, secret);
  expect(decrypted).toBe(key);
});

it("throws on wrong secret", async () => {
  const encrypted = await encryptPrivateKey(key, secret);
  await expect(decryptPrivateKey(encrypted, "wrong")).rejects.toThrow();
});
```

## Adding a New Platform

1. **Create `platforms/{platform}.ts`:**
   ```typescript
   export function toInboundMessage(event: PlatformEvent): InboundMessage | null { ... }
   export function toResponse(response: OutboundResponse): PlatformFormat { ... }
   export function createBot(config, handleMessage) { ... }
   ```

2. **Add webhook route in `api/server.ts`**

3. **Initialize in `index.ts`**

## Reference Files

- Types: `src/types.ts`
- Handlers: `src/handlers/`
- Crypto: `src/services/crypto.ts`
- Rate limiter: `src/services/rate-limiter.ts`
- Telegram: `src/platforms/telegram.ts`
