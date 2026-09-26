# Steward Cockpit UX Fixes Plan

**Feature Slug**: `steward-cockpit-ux`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-09-25T05:02:27.261Z`
**Last Updated**: `2026-09-25`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Five grouped PRs, in order: PR1 Actions crash, PR2 Hub, PR3 Garden and Community, PR4 Shell, cookies, tone and every visual-rule change, PR5 Copy, Storybook and polish. | Reviewable surfaces; PR2 and PR3 share `useGardenDerivedState`, so they run one after the other. |
| 2 | The implementing agent merges PR1, PR2, PR3, and PR5 with `gh pr merge <n> --repo greenpill-dev-guild/green-goods --merge` once CI Gate is green and bot reviews are resolved. PR4 waits for Afo's yes, and PR5 starts and merges only after PR4 has merged. | Afo delegated routine merges; visual-rule changes need a rendered look first. |
| 3 | One Linear parent plus one child issue per PR, mirrored as execution sub-lanes (`lane_issues`). | Visibility per PR for the implementing agent. |
| 4 | D7 dropped (fixed by #894); D26 dropped (loading join requests signs a proof); D36 kept as an amendment to DL-008 for phones. | Re-verification on 2026-09-25. |
| 5 | D32 migrates every raw type size (339 uses in 78 admin files) and every view-level raw `--m3-*` colour, plus a ratchet in `scripts/design/check-tokens.sh`. | Afo chose the full migration over touched-files-only. |
| 6 | DEC-B stall rule: Critical only when work waited 7+ days and no review landed in the last 7 days; unknown review times never count as stalled. | Age alone painted every real card red. |
| 7 | D14: per-asset amounts everywhere; never sum base units across assets. | WETH and DAI were being added together. |
| 8 | DEC-C purple Actions tone; DEC-D campaign jars on the protocol garden's Payouts; DEC-E, DEC-G, and D4 copy accepted verbatim (see handoffs). | Accepted in the 2026-09-25 rounds. |
| 9 | D16: all five phone nav labels fit at 360px in en/es/pt; D17: a multi-action FAB shows its primary action's icon and a close icon while open. | Accepted in the 2026-09-25 rounds. |
| 10 | D13 is fixed in the shared `ConfidenceSelector`, so the client review sheet changes too. | One rule in one place. |
| 11 | QA catalog cases change in the PR that changes their behaviour; new IDs start at ADM-177. | Keeps testers' steps true after each merge. |
| 12 | Each PR adds in-between-state stories (empty, loading, failed, part-way) for the write surfaces it changes; PR5 fills the rest. | D25, write surfaces first. |
| 13 | PR4 proof: develop-vs-branch screenshots at 1280 and 375, light and dark, shared with Afo before merge. | Render a rule before rolling it out. |
| 14 | This hub and DL-043–DL-051 are the docs-only first commit on PR1's branch. | Hub before the first code change. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror (listed in `spec.md` and each handoff)
- [x] List human judgment points before implementation
- [x] Define what is out of scope (`brief.md`)
- [x] Choose the lightest honest validation commands (`eval.md`)

## PR Sequence

| PR | Sub-lane | Branch | Findings | Handoff | Merge |
|---|---|---|---|---|---|
| PR1 | `pr1_actions_crash` | `fix/actions-capitals-crash` | D1 | [handoff](handoffs/pr1-actions-crash.md) | agent, on green |
| PR2 | `pr2_hub_review_queue` | `fix/hub-review-and-queue-health` | D2, D3, D5, D8, D12, D13, D14 (review time), D23, D28, D29, D30, D31, D35 | [handoff](handoffs/pr2-hub-review-queue.md) | agent, on green |
| PR3 | `pr3_garden_community` | `fix/garden-community-clarity` | D4, D6, D8, D9, D10, D11, D14 (amounts), D15, D19, D27, D30, D31, D33, D34 | [handoff](handoffs/pr3-garden-community.md) | agent, on green |
| PR4 | `pr4_shell_cookies_tone` | `feature/shell-cookies-and-actions-tone` | DEC-A, D8, D16, D17, D18, D19, D20, D21, D22, D31, D34, D36 | [handoff](handoffs/pr4-shell-cookies-tone.md) | after Afo's yes |
| PR5 | `pr5_copy_storybook_polish` | `refactor/admin-type-scale-and-stories` | D24, D25, D30, D32, D33 | [handoff](handoffs/pr5-copy-storybook-polish.md) | agent, on green |

Each PR starts from a fresh `origin/develop` after the previous one merges, in the implementing
session's own worktree (never the shared primary checkout, so no other session's branch moves).
PR1's branch already carries this hub as its first commit.

## Lane Checklists

### PR1 — Actions crash

- [x] RED table test for capital parsing, then the fix
- [x] Rendered `/actions` proof
- [x] PR opened, CI green, bot reviews resolved, merged
- [x] Sub-lane and Linear child updated

### PR2 — Hub

- [x] Work titles, repeats, and dates (D2, D28, D29)
- [x] Reject reason dialog (D3, DEC-G), codify DL-048
- [x] Confidence selector and early warnings (D12, D13)
- [x] Queue health and review time (D5, DEC-B), codify DL-044
- [x] Assessment language (D23, DEC-E, D8), codify DL-047
- [x] Certify polish (D31, D35)
- [x] Stories, en/es/pt, QA catalog, rendered proof, critical gate
- [x] PR opened, CI green, bot reviews resolved, merged; sub-lane and Linear child updated

### PR3 — Garden and Community

- [x] Garden Profile save progress (D4, D8, D11)
- [x] People counts and member actions (D6, DEC-H, D9, D15), codify DL-049
- [x] Per-asset endowment amounts (D14, D9, D27, D31, D33)
- [x] Payouts, Impact, Karma copy (D10, D19, D30, D31, D33, D34)
- [x] Stories, en/es/pt, QA catalog, rendered proof, critical gate
- [x] PR opened, CI green, bot reviews resolved, merged; sub-lane and Linear child updated

### PR4 — Shell, cookies, tone

- [x] Outlined Hub trio (DEC-A), codify DL-043
- [x] Phone app bar and nav (D16); FAB icon (D17), codify DL-050; tab rail cue (D18)
- [x] Phone alert order (D36), codify DL-051
- [x] Purple Actions tone (D21, DEC-C), codify DL-045, bump `token_version`
- [x] Campaign cookie jars home and flow dialog (D19, D20, D22, D31, D34, DEC-D), codify DL-046
- [x] Profile name (D8)
- [x] Stories, en/es/pt, QA catalog, before/after pairs sent to Afo
- [x] Afo's yes, CI green, bot reviews resolved, merged; sub-lane and Linear child updated (#908, 2026-09-25)

### PR5 — Copy, Storybook, polish

- [x] Shared admin layout stylesheet for Storybook (D24, DEC-F)
- [x] Type scale migration with a rendered census (D32)
- [x] View colours onto Warm Earth aliases (D32)
- [x] Ratchet in the design-token check; frontend-design Rules 9 and 13 clarified (D32)
- [x] Remaining copy and nesting (D30, D33); remaining write-surface stories (D25)
- [x] PR opened, CI green, merged; sub-lane and Linear child updated (#910, 2026-09-26; the hosted bots could not review it, so a local review stood in, with Afo's agreement)

### QA Pass 1 and 2

- [x] After PR5: walk the acceptance checks in `eval.md` at 1280 and 375, light and dark (QA pass 1, 2026-09-26)
- [ ] Record findings in `handoffs/claude-qa-pass-1.md` and `handoffs/codex-qa-pass-2.md`

## TDD / Proof Order

- [ ] Put each decision in a pure function where one exists in the handoff, and prove it with a
      table test first (RED), then the change (GREEN)
- [ ] Record RED and GREEN in the PR handoff; record machine proof with
      `node scripts/harness/plan-hub.mjs record-tdd --feature steward-cockpit-ux --lane <ui|state-api> ...`
- [ ] Prove each behaviour once, at the lowest layer that owns it; delete what a change orphans

## Merge Protocol

1. Open the PR against `develop`; the body lists findings closed, QA IDs changed, labelled rendered
   proof (engine and session), and the test/source ratio when above 1:1.
2. Wait for CI Gate and the Codex and CodeRabbit review rounds (each can take 10–40 minutes after a
   push). Fix, push, and resolve threads; check which SHA a standing review targets before
   treating it as outstanding.
3. Merge with `--merge` (PR4 only after Afo's yes). Update the sub-lane status, the handoff's
   Validation Receipt, and the Linear child.
   Linear: parent PRD-981; children PRD-982 (PR1) to PRD-986 (PR5), each blocked by the one
   before. Their titles, bodies, and labels were written by hand; when syncing, change state only.
   The `linear-sync` manifest proposes slug-style titles and the retired `ai:claude` label, so do
   not apply its titles or labels.
4. Start the next PR from a fresh `origin/develop`.

## Validation

See `eval.md` for the per-PR ladder.

## Closeout

After PR5 merges and the QA passes run: commit the closeout record (`Status` → `CLOSED — …`, open
items with destinations), move the Linear children and parent to Done with a short comment, run
`confirm-linear-sync`, then archive with `plan-hub.mjs move --to archive` in its own commit.
