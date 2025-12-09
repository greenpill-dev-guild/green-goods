# Green Goods Agent — Architecture Guide

The agent package provides a platform-agnostic bot for Green Goods that currently supports Telegram, with architecture designed for future Discord, WhatsApp, and SMS integrations.

## Architecture Overview

```
src/
├── types.ts               # All shared types (messages, responses, users, etc.)
├── index.ts               # Entry point — initializes services & launches bot
├── config.ts              # Configuration loader
│
├── handlers/              # Command & message handlers
│   ├── index.ts           # Message router (handleMessage function)
│   ├── start.ts           # /start — wallet creation
│   ├── join.ts            # /join — garden membership
│   ├── status.ts          # /status — user status
│   ├── help.ts            # /help — command list
│   ├── pending.ts         # /pending — operator work list
│   ├── approve.ts         # /approve — operator approval
│   ├── reject.ts          # /reject — operator rejection
│   ├── submit.ts          # Work submission (text/voice)
│   └── utils.ts           # Handler utilities
│
├── services/              # External integrations (direct, singleton pattern)
│   ├── index.ts           # Re-exports
│   ├── db.ts              # SQLite database
│   ├── blockchain.ts      # Viem blockchain operations
│   ├── ai.ts              # Whisper STT + regex NLU
│   ├── crypto.ts          # Key encryption, secure random
│   └── rate-limiter.ts    # Sliding window rate limiting
│
├── platforms/             # Platform adapters
│   ├── index.ts           # Re-exports
│   └── telegram.ts        # Telegram bot, transformer, voice processor
│
└── api/                   # HTTP API layer
    ├── index.ts           # Re-exports
    └── server.ts          # Fastify health + webhooks
```

## Core Concepts

### 1. Unified Types

All types are centralized in `types.ts`:

```typescript
// Messages
interface InboundMessage {
  id: string;
  platform: "telegram" | "discord" | "whatsapp" | "sms";
  sender: { platformId: string; displayName?: string };
  content: MessageContent; // text | command | voice | callback | image
  locale?: string;
  timestamp: number;
}

// Responses
interface OutboundResponse {
  text: string;
  parseMode?: "markdown" | "html";
  buttons?: ResponseButton[];
}

// Users, sessions, pending work, etc.
```

### 2. Direct Services (No Interfaces)

Services are simple singletons initialized at startup:

```typescript
import { initDB, getUser, createUser } from "./services/db";
import { initBlockchain, submitWork, isOperator } from "./services/blockchain";
import { initAI, transcribe, parseWorkText } from "./services/ai";

// Initialize once at startup
initDB("data/agent.db");
initBlockchain(baseSepolia);
initAI();

// Use directly in handlers
const user = await getUser("telegram", platformId);
```

### 3. Message Router

The `handleMessage` function in `handlers/index.ts` routes all messages:

```typescript
import { handleMessage, setHandlerContext } from "./handlers";

// Set platform-specific context
setHandlerContext({ voiceProcessor, notifier });

// Route any message
const response = await handleMessage(inboundMessage);
```

### 4. Platform Adapters

Each platform has a single file with:
- Message transformation (platform → InboundMessage)
- Response transformation (OutboundResponse → platform format)
- Bot setup and lifecycle
- Voice processor (if supporting voice)
- Notifier (for outbound messages)

```typescript
import {
  createTelegramBot,
  createVoiceProcessor,
  createNotifier,
} from "./platforms/telegram";

const bot = createTelegramBot({ token }, handleMessage);
const voiceProcessor = createVoiceProcessor(bot, transcribe);
const notifier = createNotifier(bot);
```

## Bot Modes

### Polling Mode (Development)

```bash
BOT_MODE=polling bun run dev
```

- Uses Telegram long polling
- No external URL required
- Good for local development

### Webhook Mode (Production)

```bash
BOT_MODE=webhook PORT=3000 WEBHOOK_URL=https://your-domain.com bun run start
```

- Uses HTTP webhooks
- Requires public URL
- Includes health endpoints: `/health`, `/ready`

## Environment Variables

| Variable | Description | Required |
|:---------|:------------|:---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | Yes |
| `ENCRYPTION_SECRET` | 32+ char secret for key encryption | Yes |
| `BOT_MODE` | `polling` or `webhook` (default: webhook) | No |
| `PORT` | HTTP server port (default: 3000) | No |
| `WEBHOOK_URL` | Public URL for webhooks | For webhook mode |
| `TELEGRAM_WEBHOOK_SECRET` | Secret for webhook verification | No |
| `DB_PATH` | SQLite database path (default: data/agent.db) | No |

## Running the Agent

### Development

```bash
# From project root
bun run dev:agent

# Or from package directory
cd packages/agent
bun run dev
```

### Production

```bash
# Build
bun run build:agent

# Start
NODE_ENV=production bun run start
```

## Key Patterns

### 1. Handler Structure

Handlers are pure functions with minimal dependencies:

```typescript
export interface StartDeps {
  generatePrivateKey: () => `0x${string}`;
}

export async function handleStart(
  message: InboundMessage,
  deps: StartDeps
): Promise<HandlerResult> {
  const { platform, sender } = message;
  const user = await db.getUser(platform, sender.platformId);

  if (!user) {
    const privateKey = deps.generatePrivateKey();
    // ... create user
  }

  return { response: { text: "Welcome!", parseMode: "markdown" } };
}
```

### 2. Session Management

Sessions track multi-step flows (e.g., work confirmation):

```typescript
// Set session in handler result
return {
  response: { text: "Confirm?", buttons: [...] },
  updateSession: { step: "confirming_work", draft: workData },
};

// Clear session after completion
return { response: { text: "Done!" }, clearSession: true };
```

### 3. Rate Limiting

Rate limits are checked per action type:

```typescript
import { rateLimiter } from "./services/rate-limiter";

const result = rateLimiter.check(platformId, "submission");
if (!result.allowed) {
  return textResponse(`⏳ ${result.message}`);
}
```

### 4. Voice Processing

Voice messages are processed through platform-specific processors:

```typescript
// In platforms/telegram.ts
export function createVoiceProcessor(bot: Telegraf, transcribe: TranscribeFn) {
  return {
    async downloadAndTranscribe(fileId: string): Promise<string> {
      const fileLink = await bot.telegram.getFileLink(fileId);
      // Download, convert, transcribe...
      return transcribedText;
    },
  };
}
```

## Adding a New Platform

1. Create `src/platforms/{platform}.ts`:
   - `toInboundMessage()` — Convert platform event → InboundMessage
   - `toResponse()` — Convert OutboundResponse → platform format
   - `create{Platform}Bot()` — Bot setup and message routing
   - `createVoiceProcessor()` — If supporting voice
   - `createNotifier()` — For outbound messages

2. Add webhook route in `src/api/server.ts`:

```typescript
case "discord":
  // Handle Discord webhook
  break;
```

3. Update `src/index.ts` to initialize the new platform

## Testing

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

## Dependencies

| Package | Purpose |
|:--------|:--------|
| `telegraf` | Telegram Bot API framework |
| `fastify` | HTTP server for webhooks |
| `viem` | Ethereum wallet/blockchain operations |
| `@xenova/transformers` | Local Whisper model for STT |
| `@green-goods/shared` | Shared business logic |

## Future Improvements

- [ ] Discord adapter
- [ ] WhatsApp adapter (Meta Cloud API)
- [ ] SMS adapter (Twilio)
- [ ] Photo/media attachments
- [ ] LLM-based NLU for better parsing
- [ ] Multi-language support
- [ ] HSM/KMS for key management
- [ ] Analytics integration (PostHog)

## Reference Documents

- [Shared Package](../shared/README.md)
- [Contracts Handbook](../../docs/developer/contracts-handbook.md)
