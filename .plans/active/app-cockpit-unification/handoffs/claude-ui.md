# One Look for the App and the Cockpit - UI Handoff

## Lane

- Owner: Claude
- Branch: one `feature/` branch per step. Step 1's have merged: `feature/app-cockpit-typeface`
  (#1172), `feature/app-cockpit-type-roles` (#1175) and `feature/app-cockpit-type-role-guides`
  (#1176).
- Status: in progress. Steps 1 to 3 are approved. Step 1's face, the cockpit's type roles and their
  guide wording merged on 21 and 22 October; the shared components' roles finish the step. Steps 2
  and 3 are drafts on `feature/app-cockpit-token-slice-drafts`. Every later step starts on its own
  approved pair.

## Scope

- Deliver the steps in `plan.todo.md` in order, one pull request per step (step 1 took more: the
  face, the cockpit's type roles, their guide wording as a standards-only pull request, and the
  shared components' roles), each against `develop` with `Fixes PRD-<issue>` when the pull request
  completes its issue.
- For each step: Storybook first, the shared recipe or token changed until it matches the approved
  pair, the consuming surfaces picking it up, nothing styled in a view file first.
- Keep the public website on its own dialect, and never restyle a shared piece from the cockpit
  (DL-031).

## Step 1: typeface (PRD-1267)

- Merged, each with `Refs PRD-1267`:
  - greenpill-dev-guild/green-goods#1176, the type role wording in `packages/admin/DESIGN.md`,
    frontend-design Rule 9 and the defect grammar: merge `870600083`, 2026-10-21 23:46:46Z. Review
    split it out of #1175, because `packages/admin/AGENTS.md` keeps the standards and the code they
    govern apart, so it merged first.
  - #1175, the cockpit onto the type roles: merge `cfd1aaf83`, 2026-10-21 23:48:54Z.
  - #1172, the installed app in Plus Jakarta Sans: merge `20d8c8121`, 2026-10-22 00:10:24Z.
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
  - `071ce6d1b`, from review: the Plus Jakarta Sans stylesheet takes a `media` query for installed
    displays and no preload, and the boot detector sets its `media` to `all` wherever it picks the
    installed-app presentation, so a browser tab never waits on the face.
    `presentationTypeface.test.ts` guards the selector and `bootFallback.test.tsx` the detector.
  - #1175's roles: `type-title-lg`, `type-title-md`, `type-title-sm`, `type-body`, `type-label`,
    `type-label-sm`, `type-meta`, `type-meta-sm`, and `type-field` for field text. Each is a
    Tailwind utility reading `--gg-type-<role>-size|line|weight|tracking`: the installed app's
    values in shared `theme.css`, the cockpit's in admin `index.css`, mirrored in Storybook's
    `surfaces.css` and pinned by `AdminDensityScale.guard`. A codemod moved 240 cockpit files off
    the Material aliases and named classes, six unused M3 `.type-*` classes left `utilities.css`,
    and `check:design-tokens` now rejects every font size outside the roles in `packages/admin/src`.
  - The maintainer's picks on rendered pairs (21 October): the shared scale's tracking (-0.006em
    at 14px), one line height per role, titles at weight 600 (the app bar's sheet label and the
    empty-workspace heading moved up from 400), checkbox and choice labels on `type-field` (14px
    from 640px), `type-meta-sm` at 400 unless a chip sets its own weight, the cookie jar payout
    amount at 22px, and card sizes left to the card step.
- Next, to finish step 1 (the last pull request says `Fixes PRD-1267`):
  - In review: the shared components on the roles (`feature/app-cockpit-shared-type-roles`), with
    its guide wording on its own branch (`feature/app-cockpit-shared-type-role-guides`), merged
    first as #1176 was. The design gate rendered 20 screens on both surfaces at 390 and 1280px in
    English, Spanish and Portuguese, and compared every text element in every story before and
    after. Two calls had no role that keeps both surfaces as they are, and the maintainer chose on
    the pairs (22 October): status pills and the assessment domain label take one size on both
    surfaces, the cockpit's 11px chip size (`type-meta-sm`; the medium pill `type-meta`), so the
    cockpit's pills stay as they were and the app's shrink from 14 and 12px to 11px; and the shared
    field label moves from 18 to 14px, the app's field label.
    Cockpit titles with no weight take 600, as #1175 ruled. The roles are rem where the old scale
    was px, so these texts now follow the reader's text size; at 200% the pending row's pill
    covers its overflowing marker line until step 7 puts the pill under the title. Left for a
    follow-up: the client's own 17 files on the shared scale (so the scale keeps its tokens and its
    `cn()` registration) and 98 raw Tailwind sizes in 35 shared components.
  - The offline face, from #1172's review: the service worker caches no web font, Inter included,
    so an installed app's first launch with no network draws the fallback face, short of "both
    surfaces render Plus Jakarta Sans". Serve both faces from the app and precache them. This
    changes service-worker behaviour, which the proof limit below does not cover: it records its
    own RED/GREEN proof under the testing contract and labeled authenticated Brave proof of an
    installed app's first launch with no network.
  - Labeled authenticated Brave proof of the installed app in Plus Jakarta Sans, pending since
    #1172 (AGENTS.md § Browser Evidence).
- Handed on to step 7: the three texts that newly end in an ellipsis at 320px (eval.md, Typeface).
  Step 7's detail-line rules and its 320px check cover them. PRD-1267's "Done when" still names
  that check, so its closeout says where they went.
- Proof limit for the face and the role names: `not_applicable`. The installed app's font family
  and its loading screen's face change; no behaviour does. Proof is the rendered pair, the
  typeface fit audit and the design and typography guards (eval.md, Design gate for the token
  slices).
- Proof limit for the shared components' roles: `not_applicable`. Class names, type tokens and
  two retired stylesheets change; no behaviour does. Proof is the rendered pairs, the all-story
  comparison, and `check:design-tokens`, whose retired-name sweep now covers `packages/shared`.

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

- Lane mode: `required` in `status.json`, because step 1's offline face changes service-worker
  behaviour. Its RED and GREEN proof follow the testing contract and are recorded with
  `node scripts/harness/plan-hub.mjs record-tdd` before the lane closes.
- RED and GREEN: not applicable to the token slices themselves (pure styling).
- Proof limit: step 1's face and role names and step 2 `not_applicable`; step 3's solid focus ring
  is rendered-only behaviour and records `proof_limit` with its rendered evidence.

## Validation Receipt

Latest, the face's merged head (#1172):

- Tested implementation commit SHA: `10694c2b3`, the develop merge that #1172 merged as, on a clean
  tree with the rig's capture story moved out.
- Run at (UTC): 2026-10-21 23:59:28 to 2026-10-22 00:02:28.
- Exact command(s): `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts
  --test-path client:src/__tests__/bootFallback.test.tsx --test-path
  client:src/__tests__/presentationTypeface.test.ts --test-path
  client:src/__tests__/config/sharedLink.test.ts --test-path
  docs:src/components/docs/designTokens.test.ts --test-path
  shared:src/__tests__/styles/utilities.test.ts --test-path
  shared:src/__tests__/styles/buttonShape.guard.test.ts --test-path
  agent:src/__tests__/locale-terms.test.ts --test-path agent:src/__tests__/i18n.test.ts`.
- Result: 17 of 17 passed fresh: format, lint, test-quality, shared-test, client-test,
  client-build, agent-test, docs-authority, docs-test, staged-modules, source-structure, ontology,
  agent-guidance, story-quality, storybook-build, docs-generated and em-dashes. browser-proof is
  pending (manual and advisory; see the pull request). CI Gate then passed on the same head.
- Validated paths: #1172's branch against `develop` at `cfd1aaf83`.
- Worktree identity command and result: `git rev-parse --show-toplevel && git branch
  --show-current` gave `.claude/worktrees/app-cockpit-unification` and
  `feature/app-cockpit-typeface`, at `10694c2b3`.
- #1175 and #1176 record their own gates in their pull request descriptions.

Earlier, the face's first gate:

- Tested implementation commit SHA: step 1's face and guides, `9ef990bc1` and `829aaf9e9`; the gate
  ran at head `b0fb7f4dc` on a clean tree.
- Run at (UTC): 2026-10-21, 08:03 to 08:08.
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
- Since 21 October the worktree has its own frozen install of `develop`'s lockfile. The docs audit
  runs here (it passed in the gate on `10694c2b3`), and installs no longer resolve outside the
  worktree, the reason Storybook's story tests once needed a temporary `fs.allow`.
- The rig's capture story, `packages/admin/src/views/__capture__/CockpitLocales.stories.tsx`, stays
  untracked. Move it out of the worktree before a push gate and back afterwards.
