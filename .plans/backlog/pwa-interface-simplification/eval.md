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
