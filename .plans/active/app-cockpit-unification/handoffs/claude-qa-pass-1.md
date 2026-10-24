# One Look for the App and the Cockpit - QA Pass 1 Handoff

## Lane

- Owner: Claude
- Branch: `fix/app-cockpit-acceptance-pass-1`
- Status: completed for what is merged on `develop` at `8476dbd80`. Step 20's phases 1 and 2 and the
  call-site pass still need a recheck when they merge.

## Scope

- Review user flow, acceptance criteria, and missing test coverage after implementation lanes complete.

## Validation

- Acceptance pass 1 checked matrix A1 to A23 on `develop` at `8476dbd80`: steps 1 to 19 and 21 with
  step 12's look, plus step 20's phases 3 and 4. Each criterion's result and evidence is in
  [the evaluation](../eval.md#acceptance-pass-1).
- 12 criteria pass as rendered, A1 shows no change, and A4 and A23 carry their earlier proof. A14
  failed and is fixed on this branch. A2 and A21 fail, and A15, A17, A18, A19 and A22 pass in part;
  the private findings page names an owner for each finding.
- This branch fixes the cockpit's state block size (A14) and the off-screen placeholder for Home's
  garden cards (A21). `AdminDensityScale.guard` now fails if a cockpit stylesheet restyles the
  state block again.
- Rendered proof, labeled by class: mock-auth localhost (client and cockpit dev servers from the
  tested commit on Arbitrum One with the hosted indexer) and Storybook, at 320, 360, 390, 768 and
  1280px, in English, Spanish and Portuguese, light and dark. Authenticated Brave: none.

## Validation Receipt

- Tested implementation commit SHA: `8476dbd80` (`develop`)
- Run at (UTC): 2026-10-24T20:54:08Z
- Exact command(s): `node run.mjs <app|cockpit> [locale] [theme] [target]`, `node sb-run.mjs` and
  `node pub.mjs`, from the pass's measuring rig, which stays outside Git with the private evidence;
  then, for the fixes, `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:src/__tests__/styles/utilities.test.ts --test-path shared:src/__tests__/components/EmptyState.test.tsx --test-path admin:src/__tests__/components/AdminDensityScale.guard.test.tsx`
- Result: frames written from 20:23Z to 20:54Z: 460 mock-auth localhost frames, 300 Storybook
  frames and five public routes against `870600083`, results as recorded in the evaluation. The
  fixes (`090a6a9d2`) passed the push gate's six checks.
- Validated paths: rendered from `packages/client`, `packages/admin` and `packages/shared` at the
  tested commit; fixed in `packages/admin/src/index.css`,
  `packages/shared/src/styles/utilities.css` and
  `packages/admin/src/__tests__/components/AdminDensityScale.guard.test.tsx`
- Worktree identity command and result: in `.claude/worktrees/acceptance-pass-1` (HEAD `8476dbd80`),
  `git status --porcelain=v1 --untracked-files=all -- packages/client packages/admin packages/shared`
  → empty
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Recheck A12, A19 and A23 and the button, field and chip families when step 20's phases 1 (#1256)
  and 2 (#1255) and the call-site pass merge.
- Authenticated-class surfaces stay pending: wallet and passkey signing, the queue and offline
  uploads, and installed-PWA behavior.
- The cockpit's Cookies route never rendered under mock-auth, so it is unverified.
