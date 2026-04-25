# Developer Experience Hardening Spec

## Summary

Create a backlog hub and implementation surface for making Green Goods onboarding fast, repeatable, and testable. The first target is a 30-minute web-stack start for macOS, Linux, and WSL2/devcontainer users. Confidence then expands to Linux container proof and finally full-stack Docker/indexer proof.

## Users

- Primary: new Green Goods developers joining from macOS, Linux, or WSL2/devcontainer.
- Secondary: maintainers and agent operators who need reliable setup checks, docs, and validation gates.

## Functional Requirements

1. Keep this effort in `.plans/backlog/developer-experience-hardening/` until intentionally promoted to active.
2. Add a profile-aware doctor command: `bun run dev:doctor -- --profile web|full|contracts|upload`.
3. Add machine-readable doctor output with `bun run dev:doctor -- --json`.
4. Add `bun run dev:smoke:web` for doctor plus web-stack health checks.
5. Document the expected developer rhythm from first clone through web stack and focused tests.
6. Preserve agent-agnostic contracts: shared rules live in `AGENTS.md`, package `AGENTS.md`, `.plans`, and mirrored GitHub guidance; tool adapters stay optional.
7. Stage proof:
   - Phase 1: first-clone web onboarding, doctor accuracy, stale-env detection, docs consistency.
   - Phase 2: Ubuntu-based web smoke proof with Node 22, Bun, generated `.env`, `SKIP_MKCERT=true`, and client/admin/docs health checks.
   - Phase 3: Docker/indexer/full-stack smoke after web onboarding stabilizes.

## Non-Functional Constraints

- Package boundaries: repo tooling and docs only unless a DevEx check proves a product startup blocker.
- Performance: doctor and web smoke checks should be fast enough for iterative local use.
- Security: never print secret values; report presence, missing state, or unresolved OP refs only.
- Offline / sync: no product offline behavior changes.
- Localization: no new product-facing strings expected.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | `n/a`; no product UI work in this backlog item |
| State / API | `state_api` | Owns scripts, package commands, docs, plan hub, and validation wiring |
| Contracts | `contracts` | `n/a`; no Solidity or deployment work |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential review after implementation |

## Risks

- Risk: doctor output becomes noisy and developers ignore it.
- Mitigation: profile-aware checks distinguish required failures from role-specific warnings.
- Risk: PM2 reports a process online even when the service never bound its port.
- Mitigation: web smoke checks must verify actual HTTP(S) reachability, not PM2 status alone.
- Risk: container proof overfits Linux and misses macOS/WSL differences.
- Mitigation: keep Linux container proof as one confidence layer, not the only release gate.
