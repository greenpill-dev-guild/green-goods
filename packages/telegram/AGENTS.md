# Green Goods Telegram Bot — Architecture Guide

The Telegram bot provides a conversational interface for gardeners to submit work and operators to approve work via Telegram.

## Architecture Overview

```
src/
├── bot.ts          # Main bot logic (Telegraf commands, message handlers)
├── index.ts        # Entry point (loads env, starts bot)
├── types.ts        # TypeScript definitions (WorkDraft, etc.)
├── services/
│   ├── ai.ts       # Speech-to-text and NLU (OpenAI)
│   └── storage.ts  # SQLite session storage (better-sqlite3)
└── __tests__/      # Test files
```

## Core Responsibilities

- **Bot Interface:** Primary interface for users to join gardens, submit work via voice/text
- **Custodial Wallet Management:** Manages local wallets for users (MVP approach)
- **AI Integration:** STT (Speech-to-Text) transcription and NLU (Natural Language Understanding)
- **Work Submission:** Uses `@green-goods/shared` for blockchain submission

## Key Components

### Bot Commands

```typescript
/start     — Create wallet, show address
/join      — Join a garden by address
/submit    — Start work submission flow
/status    — Check pending work status
/help      — Show available commands
```

### Voice Message Flow

```
User sends voice message → Download audio file
→ AI transcribes to text → AI parses work data
→ User confirms details → Submit to blockchain
```

### Work Submission

Uses shared package for blockchain interactions:

```typescript
import { submitWorkBot } from "@green-goods/shared";

// Submit work via custodial wallet
await submitWorkBot({
  walletClient,
  gardenAddress,
  actionUID,
  workData,
});
```

## Services

### AI Service (`services/ai.ts`)

Handles OpenAI integration:

```typescript
import { ai } from "./services/ai";

// Transcribe voice to text
const text = await ai.transcribe(audioFilePath);

// Parse work description into structured data
const workData = await ai.parseWorkText(text);
// Returns: { plantCount, plantSelection, feedback }
```

### Storage Service (`services/storage.ts`)

SQLite-based session management:

```typescript
import { storage, type User } from "./services/storage";

// User management
const user = storage.getUser(telegramId);
storage.createUser({ telegramId, privateKey, address });
storage.updateUser({ telegramId, currentGarden });

// Pending work storage
storage.savePendingWork(telegramId, workDraft);
const pending = storage.getPendingWork(telegramId);
```

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  telegramId INTEGER PRIMARY KEY,
  privateKey TEXT NOT NULL,
  address TEXT NOT NULL,
  currentGarden TEXT
);

-- Pending work (for confirmation flow)
CREATE TABLE pending_work (
  telegramId INTEGER PRIMARY KEY,
  workData TEXT NOT NULL,
  createdAt INTEGER
);
```

## Environment Variables

Uses root `.env` file:

```bash
# Telegram Bot Token (required)
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather

# OpenAI API Key (required for AI features)
OPENAI_API_KEY=your-openai-key

# Chain configuration (optional, defaults to Base Sepolia)
CHAIN_ID=84532
```

## Development

### Running Locally

```bash
cd packages/telegram
bun dev      # Start with hot reload
bun start    # Production start
bun test     # Run tests
```

### Testing Commands

Use BotFather's test environment or create a test bot:

1. Message @BotFather on Telegram
2. Create new bot with /newbot
3. Copy token to `.env` as `TELEGRAM_BOT_TOKEN`
4. Start bot with `bun dev`

## Key Patterns

### Statelessness

Avoid in-memory state for critical flows; persist to SQLite:

```typescript
// ❌ Wrong - in-memory state lost on restart
const pendingSubmissions = new Map();

// ✅ Correct - persist to database
storage.savePendingWork(telegramId, workData);
```

### Type Safety

Use shared types from `@green-goods/shared`:

```typescript
import type { WorkDraft } from "@green-goods/shared";
```

### Error Handling

Gracefully handle AI failures with fallbacks:

```typescript
try {
  const workData = await ai.parseWorkText(text);
  // Use AI-parsed data
} catch {
  // Fall back to manual input prompts
  await ctx.reply("I couldn't parse that. Please provide details manually.");
}
```

### Security (MVP)

**Warning:** Current implementation stores private keys in SQLite for MVP.

For production:
- Use secure key management (KMS, HSM)
- Consider non-custodial approach with passkey auth
- Encrypt database at rest
- Never log private keys

## Common Tasks

### Adding New Commands

```typescript
// In bot.ts
bot.command("mycommand", async (ctx) => {
  const user = (ctx as any).user as User;
  if (!user) return ctx.reply("Please /start first.");
  
  // Command logic here
  await ctx.reply("Command executed!");
});
```

### Updating AI Prompts

Edit `services/ai.ts` to modify:
- Transcription settings
- Work parsing prompts
- Response formatting

### Adding Message Handlers

```typescript
// Handle photo messages
bot.on(message("photo"), async (ctx) => {
  const photos = ctx.message.photo;
  // Process photos for work submission
});
```

## Reference Files

- Main bot: `src/bot.ts`
- Entry point: `src/index.ts`
- AI service: `src/services/ai.ts`
- Storage: `src/services/storage.ts`
- Types: `src/types.ts`

## Dependencies on Shared Package

```typescript
import { submitWorkBot, submitApprovalBot } from "@green-goods/shared";
```

Work submission logic is in `packages/shared/src/modules/work/bot-submission.ts`.
