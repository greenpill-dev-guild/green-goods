# Green Goods Name Reservation at Sign-Up Evaluation Plan

## Release Gates

1. **Correctness**: a reserved name is still there when the account comes back to register it, and
   a name that was displaced or expired says so plainly instead of failing as a generic
   `NameTaken`.
2. **Usability**: a person typing a name at sign-up sees the Green Goods name it becomes before
   they commit to it, and a person who already has a name is never asked for another.
3. **Regression safety**: account creation, sign-in, and cross-device recovery are unchanged in
   every failure mode, including both chain reads failing and the passkey server being disabled.
4. **Evidence quality**: research evidence and open assumptions are recorded before
   implementation.
5. **Human judgment**: the seven decisions in `spec.md § Human Judgment Points` are answered and
   recorded in the decision log before the lanes they gate begin.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Sign-up name field | A name needing normalization shows the slug it becomes and reserves that slug on acceptance | `ui` | |
| AC-2 | Sign-up resilience | With both chain reads failing, the account is still created and the reservation is deferred, not lost | `ui` | |
| AC-3 | Reservation decision | Each branch — available, invalid, registered, reserved elsewhere, unknown — returns its own result, and a read failure returns `unknown` rather than "taken" | `state_api` | |
| AC-4 | Reservation store | One active reservation per account; a second account cannot take a held name; an expired one can be taken | `state_api` | |
| AC-5 | Reservation privacy | No route enumerates accounts or names, and no raw error reaches a log | `state_api` | |
| AC-6 | Claim path | Registering a reserved name is the existing membership-gated claim, unchanged, and a displaced reservation is reported as displacement | `state_api` | |
| AC-7 | Already-named accounts | A wallet with a mainnet ENS name is never nudged to claim and never gets a reservation | `ui` | |
| AC-8 | Existing accounts | An existing username is never rewritten, and recovery on another device still works | `qa_pass_1` | |
| AC-9 | Name resolution | Every listed surface resolves a name through one helper in the documented order | `ui` | |
| AC-10 | On-chain reservation (conditional) | Reserve, claim-your-own, claim-another's, expiry, and cooldown interaction | `contracts` | |
| AC-11 | QA review | First-run sign-up walked on a real device; the held name survives a full claim | `qa_pass_1` | |
| AC-12 | Regression review | Auth, recovery, and claim paths re-verified; targeted validation re-run | `qa_pass_2` | |

## Test Strategy

- **Unit**: the reservation decision function, every branch, including read failure. No new copies
  of the slug rules — `packages/shared/src/__tests__/utils/ens.test.ts` already owns those.
- **Integration**: agent API tests modeled on
  `packages/agent/src/__tests__/garden-join-requests.api.test.ts`, covering create, replace,
  expire, conflict, rejected signature, and the privacy assertions in AC-5.
- **E2E / Playwright**: sign-up with a name needing normalization; sign-up with chain reads
  failing.
- **Manual checks**: one real reserve-then-claim on the authenticated Brave QA profile, including
  the ~15–20 minute registration wait and a check that the name resolves on the PWA, the admin
  cockpit, and the public site.
- **TDD proof**: RED/GREEN commands and evidence recorded in lane handoffs and summarized in
  `status.json`.

## QA Sequence

### Claude QA Pass 1

- Walk first-run sign-up on a device, including the normalization confirmation and the offline
  case
- Verify AC-1, AC-2, AC-7, AC-8, AC-9, AC-11
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Re-verify AC-3 through AC-6 and AC-10, re-run targeted validation, and close the loop on
  remaining defects
