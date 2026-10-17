# Handoffs: passkey-account-continuity

## State (2026-10-17)

- **Planned and de-risked; nothing implemented.** Lanes are `todo`; `contracts` is `n/a`.
- **Waiting on Afo:** decisions 1 to 7 and 9 in [plan.todo.md](../plan.todo.md#decision-log).
- **Open review items:** later review findings go to
  [plan.todo.md](../plan.todo.md#open-review-items) for the implementation steps, by Afo's
  direction on 2026-10-17. O1 is the first.
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
- **CodeRabbit, after the thirteenth review.** One finding, addressed: completion writes the
  challenge's domain and origin to the adopted row's existing `rpId` and `origin` columns.
- **Thirteenth review.** Codex raised one finding at 03:03 UTC on 2026-10-17, and it is
  addressed: `switchingAccounts` compares the exact ID string as well as the key, so the device
  that cached a legacy spelling signs in by both names, each to its own address (step 1).
- **Twelfth review.** Codex raised two findings at 02:52 UTC on 2026-10-17, both addressed:
  - After adoption, the saved-session hook saves the adopted name with `setStoredUsername`,
    so a reload doesn't bring the row back.
  - The account-screen button reports its own outcome: busy while it runs, idle again after a
    cancelled prompt, and `failed` copy with a retry for offline, timeout and an unavailable
    lookup.
- **Eleventh review.** Codex raised one finding at 02:36 UTC on 2026-10-17, and it is addressed:
  - Uniqueness now follows the account, the exact ID string with the key, not the passkey. The
    other spelling of one passkey is another account to Kernel, and the app keeps a cached legacy
    spelling, so that spelling may adopt under another name in either order. The account row
    compares exact ID strings.
  - This reverses an earlier rule, held in the prototype, that refused the other spelling under a
    second name. That case is now a planned test, not rig evidence.
- **Tenth review.** Codex raised four findings at 02:26 UTC on 2026-10-17, all addressed:
  - The account row compares the directory entry with the session's passkey, so a name held by
    another passkey keeps the row and its rename.
  - A workflow test drives the saved-session hook through start, ceremony and completion.
  - Step 9 includes the two workflows that know the entry's domain and the hosted lookup, and
    they carry that context to the copy.
  - On www and beta, a hosted name's refusal starts with "Try again here.", since it may only be
    a dismissed prompt on the account's own site.
- **CodeRabbit, after the ninth review.** One finding, addressed: R6 now gives the neutral
  related-origins copy only to a cross-site `SecurityError`, as step 9 does, and a refused
  assertion keeps its own copy.
- **Ninth review.** Codex raised four findings at 02:14 UTC on 2026-10-17, all addressed:
  - Every insert writes `credentialKey`, registration included, and both stores' own duplicate
    check moves to the ID-and-key pair.
  - The shared check takes bytes. A completion's assertion travels as base64url JSON, decoded at
    the route, with a test through the real JSON-RPC route.
  - The device walk adds the brief's success signal: a September www account on admin.
  - A related-origins failure in a browser that reported support gets neutral copy, never "update
    your browser".
- **Eighth review.** Codex raised three findings at 01:01 UTC on 2026-10-17, all addressed:
  - The account row's draft copy no longer promises every site and device. It names other Green
    Goods sites, in browsers that allow it, on devices that have the passkey.
  - `gg_startPasskeyAdoption` takes the name and domain. Its challenge is stored with them and the
    origin, and completion must match all three.
  - Step 5 extends the agent's Production Checklist, and AC-13 requires a restore rehearsal before
    step 5 deploys.
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
| review | 2026-10-16T22:52Z → unknown | Thirteen review rounds (Codex 40 findings, CodeRabbit 4). First review 22:52:19Z; fixes in `61e4591c0`, `291b53161`, `74a2c80d5`, `0cc1fe244`, `45d50a51a`, `21357984c`, `3fb07707e`, `8a7779a77`, `cd46bf895`, `82f714599`, `f8f17bc6b`, `0873fc4c5` and `ad9e022f3`, and round thirteen edited at 2026-10-17T03:06:47Z; round twelve was edited at 2026-10-17T02:53:30Z; round eleven was edited at 2026-10-17T02:42:25Z |
| sync | 2026-10-17T01:56:37Z → unknown | Expired test skips fixed on develop by #1112 (`1c9eca913`); develop merged into this branch as `c3a8fec26` |

Times are observed boundaries: file and log write times, the scaffold time, commit times and the
PR's creation time. Anything not observed is `unknown`.

Human corrections: 0; attention: unknown.
