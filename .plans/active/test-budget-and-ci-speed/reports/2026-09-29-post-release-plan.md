# Post-release plan (2026-09-29)

After D13 reached `develop`, Afo asked for a review of the Velocity Scorecard (version 22: snapshot 08
and the September 29 follow-ups) and a plan for what it still lists as open, then chose to record the
plan in this hub and start it after the 2.0.0 release (D14). This report holds the evidence, read on
September 29 between 20:44 and 20:58 PDT (September 30, 03:44 to 03:58 UTC) with `develop` at
`22592595d` and `origin/develop` the same. The checklist lives in `plan.todo.md` § After the release.

## What the scorecard lists as open, checked against the repository

| The page says | State on September 29 |
|---|---|
| The laptop slows under sustained load; a restart and a worker-count test are Afo's call | Worse. Up 7 days 9 h (booted September 22, 11:06 PDT); swap 17.1 GB used of 18.4 GB, against 10.3 to 12.3 GB at snapshots 06 to 08; load averages 2.11, 4.03, 3.67 with no Vitest process on the machine; `memory_pressure` reports 52% free after 145,038 pageouts. Resident memory by application (RSS summed over processes, so an upper bound): Brave 5.7 GB, Claude 2.0 GB, OrbStack 1.3 GB, ChatGPT 1.1 GB, Bitdefender 1.0 GB. `pmset -g therm` has recorded no thermal level, so throttling is still inferred, not observed |
| The CI week: snapshot 09 reads September 28 to October 5 | Still pending. The snapshot 07 (`fca76d585`) and 08 (`1a3afcb52`) entries each carry seven null CI fields: gate p50 and p90, red rate, runs per day, workflows per push, compute minutes per push, setup seconds per job |
| The contracts pull-request path has not used the cached production tree | Still unobserved, for a new reason. Dependabot's PR #948 (js-yaml 5.2.2 to 5.4.1 in `packages/contracts/package.json`, September 29, 18:43 UTC) is the first contracts pull request since slice 9. Its Lint And Build and Unit Tests jobs (run 36614057658) failed at `bun install --frozen-lockfile` with `error: lockfile had changes, but lockfile is frozen`, before the production-tree cache step ran; Build Docs, Repository formatting and CI Gate failed on the same head and were not read. The cache exists under two keys on `develop`, saved September 28 20:56 and September 29 16:26 UTC |
| 33 of 34 worktrees run code from before the lease | Still 33 of 34, but only four hold unmerged work. See the worktree table below |
| CodeQL refilled the Actions cache within two hours (snapshot 08, serious) | Holding. The cache totals 1.15 GB: two CodeQL databases of 455 MB (0.89 GB), 37 Foundry entries (0.23 GB) and one Bun entry (0.03 GB). Both databases were saved at 00:58 and 01:04 UTC on September 30, after the prune that ran with the 00:54 and 00:59 pushes, which is the known race. The prune has run on every push to `develop` since `42b6d4860`; its hourly schedule fired at 02:42, 10:06, 16:36 UTC on September 29 and 00:43 UTC on September 30 |
| CI health | Every workflow on `58d442042` (11) and `22592595d` (4) passed. The Shared workflow since September 28: 24 successes, one cancelled by a superseding push, no failures. Coverage Nightly's schedule ran at 15:04 UTC on September 29 at `3fc9f132f` and passed |

## Closed items the page still shows as open

- **The order-flaky test in the QA batch.** `proof-draft-repository.test.ts` › "round-trips photo/audio
  without a Work record and clears only its proof scope" failed in 3 of 6 full Shared runs on September
  28, when it was another session's uncommitted file. The commit that landed it, `e4c650b1c`, also
  numbers each saved draft image: `replaceImages` in
  `packages/shared/src/modules/job-queue/draft-db.ts` writes `order` from the file's position, and
  `getImagesForDraft` sorts by `order ?? createdAt`. The flake was fixed before the test was committed,
  and no Shared run has failed since.
- **CodeQL refilling the cache.** See the table: the prune works, and the cache sits at 1.15 GB.

## Open items with no plan row

- **Setup debt the codemod did not touch.** `toHaveClass` assertions: 183 (55 files at snapshot 08).
  Test files with six or more `vi.mock` calls: 152 (Shared 77, Client 46, Admin 29, Agent 0). Both
  unchanged since snapshot 08. Neither slows the gate; they are what a reader wades through and what
  goes stale without failing.
- **Storybook and Admin Playwright.** At snapshot 08 they ran 183 to 192 s and 164 to 185 s, second and
  third behind Admin · Test on the gate path. Admin's imports and happy-dom have been addressed; these
  two have no row.

## Worktrees on September 29

Read at 20:52 PDT. *Merged*: the head is an ancestor of `develop`, or every commit's patch is already
in `develop` (`git cherry`). *Modified*: tracked changes in the worktree, untracked files not counted.
*Live*: a `claude`, `codex`, `node`, `bun`, `zsh` or `vitest` process has its working directory
there (`lsof -a -d cwd`). *Lease*: `git merge-base --is-ancestor d1bc5d86e <head>`.

Of the 34 worktrees besides the main checkout:

- **3 registrations point at directories that no longer exist**, all under `/private/tmp`:
  `gg-pr799-update-02c1` (`feature/gardener-celo-wallets`), `gg-community-g-dollar-02c1`
  (`fix/community-g-dollar-transfers`), `gg-pr802-update-02c1` (`refactor/shared-capability-boundaries`).
  `git worktree prune` clears them.
- **27 are merged with no tracked changes.** One is live: `sharp-sutherland-95b968`
  (`claude/green-goods-dev-audit-6633cd`), so it stays. The other 26 are removal candidates:

  | Worktree | Branch |
  |---|---|
  | `.claude/worktrees/browser-evidence-gates` | `chore/browser-evidence-advisory-gates` |
  | `.claude/worktrees/ci-prune-codeql-caches` | `ci/prune-codeql-caches` (the one lease-aware worktree; PR #945 merged) |
  | `.claude/worktrees/commitment-pooling-qa-prep-ed4b16` | `fix/prevent-duplicate-role-assignment` |
  | `.claude/worktrees/contracts-release-check-fresh-build` | `fix/contracts-release-check-fresh-build` |
  | `.claude/worktrees/fix-query-cache-deadline` | `fix/query-cache-store-deadline` |
  | `.claude/worktrees/haptic-feedback-audit-44236d` | detached at `956a85121` |
  | `.claude/worktrees/musing-rhodes-b71d24` | detached at `36555ab9f` |
  | `.claude/worktrees/opaque-client-chunk-names` | `fix/opaque-client-chunk-names` |
  | `.claude/worktrees/pooling-rehearsal-review` | `chore/pooling-rehearsal-review` |
  | `.claude/worktrees/push-gate-source-structure-base` | `refactor/work-view-and-flow-controller-under-cap` |
  | `.claude/worktrees/qa-pr-894` | detached at `1f3bb0c03` |
  | `.claude/worktrees/steward-cockpit-ux` | `fix/actions-capitals-crash` |
  | `.claude/worktrees/submit-work-media-details-5c1e` | `fix/submit-work-media-details-label` |
  | `.claude/worktrees/w3-closeout` | `chore/record-pooling-w3-merges` |
  | `.claude/worktrees/w3b-commitment-chrome` | `fix/commitment-screen-chrome` |
  | `.claude/worktrees/w3c-seed-wizard` | `fix/seed-wizard-questions` |
  | `.claude/worktrees/w3d-unlisted-gardens` | `fix/unlisted-gardens-reachable` |
  | `.claude/worktrees/w3e-account-sessions` | `fix/account-switch-state-reset` |
  | `.claude/worktrees/w3f-inspector-names` | `fix/inspector-story-and-names` |
  | `.claude/worktrees/w3g-followup` | `fix/commitment-send-nonce-cursor` |
  | `.claude/worktrees/w3h-host-garden` | `fix/host-garden-personal-claims` |
  | `.claude/worktrees/work-decision-send-rules` | `fix/work-decision-sends-keep-chain-time` |
  | `.claude/worktrees/zealous-banach-a1c7a6` | detached at `4c16fe573`; 9 commits ahead by ancestry, every patch in `develop` |
  | `~/.codex/worktrees/8dfc/green-goods` | `fix/profile-ens-recovery` |
  | `~/.codex/worktrees/ca78/green-goods` | `fix/online-submit-sends-at-once` |
  | `~/.codex/worktrees/ce80/green-goods` | `fix/garden-hero-identity` |

- **4 hold unmerged work** and need `git merge develop` from their owning sessions:

  | Branch | Ahead | Modified | Live | PR | Worktree |
  |---|---|---|---|---|---|
  | `feature/agent-reporting-core` | 70 | 0 | yes | #934, draft into `chore/whatsapp-prototype-scope-lock` | `.claude/worktrees/beautiful-mcclintock-768d91` |
  | `chore/whatsapp-prototype-scope-lock` | 23 | 17 | no | #864 | `~/.codex/worktrees/dddc/green-goods` |
  | `feature/builder-docs-rebuild` | 37 | 3 | no | #795 | `.claude/worktrees/builder-docs-rebuild` |
  | `chore/community-docs-revamp-plan` | 1 | 0 | no | #896 | `.claude/worktrees/community-docs-revamp-plan` |

"Idle" and "live" were read once; check `lsof` again right before removing anything.

## The plan

Nothing here starts before 2.0.0 ships on October 4. Snapshot 09 goes first because its reading
decides row 7.

| Order | Work | Why | Who | Effort | Proof it worked |
|---|---|---|---|---|---|
| 1 | **Snapshot 09 on October 5.** Fill the fourteen pending CI fields on snapshots 07 and 08 from the September 28 to October 5 window; job medians for Admin · Test, Client · Test, both Shared shards, Storybook and Admin Playwright, dividing single-run comparisons by the test-body bucket; recheck the Actions cache total, the prune's cadence and the lease bound | Shows whether the import cuts and happy-dom reached the runner, and ranks the gate's jobs for row 7 | a session | about 1 h | Snapshot 09 published with no `pending` field left on 07 or 08 |
| 2 | **Restart the laptop, then the worker test.** On an idle machine, four full Shared runs at the default worker count and four at `VITEST_MAX_WORKERS=5`, recording Vitest `Duration` and the `tests` bucket; size the lease's worker cap from the result | Swap is at 17.1 of 18.4 GB and back-to-back runs still slow down; this is the only way to learn whether fewer workers finish sooner over a session | Afo restarts; a session measures | 30 min | The fourth run within 20% of the first at one of the two counts |
| 3 | **Worktree cleanup.** `git worktree prune`; remove the 26 merged, idle worktrees above after a fresh `lsof` check; the four branches with unmerged work merge `develop` from their owning sessions, `feature/agent-reporting-core` first | Their gates and suites take the lease, so sessions stop colliding on this laptop | Afo authorizes; a session and the branch owners | 10 min, then per branch | `git merge-base --is-ancestor d1bc5d86e <head>` holds for every worktree left |
| 4 | **Scorecard version 23.** Mark the order-flaky test closed and CodeQL holding, give the contracts row its new reason, replace the worktree line with the split above, and add rows for the setup debt and for Storybook and Admin Playwright | The page should not show closed work as open or leave open work without a row | a session | 20 min | The page matches this report |
| 5 | **Dependabot #948.** Regenerate `bun.lock` on its branch (`bun install --lockfile-only`, then `bun install`) or close it and bump js-yaml by hand within the release-age gate | It is the only open contracts pull request and fails at install. It cannot prove the production-tree cache: `bun.lock` is one of the key's inputs, so the regenerated lockfile makes a new key and a rebuild by design | needs approval, as a dependency change | 20 min | PR green and merged, or closed with the bump landed |
| 6 | **The contracts pull-request path.** Read the Unit Tests log of the next contracts pull request that changes none of the key's inputs (`foundry.toml`, `foundry.lock`, `remappings.txt`, `src/**`, `test/**`, `script/**/*.sol`, `lib/**`, `config/commitment-pooling-release.json`, `bun.lock`) | Confirms slice 9's saving of about 85 s a run, which no run has shown yet | waits for such a PR | one log | `Cache restored` for `foundry-release-production-*` |
| 7 | **After snapshot 09, conditional.** If Storybook or Admin Playwright lead the gate, measure them next; if the Shared shards lead, stop optimising the gate | The gate's pace after Admin · Test was these two; snapshot 09 says whether they still are | decide after 09 | half a day to measure | Job p50 of the leader |
| 8 | **Setup debt.** Leave the 183 `toHaveClass` assertions and 152 heavy-mock files for the December re-measure unless a batch rides along with feature work; no new rule | It does not slow the gate, and a rule would add lines without a failure to catch; Check 6 already guards new wrappers and query clients | Afo | none, or 2 to 3 h a batch | Counts in December |
| 9 | **`linear-sync` for PRD-835** (architecture hub) | Carried from the handoff | needs Linear write authorization | one pass | Hub and Linear agree |
| 10 | **December.** Redraw the 36-file sample and rerun the nineteen faults | Keeps the scorecard honest about quality as well as speed | a session | about 2 h | A new snapshot |

## Left

- The restart, the worktree removal and the setup-debt row are Afo's; the Dependabot fix needs
  dependency approval and the Linear sync needs authorization. Nothing in this plan is authorized by
  the review itself.
- The scorecard was not republished for this review; row 4 does that after the release.

## How this was read

```bash
uptime; sysctl vm.swapusage; memory_pressure; pmset -g therm
ps -A -o rss=,command=                       # summed by application
git worktree list --porcelain                # then merge-base, cherry, status, lsof per worktree
gh cache list --repo greenpill-dev-guild/green-goods --limit 300 --json key,sizeInBytes,createdAt,ref
gh run list --repo greenpill-dev-guild/green-goods --branch develop --limit 25 --json headSha,name,conclusion,createdAt
gh run view 36614057658 --repo greenpill-dev-guild/green-goods --json jobs
git show e4c650b1c -- packages/shared/src/modules/job-queue/draft-db.ts
git grep -c toHaveClass -- 'packages/*/src/**/*.test.ts' 'packages/*/src/**/*.test.tsx'
git grep -c 'vi\.mock(' -- 'packages/<pkg>/src/**/*.test.ts' 'packages/<pkg>/src/**/*.test.tsx'   # files with 6 or more
```
