# Developer Experience Proof Pass

**Slug**: `developer-experience-proof-pass`
**Stage**: `archive`
**Priority**: `p2`
**Created**: `2026-04-25`

## Problem

The earlier DevEx hardening pass had already delivered the first tooling pass: profile-aware doctor, web smoke command, docs, and setup guidance. Keeping that old plan open in backlog made the board look less current than the repo. The remaining value is proof on another environment, not more speculative tooling.

## Desired Outcome

- Confirm the web onboarding path works from a clean-ish Ubuntu, WSL2, or devcontainer environment.
- Capture any real failures as focused follow-up tasks.
- Decide whether Docker/indexer/full-stack proof should become a separate active lane after web proof.

## Scope Notes

- In scope: `bun run dev:doctor -- --profile web --json`, `bun run dev:web`, `bun run dev:smoke:web`, docs accuracy, and machine-readable output sanity.
- Optional follow-up: `full` profile and Docker/indexer proof after web path is verified.
- Out of scope: new setup architecture, package-level `.env` files, or rewriting the existing DevEx scripts without evidence.

## Success Signal

A fresh environment can follow the documented web path and reach client/admin/docs, or the plan records exact blockers with command output and a small remediation path.
