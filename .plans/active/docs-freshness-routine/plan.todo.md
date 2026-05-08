# Docs Freshness Routine Plan

**Feature Slug**: `docs-freshness-routine`
**Stage**: `active`
**Status**: `ACTIVE — state_api READY`
**Created**: `2026-04-25`
**Last Updated**: `2026-05-07`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep this in the existing `docs-freshness-routine` hub | Avoids duplicate truth for screenshots, social cards, and docs freshness work. |
| 2 | Treat the Matt audit copy remediation as complete baseline work | The reviewed copy/docs changes have already passed the docs gates and should not be reopened casually. |
| 3 | Wait for UI stabilization before screenshot replacement | Funder and admin UI naming/surfaces are actively changing; early screenshots would churn. |
| 4 | Refresh only scoped community docs media | The user asked about the docs scope discussed: Gardener, Operator, Funder, and the six reviewed flows. |
| 5 | Use real app/admin/docs surfaces for all screenshots | Docs media must be source-backed and should not teach fabricated states. |
| 6 | Add a distinct Donate visual | Donate and Endow are now separate visible funder flows; sharing the same image weakens comprehension. |
| 7 | Keep app UI changes out of this plan | Donate/Endow/Remove UI work is already active elsewhere and should be aligned later, not duplicated here. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands
- [x] Confirm prerequisite PWA QA is complete (`client-pwa-gardener-audit` archived)
- [ ] Confirm current admin/client UI is stable enough for screenshot recapture

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Preserve completed community docs copy remediation | `state_api` | Phase 0 | Done |
| Wait for active UI updates before capture | `state_api` | Phase 1 | Pending |
| Recapture stale admin screenshots | `state_api` | Phase 3 | Pending |
| Replace mismatched Work Dashboard screenshot | `state_api` | Phase 2 | Pending |
| Add distinct Donate social image | `state_api` | Phase 4 | Pending |
| Decide whether funder UI screenshots are needed | `state_api` + human | Phase 4 | Pending |
| Wire updated media into scoped MDX pages | `state_api` | Phase 5 | Pending |
| Verify rendered docs desktop/mobile | `qa_pass_1` + `qa_pass_2` | Phase 6 | Pending |

## Impact Analysis

### Files Likely To Modify

- `docs/docs/community/gardener-guide/uploading-your-work.mdx`
  - Update image reference/alt text if the Work Dashboard screenshot filename or framing changes.
- `docs/docs/community/operator-guide/creating-a-garden.mdx`
  - Keep `admin-create-garden.png` aligned to the actual Create Garden form.
- `docs/docs/community/operator-guide/reviewing-work.mdx`
  - Keep queue/detail screenshots aligned to pending work and review controls.
- `docs/docs/community/operator-guide/creating-impact-certificates.mdx`
  - Keep Certify/Create Hypercert screenshot aligned to the final admin surface.
- `docs/docs/community/funder-guide/index.mdx`
  - Use distinct visuals for Donate, Endow, and Remove cards.
- `docs/docs/community/funder-guide/donating-to-a-garden.mdx`
  - Use the distinct Donate image and optional screenshot if approved.
- `docs/docs/community/funder-guide/funding-a-garden.mdx`
  - Keep Endow image and optional screenshot aligned to the vault deposit flow.
- `docs/docs/community/funder-guide/withdraw-from-a-vault.mdx`
  - Keep Remove image and optional screenshot aligned to withdrawal/removal.

### Files Likely To Replace Or Add

- `docs/static/img/screenshots/client-work-dashboard.png`
- `docs/static/img/screenshots/admin-create-garden.png`
- `docs/static/img/screenshots/admin-work-queue.png`
- `docs/static/img/screenshots/admin-work-detail.png`
- `docs/static/img/screenshots/admin-garden-impact.png`
- `docs/static/img/social/donating-to-a-garden.webp` (new, if distinct Donate asset is approved)

### Files To Avoid Unless Explicitly Needed

- App UI files under `packages/client/**`, `packages/admin/**`, and `packages/shared/**`
- Contract, indexer, schema, deployment, or i18n files
- Unrelated docs outside the scoped community guide path

## Implementation Phases

### Phase 0: Preserve Completed Copy Baseline

Status: complete.

- [x] Gardener guide narrowed to Join and Submit paths.
- [x] Operator guide narrowed to Create, Assess, Review, and Mint paths.
- [x] Funder guide reshaped around Donate, Endow, and Remove.
- [x] Docs chrome fixes applied for edit URL and previous/next labels.
- [x] Inline help added for same-login, passkey/smart-account address, Arbitrum gas, draft/offline clarity, and Telegram/help pointer.
- [x] Stale terms removed from scoped docs: old vault labels, `assessment frame`, `same action`, behind-the-scenes protocol detail, and confusing internal language.

Validation evidence already recorded in chat:

- `bun run build:docs` passed.
- Generated HTML scan passed for pagination labels, edit URL, funder labels, and core links.
- `bun run lint:vocab` passed.
- `bun run docs:audit` passed with existing unrelated builder/reference warnings only.
- Scoped stale-copy scan and `git diff --check` passed.

### Phase 1: UI Readiness Gate

Do not capture screenshots until this phase is satisfied.

- [ ] Confirm the Donate / Endow / Remove UI work has landed or reached a stable review point.
- [ ] Confirm admin Create Garden, Work review, and Certify surfaces are stable enough for docs captures.
- [ ] Confirm whether captures should use local seeded data, staging data, or manually prepared demo data.
- [ ] Confirm that no private user data, secrets, unrelated browser overlays, or active-agent toasts are visible.
- [ ] Decide whether funder pages get screenshots now or remain illustration-led until a later pass.

### Phase 2: Recapture Gardener Work Dashboard

- [ ] Open the client app with a gardener account or fixture that has at least one submitted work record.
- [ ] Capture a phone-shaped screenshot of the Work Dashboard showing one queued, pending, approved, or rejected submission.
- [ ] Replace `docs/static/img/screenshots/client-work-dashboard.png` or add a better-named replacement if needed.
- [ ] Update `uploading-your-work.mdx` alt text if the visible state changes.
- [ ] Verify the screenshot renders legibly at `320px` width inside the docs page.

Acceptance notes:

- The screenshot should not look like the Home garden list.
- The visible state should match the "How to know it worked" copy.
- If showing rejection feedback, use safe demo data and keep the copy generic.

### Phase 3: Recapture Operator Admin Screenshots

#### 3A: Create Garden

- [ ] Capture a desktop admin screenshot showing the Create Garden form, not an empty create route.
- [ ] Ensure visible fields include enough of name/ENS/location/description/domain selection to support the docs step.
- [ ] Remove any unrelated overlays such as "Claude is active", browser prompts, or local tooling toasts.
- [ ] Replace `docs/static/img/screenshots/admin-create-garden.png`.

#### 3B: Review Work Queue

- [ ] Capture a desktop admin screenshot showing a pending work queue with at least one pending submission.
- [ ] Make the garden picker/filter and pending state visible enough to support the page steps.
- [ ] Replace `docs/static/img/screenshots/admin-work-queue.png`.

#### 3C: Work Detail Review

- [ ] Capture a desktop admin screenshot showing a selected submission with action, evidence/media, details, notes, and approve/reject controls where possible.
- [ ] Crop or frame the screenshot so the review area is legible in docs.
- [ ] Replace `docs/static/img/screenshots/admin-work-detail.png`.

#### 3D: Certify / Create Hypercert

- [ ] Capture a desktop admin screenshot of the Certify workspace or Create Hypercert form after the UI settles.
- [ ] Prefer a state with assessment/certificate context visible, not an empty "no hypercerts yet" placeholder.
- [ ] Replace `docs/static/img/screenshots/admin-garden-impact.png` or add a better-named replacement and update MDX.

### Phase 4: Refresh Funder Visuals

#### 4A: Distinct Donate Social Image

- [ ] Create or source a distinct `docs/static/img/social/donating-to-a-garden.webp`.
- [ ] Keep dimensions at 1440x900.
- [ ] Make the visual read as direct Cookie Jar support, not a vault/endowment.
- [ ] Wire Donate overview card and `donating-to-a-garden.mdx` to the new image.
- [ ] Keep Endow using the vault/endowment visual unless a better Endow asset is created.

#### 4B: Optional Funder Screenshots

Only do this if the UI is stable and screenshots clarify the flow.

- [ ] Capture Donate from public `/fund` showing Support this Garden, Donate, and Cookie Jar deposit dialog.
- [ ] Capture Endow from public `/fund` or Treasury drawer showing the vault deposit dialog.
- [ ] Capture Remove from authenticated Treasury drawer showing Active deposits and Withdraw controls.
- [ ] Add screenshots only where they reduce ambiguity; do not turn the funder docs into a screenshot-heavy guide if the UI is still moving.

### Phase 5: Wire Docs Media And Metadata

- [ ] Update MDX `image:` frontmatter where a new social image is added.
- [ ] Update `GuideOpener` image paths and alt text where needed.
- [ ] Update inline `<img>` paths and alt text where screenshots change.
- [ ] Keep `last_verified` aligned only for pages actually verified after replacement.
- [ ] Avoid expanding `docs/sidebars.ts` unless a media change exposes a broken nav label.

### Phase 6: Rendered QA And Validation

- [ ] Run `bun run docs:audit`.
- [ ] Run `bun run build:docs`.
- [ ] Run `bun run lint:vocab`.
- [ ] Run `git diff --check -- <touched docs/media files>`.
- [ ] Render desktop and mobile docs pages for:
  - `/community/gardener-guide/uploading-your-work`
  - `/community/operator-guide/creating-a-garden`
  - `/community/operator-guide/reviewing-work`
  - `/community/operator-guide/creating-impact-certificates`
  - `/community/funder-guide`
  - `/community/funder-guide/donating-to-a-garden`
  - `/community/funder-guide/funding-a-garden`
  - `/community/funder-guide/withdraw-from-a-vault`
- [ ] Confirm every replaced image is legible at rendered docs size.
- [ ] Confirm no screenshot contains private data or unrelated overlays.
- [ ] Confirm generated HTML still has correct edit URL and previous/next labels.

## Lane Checklists

### UI (`claude/ui/docs-freshness-routine`)

- [x] Keep lane `n/a` for now.
- [ ] Reopen only if the docs components themselves need visual treatment changes.

### State / API (`codex/state-api/docs-freshness-routine`)

- [ ] Claim this lane only after UI readiness gate passes.
- [ ] Keep implementation docs/media-only.
- [ ] Replace or add only the approved images.
- [ ] Update only the MDX files whose images changed.
- [ ] Write `handoffs/codex-state-api.md` with capture commands, replaced files, and validation evidence.

### Contracts (`codex/contracts/docs-freshness-routine`)

- [x] Keep lane `n/a`.

### QA Pass 1 (`claude/qa-pass-1/docs-freshness-routine`)

- [ ] Review desktop/mobile screenshots in context.
- [ ] Check whether image content supports the revised user-facing copy.
- [ ] Confirm screenshots came from real app/admin/docs surfaces.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/docs-freshness-routine`)

- [ ] Re-run docs validation.
- [ ] Re-run generated-page scans for edit URL, pagination labels, sidebar labels, and stale labels.
- [ ] Confirm no unrelated dirty files were touched.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [ ] `bun run docs:audit`
- [ ] `bun run build:docs`
- [ ] `bun run lint:vocab`
- [ ] `node scripts/harness/plan-hub.mjs validate`
- [ ] Scoped visual/rendered docs screenshot review
