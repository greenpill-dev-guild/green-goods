# Agent PostHog Observability Spec

The state/API lane owns the read-only PostHog query surface, local cache behavior, bug-intake routine wiring, `/debug` skill integration, and privacy-safe replay-link handling.

All public issue output must avoid replay URLs and user-identifying properties. Replay links are private-context evidence only unless explicitly routed to a private channel/comment.
