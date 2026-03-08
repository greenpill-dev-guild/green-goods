# Agent Package Context

Loaded when working in `packages/agent/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun dev` | Start in polling mode (local) |
| `bun start` | Start in webhook mode (production) |
| `bun run test` | Run tests (Vitest) |
| `bun run test:watch` | Watch mode |
| `bun run test:coverage` | Tests with coverage |
| `bun run test:ui` | Interactive test UI |

## Contents
- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Critical Patterns](#critical-patterns)
- [Security Patterns](#security-patterns-mandatory)
- [Deployment](#deployment)
- [Testing](#testing)
- [Adding a New Platform](#adding-a-new-platform)
- [Reference Files](#reference-files)

## Architecture

```
packages/agent/
├── src/
│   ├── index.ts           # Entry point
│   ├── types.ts           # ALL type definitions
│   ├── handlers/          # Message/command handlers
│   ├── services/          # DB, crypto, rate limiter
│   ├── platforms/         # Platform adapters (Telegram)
│   ├── api/               # Webhook server
│   └── __tests__/         # Vitest tests (co-located)
│       ├── setup.ts       # Test setup and mocks
│       ├── *.test.ts      # Unit tests
│       └── utils/         # Test utilities and factories
└── vitest.config.ts       # Vitest configuration
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

Uses **Vitest** for unit tests. Database operations use an in-memory SQLite mock for isolation.

### Test Files

| Test File | Coverage |
|-----------|----------|
| `src/__tests__/crypto.test.ts` | Encryption, key generation, validation |
| `src/__tests__/handlers.test.ts` | Start, join, submit handlers |
| `src/__tests__/rate-limiter.test.ts` | Sliding window rate limiting |
| `src/__tests__/storage.test.ts` | User, session, pending work CRUD |

### Coverage Targets

| Component | Target |
|-----------|--------|
| Crypto | 80%+ |
| Rate Limiter | 80%+ |
| Handlers | 70%+ |
| Storage | 70%+ |
| Overall | 70%+ |

### Handler Tests (Vitest)

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { handleStart, type StartDeps } from "../handlers/start";
import { initDB } from "../services/db";

describe("handleStart", () => {
  // Use in-memory database for test isolation
  beforeAll(() => initDB(":memory:"));

  it("creates new user", async () => {
    const message = {
      id: "1",
      platform: "telegram",
      sender: { platformId: "123" },
      content: { type: "command", name: "start", args: [] },
      timestamp: Date.now(),
    };

    const deps: StartDeps = {
      generatePrivateKey: () => "0x" + "a".repeat(64) as \`0x\${string}\`,
    };

    const result = await handleStart(message, deps);
    expect(result.response.text).toContain("Welcome");
  });
});
```

### Mocking Strategy

The test setup (`src/__tests__/setup.ts`) provides:

- **bun:sqlite** → In-memory database via `initDB(":memory:")` for Vitest tests
- **@green-goods/shared** → Blockchain function mocks
- **pino** → Logger mock
- **telegraf** → Telegram bot mock
- **posthog-node** → Analytics mock

> **Note:** For file-based database tests (e.g., `data/test/handlers-test.db`), run with `bun test` directly outside Vitest.

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

## Documentation References (on-demand)

Read these docs pages when you need domain context for bot responses or user guidance:

- Domain glossary (35+ terms): `docs/docs/glossary.md`
- Impact model and CIDS framework: `docs/docs/concepts/impact-model.mdx`
- Gardener getting started: `docs/docs/gardener/getting-started.mdx`
- Communities and localization: `docs/docs/concepts/communities.mdx`
