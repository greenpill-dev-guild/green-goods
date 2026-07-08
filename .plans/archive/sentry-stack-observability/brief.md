# Sentry Stack Observability Brief

Add Sentry to Green Goods as the stack/root-cause companion to PostHog across the client, admin, and agent surfaces.

PostHog remains the product telemetry system: sessions, funnels, replay, usage patterns, and customer-impact sizing. Sentry owns crash grouping, stack traces, releases, source maps, suspect commits, and agent/API runtime failures. The first rollout keeps both tools active with conservative privacy defaults and no Sentry MCP wiring.

## Scope

- Browser client: `green-goods-client`
- Browser admin: `green-goods-admin`
- Agent/API: `green-goods-agent`
- Shared PII redaction and error-funnel integration
- Routine/skill docs for agentic debugging flow

## Non-goals

- Contracts/indexer Sentry integration
- Sentry logs/profiling rollout
- Sentry MCP or custom connector setup
- Replacing PostHog exception/session workflows
