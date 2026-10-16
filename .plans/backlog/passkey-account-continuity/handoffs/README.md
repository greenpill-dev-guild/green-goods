# Handoffs: passkey-account-continuity

## State (2026-10-16)

- **Planned and de-risked; nothing implemented.** Lanes are `todo`; `contracts` is `n/a`.
- **Waiting on Afo:** decisions 1 to 7 in [plan.todo.md](../plan.todo.md#decision-log). Decision 8
  is answered: COM-39 was rewritten on 2026-10-16. Step 6
  depends on decision 2, and step 8 on decision 4.
- **First review.** Codex's review of the first commit raised eight findings, all addressed on
  2026-10-16:
  - Adoption calls get their own no-retry, 3-second client and run beside the hosted lookup.
  - Completion is idempotent, and uniqueness is on credential bytes.
  - A v2.0.1 upgrade test and mismatched-ID refusals are planned.
  - The wrong-site copy names the sites a hosted account may come from.
  - The rig now signs on admin, and the report and raw results come from one run.
- **Second review.** Codex and CodeRabbit reviewed the fix commit and raised eight findings, all
  addressed the same day:
  - Stored IDs match under either reading, and the key comes from the assertion's bytes.
  - The completion gets a 10-second deadline.
  - Positive tests are planned for the hosted race and the taken-name row.
  - The resume steps below keep the decision gate.
  - Current-evidence links point at the second-review report.
  - The rig refuses unknown modes.
- **Proven in clean-room Chromium** ([report](../reports/2026-10-16-clean-room-proof-second-review.md)):
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
2. Only once decisions 1 to 7 are answered, start at step 1. Steps 1 to 5 can land before any
   user-visible change, but none of them starts before the decisions.
3. Rerun the rig ([artifacts/rig/README.md](../artifacts/rig/README.md)) after steps 1, 5 and 8.

## Task record

Task record: passkey-account-continuity (plan and clean-room proof) | Type: investigation | Outcome: complete
Agent/model: Claude Code, claude-opus-5-5 | Coverage: planning segment on 2026-10-16

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| investigate | unknown → 2026-10-16T19:34Z | Rig built; scenarios A to E passed, and A found the hex-ID failure (first full results file written 19:34:12Z) |
| implement | 2026-10-16T19:35Z → unknown | Hub scaffolded 19:35:57Z; brief, spec, plan, eval, report, rig and COM-39 draft written |
| verify | 2026-10-16T19:41Z → unknown | Portable rig rerun from the hub (log written 19:41:57Z); `plan-hub validate`, guidance links, immutable reports, Biome |
| wait | unknown → unknown | Afo's choice of delivery and Linear records; resolved (PR, COM-39 rewrite) |
| publish | 2026-10-16T22:43Z → 2026-10-16T22:47Z | Worktree from develop, commits `0c09b4128` and `556932c65`, push gate passed, PR #1111 opened 22:44:48Z |

Times are observed boundaries: file and log write times, the scaffold time, commit times and the
PR's creation time. Anything not observed is `unknown`.

Human corrections: 0; attention: unknown.
