# Handoffs: passkey-account-continuity

## State (2026-10-17)

- **Planned and de-risked; nothing implemented.** Lanes are `todo`; `contracts` is `n/a`.
- **Waiting on Afo:** decisions 1 to 7 and 9 in [plan.todo.md](../plan.todo.md#decision-log).
  Decision 8 is answered: COM-39 was rewritten on 2026-10-16. Step 6 depends on decisions 2 and
  9, and step 8 on decision 4.
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
- **Seventh review.** Codex raised five findings at 00:34 UTC on 2026-10-17, all addressed:
  - Every stored key has one spelling (`0x04`, lowercase), so a key written another way can't put
    one passkey under two names. The hosted fallback compares keys by point.
  - When the directory lookup fails, hosted sign-in runs exactly as today, verdict included. The
    merged path needs a directory answer first.
  - The browser ID is no longer an input. The lookup's `signingId` is `credentialKey`, taken from
    the assertion's `rawId`.
  - Step 9 rewrites the builder passkey page, which still says older accounts sign in as before.
  - Step 3 raises the database's `user_version` from 8 to 9, with tests.
- **Sixth review.** Codex raised one finding at 00:03 UTC on 2026-10-17, and it is addressed:
  - Step 6 no longer calls the local check the hosted verdict's equal. It doesn't read the
    signature counter, and the hosted lookup returns no counter to compare.
  - New decision 9 asks whether the directory tracks the counter. The plan recommends not,
    because the validator ignores it and synced passkeys report 0. Step 6 holds the tracking
    design and its tests, and AC-12 covers both answers.
- **Fifth review.** Codex raised four more findings the same day, all addressed:
  - Credential uniqueness binds the ID bytes to the proven key, since `rawId` sits outside the
    signature. A table rebuild drops the string-only constraint.
  - The capability check runs only when a ceremony needs related origins.
  - AC-4 now requires adoption on beta before cross-site sign-in, and the rig does exactly that.
  - Step 6 says plainly that the hosted start and verify calls are replaced by a local check.
  - The rig adds a spoofed-`rawId` scenario (G).
- **Fourth review.** Codex raised one more finding the same day, and it is addressed:
  - A hosted name is adopted only under the hosted server's exact ID string, not just the same
    bytes.
  - The rig has no hosted lookup, so this rule is a planned test, not rig evidence.
- **Third review.** Codex raised one finding the same day, and it is addressed:
  - An idempotent completion must match the stored ID string exactly.
  - The rig now refuses the held name when its ID arrives in the other spelling.
- **Proven in clean-room Chromium** ([report](../reports/2026-10-16-clean-room-proof-fifth-review.md)):
  - A beta-bound passkey, once adopted on beta, signs in by name and signs on www and admin, with
    beta serving `/.well-known/webauthn`.
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
2. Only once decisions 1 to 7 and 9 are answered, start at step 1. If decision 9 chooses
   tracking, first fold step 6's counter design into steps 2, 3 and 5. Steps 1 to 5 can land
   before any user-visible change, but none of them starts before the decisions.
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
| review | 2026-10-16T22:52Z → unknown | Seven review rounds (Codex 25 findings, CodeRabbit 3). First review 22:52:19Z; fixes in `61e4591c0`, `291b53161`, `74a2c80d5`, `0cc1fe244`, `45d50a51a` and `21357984c`, and round seven edited at 2026-10-17T00:54:56Z |

Times are observed boundaries: file and log write times, the scaffold time, commit times and the
PR's creation time. Anything not observed is `unknown`.

Human corrections: 0; attention: unknown.
