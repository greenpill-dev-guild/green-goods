# Green Goods Agent — Architecture Guide

The agent package provides a platform-agnostic bot for Green Goods that currently supports Telegram, with architecture designed for future Discord and WhatsApp integrations.

## Architecture Overview

```
src/
├── core/                    # Platform-agnostic business logic
│   ├── contracts/          # Message envelope types
│   │   ├── message.ts      # InboundMessage, MessageContent types
│   │   └── response.ts     # OutboundResponse, HandlerResult types
│   ├── handlers/           # Command and message handlers
│   │   ├── start.ts        # /start - wallet creation
│   │   ├── join.ts         # /join - garden membership
│   │   ├── status.ts       # /status - user status
│   │   ├── help.ts         # /help - command list
│   │   ├── pending.ts      # /pending - operator work list
│   │   ├── submit.ts       # Work submission (text/voice)
│   │   ├── approve.ts      # /approve - operator approval
│   │   ├── reject.ts       # /reject - operator rejection
│   │   └── utils.ts        # Handler utilities
│   └── orchestrator.ts     # Routes messages to handlers
│
├── ports/                   # Interfaces for external dependencies
│   ├── storage.ts          # StoragePort - user/session/work persistence
│   ├── ai.ts               # AIPort - STT and NLU
│   ├── blockchain.ts       # BlockchainPort - on-chain operations
│   └── index.ts
│
├── adapters/                # Platform-specific implementations
│   ├── storage/
│   │   └── sqlite.ts       # SQLite storage (platform-agnostic schema)
│   ├── ai/
│   │   └── whisper.ts      # Whisper STT + regex NLU
│   ├── blockchain/
│   │   └── viem.ts         # Viem blockchain operations
│   └── telegram/
│       ├── index.ts        # Telegraf bot setup
│       └── transformer.ts  # Telegram <-> core envelope conversion
│
├── services/                # Reusable utilities
│   ├── crypto.ts           # Key encryption, secure random
│   └── rate-limiter.ts     # Sliding window rate limiting
│
├── api/                     # HTTP API layer
│   ├── server.ts           # Fastify server
│   └── routes/
│       ├── health.ts       # Health/readiness endpoints
│       └── webhook.ts      # Platform webhook receivers
│
├── config.ts               # Centralized configuration
└── index.ts                # Entry point
```

## Core Concepts

### 1. Platform-Agnostic Message Contract

All platforms are normalized to a common message format:

```typescript
interface InboundMessage {
  id: string;
  platform: 'telegram' | 'discord' | 'whatsapp';
  sender: { platformId: string; displayName?: string };
  content: MessageContent;  // text | command | voice | callback | image
  locale?: string;
  timestamp: number;
}

interface OutboundResponse {
  text: string;
  parseMode?: 'markdown' | 'html';
  buttons?: { label: string; callbackData: string }[];
}
```

### 2. Ports & Adapters Pattern

Dependencies are abstracted behind port interfaces:

```typescript
// Storage port
interface StoragePort {
  getUser(platform: Platform, platformId: string): Promise<User | undefined>;
  createUser(input: CreateUserInput): Promise<User>;
  // ... sessions, pending work
}

// AI port
interface AIPort {
  transcribe(audioPath: string): Promise<string>;
  parseWorkText(text: string): Promise<ParsedWorkData>;
}

// Blockchain port
interface BlockchainPort {
  submitWork(params: SubmitWorkParams): Promise<Hex>;
  isOperator(gardenAddress: string, userAddress: string): Promise<boolean>;
}
```

### 3. Orchestrator

The orchestrator routes messages to handlers:

```typescript
const orchestrator = new Orchestrator({
  storage,
  ai,
  blockchain,
  rateLimiter,
  crypto,
  voiceProcessor,
  notifier,
});

const response = await orchestrator.handle(inboundMessage);
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
- Includes health endpoints: `/health`, `/health/ready`

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

Each handler is a pure function that takes a message and dependencies:

```typescript
export async function handleStart(
  message: InboundMessage,
  deps: { storage: StoragePort; generatePrivateKey: () => Hex }
): Promise<HandlerResult> {
  // Business logic
  return { response: { text: '...' } };
}
```

### 2. Session Management

Sessions track multi-step flows (e.g., work confirmation):

```typescript
// Set session in handler result
return {
  response: { text: 'Confirm?', buttons: [...] },
  updateSession: { step: 'confirming_work', draft: workData },
};

// Clear session after completion
return { response: { text: 'Done!' }, clearSession: true };
```

### 3. Rate Limiting

Rate limits are checked per action type:

```typescript
const rateCheck = this.checkRateLimit(platformId, 'submission');
if (rateCheck) return rateCheck;  // Returns error response if limited
```

### 4. Voice Processing

Voice messages are processed through the VoiceProcessor:

```typescript
interface VoiceProcessor {
  downloadAndTranscribe(audioUrl: string): Promise<string>;
}
```

## Adding a New Platform

1. Create adapter in `src/adapters/{platform}/`:
   - `transformer.ts` - Convert platform events <-> core envelopes
   - `index.ts` - Platform client setup

2. Create voice processor (if supporting voice)

3. Create notifier (for outbound messages)

4. Add webhook route in `src/api/routes/webhook.ts`

5. Update entry point to initialize the new adapter

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
- [ ] Photo/media attachments
- [ ] LLM-based NLU for better parsing
- [ ] Multi-language support
- [ ] HSM/KMS for key management

## Reference Documents

- [Shared Package](../shared/README.md)
- [Contracts Handbook](../../docs/developer/contracts-handbook.md)
