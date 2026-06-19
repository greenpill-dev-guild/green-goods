# @green-goods/agent

Platform-agnostic bot for Green Goods. Currently supports Telegram, with architecture designed for Discord and WhatsApp.

📖 **[Agent Documentation](https://docs.greengoods.app/developer/architecture/telegram-bot)** — Complete bot architecture and deployment guide

## Quick Start

```bash
# Install dependencies
bun install

# Development (polling mode)
bun run dev

# Production (webhook mode)
bun run build && bun run start
```

## Deploy to Fly.io (recommended)

> Production deployment. Webhook mode. Routines consume the deployed URL as `BOT_API_URL`.
> The active Fly config is the repo-root `fly.toml`, not a package-local config file.

**Prereqs**
- Telegram token (`TELEGRAM_BOT_TOKEN`) from BotFather
- 32+ char `ENCRYPTION_SECRET`
- 32+ char `BOT_API_TOKEN` (bearer token that routines use to call `/api/messages` and its attachments proxy)
- Pinata JWT (`PINATA_JWT`) when the deployed agent should sign browser upload URLs
- Resend API key plus Green Goods segment/topic IDs when `/public/subscribe` should capture public subscribers
- [`flyctl`](https://fly.io/docs/flyctl/install/) installed and authenticated
- Config file: `fly.toml` at the repo root. Keep it there so the Docker build context includes the workspace root `package.json`, `bun.lock`, `packages/`, `docs/`, and `scripts/`.

**One-time setup**

Run from the repo root:

```bash
# Create the app without deploying (allows secrets + volume first)
flyctl launch --no-deploy --config fly.toml --dockerfile packages/agent/Dockerfile

# Persistent volume for the SQLite database
flyctl volumes create agent_data --config fly.toml --region ams --size 1

# Secrets (these never land in fly.toml)
flyctl secrets set --config fly.toml \
  TELEGRAM_BOT_TOKEN=<botfather-token> \
  ENCRYPTION_SECRET=<32+-char-secret> \
  BOT_API_TOKEN=<routine-auth-bearer-token> \
  PINATA_JWT=<pinata-jwt-for-upload-signing> \
  RESEND_API_KEY=<resend-api-key> \
  RESEND_GREEN_GOODS_SEGMENT_ID=<resend-segment-id> \
  RESEND_GREEN_GOODS_TOPIC_ID=<resend-topic-id> \
  AGENT_ALLOWED_ORIGINS=https://greengoods.app,https://admin.greengoods.app \
  POSTHOG_AGENT_KEY=<optional> \
  TELEGRAM_WEBHOOK_SECRET=<random-string>

# First deploy
flyctl deploy --config fly.toml
```

**After first deploy**

```bash
# Confirm the URL
flyctl status --config fly.toml

# Custom domain is configured in fly.toml:
# WEBHOOK_URL=https://agent.greengoods.app

# Re-deploy after changing fly.toml env or Docker build inputs
flyctl deploy --config fly.toml

# Verify health
curl https://agent.greengoods.app/health

# Talk to the bot in Telegram (/start, /status)
```

**Health contract**

- `/health` is the Fly machine health endpoint. It should return HTTP 200 with `status: "ok"`.
- `/ready` is stricter and currently includes the optional voice transcription model. It can return HTTP 503 with `AI model is still loading` while the bot, webhook, and routine API are still usable.
- Fly checks must use `/health`, not `/ready`, until voice processing is required for launch readiness.

**Prevent suspended or crashed state**

The production config intentionally keeps one machine warm:

- `auto_stop_machines = 'off'`
- `auto_start_machines = true`
- `min_machines_running = 1`

Do not change those values unless intentionally scaling the agent down. After every deploy or secret change, wait for this exact shape before calling the deployment healthy:

```bash
flyctl status --config fly.toml
flyctl checks list --app green-goods
curl -fsS https://agent.greengoods.app/health
```

Expected result: one `app` machine in `started`, checks `1 total, 1 passing`, and `/health` returning HTTP 200. If the Fly UI shows a grey icon, confirm whether the machine is briefly `starting` or `replacing` during deploy:

```bash
flyctl machines list --app green-goods
flyctl releases --app green-goods --image
flyctl logs --app green-goods --no-tail
```

If the state stays `stopped`, `crashed`, `replacing`, or `0/1` checks after the deploy window, treat it as degraded. Inspect logs before restarting or rolling back so the failure reason is not lost.

**Telegram webhook check**

Run from inside the Fly machine when you need to verify Telegram delivery without printing the bot token:

```bash
flyctl ssh console --app green-goods -C 'bun -e "const token=process.env.TELEGRAM_BOT_TOKEN;if(!token)throw new Error(\"missing token\");const res=await fetch(\"https://api.telegram.org/bot\"+token+\"/getWebhookInfo\");const body=await res.json();const info=body.result||{};console.log(JSON.stringify({ok:body.ok,url:info.url,pending_update_count:info.pending_update_count,last_error_date:info.last_error_date,last_error_message:info.last_error_message,max_connections:info.max_connections},null,2));"'
```

Expected result: `ok: true`, `url: "https://agent.greengoods.app/webhook/telegram"`, and `pending_update_count: 0`.

**Plug into routines**

In `claude.ai/code/routines` under the `green-goods` environment, the `bug-intake` routine already has `BOT_API_URL`, `BOT_API_TOKEN`, and `DISCORD_BUGS_CHANNEL_ID` wired. No new env vars are needed for the topic-capture flow.

On the Fly.io secret store (deployed agent), set one secret per topic type:

```
TELEGRAM_BUGS_TOPIC = <chat_id>_<thread_id>      # e.g. -1002847752257_311
TELEGRAM_IDEAS_TOPIC = <chat_id>_<thread_id>     # e.g. -1002847752257_312
```

The agent's mapping from env-var name to `inferredType` lives in `CAPTURE_TYPE_ENV_VARS` in [`config.ts`](src/config.ts). The routine reads `/api/messages?inferred_type=bug|idea`, claims each row with `PATCH { "status": "processing" }`, then marks it `triaged` or `rejected` — it never hardcodes chat or thread ids. Adding a new topic type later is a one-line code change in the agent + a new Fly secret.

The Green Goods `bug-intake` routine consumes captured topic messages from `/api/messages`, creates Linear Customer Needs for validated signals (with attachments uploaded to Linear via the `/api/messages/:id/attachments/:ordinal` proxy), and acknowledges each accepted record by posting in Discord — `#bug-report` for bug-source captures, `#product` for idea-source captures. The bot stays silent in the Green Goods chat itself: no DMs, no group replies, no reactions on capture.

Deploys: pushing to `main` ships the agent via Fly's GitHub integration. The `flyctl deploy` command above is for the cold-start / disconnected setup path, not the day-to-day flow.

## Deploy to Railway (legacy)

> Alternate path. Use Fly.io for new deployments; this section is retained for existing Railway-hosted instances. Cheapest/quickest path on Railway: start in polling mode so you don't need HTTPS/Webhook yet.

**Prereqs**
- Telegram token (`TELEGRAM_BOT_TOKEN`) from BotFather
- 32+ char `ENCRYPTION_SECRET`
- Railway project + a volume (e.g., `/data`)

**Build artifact**
- Dockerfile: `packages/agent/Dockerfile`

**Railway setup**
1) Create a new Service from this repo and select `packages/agent/Dockerfile`.
2) Add a Volume (e.g., name `agent-data`, mount path `/data`).
3) Set environment:
   - `TELEGRAM_BOT_TOKEN=...`
   - `ENCRYPTION_SECRET=...`
   - `BOT_MODE=polling` (recommended to start; switch to `webhook` later)
   - `DB_PATH=/data/agent.db`
   - Optional for webhook: `WEBHOOK_URL=https://your-domain.com/telegram/webhook`, `PORT=3000`, `TELEGRAM_WEBHOOK_SECRET=...`
4) Deploy: Railway will run `bun run start` from `packages/agent` (see Dockerfile).
5) Verify health: `curl https://<railway-url>/health` (or `/ready` if voice-model readiness matters).
6) Talk to the bot in Telegram (`/start`, `/status`) to confirm.

Notes:
- The bot pulls chain config from the shared `getDefaultChain()` (VITE_CHAIN_ID); ensure root `.env` matches your target chain.
- SQLite lives on the mounted volume; no DB = fresh state each deploy.

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

# Analytics (optional, enabled in production)
POSTHOG_AGENT_KEY=phc_...     # PostHog API key from https://posthog.com
ANALYTICS_ENABLED=true        # Enable/disable analytics
PINATA_JWT=...                # Required for POST /api/uploads/sign
RESEND_API_KEY=...            # Required for POST /public/subscribe subscriber capture
RESEND_GREEN_GOODS_SEGMENT_ID=...
RESEND_GREEN_GOODS_TOPIC_ID=...
AGENT_ALLOWED_ORIGINS=...     # Comma-separated browser origins allowed to request public APIs
```

Use `POSTHOG_AGENT_KEY` for Fly secrets. `VITE_POSTHOG_AGENT_KEY` is a browser-style name and is ignored by the Node agent runtime.

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
- **Upload Signing**: Browser uploads receive short-lived Pinata signed upload URLs; the Pinata JWT stays server-side
- **On-Chain Verification**: Operator roles verified against smart contracts
- **Input Validation**: Address and key format validation
- **Analytics Privacy**: User IDs are hashed before sending to PostHog (no raw Telegram IDs stored)

### Rate Limits

| Action | Limit | Window |
|:-------|:------|:-------|
| Messages | 10 | 1 min |
| Voice | 3 | 1 min |
| Submissions | 5 | 5 min |
| Commands | 20 | 1 min |
| Approvals | 30 | 1 min |

## Testing

Uses **Vitest** for unit tests with an in-memory SQLite mock for database operations.

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# Coverage report
bun run test:coverage
```
