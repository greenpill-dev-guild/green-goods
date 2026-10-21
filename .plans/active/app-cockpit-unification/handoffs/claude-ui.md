# One Look for the App and the Cockpit - UI Handoff

## Lane

- Owner: Claude
- Branch: one `feature/` branch per step; step 1 is `feature/app-cockpit-typeface`
- Status: in progress. Steps 1 to 3 are approved. Step 1's face, with its guides, guards and
  stories, is on `feature/app-cockpit-typeface` for its first pull request; the type role names
  follow as a second one. Steps 2 and 3 are drafts on `feature/app-cockpit-token-slice-drafts`.
  Both branches are pushed. Every later step starts on its own approved pair.

## Scope

- Deliver the steps in `plan.todo.md` in order, one pull request per step (two for step 1: the
  face, then the type role names), each against `develop` with `Fixes PRD-<issue>` when the pull
  request completes its issue.
- For each step: Storybook first, the shared recipe or token changed until it matches the approved
  pair, the consuming surfaces picking it up, nothing styled in a view file first.
- Keep the public website on its own dialect, and never restyle a shared piece from the cockpit
  (DL-031).

## Step 1: typeface (PRD-1267)

- Pull request: the face, opened from `feature/app-cockpit-typeface` against `develop` with
  `Refs PRD-1267`. The role-name pull request after it says `Fixes PRD-1267`.
- Done:
  - `9ef990bc1` sets the installed app in Plus Jakarta Sans. `index.html` loads the variable face
    (italic, 200 to 800) before Inter and the PWA loading screen names it; `index.css` sets it on
    `:root[data-boot-presentation="pwa"]:not(:has([data-site="website"]))`; Storybook's app scope
    and app body take it in `surfaces.css`. The website keeps Inter.
  - `2cd0ba268` merges `develop`: its status bar meta and standalone `html` floor sit beside step
    1's hunks without a conflict.
  - `829aaf9e9` brings every guide, guard and story that named Inter for the installed app into
    line. Root `DESIGN.md`: the Typography table, and front matter where `body-md`, `label-md` and
    `app-title` name Plus Jakarta Sans and the website's button takes its own Inter role,
    `website-label` (16px, 600, 24px line), as the maintainer chose on 2026-10-21; `token_version`
    2.22.0 and the regenerated projections. DL-095 (the retired Material 3 rule) and DL-096 (the
    typeface) from the step 13 draft, with two corrections: DL-095 cites `prompt-contract.md` §
    Workspace Tone for the tone budget (the draft cited DL-043, the Hub's outlined trio), and DL-096
    carries the measured fit from eval.md. The guides and prompt contracts, "Plus Jakarta Sans" out
    of the client prompt ban list, the Storybook rules, specimens, Overview play, base stylesheet and
    font request (the website's field now carries its own Inter expectation), the docs token page
    and its test, and the comments. The "Português" width note was measured again: 69.1px at 14px
    against the trigger's 66px (68.0px in Inter), still one line, about 10px clear of the chevron.
- Next: the type role rename (title, body, label, meta at each surface's sizes) as the second pull
  request, `Fixes PRD-1267`.
- Proof limit: `not_applicable`. The installed app's font family and its loading screen's face
  change; no behaviour does. Proof is the rendered pair, the typeface fit audit and the design and
  typography guards (eval.md, Design gate for the token slices).

## Steps 2 and 3: drafts

- `feature/app-cockpit-token-slice-drafts` holds the drafts the design gate rendered, on top of the
  step 1 draft and two hub records already folded into `238706a78`. Carry only these five commits:
  step 2 `437790fea`, `b8c200156`, `9b9bb5dc1`, `c1ddb4a38`; step 3 `10f0aa565`. Their base,
  `678a672dd`, predates `develop`'s safe-area work. Replayed in a dry run (`git merge-tree`) onto
  step 1 with `develop` merged, only `437790fea` conflicts, in four files: `PinnedPromiseCard.tsx`,
  `TopNav.tsx`, the client's `index.css` and `views/Profile/index.tsx`. Each is the same clash:
  `develop` rewrote the line for the safe area (`--app-top-bar-height`, `--app-top-offset`, the new
  comments) and the draft changed `bg-bg-white-0` to `bg-bg-canvas` on it. Keep `develop`'s line
  and swap the class. The other four commits replay cleanly, and `index.html`, `theme.css` and
  `views/Home/Garden/index.tsx` merge on their own.
- Step 2 still needs: the status bar and manifest colours per presentation
  (`config/pwaManifest.ts` theme and background colours, the `theme-color` metas in `index.html`,
  shared `utils/styles/theme.ts`), reconciled with the solid iOS status bar `develop` now sets;
  colons in place of the em dashes in the draft's comments (`theme.css` Earth ramp,
  `admin-m3-tokens.css`); the seam fingerprint for `views/Home/Garden/index.tsx`; and
  `design:generate`.
- Step 3 still needs the solid 2px focus ring in place of the 12 to 16% halos on `.gg-control`,
  `.gg-button`, `.gg-chip` and `.gg-switch` (the icon button already draws one), and the
  `AdminDensityScale.guard` updates for `--gg-control-outline`.
- The step 13 guide draft and the two pending decision-log rows are in
  `artifacts/step-13-draft/`: DL-097 lands with step 2 and DL-098 with step 3, each with the
  guide lines its slice makes true.

## TDD Proof

- RED: not applicable to the token slices (pure styling).
- GREEN: not applicable to the token slices.
- Proof limit: steps 1 and 2 `not_applicable`; step 3's solid focus ring is rendered-only
  behaviour and records `proof_limit` with its rendered evidence.

## Validation Receipt

- Tested implementation commit SHA: step 1's face and guides, `9ef990bc1` and `829aaf9e9`; the gate
  ran at head `b0fb7f4dc` on a clean tree.
- Run at (UTC): 2026-10-21, 08:03 to 08:15.
- Exact command(s): `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts
  --test-path shared:src/__tests__/styles/buttonShape.guard.test.ts --test-path
  docs:src/components/docs/designTokens.test.ts --test-path agent:src/__tests__/i18n.test.ts
  --test-path agent:src/__tests__/locale-terms.test.ts`, then each check it left unrun by its own
  command from `scripts/data/validation-policy.json`.
- Result: format, lint, test-quality, shared-test, client-build and agent-test passed in the gate.
  docs-authority failed on this worktree's linked installs: `docs/scripts/docs-audit.mjs` imports
  `@babel/parser` 8.0.4, which `develop` added to the docs package on 2026-10-18 and the main
  checkout's store lacks. Run separately, everything else passed: docs-authority's other tests and
  generate check, docs-test, staged-modules, source-structure, ontology, agent-guidance,
  story-quality, docs-generated, em-dashes and storybook-build. The Design workflow's checks
  (DesignMD and docs projections, `design.md lint` on the five guides, design tokens, vocabulary,
  guidance examples and links) passed on the same content before the commit. Not run locally: the
  docs audit; CI runs it. browser-proof is pending (manual and advisory; see the pull request).
- Validated paths: the branch against `develop`: step 1's code, guides, guards, stories, generated
  files and these hub records.
- Worktree identity command and result: `git rev-parse --show-toplevel && git branch
  --show-current` gave `.claude/worktrees/app-cockpit-unification` and
  `feature/app-cockpit-typeface`.

## Risks / Blockers

- The garden-scoped PWA Home builds in parallel on these tokens and recipes and must not restyle
  them; coordinate through merges to `develop`, tokens first.
- The pairs rig and its frames stay outside Git: the app frames show public gardens' photos.
- The worktree links the main checkout's installs, which predate `develop`'s lockfile (Vite 8.2.1
  where `develop` pins 8.2.4); CI runs the pinned versions. Because those installs resolve outside
  the worktree, Storybook's story tests here need a temporary `server: { fs: { allow: [<main
  checkout>] } }` on the storybook project in `packages/shared/vitest.storybook.config.ts`; revert
  it before committing.
- The rig's capture story, `packages/admin/src/views/__capture__/CockpitLocales.stories.tsx`, stays
  untracked. Move it out of the worktree before a push gate and back afterwards.
