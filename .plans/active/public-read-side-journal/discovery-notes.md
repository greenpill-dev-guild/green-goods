# Discovery Notes — Public Browser Read-side Refresh

**Slug:** `public-read-side-journal`
**Lane:** A — Discovery
**Date:** 2026-04-25
**Source of truth:** `.plans/active/public-read-side-journal/plan.todo.md`

> Lane A is discovery only. No source files were modified. This file supersedes the earlier research pass that treated external visual references as IA, vocabulary, and component guidance. Treat those references as visual mood only; canonical routes, personas, and entities come from the repo.

---

## 1. Canonical boundary

The public browser refresh stays inside the existing public route families:

| Route | Existing view | Role in this plan |
| --- | --- | --- |
| `/gardens` | `packages/client/src/views/Public/Gardens.tsx` | Network browse surface with richer public Garden cards. |
| `/impact` | `packages/client/src/views/Public/Impact.tsx` | Network impact summary and available assessment/hypercert evidence. |
| `/fund` | `packages/client/src/views/Public/Fund.tsx` | Funder entry point that preserves the existing vault and Cookie Jar dialogs. |
| `/actions` | `packages/client/src/views/Public/Actions.tsx` | Public Action template catalog. |

Do not add new public route families. The existing garden detail view remains part of the Garden route family; this plan should not expand IA beyond the four canonical families.

Canonical domain terms remain: Garden, Action, Work, Assessment, Hypercert, Vault, Cookie Jar, Attestation, Hat, Season. Canonical personas remain: Gardener, Operator, Evaluator, Funder, Community Member.

Evaluator framing is settled: no dedicated Evaluator workspace, public profile, credibility loop, or second-signature queue. Evaluators are served by existing Garden and Hub surfaces through role-permissioned visibility.

---

## 2. Existing scaffold inventory

### `packages/client/src/views/Public/Gardens.tsx`

- Read-only public Garden grid using public Garden data.
- Reusable: route family, Garden summary data, loading/error states.
- Follow-up: replace inline card markup with a public Garden card composition that keeps the Garden entity name and avoids new domain aliases.

### `packages/client/src/views/Public/GardenDetail.tsx`

- Existing detail view under the Garden route family.
- Reusable: Garden lookup and banner/detail composition.
- Follow-up: if this view stays in scope, keep it as Garden detail and add only data that is already available through canonical Garden, Work, Assessment, and Attestation reads.

### `packages/client/src/views/Public/Actions.tsx`

- Read-only Action template catalog.
- Reusable: `useActions`, domain-label mapping, template-card grid.
- Follow-up: improve the browser editorial treatment without changing Action into a different public entity.

### `packages/client/src/views/Public/Fund.tsx`

- Funder surface with vault deposit and Cookie Jar deposit dialogs.
- Reusable: wallet-on-demand flow, existing dialogs, aggregate Garden stats.
- Follow-up: polish page framing while preserving the current transaction path.

### `packages/client/src/views/Public/Impact.tsx`

- Network summary surface for assessments, gardens, and available evidence.
- Reusable: stat aggregation and public evidence grid.
- Follow-up: hide unavailable oracle-style metrics cleanly; do not invent placeholder units.

### `packages/client/src/components/Navigation/SiteHeader.tsx`

- Existing public browser header.
- Follow-up: surface the four canonical public route families clearly and add return-user/auth affordance without creating deeper nav hierarchy.

---

## 3. Component direction

Keep the refresh small and repo-native:

| Component | Purpose | Placement guidance |
| --- | --- | --- |
| `PublicHero` | View-level browser hero shared by the four public route families. | `packages/client/src/components/Layout/` or a nearby public browser component folder. |
| `PublicGardenCard` | Public Garden summary card with optional stat/content slots. | Client package first; move to shared only if admin/PWA reuse appears. |
| `StatTile` | Editorial public stat anatomy for `/impact` and funding summaries. | Reuse an existing primitive if it already matches; create only if needed. |

Avoid adding one-off component names imported from visual references. The implementation should grow from existing Garden, Action, Work, Assessment, Hypercert, Vault, Cookie Jar, Attestation, Hat, and Season data.

---

## 4. Data and hook follow-up

Lane B public reads are the expected base. Before merging any consumer work, align any old hook or constant names to canonical vocabulary:

- Public Garden list and Garden detail hooks should keep Garden naming.
- Public Work feed/read hooks should use Work naming.
- Public Season reads should use Season naming.
- The Season One constant should be named `SEASON_ONE_ID`; keep `SEASON_ONE_WINDOW` for the time window.
- `usePublicStats` remains the public aggregate hook.

Renames are mechanical and should happen before page consumers stabilize.

---

## 5. Implementation constraints

- Browser path uses `SiteHeader`; installed PWA continues to route through `PlatformRouter`.
- No new public route families beyond `/gardens`, `/impact`, `/fund`, `/actions`.
- Client copy and component names use canonical domain vocabulary.
- Tailwind v4 utility classes authored in `packages/shared/src/` do not reliably scan into client builds; keep new browser UI in the client package unless there is a proven shared need.
- Use semantic tokens; no raw color/radius/motion literals.
- Keep i18n coverage for any new user-facing strings.
- Do not introduce evaluator-specific public surfaces.
- SEO, Open Graph, and Lighthouse polish are follow-up work after the visual refresh is stable.

---

## 6. Suggested execution order

1. Rename any old public Work/Season hook and constant names.
2. Confirm `SiteHeader` exposes the four public route families and the auth/join affordance.
3. Build the smallest `PublicHero`, `PublicGardenCard`, and `StatTile` set needed by the four views.
4. Refresh `/gardens`, `/impact`, `/fund`, and `/actions` one at a time, preserving current data and transaction paths.
5. Validate browser-vs-PWA routing, i18n, vocabulary lint, and the standard repo checks for the touched surface.

---

## Appendix — files read for discovery

- `.plans/active/public-read-side-journal/plan.todo.md`
- `CLAUDE.md`
- `DESIGN.md`
- `packages/client/DESIGN.browser.md`
- `.claude/skills/design/client-prompt-contract.md`
- `.claude/skills/design/quick-reference.md`
- `.claude/rules/react-patterns.md`
- `.claude/rules/frontend-design.md`
- `.claude/rules/typescript.md`
- `packages/client/src/views/Landing/index.tsx`
- `packages/client/src/views/Public/Gardens.tsx`
- `packages/client/src/views/Public/GardenDetail.tsx`
- `packages/client/src/views/Public/Actions.tsx`
- `packages/client/src/views/Public/Fund.tsx`
- `packages/client/src/views/Public/Impact.tsx`
- `packages/client/src/components/Layout/Hero.tsx`
- `packages/client/src/components/Navigation/SiteHeader.tsx`
- `packages/client/src/routes/PlatformRouter.tsx`
- `packages/client/src/routes/PublicShell.tsx`
- `packages/client/src/router.config.tsx`
- `packages/client/src/views/PublicBrowserSurfaces.stories.tsx`
- `packages/shared/src/components/Display/ImageWithFallback.tsx`
- `packages/shared/src/styles/theme.css`
