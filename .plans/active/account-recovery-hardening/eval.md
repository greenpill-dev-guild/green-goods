# Account Recovery Hardening Evaluation Plan

## Release Gates

1. Correctness: server-backed registration and login rebuild the same Kernel smart-account address for the same passkey user.
2. Recovery behavior: local browser/PWA storage loss no longer forces a new account when the user's passkey provider still has the credential.
3. Legacy safety: existing local-only users retain same-device access and receive re-enrollment guidance.
4. Failure safety: passkey server or network failures do not delete stored credentials, usernames, or auth-mode state.
5. Rollout safety: `VITE_PASSKEY_SERVER_ENABLED` is false by default and enabled first in staging with QA evidence before production.
6. Account creation guardrail: failed recovery never routes users directly into creating a separate smart-account address without explicit confirmation copy.
7. Origin safety: production passkey ceremonies use approved HTTPS origin(s), RP ID `greengoods.app`, and no preview/localhost credentials.
8. Address safety: recovered credentials must rebuild the expected smart-account address; mismatch fails closed.
9. Observability safety: recovery telemetry uses reason codes and source/outcome flags without raw username, credential ID, wallet address, or smart-account address.
10. Evidence quality: QA records browser, installed PWA, reinstall/local-storage-clear, and server-unavailable cases before June 10.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Server-backed registration | New passkey registration verifies through Pimlico passkey server and stores a cache of the verified credential | `state_api` | targeted auth test |
| AC-2 | Server-backed login | Login by username retrieves/verifies server credential and rebuilds the same smart-account address | `state_api` | targeted auth test |
| AC-3 | Legacy fallback | Local-only credential can still authenticate on the same device when no server credential exists | `state_api`, `ui` | targeted auth test + UI proof |
| AC-4 | Username recovery prompt | Missing local credential cache opens username/ENS-handle recovery before server-backed lookup | `ui`, `state_api` | UI proof + targeted auth test |
| AC-5 | Guarded new account | Failed recovery requires explicit separate-address confirmation before account creation | `ui` | QA screenshot or handoff note |
| AC-6 | Rollout flag | Passkey-server path is disabled by default and can be enabled for staging QA | `state_api` | env/config test or build proof |
| AC-7 | Canonical origin/RP | Production RP/origin and staging/prod isolation are documented and validated before prod enablement | `state_api`, `qa_pass_1` | config evidence + QA note |
| AC-8 | Address continuity | Server-backed registration/login rebuilds the same expected smart-account address and mismatch fails closed | `state_api`, `qa_pass_2` | targeted auth test |
| AC-9 | Privacy-safe telemetry | Recovery analytics emit reason/source/outcome only and avoid raw account identifiers | `state_api` | code review note + test/handoff |
| AC-10 | Docs/support cleanup | Stale IndexedDB/ENS passkey recovery claims and env docs are updated or marked historical | `ui`, `state_api`, `qa_pass_2` | docs diff or handoff note |
| AC-11 | QA matrix | Browser/PWA/reinstall/provider-sync matrix is completed and blockers are filed under PRD-521 | `qa_pass_1` | `reports/` artifact |
| AC-12 | Regression review | Codex reruns targeted auth tests and `build:shared` after QA pass 1 | `qa_pass_2` | handoff evidence |

## Test Strategy

- Unit: shared auth service and auth machine tests for registration, login, rollout flag off, no-server-credential fallback, server failure, address mismatch, unsupported context classification, telemetry payload shape, and storage preservation.
- Integration: passkey-server client mocks at the shared auth boundary.
- E2E / Playwright: use existing passkey mock project where it can honestly cover the flow; record any provider-sync behavior that requires manual device testing.
- Manual checks: desktop Chrome, Android Chrome/PWA, iOS Safari/PWA if available, installed PWA, browser-to-installed-PWA, local storage clear/reinstall, unsupported/in-app browser negative cases, passkey server unavailable, and failed recovery followed by guarded new-account creation.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.
- Production readiness proof: attach staging flag evidence, Pimlico dashboard/config notes, rollback instructions, and docs/support cleanup evidence before enabling production.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, fallback clarity, and missing provider/device cases.
- Treat `PRD-505` and `PRD-507` as acceptance cases.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/account-recovery-hardening`.
- Re-run targeted validation and close the loop on remaining auth/recovery defects.
