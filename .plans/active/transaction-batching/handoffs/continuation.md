# Continue transaction batching

Finish the remaining plan from this batching checkpoint. Read `status.json`, `plan.todo.md`, and `spec.md` first. The completed work is Phase 1 shared transport, recovery, reviewed budgets, and queue-reference compatibility. No product action calls the new batch API yet.

## State on 2026-10-30

PR #1208 merged to `develop` as `2376e5b84`. Slice 1D, #1396, merged as `a2fdc723a` and answered its six review findings: five are fixed, and operation IDs stay unscoped, with the reason in [the spec](../spec.md#recovery-rules-added-on-2026-10-30). Slice 1E, on branch `fix/batch-recovery-races`, fixes the four findings from review of #1396.

Proof for 1D, with RED first. The first run, at 05:58:45 UTC, had 8 failures: 4 assertions on real behavior and 4 on the missing release function. The second, at 06:03:48 UTC, had 8 more: 7 assertions on the same round of behavior and a budget test corrected once to fail for the right reason. At 06:05:07 UTC, 13 focused files passed 228 tests with 6 existing skips, and both Shared typechecks passed. For 1E, on 2026-10-31, 4 new tests failed on behavior at 07:35:27 UTC, and at 07:37:31 UTC the same 13 files passed 234 tests with 6 existing skips, with both Shared typechecks passing. Each PR records the gate and CI results for its final head.

Slice 1E, #1397, merged as `3fbe745c6`.

Garden settings (slice 2) is built on `feature/batch-garden-settings`, with the enablement list empty, so it changes nothing for anyone yet. Proof, with RED first for Shared: at 08:16:11 UTC its new tests failed on the missing modules. Admin's tests followed the wiring, so they were proven by breaking the behavior at 08:42:30 UTC: with the batch path, the sent values, the field locks, and the read-driven settlement removed, 17 failed, and with moving on no longer limited to the saves a person was shown, 1 more failed in Shared. With the behavior back at 08:42:46 UTC, admin passed 78 tests and Shared 363, with six existing skips. Rendered proof is Storybook only: the alert and the one-signature rows at desktop and 375px.

Review of #1398 found three gaps, fixed before the merge. A partly proven save now stays whole until it ends and reports what it proved once, the capability cache names the wallet connector, and Move On waits until every held value has been read. Their tests failed first at 08:58:29 UTC, 4 on behavior.

A second review round found two more. The engine now gives the caller the reason for a batch proven never sent, so one refused by the last check before signing goes one field at a time instead of failing, and any other reason reaches the person as a toast. A banner removal now survives a reload. Their tests failed first at 09:19:49 UTC, 4 on behavior. At 09:20:17 UTC Shared passed 369, with six existing skips, and admin 80.

#1398 merged as `92d1ab74f`, with its landed tree equal to the tested one. Three narrow findings from a third review round were confirmed and left for `fix/batch-settings-findings`, checkpoint 2.4. Their tests failed first at 10:17:23 UTC, 6 on behavior. At 10:18:14 UTC Shared passed 373, with six existing skips, and admin 82. Review of that PR added one more: a capability check that fails is not a refusal. Its tests failed first at 10:27:50 UTC, 3 on behavior, and at 10:28:22 UTC Shared passed 376. A later review added one more: what someone types during the first read now stays. Its editor test failed first at 10:35:27 UTC, and at 10:35:53 UTC admin passed 85. A last one: a banner edit ends only when that edit is the one that landed, and a wallet reporting no atomic capability reads as unable to batch. Their tests failed first at 10:50:06 UTC, 4 in all, and at 10:50:31 UTC admin passed 88 and Shared 377.

Next, once that merges: list each rail in a small follow-up and prove one live batch on each. That needs the user's passkey and approval to broadcast, and it is where the ceilings and the RPC's `simulateCalls` answer get checked. [The plan](../plan.todo.md#slices) defines every slice after that.

#1399 merged as `c324f882a`, with its landed tree equal to the tested one.

Add members (slice 3) is built on `feature/batch-add-members`, ahead of the live proof because the user chose it first, with the enablement list still empty, so it changes nothing for anyone yet. It shares the settings batch's recovery, now in `modules/transactions/batch-hold.ts` and `hooks/garden/useHeldBatches.ts`. Shared came RED first: at 19:25:36 UTC its new tests failed on the missing module, and at 20:02:28 UTC 7 files passed with 89 tests. Admin's tests came after the dialog, so they are not RED first: run against the previous dialog at 19:43:05 UTC, 7 of 20 failed, and at 20:02:12 UTC 7 files passed with 110 tests. Both greens are on the tree committed as `01799502c`. Rendered proof is labeled Storybook, in the built-in browser pane, driven with real clicks, at desktop and 375px: one signature for two people, a refused row with its reason, and held rows with what the chain shows. The 375px pass found two faults, fixed in `01799502c`: a held row's note cut off the chain value, and the signature line moved the Add button. The stories' play functions could not run in that pane, because the page has no window focus, so they ran through the story runner in headless Chromium, with a temporary uncommitted `server.fs.allow` config for this worktree's link mirror: at 20:08:08 UTC, 5 files and 30 stories passed. That run caught one play asserting while its dialog was still fading in, fixed before this result. These story files now carry the `storybook-ci` tag, so CI's `test:stories:ci` runs them too. No passkey, wallet or network was involved.

Review of #1400 found five real gaps, fixed in `a68a454a6`. Another account could send rows held for the last one; a failed role read still sent, though `_grantRole` on a held role skips only the mint; a list past its ceilings went straight to as many prompts as people; a batch's reason never reached the dialog's line; and analytics reported starts for rows never tried. Their tests failed first at 20:19 UTC, 10 on behavior. Green at 20:24:14 UTC (Shared 7 files, 92 passed) and 20:24:23 UTC (Admin 7 files, 114 passed), with 31 stories passing at 20:23 UTC.

A second review round found six more, fixed in `301cc1fc7`: another casing of the same wallet cleared a draft, Remove took every row for an address, a typed person did not retry one signature, the footer's count could overstate, two tabs both counted a proven add, and the selector missed batch modules. `batches` is now a mutation primitive, which marks `members-batch`, `settings-batch` and `batch-hold` critical and will catch every later slice. Their tests failed first at 20:42 UTC, 7 on behavior. Green at 20:45:38 UTC (Shared 7 files, 93 passed) and 20:45:57 UTC (Admin 7 files, 115 passed), with 31 stories passing at 20:44 UTC.

A third round found one more real gap, fixed in `a84afd07e`: a send that finished after an account change put its rows into the new draft. Its test failed first at 20:58 UTC, and Admin passed 7 files with 116 tests at 20:58:51 UTC. Its other finding, duplicate rows from concurrent holds, cannot happen: `BatchJournal.claim` refuses a second open operation on an item inside one transaction.

Still open for that slice, and all of it needs the user's approval to broadcast: recheck `grantRoles` live on Arbitrum, list the rails, and prove one live batch on each, which confirms the ceilings.

## Start here

1. Start with [publication.md](publication.md) for the isolated `develop` base, implementation commit, and current proof. Confirm the PR head, clean working tree, and validation status. The original 35 unpublished parent commits were excluded from this branch.
2. Read [the Phase 1 foundation](phase-1.md) and [limits follow-up](phase-1-compatibility.md) as historical evidence for that source snapshot. Current source/receipt evidence must be refreshed after any base migration. Do not infer that old full-suite results establish current readiness.
3. Work through [the slices](../plan.todo.md#slices) in order. Garden settings also proves the first live batches (decision 14), which closes checkpoint 1.6. Follow the plan skill start gate and repository validation selector. Later-phase checkboxes remain open.

## Boundaries

- Keep the shared batch service authoritative for prepared intent, reviewed budget, durable references, execution ownership, and read-only recovery. Domain permissions and per-item receipt verification stay with the caller.
- Preserve existing native EAS batching in client Upload all. Existing wallet pool batching, hypercert batch listing, and card endowment paths are not missing features; inspect their behavior before any migration.
- Live Gnosis/account/profile migration and device-authenticator QA belong to another session. Standalone probes from this lane were stopped after the user clarified the overlap. Do not resume them from this handoff. A live batch through garden settings is this plan's own work and needs the user's approval to broadcast.
- This checkpoint authorizes no deployment, live transaction broadcast, account upgrade, merge, dependency change, or unrelated cleanup. Further publication follows the user's current instruction and the ship workflow.

## Evidence and remaining work

The original limits snapshot passed 180 focused tests with six existing skips, both Shared typechecks, lint, formatting, and independent ontology guards. Real software P-256-signed Kernel 0.3.1/0.3.3 operations passed eight isolated-fork outcomes. These do not certify live sponsorship or device signing. Full Shared validation had failures in unchanged files; a focused recheck passed but the full rerun reproduced a language-test failure and was interrupted. Two inherited auth source-policy violations were also present on that original base. Keep failed, interrupted, unrun, and passing evidence distinct.

Use the PR body and publication handoff for the final branch, base, commit, and current proof. The hub remains active and all implementation lanes remain uncertified until their required fresh receipts exist.
