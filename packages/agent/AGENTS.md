# Green Goods Agent — Architecture Guide

The agent package provides a platform-agnostic bot for Green Goods that currently supports Telegram, with architecture designed for future Discord, WhatsApp, and SMS integrations.

## Quick Reference

| Command | Description |
|---------|-------------|
| `bun dev` | Start in polling mode (local dev) |
| `bun start` | Start in webhook mode (production) |
| `bun test` | Run all tests |
| `bun test --coverage` | Run with coverage report |

## Architecture Overview

```
src/
├── types.ts           # All types (messages, responses, users, etc.)
├── index.ts           # Entry point
├── config.ts          # Configuration loader
├── handlers/          # Command & message handlers (pure functions)
├── services/          # External integrations (singletons)
├── platforms/         # Platform adapters
└── api/               # Fastify health + webhooks
```

**Philosophy:** Keep it simple. Direct imports, singleton services, minimal indirection.

## Core Concepts

### Platform-Agnostic Messages

All platforms normalize to a common format:

```typescript
interface InboundMessage {
  id: string;
  platform: "telegram" | "discord" | "whatsapp" | "sms";
  sender: { platformId: string; displayName?: string };
  content: MessageContent; // text | command | voice | callback | image
  timestamp: number;
}
```

### Handler Pattern

Handlers are pure functions with dependency injection for testability:

```typescript
export async function handleStart(
  message: InboundMessage,
  deps: { generatePrivateKey: () => `0x${string}` }
): Promise<HandlerResult> {
  // Business logic here
  return { response: { text: "Welcome!" } };
}
```

### Session Management

Sessions track multi-step flows via `updateSession` / `clearSession` in handler results.

## Development

### Adding a Command

1. Create handler in `src/handlers/{command}.ts`
2. Add route in `handlers/index.ts` switch
3. Write tests in `src/__tests__/`
4. Update help text

### Adding a Platform

1. Create `src/platforms/{platform}.ts` with:
   - `toInboundMessage()` — Transform platform → unified format
   - `toResponse()` — Transform unified → platform format
   - `create{Platform}Bot()` — Bot setup
2. Add webhook route in `api/server.ts`
3. Initialize in `index.ts`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | Yes |
| `ENCRYPTION_SECRET` | 32+ char secret for key encryption | Yes |
| `BOT_MODE` | `polling` or `webhook` | No (default: webhook) |
| `DB_PATH` | SQLite path | No (default: data/agent.db) |

See deployment guide for full production configuration.

## Deep Dive Rules

Detailed patterns for specific concerns:

- **Architecture:** `.cursor/rules/architecture.mdc` — Data flow, handler context, layer patterns
- **Deployment:** `.cursor/rules/deployment.mdc` — Railway, Docker, webhooks, monitoring
- **Security:** `.cursor/rules/security.mdc` — Encryption, rate limiting, input validation
- **Testing:** `.cursor/rules/testing.mdc` — Coverage targets, test patterns

## Key Anti-Patterns

❌ **Don't put business logic in platform adapters** — Adapters only transform

❌ **Don't skip rate limiting** — Always check before expensive operations

❌ **Don't hardcode chain IDs** — Use `getConfig().chainId`

❌ **Don't store plaintext keys** — Always encrypt via `prepareKeyForStorage()`

## Dependencies

| Package | Purpose |
|---------|---------|
| `telegraf` | Telegram Bot API |
| `fastify` | HTTP server |
| `viem` | Blockchain operations |
| `@xenova/transformers` | Whisper STT |
| `@green-goods/shared` | Shared business logic |

## References

- [Shared Package](../shared/AGENTS.md)
- [Contracts Handbook](../../docs/developer/contracts-handbook.md)
