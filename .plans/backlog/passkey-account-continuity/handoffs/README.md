# Handoffs: passkey-account-continuity

## State (2026-10-16)

- **Planned and de-risked; nothing implemented.** Lanes are `todo`; `contracts` is `n/a`.
- **Waiting on Afo:** decisions 1 to 7 in [plan.todo.md](../plan.todo.md#decision-log). Decision 8
  is answered: COM-39 was rewritten on 2026-10-16. Step 6
  depends on decision 2, and step 8 on decision 4.
- **Proven in clean-room Chromium** ([report](../reports/2026-10-16-clean-room-proof.md)):
  - A beta-bound passkey signs in and signs on www and admin once beta serves
    `/.well-known/webauthn`.
  - An app-made apex passkey, once adopted, signs in by name on admin and beta at the same
    address.
  - The deployed validator accepts every signature produced.
- **Found:**
  - Directory sign-in can't name a passkey stored with a hex ID (step 1).
  - The agent's `@simplewebauthn/server` can't verify ES256 assertions with the current lockfile
    (follow-up F1).
  - www and beta answer `/.well-known/webauthn` with the app shell today.
- **Not proven:** real devices, passkey sync, browsers other than Chromium.
- **Browser support** for related origin requests was checked on 2026-10-16:
  - Chrome and Edge 128+ on every platform, including Android.
  - iOS and iPadOS 18+, and Safari on macOS 15+.
  - Firefox 152+, which rests on passkeys.dev only.

  Details are in [spec.md](../spec.md#browser-support-for-related-origin-requests).

## Resume

1. Read the decision answers. Promote the hub with
   `node scripts/harness/plan-hub.mjs move --feature passkey-account-continuity --to active`, then
   run the Linear gate from the plan skill.
2. Start at step 1. Steps 1 to 5 can land before any user-visible change.
3. Rerun the rig ([artifacts/rig/README.md](../artifacts/rig/README.md)) after steps 1, 5 and 8.

## Task record

Task record: passkey-account-continuity (plan and clean-room proof) | Type: investigation | Outcome: complete
Agent/model: Claude Code, claude-opus-5-5 | Coverage: planning segment on 2026-10-16

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| investigate | unknown → 2026-10-16T19:20Z | Rig built; scenarios A to E passed, and A found the hex-ID failure (report above) |
| implement | 2026-10-16T19:35Z → 2026-10-16T20:10Z | Hub written: brief, spec, plan, eval, report, rig, COM-39 draft |
| verify | 2026-10-16T20:00Z → 2026-10-16T20:10Z | Portable rig rerun from the hub (results-2026-10-16.json); `plan-hub validate` run before handoff |

Human corrections: 0; attention: unknown.
