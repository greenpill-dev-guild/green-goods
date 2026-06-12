# Sentry Stack Observability Spec

## Architecture

Browser apps initialize Sentry from `@green-goods/shared/sentry`, a subpath export that is not part of the shared root barrel. The shared `trackError()` funnel sends structured errors to PostHog and also forwards categorized non-global errors to registered external reporters. Sentry's native handlers own `window.onerror` and `unhandledrejection`; the shared reporter bridges React error boundaries and categorized app errors.

The agent initializes `@sentry/bun` from `packages/agent/src/services/sentry.ts`. Capture points are startup/runtime failures, Hono `onError`, and message-handler failures. The prior Hono middleware approach is intentionally avoided because it enabled default PII and added a public debug route.

## Privacy

- `sendDefaultPii` is false everywhere.
- Browser replay is error-only with all text masked and media blocked.
- Shared redaction strips emails, wallet addresses, tokens, sensitive keys, and URL query/hash data.
- Agent capture context excludes raw Telegram IDs, message text, reporter names, wallet addresses, and email addresses.

## Environment

- `VITE_SENTRY_CLIENT_DSN`
- `VITE_SENTRY_ADMIN_DSN`
- `SENTRY_AGENT_DSN`
- `SENTRY_AUTH_TOKEN` for build-time source map upload only
- `SENTRY_ORG`, `SENTRY_CLIENT_PROJECT`, `SENTRY_ADMIN_PROJECT`, `SENTRY_AGENT_PROJECT`

## Agentic Flow

- Sentry evidence: issue ID/shortlink, title, top-line message, normalized top frame, release/environment, event/user count, first/last seen, suspect commit.
- PostHog evidence: error hash, affected sessions/users, replay/session lookup in private context, product journey/funnel context.
- Counts are not merged across tools.
- Routines remain Sentry-ready but not Sentry-dependent until a connector/API surface is attached.
