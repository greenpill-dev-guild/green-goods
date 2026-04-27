# Developer Experience Proof Pass Spec

## Goal

Prove the existing DevEx hardening work in an environment that is not the original macOS workspace. This is a validation and evidence-capture plan; do not add new tooling unless the proof pass exposes a concrete failure.

## Current Implemented Surface

Source checks on 2026-04-25 confirmed the commands and docs exist:

- `package.json` includes `dev:doctor`, `dev:web`, and `dev:smoke:web`.
- `scripts/dev/doctor.js` supports profile-aware and JSON output.
- `scripts/dev/smoke-web.js` runs the web doctor before client/admin/docs reachability checks.
- `docs/docs/builders/getting-started.mdx` and `docs/docs/reference/faq.mdx` document the web path.

## Proof Environments

Preferred first target: Ubuntu, WSL2, or devcontainer with Node, Bun, Git, and repo checkout.

Secondary target: Docker/indexer/full-stack profile only after the web profile proof is recorded.

## Required Evidence

1. Environment summary: OS, Bun version, Node version, and whether Docker is installed/running.
2. `bun run dev:doctor -- --profile web --json` output summary, with no secret values.
3. `bun run dev:web` startup result.
4. `bun run dev:smoke:web` result for client/admin/docs reachability.
5. Any docs mismatch or stale troubleshooting step found during the run.

## Human Judgment Points

- Whether to accept expected environment-specific failures, such as missing secrets or occupied ports.
- Whether full-stack Docker/indexer proof belongs here or in a later active hub.
- Whether any failure requires code changes or just docs/ops guidance.
