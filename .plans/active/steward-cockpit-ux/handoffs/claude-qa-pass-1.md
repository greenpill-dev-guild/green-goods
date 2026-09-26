# Steward Cockpit UX Fixes - QA Pass 1 Handoff

## Lane

- Owner: Claude
- Branch: `chore/steward-cockpit-ux-qa-closeout`
- Status: completed 2026-09-26; no open defect on `develop`

## Scope

- After PR5 merges, walk AC-1 to AC-14 in `eval.md` at 1280 and 375, light and dark, on mock-auth localhost, including the three audit tasks (reject work with a reason, create an assessment, change one Garden Profile field).

## Findings

Walked on `develop` at `11bc2d467`, after all five PRs merged (#904, #905, #906, #908, #910).
Every acceptance check passes; nothing new was filed.

| Check | Result |
|---|---|
| AC-1 | `/actions` shows capital names (Social, Material, Financial, Living, Intellectual, Experiential), no raw capital codes, and no route error on any surface, at 1280 and 375, light and dark. |
| AC-2 | Reject opens Reject Work, whose confirm stays disabled until a reason is entered, then enables. Cancelled without submitting; the work still read Pending afterwards. |
| AC-3 | Queue cards show a neutral Pending chip with the work's age; the Hub header reads "5 waiting over a week". Garden Health reads Critical, consistent with 6 works waiting and no review in 7 days. Median review time reads "14 weeks", which is the DL-044 format (days, then weeks past two weeks). |
| AC-4 | No machine timestamp in queue cards, the work dialog title, notifications ("No reviews in 7 days, and 6 works are waiting."), or the hypercert flow's attestation list, which dates each item on its own line. |
| AC-5 | The admin review form preselects no confidence level, and Approve stays disabled with a neutral hint until one is chosen. The client's work review starts from `Confidence.NONE` in the shared `useWorkApprovalActions`. |
| AC-6 | Create Assessment starts with no domain selected, titles its steps "Domain & Context" and "Challenge & Goals", and asks in plain questions ("How Predictable Is This Work?"). Method names appear only in helper text, and validation errors appear only after Next. Discarded at the prompt. |
| AC-7 | Edit Garden's footer reads "All changes saved" with Save disabled, then "1 change · 1 wallet confirmation" after one description edit. Discarded without saving. |
| AC-8 | The Members tab, the rail's total, the directory, and Manage Members all count 46 people, one row each with a chip per role. |
| AC-9 | Every endowment amount names its asset (WETH, DAI); no bare amount. |
| AC-10 | At 375 and 360, in en, es, and pt, light and dark (12 combinations): the chip ends before the first app-bar icon and truncates, all five nav labels show whole with no overflow, the FAB clears the nav, the tab rail fades its clipped end, and the alert card leads. |
| AC-11 | The Actions workspace uses purple for its action (light `rgb(91, 44, 201)`, dark `rgb(202, 192, 255)`), the active tab, and the nav pill (`rgb(220, 213, 255)` with `rgb(61, 29, 134)` ink); no red appears anywhere on `/actions`. |
| AC-12 | Community → Payouts shows Campaign Cookie Jars with Create Cookie Jar for the deployer on the protocol garden. `/cookies` lands there, and `/cookies/deploy` opens Create Cookie Jar on its Campaign step. Closed without creating a jar. |
| AC-13 | The Garden Overview story and the live Garden Health share the two-column rail and label/value stat rows; the Hub queue story and the live queue share the header, outlined trio, tabs, and card grid. Only fixture data differs. |
| AC-14 | `bun run check --only design-tokens` passes, including the type-scale and view-colour sweep. |

Found and fixed before merge (PR5's local review): the capital tiles' label size, the review
hints' weight, arbitrary sizes the type ratchet missed, and the review form's Actionable story,
which had rendered "Action expired". Still open from PR4: the protocol garden past a chain's
newest 50 gardens, filed as PRD-988.

## Rendered Proof

- Engine: headless Chromium through Playwright, plus the in-app browser for the audit tasks.
  Session: mock-auth localhost (`?mockAuth=deployer`), the admin dev server on `develop`
  `11bc2d467` reading the hosted Arbitrum indexer, Green Goods Community Garden. Storybook dev
  server on the same commit for AC-13. Nothing was saved, submitted, or created: every dialog was
  cancelled or discarded before its final button.

## Validation

- Proof limits: whether a rejection carries its reason as feedback (AC-2), and each save row's
  landing and a stop naming its field (AC-7), need a submitted write, so they rest on the PR2
  and PR3 unit tests. The client's review sheet (AC-5) was checked in code, not rendered, because
  the client dev server was not running.

## Validation Receipt

- Tested implementation commit SHA: `11bc2d467a7d6ceb2bb460b8dd967a16d5dade97` (`develop` after #910)
- Run at (UTC): `2026-09-26T00:45:30Z`
- Exact command(s): scripted walks from the session scratchpad, which are not in the repository (`qa1_walk.mjs` for AC-1, 3, 4, 9, 11, and 12 over 10 surfaces at 1280 and 375, light and dark; `qa1_phone.mjs` for AC-10 at 375 and 360 in en, es, and pt, light and dark; Storybook captures for AC-13), in-app browser probes for AC-2, 5, 6, 7, and 8, and `bun run check --only design-tokens`
- Result: all 14 acceptance checks pass; no defect filed (the walk ran from `2026-09-26T00:28:06Z`)
- Validated paths: `packages/admin/src` `packages/shared/src` (read-only QA of the code on `develop`; nothing changed)
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/admin/src packages/shared/src` → empty on `11bc2d467`
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- None for QA pass 2.
