# Telegram Bot

The **Telegram Bot** package (`packages/telegram`) provides a conversational interface for Green Goods, enabling users to join gardens, submit work, and approve submissions directly from Telegram.

## Overview

The bot is designed to be a "Bot-First" alternative to the web client, focusing on ease of use and low-bandwidth accessibility. It leverages AI for natural language understanding and voice processing.

### Key Features

* **Custodial Wallet Management**: Automatically generates and manages wallets for users (MVP).
* **Natural Language Submission**: Users can describe their work in plain text.
* **Voice-to-Text**: Supports voice notes for work submission using OpenAI Whisper (via `@xenova/transformers`).
* **Operator Approvals**: Operators receive notifications and can approve work with a single command.

## Architecture

The bot is built with **Telegraf** and runs as a standalone Node.js/Bun process.

### Tech Stack

| Component | Technology |
|:----------|:-----------|
| Framework | [Telegraf](https://telegraf.js.org/) |
| Database | `bun:sqlite` (SQLite via Bun native API) |
| AI/ML | `@xenova/transformers` (local Whisper inference) |
| Blockchain | `viem` (interaction with EAS and contracts) |
| Shared Logic | `@green-goods/shared` |

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Telegram API                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Telegraf Bot                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Commands   │  │  Messages   │  │  Callback Handlers   │ │
│  │ /start      │  │  Text       │  │  confirm_submission  │ │
│  │ /join       │  │  Voice      │  │  cancel_submission   │ │
│  │ /approve    │  │             │  │                      │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐
│  AI Service   │  │   Storage     │  │  @green-goods/shared  │
│  - Whisper    │  │   Service     │  │  - submitWorkBot()    │
│  - NLU Parse  │  │  - SQLite     │  │  - EAS encoding       │
└───────────────┘  └───────────────┘  └───────────────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │   bot.db      │
                   │  - users      │
                   │  - sessions   │
                   │  - pending    │
                   └───────────────┘
```

### Data Flow

1. **User Input**: Text or Voice message received via Telegram Webhook/Polling.
2. **Processing**:
   * **Voice**: Downloaded, converted to WAV, transcribed using Whisper.
   * **Text**: Parsed using regex patterns to extract work details.
3. **Session**: Draft work stored in SQLite session.
4. **Confirmation**: User confirms details via Inline Keyboard.
5. **Submission**:
   * Bot creates a `WorkDraft`.
   * Work stored as "pending" awaiting operator approval.
   * Operator notified via direct message.
6. **Approval**: Operator sends `/approve <id>`, bot submits on-chain attestation.

## Directory Structure

```
packages/telegram/
├── src/
│   ├── index.ts           # Entry point, environment setup
│   ├── bot.ts             # Main bot logic and command handlers
│   ├── types.ts           # Type definitions
│   ├── services/
│   │   ├── ai.ts          # STT (Whisper) and NLU logic
│   │   └── storage.ts     # SQLite database wrapper
│   └── __tests__/
│       ├── ai.test.ts     # NLU parsing tests
│       └── storage.test.ts # Storage layer tests
├── data/
│   └── bot.db             # Local database (gitignored)
├── package.json
├── tsconfig.json
└── README.md              # Package documentation
```

## Setup & Configuration

The bot requires a Telegram Bot Token from [@BotFather](https://t.me/BotFather).

### Environment Variables

| Variable | Description | Required |
|:---------|:------------|:---------|
| `TELEGRAM_BOT_TOKEN` | API Token from BotFather | Yes |
| `DB_PATH` | Path to SQLite DB (default: `data/bot.db`) | No |
| `NODE_ENV` | Environment mode | No |

### System Requirements

* **Bun**: Runtime environment (uses native SQLite)
* **ffmpeg**: Required for voice message processing

### Running Locally

```bash
# From project root
bun run dev:telegram

# Or from package directory
cd packages/telegram
bun run dev
```

## Commands Reference

### User Commands

| Command | Description |
|:--------|:------------|
| `/start` | Create wallet and get started |
| `/join <address>` | Join a garden by address |
| `/status` | Check current status |
| `/help` | Show available commands |

### Operator Commands

| Command | Description |
|:--------|:------------|
| `/approve <id>` | Approve a pending work submission |
| `/reject <id> [reason]` | Reject a submission with optional reason |
| `/pending` | List pending work for your garden |

## Work Submission Flow

### Text Submission

```
User: "I planted 5 trees today"
       ↓
Bot: Parses text using regex NLU
       ↓
Bot: Shows confirmation with inline buttons
       ↓
User: Clicks "✅ Submit"
       ↓
Bot: Stores pending work, notifies operator
       ↓
Operator: /approve abc123
       ↓
Bot: Submits EAS attestation on-chain
```

### Voice Submission

```
User: [Voice Message]
       ↓
Bot: Downloads OGG file
       ↓
Bot: Converts OGG → WAV (ffmpeg)
       ↓
Bot: Transcribes using Whisper
       ↓
Bot: Shows transcription for confirmation
       ↓
[Same flow as text submission]
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  telegramId INTEGER PRIMARY KEY,
  privateKey TEXT NOT NULL,      -- WARNING: Unencrypted in MVP!
  address TEXT NOT NULL,
  currentGarden TEXT,
  role TEXT DEFAULT 'gardener',
  createdAt INTEGER
);
```

### Sessions Table

```sql
CREATE TABLE sessions (
  telegramId INTEGER PRIMARY KEY,
  step TEXT NOT NULL DEFAULT 'idle',
  draft TEXT,                    -- JSON serialized ParsedWorkData
  updatedAt INTEGER
);
```

### Pending Works Table

```sql
CREATE TABLE pending_works (
  id TEXT PRIMARY KEY,
  actionUID INTEGER NOT NULL,
  gardenerAddress TEXT NOT NULL,
  gardenerTelegramId INTEGER NOT NULL,
  gardenAddress TEXT,
  data TEXT NOT NULL,            -- JSON serialized WorkDraftData
  createdAt INTEGER
);
```

## Testing

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

### Test Coverage

| Component | Coverage |
|:----------|:---------|
| AI Service (NLU) | ✅ Regex parsing covered |
| Storage Service | ✅ CRUD operations covered |
| Bot Commands | ⚠️ Integration tests needed |
| Voice Processing | ⚠️ Requires Whisper model |

## Security Considerations

### MVP Limitations

1. **Private Keys**: Stored unencrypted in SQLite
2. **No Auth**: Any Telegram user can create a wallet
3. **No Rate Limiting**: Vulnerable to spam

### Production Requirements

- [ ] Hardware Security Module (HSM) for key storage
- [ ] User authentication/verification
- [ ] Rate limiting and spam protection
- [ ] Input validation and sanitization
- [ ] Webhook mode with TLS

## Known Issues

1. **Sharp Dependency**: May fail to build on some systems (removed in latest)
2. **Whisper Loading**: First transcription is slow (model download)
3. **ffmpeg Required**: Voice processing fails without ffmpeg installed

## Future Enhancements

- [ ] Non-custodial wallet support (WalletConnect)
- [ ] Photo/media attachments
- [ ] LLM-based NLU (GPT/Claude)
- [ ] Multi-language support (i18n)
- [ ] Inline mode for group submissions
- [ ] Webhook deployment (vs polling)
- [ ] Garden verification on-chain

## Related Documentation

- [Package README](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/agent#readme)
- [Agent Context](https://github.com/greenpill-dev-guild/green-goods/tree/main/.claude/context/agent.md)
- [Shared Package](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/shared#readme)
- [Architecture Overview](../architecture)
