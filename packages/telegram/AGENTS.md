# Green Goods — Telegram Bot Agent Guide

Context for AI agents working on the `packages/telegram` directory.

## Core Responsibilities

-   **Bot Interface**: Primary interface for users to join gardens, submit work, and approve work via Telegram.
-   **Custodial Wallet Management**: Manages local wallets for users (MVP).
-   **AI Integration**: Handles STT (Speech-to-Text) and NLU (Natural Language Understanding) for conversational flows.

## Key Patterns

-   **Telegraf**: Uses `telegraf` framework for bot logic.
-   **Session Management**: Uses `better-sqlite3` for persistent session state and pending work storage.
-   **Shared Logic**: Imports business logic (submission, encoding) from `@green-goods/shared`.
-   **Environment**: Loads environment variables from the root `.env` file.

## Development Rules

1.  **Statelessness**: Avoid in-memory state for critical flows; persist to SQLite.
2.  **Type Safety**: Use shared types from `@green-goods/shared` where possible.
3.  **Error Handling**: Gracefully handle AI model failures (fallback to regex/text).
4.  **Security**: Treat private keys in `bot.db` with extreme caution (MVP only).

## Common Tasks

-   **Adding Commands**: Register new commands in `bot.ts`.
-   **Updating AI**: Modify `services/ai.ts` for model updates or logic changes.
-   **Schema Changes**: Update `services/storage.ts` and run migrations (if any) manually for now.
