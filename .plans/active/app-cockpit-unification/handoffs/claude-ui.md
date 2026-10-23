# One Look for the App and the Cockpit - UI Handoff

## Lane

- Owner: Claude
- Branch: one `feature/` branch per step. Step 1's have merged: `feature/app-cockpit-typeface`
  (#1172), `feature/app-cockpit-type-roles` (#1175), `feature/app-cockpit-type-role-guides`
  (#1176), `feature/app-cockpit-shared-type-roles` (#1188) and
  `feature/app-cockpit-shared-type-role-guides` (#1187). Step 2 runs on
  `feature/app-cockpit-ground-ladder`, with its guide wording on
  `feature/app-cockpit-ground-ladder-guides`.
- Status: in progress. Steps 1 to 3 are approved. Step 1's face, both halves of the type roles and
  their guide wording have merged, and #1190 served and precached the faces; step 1 waits only on
  the maintainer's call on #1189 (below). Step 2 is in review. Step 3's draft is on
  `feature/app-cockpit-token-slice-drafts`. Every later step starts on its own approved pair.

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
  - #1188, the shared components onto the type roles: merge `f305bd7f6`, 2026-10-23 05:10:05Z.
  - #1187, their guide wording: merge `671bc8220`, 2026-10-23 05:36:58Z.
- Served and precached by other work: #1190 (`perf/startup-session-performance`, merge `65df3ad13`,
  2026-10-23 06:13:54Z) serves Inter, Plus Jakarta Sans and Fraunces from
  `packages/client/public/fonts/` (latin and latin-ext), precaches `fonts/pwa.css` and
  `fonts/jakarta-*.woff2`, and its `tests/specs/client.pwa-preview.spec.ts` proves the installed
  face on an offline reload. That is the offline face #1172's review asked for.
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
- The shared components' roles (#1188, #1187): the design gate rendered 20 screens on both
  surfaces at 390 and 1280px in English, Spanish and Portuguese, and compared every text element in
  every story before and after. Two calls had no role that keeps both surfaces as they are, and the
  maintainer chose on the pairs (22 October): status pills and the assessment domain label take
  one size on both surfaces, the cockpit's 11px chip size (`type-meta-sm`; the medium pill
  `type-meta`), so the cockpit's pills stay as they were and the app's shrink from 14 and 12px to
  11px; and the shared field label moves from 18 to 14px, the app's field label. Cockpit titles
  with no weight take 600, as #1175 ruled. The roles are rem where the old scale was px, so these
  texts now follow the reader's text size; at 200% the pending row's pill covers its overflowing
  marker line until step 7 puts the pill under the title.
- Follow-ups the shared roles left, neither filed yet: the client's own 17 files on the shared scale
  (so the scale keeps its tokens and its `cn()` registration), and 98 raw Tailwind sizes in 35
  shared components.
- Next, to finish step 1 (the last pull request says `Fixes PRD-1267`):
  - The maintainer's call on #1189 (`feature/app-cockpit-offline-face`, head `27189c373`), which
    #1190 overtook: it conflicts with `develop` in seven files and would add a second copy of the
    faces under `src/styles/fonts/`. Recommended: close it as superseded and port what #1190 lacks
    as one small pull request. What it lacks is the vietnamese subset: `develop`'s latin-ext ranges
    skip U+1EA0 to U+1EF1 (ẹ, ọ, ị, ụ), and Google Fonts served that subset for all three faces
    before #1190, Fraunces included, so Yoruba and Igbo names now draw those letters in a fallback
    face. Inter stays out of the precache: under `/home` it draws only in the wallet modal, which
    needs a network. #1189's budget-checker guard is not recommended: on `develop`'s build it
    reports nothing, and it fires only when `fonts/pwa.css` names a face outside the
    `fonts/jakarta-*.woff2` glob (a constructed case: `develop`'s checker passes it, #1189's fails
    it), which a `jakarta-vietnamese-*` file does not do; the offline spec can assert the new face
    directly.
  - Brave proof, 2026-10-23, **authenticated Brave** (the maintainer's profile through the Claude
    in Chrome extension, `navigator.brave` true), `develop` `65df3ad13` built for production and
    served by `vite preview` on :4318, `/home/login?presentation=pwa` in a browser tab: online, the
    sign-in screen draws Plus Jakarta Sans; after a reload the worker controls the page and holds
    `fonts/pwa.css` and the four `jakarta-*` files; with the server stopped, a reload renders the
    sign-in screen from the worker, both latin files decode from the precache (27,348 and 29,600
    bytes) and the button draws Plus Jakarta Sans. **Still pending:** the installed app's first
    launch. Installing needs Brave's own install dialog, which the extension cannot click, and the
    session had no desktop control.
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

## Step 2: ground and dark ladder (PRD-1268)

- `feature/app-cockpit-ground-ladder` from `develop` `65df3ad13`: the four drafts (`437790fea`,
  `b8c200156`, `9b9bb5dc1`, `c1ddb4a38`) replayed with `cherry-pick --no-commit`, keeping
  `develop`'s safe-area line with the canvas swap in `PinnedPromiseCard.tsx`, then finished in
  `c9b1fd66a` (`Fixes PRD-1268` in the pull request):
  - The re-grep found no ground use added since the 20 October gate: every later
    `bg-bg-white-0` in shipped app code is a card, a sheet, a bottom bar or the website. Six app
    story files whose wrappers paint a page, and the garden page's story frame, moved to
    `bg-bg-canvas`.
  - The status bar and the manifest per presentation: the `theme-color` meta carries the
    website's white (`data-light`, `data-dark`) and the installed app's linen and warm floor
    (`data-app-light`, `data-app-dark`); the boot detector points the bar at the app's ground when
    it picks the installed presentation, and shared `theme.ts` keeps it current. The manifest's
    theme and background colours take linen. The colours come from the DesignMD token export:
    `neutral-dark` moved from `#1C1917` to `#110C08`, the floor both surfaces paint, so the two
    `#fff` baseline rows retired, and a manifest test pins the export to the canvas `theme.css`
    paints. The iOS solid status bar is iOS's own; whether it follows `theme-color` needs a device.
  - The error boundary's Retry label took the static white token, retiring its baseline row; the
    seam fingerprint of `shared-commitment-pooling-public` is re-certified (its proof suites, 61
    tests, passed); colons replaced the draft's em dashes; the projections and the docs token
    data are regenerated.
- Guides: DL-097 and its lines in root `DESIGN.md`, `language.md` § Dark Mode Palette,
  `DESIGN.pwa.md` and the cockpit's `DESIGN.md`, with token version 2.23.0, go in the standards-only
  `feature/app-cockpit-ground-ladder-guides`, as #1176 and #1187 did.
- Proof: eval.md, Step 2 proof (contrast audit and 76 rendered pairs). TDD `not_applicable`: pure
  styling and the status bar colour, whose unit cases are in `theme.test.ts`,
  `bootFallback.test.tsx` and `pwa-manifest.test.ts`.

## Step 3: control outline and focus role (PRD-1269)

- Draft `10f0aa565` on `feature/app-cockpit-token-slice-drafts` replays onto step 2:
  `theme.css` applies cleanly, and the cockpit's `index.css` and Storybook's `surfaces.css` keep
  both sides after `--gg-hit-block` (`develop`'s type role block and the draft's outline).
- Built on top of it, not yet committed: one solid 2px ring on `.gg-control`, `.gg-button`,
  `.gg-chip` and `.gg-switch` in the workspace tone in the cockpit and the app's green, switched on
  by two plain tokens (`--gg-focus-ring-width`, `--gg-focus-halo-alpha`) that the installed app and
  the cockpit set, so the public website keeps its halo (A13); `AdminDensityScale.guard` pins
  `--gg-control-outline` and both focus tokens. Its pull request waits on step 2, or on the
  maintainer's word on stacking it.
- The step 13 guide draft and the pending DL-098 row are in `artifacts/step-13-draft/`; DL-098
  lands with step 3, with the guide lines it makes true.

## TDD Proof

- Lane mode: `required` in `status.json`, because step 1's offline face changes service-worker
  behaviour. Its RED and GREEN proof follow the testing contract and are recorded with
  `node scripts/harness/plan-hub.mjs record-tdd` before the lane closes.
- Proposed for the offline face, now that #1190 delivered it (recorded once the maintainer decides
  #1189), with `develop`'s `tests/specs/client.pwa-preview.spec.ts` (`55b0b9b86`) and the policy's
  command `PLAYWRIGHT_JSON_OUTPUT_FILE=<file> bun run browser e2e --preset pwa-preview --
  --workers=1 --reporter=line,json`, run 2026-10-23 in this worktree:
  - RED at `671bc8220` (`develop` just before #1190) with that spec file checked out over it:
    1 failed, at spec line 95, `page.evaluate: TypeError: Failed to fetch`, when the offline page
    fetches `/fonts/jakarta-latin-normal.woff2`: no face is served or precached. The offline
    shell's earlier assertions pass.
  - GREEN at `develop` `65df3ad13`: 1 passed (55.3s).
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
