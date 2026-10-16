# Keep Older Passkey Accounts Working on Every Site Evaluation Plan

## Release Gates

1. **Correctness.** An adopted account opens at the same address on every site its passkey can
   reach, and the deployed WebAuthn validator accepts its signatures there.
2. **Safety.** Adoption refuses every case in AC-3. No name, key or credential ID reaches a log.
3. **Regression safety.** Directory sign-up and sign-in, hosted sign-in on its home site, session
   restore and signing behave as before. Sign-in never waits on adoption.
4. **Evidence quality.** Every claim carries its evidence label: clean-room Chromium with a
   virtual authenticator, authenticated device, or a read-only `eth_call`.
5. **Human judgment.** Decisions 1 to 8 in [plan.todo.md](plan.todo.md) are answered before any
   step starts. Shared auth and the agent directory keep the critical override.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Directory sign-in, hex stored ID | An entry whose `id` is hex signs in, and the session keeps that string as the Kernel identity | `state_api` | RED today: `NotAllowedError` on beta and www (clean-room report, scenario A). Unit test after step 1. |
| AC-2 | Adoption, success | A remembered passkey is adopted on the site where it works. Sign-in by name then succeeds on admin and beta with the same address. | `state_api` | Prototype passed (scenario C, address check D). Agent and shared tests after steps 5 and 6. |
| AC-3 | Adoption, refusals | Replayed challenge, wrong key, taken name, wrong site, unadoptable domain, hosted name held by a different passkey, and hosted lookup down are all refused | `state_api` | Prototype refused the first four (scenario C, A). Route tests after step 5 cover all seven. |
| AC-4 | Related origins | With the file on beta, a beta-bound passkey signs in and signs on www and admin. Without the file, or with www missing, Chrome refuses. | `ui` | Passed in clean-room Chromium (scenario A and controls). Smoke check and device walk after step 8. |
| AC-5 | On-chain acceptance | Signatures made through related origins and after adoption validate against Arbitrum's deployed validator; a tampered hash does not | `state_api` | Passed via read-only `eth_call` with a state override (scenario E). Rerun on the branch. |
| AC-6 | Copy | Wrong-site and unsupported-browser failures show the new copy in en, es and pt | `ui` | Unit tests after step 9 |
| AC-7 | Saved sessions | The account row shows only for passkey sessions without a directory entry, and disappears after adoption | `ui` | Component test and Storybook after step 7 |
| AC-8 | QA review | The full journey on Android Chrome and iPhone Safari | `qa_pass_1` | Authenticated device proof (step 11) |
| AC-9 | Regression review | Existing passkey specs and auth tests pass, and the critical gate is green | `qa_pass_2` | `node scripts/dev/ci-local.js --intent push` receipts |

## Test Strategy

- **Unit (shared):** directory sign-in with hex and base64url IDs; the verifier at its new home;
  the adoption client's address guard and its silent failure; error copy.
- **Unit and route (agent):** the adoption rules with a software passkey that makes assertions;
  the store migration for both stores; the hosted lookup with a stubbed fetch.
- **Integration:** the clean-room rig in [artifacts/rig/](artifacts/rig/README.md), rerun on the
  branch. Cross-site ceremonies need real hostnames on the default port, so this stays a
  scripted manual proof rather than a CI test (proof limit).
- **E2E / Playwright:** extend `tests/specs/client.passkey.spec.ts` only for adoption on a single
  origin, which a virtual authenticator can cover in CI.
- **Manual:** authenticated device proof (AC-8); Afo runs it.
- **TDD proof:** RED and GREEN commands and evidence are recorded in lane handoffs and summarized
  in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Walk the journeys in AC-2, AC-4 and AC-7 on devices, and check the copy in all three languages.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` passes.
- Re-run the rig and the critical gate, then close the loop on remaining defects.
