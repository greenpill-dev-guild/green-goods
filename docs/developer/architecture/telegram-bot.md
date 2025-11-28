# Telegram Bot

The **Telegram Bot** package (`packages/telegram`) provides a conversational interface for Green Goods, enabling users to join gardens, submit work, and approve submissions directly from Telegram.

## Overview

The bot is designed to be a "Bot-First" alternative to the web client, focusing on ease of use and low-bandwidth accessibility. It leverages AI for natural language understanding and voice processing.

### Key Features

*   **Custodial Wallet Management**: Automatically generates and manages wallets for users (MVP).
*   **Natural Language Submission**: Users can describe their work in plain text.
*   **Voice-to-Text**: Supports voice notes for work submission using OpenAI Whisper (via `@xenova/transformers`).
*   **Operator Approvals**: Operators receive notifications and can approve work with a single command.

## Architecture

The bot is built with **Telegraf** and runs as a standalone Node.js process.

### Tech Stack

*   **Framework**: [Telegraf](https://telegraf.js.org/)
*   **Database**: `better-sqlite3` (local SQLite for sessions and user data)
*   **AI/ML**: `@xenova/transformers` (local inference for STT)
*   **Blockchain**: `viem` (interaction with EAS and Green Goods contracts)

### Data Flow

1.  **User Input**: Text or Voice message received via Telegram Webhook/Polling.
2.  **Processing**:
    *   **Voice**: Transcribed to text using Whisper.
    *   **Text**: Parsed (currently Regex/Logic, planned LLM) to extract work details.
3.  **Session**: Draft work stored in SQLite session.
4.  **Confirmation**: User confirms details via Inline Keyboard.
5.  **Submission**:
    *   Bot creates a `WorkDraft`.
    *   Bot signs and submits transaction to EAS using the user's local custodial wallet.
    *   **Pending State**: If approval is needed, work is stored as "pending" and operator is notified.
6.  **Approval**: Operator sends `/approve <id>`, bot submits on-chain attestation.

## Directory Structure

```
packages/telegram/
├── src/
│   ├── services/
│   │   ├── ai.ts       # STT and NLU logic
│   │   └── storage.ts  # SQLite database wrapper
│   ├── bot.ts          # Main bot logic and command handlers
│   └── index.ts        # Entry point
├── bot.db              # Local database (gitignored)
└── package.json
```

## Setup & Configuration

The bot requires a Telegram Bot Token from [@BotFather](https://t.me/BotFather).

### Environment Variables

| Variable | Description |
| :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | API Token from BotFather |
| `DB_PATH` | Path to SQLite DB (default: `bot.db`) |

### Running Locally

```bash
# From root
bun run dev:telegram
```
