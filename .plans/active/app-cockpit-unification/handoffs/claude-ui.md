# One Look for the App and the Cockpit - UI Handoff

## Lane

- Owner: Claude
- Branch: one `feature/` branch per step; step 1 is `feature/app-cockpit-typeface`
- Status: in progress, handed to the next session on 2026-10-21. Steps 1 to 3 are approved; step
  1's code is committed and pushed, its guides and guards are not; steps 2 and 3 are drafts on
  `feature/app-cockpit-token-slice-drafts`. Every later step starts on its own approved pair.

## Scope

- Deliver the steps in `plan.todo.md` in order, one pull request per step (two for step 1: the
  face, then the type role names), each against `develop` with `Fixes PRD-<issue>` when the pull
  request completes its issue.
- For each step: Storybook first, the shared recipe or token changed until it matches the approved
  pair, the consuming surfaces picking it up, nothing styled in a view file first.
- Keep the public website on its own dialect, and never restyle a shared piece from the cockpit
  (DL-031).

## Step 1: typeface (PRD-1267)

- Pull request: not opened. The body says `Refs PRD-1267`; the role-name pull request after it
  says `Fixes PRD-1267`.
- Done: `9ef990bc1` sets the installed app in Plus Jakarta Sans. `index.html` loads the variable
  face (italic, 200 to 800) before Inter and the PWA loading screen names it; `index.css` sets it
  on `:root[data-boot-presentation="pwa"]:not(:has([data-site="website"]))`; Storybook's app scope
  and app body take it in `surfaces.css`. The website keeps Inter.
- Left before the pull request, every place that still pins Inter for the installed app:
  - Guides: `packages/client/DESIGN.pwa.md` § Typography ("Inter only"); the line in
    `packages/client/DESIGN.browser.md` § Typography that gives Inter to both presentations; root
    `DESIGN.md` § Typography rows; `.claude/skills/design/client-prompt-contract.md` (three
    lines), `ai-ui-brief.md` and the `ARCHITECTURE.md` file map row; the two installed-app lines
    in `docs/docs/builders/architecture/design.mdx`.
  - Root `DESIGN.md` front matter: `body-md`, `label-md` and `app-title` name Inter and feed
    `design-md.generated.json` and the docs token page, whose samples load only Inter
    (`docs/src/components/docs/designTokens.data.ts`). Decide whether these roles describe the
    installed app (then Plus Jakarta Sans, and the docs samples load it) or the website.
  - Vocabulary: `scripts/data/banned-vocabulary.json` bans "Plus Jakarta Sans" in client prompts
    (`prompt_vocabulary_client_banned`); drop it, fix the rationale, regenerate the glossary.
  - Decision log: the step 13 draft numbers the typeface row DL-096 after a DL-095 for the retired
    cockpit rule; `develop` ends at DL-094.
  - Storybook rules and stories: `design-system/rules.ts` (`APP.family`, its rule line and the
    button and field expectations; `WEBSITE` stays Inter), `AppFoundations.stories.tsx` (label type
    lede and specimens), `Overview.stories.tsx` (the installed app's expected family);
    `storybook.css` (the `:root` and `.storybook-browser-preview` Inter rules, the comment on
    inherited faces) and `preview-head.html`, which loads Plus Jakarta Sans at 400 to 700 only.
  - Comments: `packages/client/src/styles/typography.css` ("the shell's Inter face"),
    `packages/shared/src/styles/theme.css` (`--font-serif` note), and
    `packages/client/src/views/Profile/AppSettings.tsx`, whose "Português" width note was measured
    in Inter; measure it again in the new face.
  - `bootFallbackGeometry.test.ts` and `typographyLayer.guard.test.ts` do not pin the face.
- Then: bring the branch up to `develop` (`aa217ef9c` changed the status bar meta in `index.html`
  and added an installed-app `html` rule in `index.css`, beside step 1's hunks), run
  `bun run design:generate` and `check:design-generated`, re-render the pair from the branch, and
  run the push gate by hand: worktrees without `.husky/_` run no git hooks, so this branch was
  pushed without one.
- Proof limit: `not_applicable`. The installed app's font family and its loading screen's face
  change; no behaviour does. Proof is the rendered pair, the typeface fit audit and the design and
  typography guards (eval.md, Design gate for the token slices).

## Steps 2 and 3: drafts

- `feature/app-cockpit-token-slice-drafts` holds the drafts the design gate rendered, on top of the
  step 1 draft and two hub records already folded into `238706a78`. Carry only these five commits:
  step 2 `437790fea`, `b8c200156`, `9b9bb5dc1`, `c1ddb4a38`; step 3 `10f0aa565`. Their base,
  `678a672dd`, predates `develop`'s safe-area work, which touched `index.html`, `index.css`,
  `theme.css`, `views/Home/Garden/index.tsx`, `views/Profile/index.tsx`, `PinnedPromiseCard.tsx`
  and `TopNav.tsx`; expect conflicts there.
- Step 2 still needs: the status bar and manifest colours per presentation
  (`config/pwaManifest.ts` theme and background colours, the `theme-color` metas in `index.html`,
  shared `utils/styles/theme.ts`), reconciled with the solid iOS status bar `develop` now sets;
  colons in place of the em dashes in the draft's comments (`theme.css` Earth ramp,
  `admin-m3-tokens.css`); the seam fingerprint for `views/Home/Garden/index.tsx`; and
  `design:generate`.
- Step 3 still needs the solid 2px focus ring in place of the 12 to 16% halos on `.gg-control`,
  `.gg-button`, `.gg-chip` and `.gg-switch` (the icon button already draws one), and the
  `AdminDensityScale.guard` updates for `--gg-control-outline`.

## TDD Proof

- RED: not applicable to the token slices (pure styling).
- GREEN: not applicable to the token slices.
- Proof limit: steps 1 and 2 `not_applicable`; step 3's solid focus ring is rendered-only
  behaviour and records `proof_limit` with its rendered evidence.

## Validation Receipt

- Tested implementation commit SHA: pending (recorded per step; no gate has run on `9ef990bc1`)
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending

## Risks / Blockers

- The garden-scoped PWA Home builds in parallel on these tokens and recipes and must not restyle
  them; coordinate through merges to `develop`, tokens first.
- The pairs rig and its frames stay outside Git: the app frames show public gardens' photos.
- The worktree links the main checkout's installs, which predate `develop`'s lockfile (Vite 8.2.1
  where `develop` pins 8.2.4); CI runs the pinned versions.
