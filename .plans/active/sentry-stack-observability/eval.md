# Sentry Stack Observability Eval

## Validation

- `bun run --cwd packages/shared typecheck` — passed
- `bun run --cwd packages/agent typecheck` — passed
- `bun run --cwd packages/shared test src/__tests__/modules/app/sentry-redaction.test.ts` — passed
- `bun run --cwd packages/agent test src/__tests__/sentry.test.ts src/__tests__/config.test.ts` — passed
- `bun run --cwd packages/client build` — passed with existing Rollup/chunk warnings
- `bun run --cwd packages/admin build` — passed with existing CSS/Rollup/chunk warnings
- `bun run --cwd packages/agent build` — passed
- 2026-05-27 review: `bun run --cwd packages/shared test src/__tests__/components/ErrorBoundary.test.tsx src/__tests__/components/SheetErrorBoundary.test.tsx src/__tests__/modules/app/sentry-redaction.test.ts` — passed
- 2026-05-27 review: `bun run --cwd packages/agent test src/__tests__/sentry.test.ts src/__tests__/config.test.ts` — passed
- 2026-05-27 review: `bun run --cwd packages/shared typecheck`, `bun run --cwd packages/agent typecheck`, `bun run --cwd packages/client build`, `bun run --cwd packages/admin build`, and `bun run --cwd packages/agent build` — passed

## Remaining Proof

Runtime Sentry ingestion is not proven until DSNs and `SENTRY_AUTH_TOKEN` are configured in deployed environments. First-event verification should confirm:

- client React boundary crash appears in `green-goods-client`
- admin React boundary crash appears in `green-goods-admin`
- agent Hono/runtime failure appears in `green-goods-agent`
- uploaded source maps resolve frames for a production release
- agent source-map upload is not wired into the Fly Docker build; run it only as an explicit deploy step because it sends private build artifacts to Sentry
