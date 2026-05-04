# Agent Package Hardening Spec

The state/API lane covers auth-path tests, idempotency for side-effecting handlers, sanitized error boundaries, rate-limit coverage, crypto-flow review, and a small observability cleanup if it stays cheap.

The plan succeeds when the existing agent surface has targeted proof around trust-bearing handlers and a documented key-material flow without introducing SMS/WhatsApp behavior.
