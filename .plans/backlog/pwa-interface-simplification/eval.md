# PWA Interface Simplification — Evaluation

**Status:** acceptance criteria proposed; implementation and usability results pending.

## Product validation

Compare the current released PWA with the selected design using the same scenarios and content.
Start with a small formative round covering a gardener, steward, evaluator, and community member;
include a multi-garden account and a qualifying non-steward depositor. This is qualitative design
validation, not a statistically established improvement claim.

Observe whether participants can:

- Identify their active garden and find another joined garden or discovery.
- Understand a recent activity's status without mistaking submission for confirmation or reward.
- Resume their own unfinished work, including a draft in a different garden.
- Find an opportunity and enter work submission without selecting the same garden again.
- Find their permitted review or management responsibility without exploring unrelated controls.
- Explain whether a sheet is personal or garden-scoped, and return to their previous context.

Measure task completion, wrong destinations, assistance, repeated selections, and recovery errors.
Record taps and time only when observed; compare like-for-like tasks. Proposed targets are no lost
work/context, no unauthorized action exposure, no repeated garden choice when already valid, and
better task clarity without materially worsening steward access. Establish a baseline before
choosing numerical reduction targets. Visual preference alone is insufficient.

## Acceptance matrix

| ID | Case | Required proof |
|---|---|---|
| A1 | No, one, and several joined gardens | Correct Home default; clear switcher; directory remains available; pending join does not grant membership. |
| A2 | Membership/account/chain changes and direct links | Correctly scoped data and context; loading or failed reads do not masquerade as no membership; no leaked prior-account state. |
| A3 | Home density and hierarchy | Recent activity, unfinished work, participation in that order; bounded previews; optional management follows the accepted design. |
| A4 | Familiar sheets and navigation | Home / Garden / Profile retained; header sheets open in one tap; scope labels are truthful; dismiss/back restores location and focus. |
| A5 | Gardener, steward, evaluator, owner, community member, depositor | Existing capability predicates preserved; permitted work reviews, joins, governance, and Endowment remain reachable. No new privileges from presentation. |
| A6 | Fresh work | Valid preselected garden carried into action selection, evidence, action-defined fields, review, and existing submission behavior. |
| A7 | Promise-linked work | Exact action/requirement carried only when valid; ambiguous selection stays visible; stale/failed reads have explicit recovery. |
| A8 | Drafts and existing unlinked work | Original garden, saved step, fields, attachments, and links preserved; no forced promise link or reassignment when Home changes. |
| A9 | Offline, upload failure, retry, and pending delivery | Existing queue remains authoritative; visible recoverable states; no duplicate submissions; existing unsent badge semantics retained. |
| A10 | Work, confirmation, recognition, and usable value | Copy represents actual lifecycle state; no implication that approved work automatically issues a voucher, pays G$, or grants access. |
| A11 | Accessible and localized mobile layout | Existing tap targets, focus handling, sheet dismissal, safe areas, reduced motion, and contrast retained; long EN/ES/PT copy and phone-width layouts remain usable. |
| A12 | Existing garden links and deeper areas | Work/Promises details, Gardeners, Insights, share, notifications, and applicable financial/governance controls retain an accepted route. |

## Verification posture for future implementation

Select proof with `bun run check --plan -- --intent qa` against the eventual changed surfaces.
Use focused existing tests at the owner of context, selection, and recovery behavior, then the
required surface checks. Do not add tests that only mirror component markup or manufacture a test
for this prose-only change. Broaden testing when changed boundaries or failures justify it.

Rendered results must name their evidence class: authenticated Brave, mock-auth localhost,
Storybook, or CI Playwright. A local static design preview is a prototype, not any of those
application proof classes. Include browser/screenshot proof for UI-visible implementation changes.
Use the repository's authenticated-session requirements for auth, queue, offline, and installed-PWA
behavior; note inaccessible flows as unverified. Use safe fixtures/test environments for mutations;
this planning request authorizes no signing, publishing test records, or transactions.

Keep private screenshots and session details out of Git. Lane completion requires the normal fresh
validation receipt with exact commands, timestamps, scope, and reproducible implementation identity.
Planning checks cannot certify a feature or release.

## Hub creation check

Checked on 2026-10-06 at 05:46 UTC against these uncommitted planning files:

- `node scripts/harness/plan-hub.mjs validate` reported no errors for this hub. The repository-wide
  command exited 1 because the unrelated `active/agent-messaging-channels` directory has no
  `status.json`. That directory was left untouched; the global check is not passing.
- A focused read-only check resolved all 31 local Markdown links and anchors, parsed `status.json`,
  checked Markdown whitespace, and verified backlog stage, null branches, blocked execution lanes,
  and no Linear parent. It reported no errors.

These are working-tree document checks, not commit-attributed implementation receipts. No
application code was changed; implementation, usability, and release evidence remain pending.

## Commit preparation — 2026-10-07

The user authorized a local commit directly on `develop`. Design and implementation gates remain
open. Fresh document checks on 2026-10-08 at 01:31 UTC:

- `node scripts/harness/plan-hub.mjs validate` passed for all 25 hubs. The earlier unrelated
  missing-status blocker has been resolved.
- All 31 local Markdown links/anchors resolved, and backlog/null-branch/blocked-lane state remained
  valid. This is document proof only.
- The path-scoped QA selector selected formatting. Its execution was blocked by sandbox denial of
  root environment-file metadata access; no environment file was read or permission changed.
- The direct equivalent formatting check passed:
  `bunx --no-install @biomejs/biome format --no-errors-on-unmatched .plans/backlog/pwa-interface-simplification/*.md .plans/backlog/pwa-interface-simplification/status.json`.
  Biome checked the JSON file; Markdown is outside its supported formatter coverage. A separate
  whitespace/link check covers the Markdown documents.

No push or application-readiness claim is part of this commit request.

## Scope lock check (2026-10-18)

Checked on 2026-10-18 at about 23:45 UTC in the `research/pwa-garden-home-scope-lock` worktree on
develop `1a960dba3`, before the commit that records the lock:

- `node scripts/harness/plan-hub.mjs validate`: 32 feature hubs validated, no errors.
- A read-only link check resolved all 41 local Markdown links and anchors in this hub, the
  artifacts README included.
- `biome format --write` on `status.json` applied no fixes (the main checkout's binary with this
  worktree's configuration).
- `node scripts/quality/check-immutable-plan-reports.mjs`: existing dated reports unchanged.
  `node scripts/quality/check-guidance-links.mjs`: 93 guidance files OK.
- `git diff --check`: clean. The added text contains no em dashes.

These are working-tree document checks. The lab in `artifacts/` is a mock drawn from the locked
tokens, not application proof, and the code findings come from the labeled mock-auth localhost walk
recorded in spec.md. No application code changed and no implementation lane is passed.

## Review round check (2026-10-19)

Checked on 2026-10-19 in the `research/pwa-garden-home-scope-lock` worktree, before the commit that
records the maintainer's review of the lab and the lock:

- The rebuilt lab was rendered in the desktop app's built-in browser pane (Chromium, no app
  session: a static mock served locally, not the application) at 1440 × 1000 and measured by script: the chip
  and the compact icon buttons both 32px tall on one centre line; every row 88px in Home, the
  Explore cards one height (182px at 390px), the Work, Insights, Gardeners and Notifications
  sheets' rows 88px; the switcher sheet at 52% of the phone; the offline strip moving the chip,
  the icons and the first section by 0px; the dark primary button `rgb(194, 245, 218)` with text
  `rgb(12, 10, 9)` and the light one `rgb(26, 117, 68)` with white text; the Submit Work step with
  no change-garden control and a promise row selecting its action card; the no-garden Home without
  the bell; the Portuguese header the same 80px as the English one. Two defects found and fixed
  before publishing: sheet rows shrank under a long list (no `flex-shrink: 0`), and an Approve
  button nested inside a row button was dropped by the HTML parser (rows that carry a button are
  now `div` rows with the button role).
- The production indexer's garden list was read on 19 October with `urllib`; eight of sixteen
  banners were fetched (two Pinata CIDs returned 403 and the `w3s.link` gateway did not resolve from
  this environment), re-encoded to 640 × 320 JPEG with `sips`, and committed under
  `artifacts/gardens/`.
- `node scripts/harness/plan-hub.mjs validate`, the read-only link check over this hub, Biome
  format on `status.json`, the immutable-report and guidance-link checks and `git diff --check`
  were run again after the edits: 32 hubs valid, every local link and anchor resolved, one format
  fix applied to `status.json`, reports unchanged, guidance links OK, no whitespace errors, no em dashes.

These are document and mock checks. No application code changed and no implementation lane is
passed.

## Decisions check (2026-10-19, later)

After the maintainer answered the five explorations and the badge question, the same document
checks were run on the recording edits: `node scripts/harness/plan-hub.mjs validate` (32 hubs), the
read-only link and anchor check over this hub, Biome format on `status.json`, the immutable-report
and guidance-link checks, `git diff --check`, and a scan of the added lines for em dashes. All
passed. The lab's script was parsed with `node --check` after its hints and preset changed; its
defaults already drew every decision, so no new render measurement was needed.

## Design round check (2026-10-20)

The hub checks were run again on the edits that record decisions 16 to 20: `node
scripts/harness/plan-hub.mjs validate`, the read-only link and anchor check over this hub, Biome
format on `status.json`, `git diff --check` and the em dash scan of added lines. The lab's start
step variants were measured in the desktop app's built-in browser pane (Chromium, static mock, no
app session): seven action rows at 88px with the promoted rows first, the keeps line and the
promise chooser for one and two matches, the open-ask take-up line, the two-group and question
shapes, the three headings in English and Portuguese, and a pick keeping the screen in view.

## Start step check (2026-10-20, later)

The decided flow was measured in the desktop app's built-in browser pane (Chromium, static mock,
no app session): the promises screen with three promise rows and Other work at 88px; the promise
screen for a promise taking evidence and two actions (Add evidence first, then two rows) and for
one needing one action; the evidence-only open ask opening Media with the promise pinned and
"Takes it up"; the actions screen with All plus three domain tabs and seven tiles at one 156px
height with a 36px two-line title block; no tabs for a one-domain garden; no Start button on any
screen except today's order; Media offering Details; Back returning along the path taken; the
Portuguese strings fitting. The hub checks were run again on the recording edits.

## Steward Home check (2026-10-21)

Measured in the desktop app's built-in browser pane (Chromium, static mock, no app session): a
gardener's Home has no Garden duties section; a steward's shows it above Recent activity with
three 88px rows (to review, join requests, to confirm), each opening its sheet, and Continue back
to the member's own items; an evaluator's shows the assessment row; the Portuguese strings fit.
The promise cards measured 204px each at 390px in English and Portuguese with the description
clipped at two lines and the needs row at one; the switcher's rows all end their role chip at the
same edge with no check mark. The hub checks were run again on the recording edits.
