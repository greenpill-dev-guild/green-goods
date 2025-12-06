# @green-goods/agent

Platform-agnostic bot for Green Goods. Currently supports Telegram, with architecture designed for Discord and WhatsApp.

## Quick Start

```bash
# Install dependencies
bun install

# Development (polling mode)
bun run dev

# Production (webhook mode)
bun run build && bun run start
```

## Environment Variables

Create a `.env` file in the repo root:

```bash
# Required
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
ENCRYPTION_SECRET=your-32-character-secret-key

# Optional
BOT_MODE=polling              # or "webhook" (default: polling in dev)
PORT=3000                     # HTTP server port
WEBHOOK_URL=https://...       # Required for webhook mode
DB_PATH=data/agent.db         # SQLite database path
```

## Commands

| Command | Description |
|:--------|:------------|
| `/start` | Create wallet and get started |
| `/join <address>` | Join a garden by contract address |
| `/status` | View your current status and wallet |
| `/pending` | (Operators) View pending work submissions |
| `/approve <id>` | (Operators) Approve a work submission |
| `/reject <id>` | (Operators) Reject a work submission |
| `/help` | Show available commands |

## Work Submission

Users can submit work via:
- **Text message**: "I planted 5 oak trees today"
- **Voice message**: Transcribed automatically using Whisper

The bot parses natural language to extract tasks, then prompts for confirmation.

## Scripts

```bash
bun run dev          # Start in polling mode with hot reload
bun run build        # TypeScript compilation
bun run start        # Run production build
bun run test         # Run tests
bun run test:watch   # Watch mode
bun run test:coverage # Coverage report
bun run lint         # Lint with oxlint
bun run format       # Format with Biome
bun run typecheck    # TypeScript type check
```

## Security Features

- **Private Key Encryption**: AES-256-GCM with PBKDF2 key derivation (100k iterations)
- **Rate Limiting**: Sliding window per action type
- **On-Chain Verification**: Operator roles verified against smart contracts
- **Input Validation**: Address and key format validation

### Rate Limits

| Action | Limit | Window |
|:-------|:------|:-------|
| Messages | 10 | 1 min |
| Voice | 3 | 1 min |
| Submissions | 5 | 5 min |
| Commands | 20 | 1 min |
| Approvals | 30 | 1 min |

## Testing

```bash
# Run all tests
bun test

# Test files:
# - crypto.test.ts     (25 tests) - Encryption & validation
# - rate-limiter.test.ts (18 tests) - Rate limiting
# - handlers.test.ts   (15 tests) - Command handlers
# - orchestrator.test.ts (18 tests) - Message routing
# - storage.test.ts    (22 tests) - Database operations
```

## Architecture

See [AGENTS.md](./AGENTS.md) for detailed architecture documentation including:
- Ports & Adapters pattern
- Message contracts
- Handler patterns
- Adding new platforms

## Known Limitations

- **Voice**: Requires ffmpeg installed; Whisper model downloads on first use
- **Blockchain**: Currently uses environment chain only
- **Media**: Photo attachments not yet implemented

## Production Checklist

- [ ] Set `ENCRYPTION_SECRET` (32+ characters)
- [ ] Configure webhook URL with TLS
- [ ] Consider HSM/KMS for key storage
- [ ] Set up monitoring for `/health` endpoint

