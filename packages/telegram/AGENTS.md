# Green Goods — Telegram Bot Agent Guide

Context for AI agents working on the `packages/telegram` directory.

## Overview

The Telegram Bot provides a conversational interface for Green Goods, enabling users to join gardens, submit work reports, and operators to approve submissions—all through Telegram.

## Core Responsibilities

- **Bot Interface**: Primary interface for users to interact with Green Goods via Telegram.
- **Custodial Wallet Management**: Automatically creates and manages local wallets for users (MVP).
- **AI Integration**: Handles STT (Speech-to-Text) via Whisper and NLU (Natural Language Understanding) for parsing work reports.
- **Operator Workflows**: Notifications and approval commands for garden operators.

## Architecture

```
src/
├── index.ts           # Entry point, environment setup, graceful shutdown
├── bot.ts             # Telegraf bot factory, command handlers, message handlers
├── types.ts           # Type definitions and re-exports
├── services/
│   ├── ai.ts          # Voice transcription (Whisper) and NLU parsing
│   └── storage.ts     # SQLite database wrapper for users, sessions, pending work
└── __tests__/
    ├── ai.test.ts     # NLU parsing tests
    └── storage.test.ts # Storage layer tests
```

## Key Patterns

### Framework
- **Telegraf**: Bot framework for Telegram API integration
- **Session Middleware**: Tracks conversation state per user
- **Callback Queries**: Handles inline keyboard interactions

### Data Layer
- **bun:sqlite**: SQLite database via Bun's native API
- **Persistent State**: Users, sessions, pending work stored in `bot.db`
- **JSON Serialization**: Complex objects (drafts) stored as JSON strings

### Shared Logic
- Imports submission logic from `@green-goods/shared`
- Uses `viem` for wallet/blockchain operations
- Aligns types with shared `WorkDraft`, `WorkApprovalDraft`

## Development Rules

### 1. Statelessness
Avoid in-memory state for critical flows. Always persist to SQLite:
```typescript
// ✅ Good: Persist to database
storage.setSession({ telegramId, step: "submitting_work", draft });

// ❌ Bad: In-memory state (lost on restart)
const sessions = new Map();
sessions.set(telegramId, draft);
```

### 2. Type Safety
Use typed interfaces from storage/AI services:
```typescript
import type { User, PendingWork } from "./services/storage";
import type { ParsedWorkData } from "./services/ai";
```

### 3. Error Handling
Gracefully handle AI model failures with fallbacks:
```typescript
try {
  const text = await ai.transcribe(audioPath);
} catch (error) {
  await ctx.reply("Voice processing unavailable. Please use text.");
}
```

### 4. Security (MVP ONLY)
- Private keys are stored unencrypted in SQLite
- Production requires proper key management (HSM/KMS)
- Never log private keys or sensitive data

## Common Tasks

### Adding New Commands
Register in `bot.ts`:
```typescript
bot.command("mycommand", async (ctx) => {
  const user = ctx.user;
  if (!user) return ctx.reply("Please /start first.");
  // Command logic...
});
```

### Updating AI/NLU
Modify `services/ai.ts`:
- Add patterns to `parseWorkTextRegex()` for new work types
- Upgrade to LLM-based parsing by modifying `parseWorkText()`

### Schema Changes
1. Update interfaces in `services/storage.ts`
2. Modify `initSchema()` for new tables/columns
3. Add migration logic if needed (manual for now)
4. Update tests in `__tests__/storage.test.ts`

### Adding Tests
```bash
# Run all tests
bun test

# Run with watch mode
bun test --watch

# Run with coverage
bun test --coverage
```

## Environment Variables

| Variable | Description | Required |
|:---------|:------------|:---------|
| `TELEGRAM_BOT_TOKEN` | API Token from [@BotFather](https://t.me/BotFather) | Yes |
| `DB_PATH` | Path to SQLite database (default: `data/bot.db`) | No |
| `NODE_ENV` | Environment (`development`, `production`) | No |

## Running Locally

```bash
# From project root
bun run dev:telegram

# Or from package directory
cd packages/telegram
bun run dev
```

## Testing

```bash
# Run tests
bun test

# Watch mode
bun test --watch

# Coverage report
bun test --coverage
```

## Dependencies

| Package | Purpose |
|:--------|:--------|
| `telegraf` | Telegram Bot API framework |
| `viem` | Ethereum wallet/blockchain operations |
| `@xenova/transformers` | Local Whisper model for STT |
| `@green-goods/shared` | Shared business logic and types |
| `dotenv` | Environment variable loading |

### System Requirements
- **ffmpeg**: Required for voice message conversion (OGG → WAV)
- **Bun**: Runtime environment (uses `bun:sqlite`)

## Known Limitations (MVP)

1. **Custodial Wallets**: Private keys stored unencrypted
2. **No Photo Support**: Text/voice only for submissions
3. **Single Operator Per Garden**: Only one operator notified
4. **Regex-based NLU**: Limited pattern recognition
5. **No Rate Limiting**: No spam protection

## Future Improvements

- [ ] Non-custodial wallet integration (WalletConnect)
- [ ] Photo/media attachments for work submissions
- [ ] LLM-based NLU for better parsing
- [ ] Multi-language support
- [ ] Inline mode for group submissions
- [ ] Webhook support (vs polling)

## Reference Documents

- [Telegram Bot Architecture](../../docs/developer/architecture/telegram-bot.md)
- [Shared Package](../shared/README.md)
- [Contracts Handbook](../../docs/developer/contracts-handbook.md)
