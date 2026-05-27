# Sentry Stack Observability Eval

## Validation

- `bun run --cwd packages/shared typecheck` — passed
- `bun run --cwd packages/agent typecheck` — passed
- `bun run --cwd packages/shared test src/__tests__/modules/app/sentry-redaction.test.ts` — passed
- `bun run --cwd packages/agent test src/__tests__/sentry.test.ts src/__tests__/config.test.ts` — passed
- `bun run --cwd packages/client build` — passed with existing Rollup/chunk warnings
- `bun run --cwd packages/admin build` — passed with existing CSS/Rollup/chunk warnings
- `bun run --cwd packages/agent build` — passed

## Remaining Proof

Runtime Sentry ingestion is not proven until DSNs and `SENTRY_AUTH_TOKEN` are configured in deployed environments. First-event verification should confirm:

- client React boundary crash appears in `green-goods-client`
- admin React boundary crash appears in `green-goods-admin`
- agent Hono/runtime failure appears in `green-goods-agent`
- uploaded source maps resolve frames for a production release
