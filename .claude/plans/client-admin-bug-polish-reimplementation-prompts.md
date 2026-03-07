# Client/Admin Bug & Polish Reimplementation Prompts

**Date:** 2026-03-07  
**Purpose:** Re-implement the reverted admin/client bug-polish work from scratch with Claude Code, while preserving the retained IPFS/community operational changes already kept on `main`.

## Working Rules

- The earlier Codex implementation for the admin/client bug-polish pass was reverted from `main`.
- Treat every batch below as a fresh implementation.
- Do not touch the retained operational IPFS/community work unless a batch explicitly depends on it.
- Any new user-facing string must be added to `en`, `es`, and `pt`.
- Use root `.env` only.
- Keep hooks in `@green-goods/shared`.

## Parallelization

- Run `Batch 0` first or keep it isolated. It should not run in parallel with the UI-heavy batches.
- `Batches 1, 3, 4, 5, 6` can run in parallel after `Batch 0` is done or explicitly skipped.
- `Batch 2` overlaps with the same garden/dashboard surfaces as `Batch 1`, so do not run those two in parallel.

---

## Batch 0: Shared UI Foundation

```text
You are re-implementing the Green Goods shared UI foundation pass for the client and admin packages.

Goal
- Standardize typography, control sizing, card spacing, and icon-button behavior across shared, client, and admin without doing a full redesign.

Important context
- A prior implementation was reverted. Rebuild this cleanly from current main.
- Do not touch data logic, auth logic, treasury math, or contract code.

Ownership
- packages/shared/src/styles/theme.css
- packages/shared/src/components/Form/*
- packages/shared/src/components/Cards/*
- packages/shared/src/components/Tokens/*
- packages/client/src/styles/*
- packages/client/src/index.css
- packages/admin/src/index.css
- minimal shared primitive call-site updates in client/admin where needed

Do not modify
- IPFS upload/read scripts
- contract files
- service worker/auth flows
- create-garden business logic
- treasury math or vault logic

Required outcomes
- Establish one shared typography source of truth and remove package-level drift.
- Standardize text inputs, textareas, selects, and icon-button sizes.
- Standardize card/header spacing plus shared radius and border conventions.
- Make mobile-safe input sizing the default in shared controls.
- Remove obvious repeated one-off control sizing classes where a shared primitive should own the behavior.
- Update or add token/component stories where useful so the system is documented.

Validation
- Run typecheck for shared/client/admin.
- Run focused Storybook or component tests for shared form/token primitives.
- Summarize which local overrides were intentionally left in place.
```

---

## Batch 1: Garden/Work UI Flow

```text
You are re-implementing the client garden/work UI fixes for Green Goods.

Issues
- #378
- #379
- #381
- #382
- #408
- #428
- #429

Goal
- Fix the garden/work interaction bugs without touching unrelated shared data or auth flows.

Ownership
- packages/client/src/views/Garden/*
- packages/client/src/views/Home/Garden/*
- packages/client/src/components/Features/Garden/*
- packages/client/src/components/Navigation/*
- packages/client/src/routes/AppShell.tsx
- packages/client/src/index.css
- packages/shared/src/hooks/work/useWorkForm.ts
- packages/shared/src/components/Form/FormInput.tsx
- packages/shared/src/components/Form/FormTextarea.tsx

Do not modify
- IPFS/shared data modules
- admin package files
- treasury/vault files
- auth/service-worker files

Required outcomes
- Normalize time-spent values exactly once.
- Fix keyboard/footer collision on work feedback textareas.
- Fix back navigation from work detail so users return to the correct prior context.
- Remove nested scroll behavior that traps work submission views.
- Apply mobile/tablet-safe input sizing.
- Fix garden top-bar sizing and notification modal close affordances.
- Remove the home-view flash before garden load.

Validation
- Run focused client tests for garden/work flows.
- Run client/shared typecheck.
- Call out any UX follow-up that was deliberately left out of scope.
```

---

## Batch 2: Dashboard, Cards, Profile Polish

```text
You are re-implementing the Green Goods client/admin polish issues for dashboards, cards, profile surfaces, and garden imagery.

Issues
- #411
- #412
- #414
- #426
- #434

Goal
- Improve the high-traffic UI surfaces that still feel inconsistent or incomplete, while preserving current product behavior.

Ownership
- packages/client/src/views/Home/*
- packages/client/src/views/Profile/*
- packages/client/src/components/Cards/*
- packages/client/src/components/Features/*
- packages/client/src/components/Dialogs/*
- packages/admin/src/components/Garden/*
- packages/shared/src/components/Cards/*
- packages/shared/src/components/Image/*

Do not modify
- contract files
- upload/read scripts
- auth internals
- treasury transaction logic
- create-garden deployment workflow logic

Required outcomes
- Standardize fallbacks for garden/action/card imagery.
- Improve recent activity so it reflects meaningful platform events.
- Improve recent garden cards with richer right-side metadata and lightweight tooltips.
- Clean up profile view width/input inconsistencies and help-section presentation.
- Fix open gardens/join garden labeling and placement issues.
- Normalize home dashboard entry animations and card heights.

Validation
- Run focused client component tests where available.
- Run typecheck for shared/client/admin if shared card primitives are touched.
- Provide before/after notes for the main surfaces changed.
```

---

## Batch 3: Treasury and Funding UX

```text
You are re-implementing the Green Goods treasury/vault UI and flow fixes.

Issues
- #377
- #409
- #410
- #432
- #433

Goal
- Fix funding UX, precision display, navigation, and admin configurability without regressing the vault or cookie-jar flows.

Ownership
- packages/admin/src/views/Treasury/*
- packages/admin/src/views/Gardens/Garden/Vault.tsx
- packages/admin/src/components/Vault/*
- packages/admin/src/components/Work/CookieJarPayoutPanel.tsx
- packages/client/src/components/Dialogs/TreasuryDrawer.tsx
- packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx
- packages/shared/src/hooks/cookie-jar/*
- packages/shared/src/utils/blockchain/vaults.ts

Do not modify
- auth/service-worker files
- garden/work layout files unrelated to treasury
- create-garden/community files
- IPFS/media scripts

Required outcomes
- Fix vault withdrawal precision and tiny-balance handling.
- Stop displaying misleading mixed-asset TVL totals.
- Fix endowment back navigation.
- Expose cookie-jar withdrawal cap controls in admin with sensible UX.
- Improve deposit flow confidence: connection prompting, Aave pool visibility, and clearer state handling.

Validation
- Run focused admin/client/shared treasury tests.
- Run typecheck for affected packages.
- Note any contract deployment dependency separately if one is discovered.
```

---

## Batch 4: Create Garden and Community/Admin Detail UX

```text
You are re-implementing the Green Goods create-garden and garden admin-detail UX fixes.

Issues
- #376
- #407
- #425

Goal
- Fix the create-garden UX and garden/community presentation so the admin experience matches actual behavior and avoids misleading team semantics.

Ownership
- packages/admin/src/views/Gardens/CreateGarden.tsx
- packages/admin/src/components/Garden/CreateGardenSteps/*
- packages/shared/src/stores/useCreateGardenStore.ts
- packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts
- packages/shared/src/hooks/garden/useCreateGardenForm.ts
- packages/admin/src/views/Gardens/index.tsx
- packages/admin/src/views/Gardens/Garden/Detail.tsx
- packages/admin/src/components/Garden/*
- packages/shared/src/modules/data/gardens.ts
- packages/shared/src/types/gardens-community.ts

Do not modify
- contract files
- treasury files
- IPFS/media scripts
- auth/service-worker files

Required outcomes
- Make the create-garden step order and semantics clear, especially operators vs gardeners.
- Remove or clarify misleading preselected domains and add-member friction.
- Ensure the UI reflects what is actually configured or deferred post-create.
- Fix member counts so unique people are represented correctly.
- Display the real community name consistently instead of collapsing to scheme labels.

Validation
- Run focused admin/shared tests for create-garden and garden detail surfaces.
- Run shared/admin typecheck.
- Explicitly document any product decisions encoded by the new UX.
```

---

## Batch 5: Assessments and Work Detail Data/UI

```text
You are re-implementing the Green Goods assessments and work-detail fixes across client and admin.

Issues
- #405
- #406
- #431

Goal
- Make work detail and assessment loading/rendering reliable across client and admin, with stronger preflight validation and correct deep links.

Ownership
- packages/shared/src/modules/data/*
- packages/shared/src/hooks/assessment/*
- packages/shared/src/hooks/work/useWorkApproval.ts
- packages/shared/src/modules/work/*
- packages/shared/src/utils/errors/*
- packages/shared/src/utils/eas/*
- packages/client/src/views/Home/Garden/Work.tsx
- packages/client/src/views/Home/Garden/WorkViewSection.tsx
- packages/client/src/views/Home/Garden/Assessment.tsx
- packages/admin/src/views/Gardens/Garden/Assessment.tsx
- packages/admin/src/views/Gardens/Garden/WorkDetail.tsx

Do not modify
- IPFS operational scripts
- auth/service-worker files
- treasury files
- create-garden files

Required outcomes
- Safely parse and render work detail metadata without crashing.
- Unify assessment loading between client and admin.
- Fix EAS deep-link generation and in-product detail access.
- Add approval preflight validation and clearer approval failure states.

Validation
- Run focused shared/client/admin tests for work/assessment flows.
- Run shared/client/admin typecheck.
- Summarize any remaining chain-state-dependent failure cases.
```

---

## Batch 6: Auth, Passkey, PWA, Profile Settings

```text
You are re-implementing the Green Goods auth/profile/PWA fixes.

Issues
- #383
- #384
- #385
- #386

Goal
- Stabilize logout, update-app behavior, PWA installability, and ENS/passkey-related profile state without touching unrelated garden or treasury flows.

Ownership
- packages/shared/src/providers/Auth.tsx
- packages/shared/src/workflows/auth*
- packages/shared/src/modules/auth/*
- packages/shared/src/hooks/app/useServiceWorkerUpdate.ts
- packages/shared/src/hooks/app/useInstallGuidance.ts
- packages/client/src/views/Profile/AppSettings.tsx
- packages/client/src/views/Profile/ENSSection.tsx
- packages/client/src/views/Login/index.tsx
- packages/client/vite.config.ts
- packages/client/public/*
- packages/client/index.html

Do not modify
- treasury files
- create-garden files
- assessment/work detail files
- IPFS operational scripts

Required outcomes
- Make logout semantics explicit and prevent unwanted silent restore.
- Make the manual app update flow reliable.
- Fix broken installability or manifest asset issues.
- Ensure ENS/subdomain state is driven by account/chain truth, not stale local session state.

Validation
- Run focused shared/client auth/profile/PWA tests.
- Run client/shared typecheck.
- Note any behavior change that requires user-facing release notes.
```

---

## Handoff Note

Use the current `main` branch as the baseline. The retained operational work around IPFS/Pinata hybrid reads, CID-preserving repinning, and garden/community repair tooling stays in place and should not be reverted by any Claude batch unless a batch explicitly calls out a dependency.
