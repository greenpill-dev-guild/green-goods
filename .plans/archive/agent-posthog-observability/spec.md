# Agent PostHog Observability Spec

The state/API lane owns connector-first PostHog observability guidance for Claude Code routines, Linear bug-intake wiring, `/debug` skill integration, and privacy-safe replay-link handling.

Claude Code should use PostHog and Linear connectors as the primary path. `scripts/agents/posthog-query.ts` is fallback-only for runtimes without connector access. Do not add a PostHog MCP server.

All Linear Customer Need / Issue body output must avoid replay URLs, session IDs, distinct IDs, wallet/user identifiers, and reporter identifiers. Replay links are private-context evidence only unless explicitly routed to an approved private field or private channel.
