# PWA Interface Simplification - QA Pass 1 Handoff

## Lane

- Owner: Claude
- Branch: none (read-only walk of develop in a worktree on `claude/serene-allen-75ead1`)
- Status: completed on 2026-10-26; the authenticated class is pending under PRD-1262

## Scope

- Review user flow, acceptance criteria, and missing test coverage after implementation lanes complete.

## Validation

- Four batches walked develop as it moved: `fccccadfe` (#1316 at its head), `907664c07`
  (#1307, #1322, #1320), `ba1875933` (#1321, #1318, #1326, #1327) and `1931f0acb` (#1312).
- 21 findings: 1 medium-high, 4 medium, 1 low-medium, 15 low. Fixed after the pass: 1 and 8
  (#1331), 2, 3 and 11 (#1333), 15 (#1332), 19 (#1334); 5 was resolved by #1312. The rest are
  listed in the plan's closeout.
- A1, A3, A5, A6, A7 (Storybook) and A8 pass. A2 failed on finding 2 and A4 on findings 1 and 3,
  all fixed afterwards; A9 is rendered only; A10 had findings 4, 8, 17 and 19; A11 passes in EN,
  ES and PT at 360 and 390 apart from findings 11 and 16; A12 has findings 1 and 10.
- Authenticated-class items were never reachable (the Claude in Chrome probe returned "not
  connected"), so step 20 does not pass on this receipt; they are listed on PRD-1262.

## Validation Receipt

- Tested implementation commit SHA: `1931f0acbfca046cdbe993c9c74b9da06d1f0ac9` (final batch;
  earlier batches on `fccccadfec84368ddf9e6950c265bf8a2ad36eaf`,
  `907664c07e9b58fd05095eca15f053a9bc3a1692` and `ba1875933ae75f25a0582920ec88af3139554af2`)
- Run at (UTC): `2026-10-26T08:34:00Z`
- Exact command(s): in `packages/client`, `SKIP_MKCERT=true APP_ENV=development
  VITE_CHAIN_ID=42161 node ../../scripts/dev/node-cli.js vite --port 3044 --strictPort`
  (mock-auth, Arbitrum One); in `packages/shared`, `node .storybook/prepare-design-assets.mjs &&
  node ../../scripts/dev/node-cli.js storybook dev -p 3054 --ci`; Playwright 1.60 headless
  Chromium rigs s1 to s32; `git merge --ff-only origin/develop` between batches
- Result: 21 findings as above; A1, A3, A5, A6, A7 and A8 pass; A2 and A4 failed on findings
  fixed afterwards; A9 rendered only; authenticated-class items pending
- Validated paths: `packages/client/src/views/Home/**`, `packages/client/src/views/Garden/**`,
  Profile's gardens list, and the Shared reads `useActiveGarden`, `useMyGardens`,
  `useGardenJournal`, `useStewardDuties`, `useAwaitingJoinRequests`, `useGardenNotifications`,
  `useStartStep`, `useSubmissionPromiseLink`, `useArrivalState`, `useUploadFailureToast`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/client/src/views/Home packages/client/src/views/Garden packages/shared/src/hooks` → empty (`git rev-parse HEAD` → `1931f0acbfca046cdbe993c9c74b9da06d1f0ac9`; worktree `.claude/worktrees/shipping-gates-audit-ab4434`, branch `claude/serene-allen-75ead1`, whole tree clean at 08:33Z)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable
- Evidence class: mock-auth localhost (headless Chromium) and Storybook; no authenticated Brave
  proof. Private captures stay in the session's scratchpad, outside Git.

## Risks / Blockers

- The authenticated class (Check Requests, a real Upload Work and take-up, a queued steward
  decision, the installed app offline, passkey signing) was not walked; PRD-1262 carries it.
