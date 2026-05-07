# Agent PostHog Observability Brief

Formalizes the active PostHog observability plan as a plan hub. The work gives Claude Code routines read-only access to production telemetry so bug intake and interactive debugging can match reports to real errors, sessions, and recurring patterns before creating Linear records.

As of 2026-05-06, the primary path is Claude Code connector access for PostHog and Linear. The durable query script remains a fallback for Codex, cron, or non-connector contexts. PostHog MCP is no longer planned.
