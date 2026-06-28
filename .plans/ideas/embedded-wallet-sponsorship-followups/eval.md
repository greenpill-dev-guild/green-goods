# Embedded Wallet Sponsorship Follow-Ups Evaluation Plan

## Release Gates

1. Correctness: sender behavior and offline semantics match what the product tells users.
2. Usability: login/auth copy makes identity continuity and sponsorship behavior understandable.
3. Regression safety: passkey auth, wallet fallback, and embedded restore keep working.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Embedded and wallet sender capability flags match real execution behavior | `state_api` | Sender tests or code proof |
| AC-2 | Sponsored execution is attempted only when supported and preserves the current fallback path | `state_api` | Sender tests |
| AC-3 | Embedded offline behavior uses deferred-signing semantics instead of implying full offline signing | `state_api` | Auth/workflow proof |
| AC-4 | Login/auth copy explains address continuity and sponsorship differences clearly | `ui` | UI review or screenshot |
| AC-5 | Passkey, wallet fallback, and embedded restore regressions remain covered | `qa_pass_2` | Test output |
| AC-6 | `bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build` passes | `qa_pass_2` | Command output |

## Test Strategy

- Unit: sender and auth/session logic
- Integration: sender factory selection and login/auth flow behavior
- E2E / Playwright: optional client login smoke path if UI copy or flow order changes materially
- Manual checks: exercise embedded login, wallet login, passkey login, and offline draft/deferred-signing messaging

## QA Sequence

### Claude QA Pass 1

- Focus on address continuity messaging, sponsorship expectations, and any login hierarchy confusion
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/embedded-wallet-sponsorship-followups`
- Re-run targeted sender/auth validation and close the loop on remaining defects
