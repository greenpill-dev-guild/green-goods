# Fix Garden Domain UI - ui Handoff

**Feature**: `fix-garden-domain-ui`
**Lane**: `ui`
**Owner**: `claude`
**Status**: `completed by codex on develop`
**Dispatch Branch**: `develop`

## What Changed

- Codex implemented this UI lane on `develop` for the current dispatch.
- The current `/garden` workspace now renders a visible domain summary row above the Garden workspace content.
- Zero-domain gardens show `No domains configured` for all users.
- Managers/operators get an `Edit domains` CTA wired to the existing `GardenDomainModal`.
- Submit Work's no-actions-for-domain state now includes a `Configure domains` CTA back to `/garden/settings` with the selected garden context.
- Added `Admin/Workspaces/Garden/EmptyDomains` Storybook coverage for the current Garden workspace empty-domain state.
- Added `en`, `es`, and `pt` strings for the zero-domain alert and Submit Work recovery CTA.

## Validation

- `cd packages/admin && bun run test -- src/views/Garden/garden-domain-ui.test.tsx` passed.
- `cd packages/admin && bun run test -- src/views/Garden` passed.
- `cd packages/shared && bun run build-storybook` passed.
- Browser smoke against `http://127.0.0.1:6006/iframe.html?id=admin-workspaces-garden--empty-domains&viewMode=story` passed: `No domains configured` rendered, exactly one `Edit domains` CTA rendered, the CTA opened `Edit Domains`, and Playwright reported no console or page errors.
- Screenshots captured at `output/playwright/garden-domain-empty-domains-story.png` and `output/playwright/garden-domain-empty-domains-modal.png`.
- `bun run lint:vocab` passed.
- `node scripts/harness/plan-hub.mjs validate` passed before and after lane status updates.

## Proof Limits

- `bun run storybook` hit the local Storybook dev-server `detect-port` failure (`expected options to have a port`), so the browser smoke used a static Storybook build served locally instead.
- The screenshots live under ignored `output/playwright/` artifacts and are not tracked plan files.
- The edit flow reuses the existing `GardenDomainModal`; this pass does not change the underlying write mutation.
