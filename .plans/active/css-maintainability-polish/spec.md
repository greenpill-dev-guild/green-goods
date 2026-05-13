# CSS Maintainability Polish Spec

## Summary

Run the active post-release CSS architecture polish pass that turns the recent design-system work into
maintainable frontend practice. The work should inventory CSS ownership, define global selector
boundaries, add or refine guardrails for repeatable drift, and clean up verified token/raw-value
issues without changing the intended visual direction of public browser, installed PWA, or admin
surfaces.

## Users

- Primary: maintainers and agents implementing future design-system, client, admin, and shared UI changes.
- Secondary: gardeners, public readers, and operators who benefit from fewer visual regressions across browser, installed PWA, and admin surfaces.
- Reviewers: maintainers checking that CSS changes are source-grounded, scoped, and validated.

## Research Evidence

- `.plans/README.md` defines feature hubs, lane ownership, lifecycle, backlog quality bar, and `status.json` as the machine-readable source of truth.
- `client-pwa-design-system-transition` already owns the installed PWA design-system migration and protected PWA baseline census; this hub consumes that output rather than duplicating it.
- `design-system-alignment-review` is a read-only review hub; this CSS cleanup now runs first so that
  review is not dominated by known stale maintainability drift.
- `public-read-side-journal` and the initial PWA audit are no longer blockers for this active cleanup;
  refresh source inventory before touching runtime CSS.
- Repo guidance requires DesignMD/Warm Earth token validation, `check:design-generated`, `check:design-tokens`, and `lint:vocab` for frontend design-system work.

Open assumptions:

- The exact CSS inventory will be refreshed when this hub is activated; active UI plans may change file-level ownership before then.
- Guardrail implementation may reuse existing design scripts or require a small focused script, depending on false-positive rate.

## Functional Requirements

### 1. Inventory CSS ownership

Create a source-grounded inventory of:

- Global CSS entrypoints and the surfaces that import them.
- Component-local CSS modules, authored selectors, and CSS custom properties.
- Tailwind utility usage in shared code versus package-local code.
- Generated design artifacts and generated audits that must remain synchronized.
- Public browser, installed PWA, admin, docs, and Storybook CSS boundaries.

The inventory must separate confirmed facts from inferred risks. It should not treat visual preference as drift unless source evidence shows a contract mismatch.

### 2. Define global selector boundaries

Document which selectors are allowed to be global and why. At minimum, classify:

- reset/base selectors;
- typography defaults;
- app shell selectors;
- route/surface selectors;
- utility or helper selectors;
- legacy selectors scheduled for migration;
- Storybook-only or docs-only selectors.

Global browser/editorial selectors must not become installed PWA defaults unless the plan explicitly calls that out. Installed PWA selectors must not leak public editorial serif or browser shell assumptions.

### 3. Tighten token and variable usage

Audit and clean up repeatable raw values where the repo already has an appropriate token or alias:

- colors and relative color variants;
- shadows and material overlays;
- border radii and concentric radius relationships;
- timing/easing values;
- typography scale, line-height, and font-family usage;
- repeated spacing values that should be component variables.

Do not mechanically wrap every CSS property in a custom property. Prefer variables where they represent design intent, variants, local component controls, or a shared system value.

### 4. Catch undefined custom properties

Add or refine a lightweight guard that detects unresolved `var(--*)` references across frontend CSS/TSX style surfaces. The check should understand generated token aliases well enough to avoid false confidence, and it should be cheap enough for the validation ladder.

If a fully automated check is too noisy for the first pass, capture the exact false positives and land a reviewed allowlist or follow-up item rather than weakening the requirement.

### 5. Preserve dialect boundaries

The cleanup must preserve the repo's design-language split:

- Public browser client: `SiteHeader`, browser shell, editorial/browser-facing typography and page composition.
- Installed PWA client: mobile shell, bottom app bar, Inter, direct task surfaces, old-design cleanup.
- Admin: M3 wrapper components, Plus Jakarta Sans, restrained operator cockpit, glass only where allowed by the admin contract.
- Shared: primitives, hooks, providers, and Storybook-backed foundations without assuming consumer Tailwind scanning for layout utilities.

### 6. Prefer flexible CSS over breakpoint duplication

When touching responsive CSS, prefer:

- grid `minmax`, `auto-fit`, or `auto-fill`;
- flex wrapping and intrinsic sizing;
- `clamp()` for bounded fluid values where appropriate;
- component custom properties adjusted at breakpoints;
- container-aware patterns where the component is reused across widths.

Do not expand selector-by-selector media-query rewrites unless a specific layout requires it.

### 7. Make guidance durable

Update the smallest existing repo guidance surface needed so future work follows the ownership model. Do not duplicate the full Warm Earth spec. Link to canonical design-system protocol where appropriate.

Durable guidance should answer:

- where new CSS should live;
- when global CSS is allowed;
- how to introduce component-level variables;
- what raw values are banned or discouraged;
- what validation commands prove the touched surface.

## Non-Functional Constraints

- Package boundaries: keep shared primitives in `packages/shared`, client-specific CSS in `packages/client`, and admin-specific overrides in `packages/admin`.
- Design language: preserve the public browser, installed PWA, and admin dialect split.
- Performance: do not add new heavy blur/material layers or responsive rewrites without proof they are needed.
- Accessibility: cleanup must preserve focus states, contrast, reduced-motion behavior, and non-color status indicators.
- Localization: any new user-facing string must be added to `en`, `es`, and `pt`.
- Tooling: new checks must be cheap enough for the existing validation ladder or clearly documented as pre-merge/scheduled gates.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| CSS inventory, component/global cleanup, visual proof | `ui` | Primary implementation lane. |
| Guardrail scripts, generated audit checks, validation integration | `state_api` | Tooling only; no runtime API/data behavior. |
| Contracts | `contracts` | `n/a`; no Solidity or deployment-adjacent scope. |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential proof across public browser, PWA, admin, and Storybook. |

## Human Judgment Points

- Whether active UI plans have stabilized enough to begin broad CSS cleanup.
- Whether a raw value is intentional local art direction or system drift.
- Whether a global selector should remain global because it is reset/base behavior or move into a package/component boundary.
- Whether guardrail false positives should be allowlisted, deferred, or fixed through source cleanup.
- Whether visual QA shows a token-correct change that should still be reverted for product quality.

## Risks

- Risk: this plan becomes a redesign pass.
  Mitigation: require source-grounded ownership evidence and keep product visual direction out of scope.
- Risk: browser/editorial CSS leaks into installed PWA or PWA mobile-shell assumptions leak into browser pages.
  Mitigation: make dialect boundaries acceptance criteria and run display-mode/browser/PWA regression proof.
- Risk: guardrails create noisy failures.
  Mitigation: start with undefined variable detection and explicit false-positive handling.
- Risk: cleanup fights active work.
  Mitigation: refresh the source inventory first and keep runtime edits scoped to confirmed CSS
    ownership/token drift.

## Acceptance Criteria

- CSS ownership inventory is checked into the plan handoff or a durable docs surface.
- Undefined custom property risk is covered by a script, existing guard, or documented blocker with exact next action.
- Global selector boundaries are documented.
- Raw-value cleanup lands only where it is source-grounded and scoped.
- Public browser, installed PWA, admin, and Storybook regression evidence is captured.
- `node scripts/harness/plan-hub.mjs validate` passes.
- Relevant design gates pass for the touched surface.
