# Community Docs Revamp - QA Pass 1 Handoff

## Lane

- Owner: Claude
- Branch: `chore/community-docs-revamp-plan` (PR #896)
- Status: not started. The implementation lanes have passed, so the replay can begin once a
  person's session is available.

## Scope

- Walk every guide on the released product and fix wording, labels, and screenshots that drift
  (`plan.todo.md` step 4.3, `eval.md` AC-7).
- The pages were written from source reads. Nothing in them has been replayed on a running
  product yet, so this pass is the first behavioral proof.

## What to replay, and with what

Label each observation with its engine and session, per `AGENTS.md` § Browser Evidence.

| Guide pages | Needs | Why |
|---|---|---|
| Install and Update; Join a Garden; Submit Work; Track Your Work; Recover Unsent Work | Authenticated Brave, plus an installed app on a phone for install, update, and the offline queue | Sign-in, passkey signing, the installed app, the service worker, and the upload queue are the authenticated class |
| Steward index (requesting access); Manage Members; Review Work; Make an Assessment; Funding and Governance | Authenticated Brave with a steward account | Each ends in a signed change |
| Create a Garden; Manage Actions, the part for people who maintain the list | A deployer account | Deployer-only. Check the Create Garden finding below first |
| Mint Impact Certificate | A steward account on a network where certificates are switched on | The page is marked "In progress" |
| Donate; Endow; Remove an Endowment | A wallet with test funds on the released network | Wallet signing. Never move money without Afo's say-so |
| Welcome, How It Works, Why We Build, FAQ, Glossary | A clean-room browser is enough | Public reading pages |

The QA catalog's DOCS-014 to DOCS-026 are the matching cases. Manage Members, Install and Update,
and the Evaluator index have no case yet.

## Known before starting

- **Create Garden.** The `ui` handoff describes why **Deploy Garden** may answer **Cannot deploy
  yet** on a fresh form. Confirm or clear this first; the page's steps depend on it.
- **Text-only steps.** Submit Work's Start and Details steps, an open submission in the cockpit,
  the Endowment tab, and the funder dialogs have no screenshot, because no fixture story renders
  them. A replay is the place to capture them from a demo garden, never a live one.
- **Advisory browser proof.** The planner selected `browser-proof` because the QA catalog changed
  (one page path and four scenario titles). It is pending: open the QA app in authenticated Brave
  and confirm the docs cases read correctly.

## Validation

- Not run.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Needs a person's authenticated session and, for the gardener pages, a phone. An agent cannot
  supply either.
- The read-through by people who have not seen the docs (`eval.md` AC-9) is a separate check and
  is not part of this lane.
