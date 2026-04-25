# Developer Experience Hardening

**Slug**: `developer-experience-hardening`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-04-23`

## Problem

Green Goods has grown from a solo-developer environment into a multi-developer and multi-agent repo. The first-clone path, local web stack, environment validation, and agent guidance need to be more repeatable so a new contributor can get productive without inheriting machine-specific assumptions, stale `.env` values, or tool-specific hooks.

## Desired Outcome

- A new developer can reach the web stack, client/admin/docs, in about 30 minutes on macOS, Linux, or WSL2/devcontainer.
- `bun run dev:doctor` catches blockers before a developer starts PM2 and sees a false "online" service.
- Documentation explains the rhythm: first clone, doctor, web stack, focused test loop, agent-agnostic rules, then full-stack escalation.
- Environment confidence grows in stages instead of trying to solve every machine and full-stack concern at once.

## Scope Notes

- In scope: first-clone setup, profile-aware doctor checks, web smoke checks, docs consistency, Linux container/web proof, staged full-stack Docker/indexer follow-up.
- Out of scope for the first success bar: native Windows PowerShell support, upload-capable QA, full-stack/indexer proof, and product runtime changes unless a DevEx check reveals a true startup blocker.

## Success Signal

A clean machine can run `npm run setup`, `bun run dev:doctor -- --profile web`, and `bun run dev:smoke:web` and get actionable output that leads to a working client/admin/docs stack without relying on project-specific tribal knowledge.
