# One Look for the App and the Cockpit - UI Handoff

## Lane

- Owner: Claude
- Branch: one `feature/` branch per step; step 1 is `feature/app-cockpit-typeface`
- Status: in progress. Steps 1 to 3 approved on 2026-10-21; every later step starts on its own
  approved pair.

## Scope

- Deliver the steps in `plan.todo.md` in order, one pull request per step (two for step 1: the
  face, then the type role names), each against `develop` with `Fixes PRD-<issue>` when the pull
  request completes its issue.
- For each step: Storybook first, the shared recipe or token changed until it matches the approved
  pair, the consuming surfaces picking it up, nothing styled in a view file first.
- Keep the public website on its own dialect, and never restyle a shared piece from the cockpit
  (DL-031).

## Step 1: typeface (PRD-1267)

- Pull request: pending.
- Proof limit: `not_applicable`. The installed app's font family and its loading screen's face
  change; no behaviour does. Proof is the rendered pair, the typeface fit audit and the design and
  typography guards (eval.md, Design gate for the token slices).

## TDD Proof

- RED: not applicable to the token slices (pure styling).
- GREEN: not applicable to the token slices.
- Proof limit: steps 1 and 2 `not_applicable`; step 3's solid focus ring is rendered-only
  behaviour and records `proof_limit` with its rendered evidence.

## Validation Receipt

- Tested implementation commit SHA: pending (recorded per step)
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending

## Risks / Blockers

- The garden-scoped PWA Home builds in parallel on these tokens and recipes and must not restyle
  them; coordinate through merges to `develop`, tokens first.
- The worktree links the main checkout's installs, which predate `develop`'s lockfile (Vite 8.2.1
  where `develop` pins 8.2.4); CI runs the pinned versions.
