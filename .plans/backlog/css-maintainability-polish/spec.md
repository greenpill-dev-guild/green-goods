# CSS Maintainability Polish Spec

## Summary

Create a follow-up polish lane for CSS maintainability after the active public-browser, PWA, and
design-alignment plans complete. The work is not a redesign. It is a scoped cleanup and enforcement
pass that makes CSS ownership easier to understand, removes stale global/legacy patterns, and adds
lightweight checks so future UI work stays coherent.

## Users

- Primary: maintainers and agents implementing frontend changes across client, admin, shared, and docs.
- Secondary: gardeners, operators, funders, and visitors who benefit from a stable, coherent design
  system across PWA, browser, and admin surfaces.

## Sequencing

Start this hub only after:

- `public-read-side-journal` is either archived or its public browser CSS architecture regression note
  is satisfied.
- `client-pwa-design-system-transition` has completed Stage 0 typography scope, and preferably the
  staged PWA visual cleanup.
- `design-system-alignment-review` has produced or reaffirmed current design-system drift findings.

This hub can start earlier only for read-only inventory or tooling design; do not run broad CSS source
edits while active UI lanes are still moving the same surfaces.

## Research Evidence

- `packages/client/src/index.css` imports `packages/client/src/styles/typography.css` globally.
- `packages/client/src/styles/typography.css` contains legacy aliases such as `.title-screen`,
  `.title-section`, `.body-md-regular`, and `.label-md`, plus broad selectors for `*`, headings,
  anchors, lists, `blockquote`, `pre`, `code`, `table`, and `hr`.
- Current shared typography tokens in `packages/shared/src/styles/theme.css` use names such as
  `--text-title-h1`, `--text-label-md`, and `--text-paragraph-md`, not the old
  `--text-*-font-size` alias shape used by the legacy client typography file.
- `public-read-side-journal` now requires public-browser CSS to stay component-authored, semantic-token
  based, and independent of the legacy global client typography layer.
- `client-pwa-design-system-transition` owns the first typography-scope cleanup and the protected PWA
  baseline census.
- Existing design gates already cover important parts of the surface:
  - `bun run check:design-generated`
  - `bun run check:design-tokens`
  - `bun run check:design-md`
  - `bun run lint:vocab`

## Functional Requirements

1. Inventory CSS ownership and classify each global style source.
   - Shared token projection: `packages/shared/src/styles/theme.css`.
   - Shared utilities: `packages/shared/src/styles/utilities.css`.
   - Package entry CSS: client/admin/docs entry styles.
   - Component/shell-scoped styles and inline CSS variables.
   - Generated audit/baseline files.

2. Add or plan a lightweight undefined-custom-property check.
   - Scan CSS and TSX style values for `var(--*)` references.
   - Compare against generated/shared token definitions and documented local runtime variables.
   - Require an allowlist for intentional component-scoped variables.

3. Define global selector ownership.
   - Only approved base/reset/theme files may own bare element selectors.
   - Package-level broad selectors must be scoped to a shell/root class or removed.
   - Public browser and PWA must not rely on the same unscoped typography element rules.

4. Finish raw-value cleanup that is not already owned by active plans.
   - Raw colors, primitive palette classes, durations, easing, radius values, and overlays should be
     mapped to Warm Earth tokens or retained only with documented exceptions.
   - Do not remove baseline rows until the corresponding source usage is actually fixed.

5. Preserve dialect boundaries.
   - Public browser stays `PublicShell` + `SiteHeader`, component-authored, editorial typography.
   - Installed PWA stays `AppShell` + bottom `AppBar`, Inter-only, field-tool typography.
   - Admin stays restrained operator cockpit with admin primitives and admin-specific rules.

6. Make maintainability guidance durable.
   - Document allowed CSS ownership and enforcement commands in the smallest existing source of truth
     that future agents already read.
   - Avoid duplicating the Warm Earth spec; link back to existing DesignMD and design protocol sources.

## Human Judgment Points

- Whether to preserve short-lived compatibility typography aliases after PWA Stage 0, or remove them
  once call sites are migrated.
- Whether a repo-level CSS check should be a hard gate immediately or start as a reporting-only guard.
- Whether any broad selector is genuinely useful enough to live in approved base CSS.
- Whether adding Stylelint is worth the dependency/config cost, or whether repo-local scripts are enough
  for the current drift patterns.

## Non-Functional Constraints

- Use existing Warm Earth tokens; do not create new tokens unless a verified blocker requires it.
- Keep source edits tightly scoped by surface and stage.
- Do not introduce a new CSS methodology or framework.
- Use `bun` scripts for validation and package operations.
- Add i18n only if user-facing copy changes, which should be rare for this plan.
- Public/editorial and PWA browser proof must state data/seed limitations honestly.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| CSS inventory and source cleanup | `ui` | Owns frontend CSS source edits and visual regression evidence. |
| CSS drift tooling | `state_api` | Owns scripts/checks only; no runtime data/API changes. |
| Contracts | `contracts` | `n/a`; no Solidity or deployment work. |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential validation and regression proof. |

## Risks

- Risk: The pass turns into a redesign.
  Mitigation: require source evidence, keep dialect visuals stable, and treat visual change as a blocker
  unless explicitly approved.
- Risk: Global selector cleanup breaks browser editorial or installed PWA typography.
  Mitigation: rerun route/shell regression checks and screenshots for both dialects.
- Risk: Tooling blocks valid component-local variables.
  Mitigation: start with an explicit allowlist and add exceptions only with file-level rationale.
- Risk: The plan duplicates active PWA work.
  Mitigation: do not start implementation until PWA Stage 0 is complete; consume its output rather than
  redoing it.
