# Docs Remediation — 2026-08-14 Audit

The Docusaurus site was audited end-to-end on 2026-08-14 (140 pages, rendered screenshots, production build, live-site probe, three code-vs-docs sweeps). Full evidence: https://claude.ai/code/artifact/302fc9ac-8b6e-4de6-9957-3e218dbd6fa8

Headline findings: site search is broken in production (no search-index emitted → live 404), a set of factually stale claims (badges "Planned" though live, SMS/WhatsApp channels that don't exist, wrong chain defaults, four-route inventories vs ten real routes), commitment pooling absent from user-facing docs despite live contracts, and ~12 pages unreachable from any sidebar with no CI gate to catch drift.

The remediation is four phases, one PR each, defined in [plan.todo.md](plan.todo.md). Work is parked pending credit budget; partial verification/edits from a first attempt exist in local worktrees (see plan § Status).
