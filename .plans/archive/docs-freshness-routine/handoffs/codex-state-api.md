# Codex Handoff: Community Docs Media Refresh

**Feature**: `docs-freshness-routine`
**Lane**: `state_api`
**Stage**: `backlog`
**Created**: `2026-05-01`

## Start Condition

Do not start implementation until the active UI update work is stable enough for docs screenshots. The current copy remediation is complete; this lane is only for media refresh and MDX image wiring.

## Scope

Refresh the media for the scoped community docs path:

- Gardener: Join a Garden, Submit Work
- Operator: Create a Garden, Make an Assessment, Review and Approve Work, Mint Impact Certificate
- Funder: Donate to a Garden, Endow a Garden, Remove an Endowment

Do not change app UI, contracts, shared types, schemas, or indexer code.

## Required Inputs

- Stable client/admin UI build or environment for screenshot capture.
- Demo or fixture data for:
  - at least one submitted work record visible in Work Dashboard
  - at least one pending work submission in admin
  - create garden form with details/domain selection visible
  - Certify/Create Hypercert surface with meaningful context
  - optional funder Donate/Endow/Remove flows if approved

## Target Replacements

1. `docs/static/img/screenshots/client-work-dashboard.png`
   - Must show Work Dashboard/submission status, not just Home/garden list.

2. `docs/static/img/screenshots/admin-create-garden.png`
   - Must show actual Create Garden form state.
   - Must not include unrelated overlays or active-agent/browser toasts.

3. `docs/static/img/screenshots/admin-work-queue.png`
   - Must show pending work queue context.

4. `docs/static/img/screenshots/admin-work-detail.png`
   - Must show a selected submission and review context.

5. `docs/static/img/screenshots/admin-garden-impact.png`
   - Must show useful Certify/Create Hypercert context.

6. `docs/static/img/social/donating-to-a-garden.webp`
   - Add if distinct Donate visual is approved.
   - Must be 1440x900 WebP.
   - Must read as direct Cookie Jar support, not a vault/endowment.

## Likely MDX Files To Touch

- `docs/docs/community/gardener-guide/uploading-your-work.mdx`
- `docs/docs/community/operator-guide/creating-a-garden.mdx`
- `docs/docs/community/operator-guide/reviewing-work.mdx`
- `docs/docs/community/operator-guide/creating-impact-certificates.mdx`
- `docs/docs/community/funder-guide/index.mdx`
- `docs/docs/community/funder-guide/donating-to-a-garden.mdx`
- `docs/docs/community/funder-guide/funding-a-garden.mdx`
- `docs/docs/community/funder-guide/withdraw-from-a-vault.mdx`

Only touch a page if its media path or alt text actually changes.

## Implementation Checklist

1. Reconfirm current UI state and capture route names.
2. Inventory current image dimensions and references.
3. Capture approved screenshots from real client/admin surfaces.
4. Crop/frame screenshots so the named UI state is legible in docs.
5. Add or replace the distinct Donate social image if approved.
6. Update MDX image paths, frontmatter `image:`, and alt text as needed.
7. Render scoped docs pages at desktop and mobile sizes.
8. Run validation commands.
9. Update this handoff with changed files, commands, and any deferred media.
10. Update `status.json` history before handing off to QA.

## Validation Commands

Run at minimum:

```sh
bun run docs:audit
bun run build:docs
bun run lint:vocab
git diff --check -- docs/docs/community docs/static/img docs/sidebars.ts docs/docusaurus.config.ts docs/src/components/docs/OperatorPathNav.tsx
node scripts/harness/plan-hub.mjs validate
```

Also run a generated-page scan for:

- previous/next labels do not say `Overview`
- edit URLs do not contain `docs/docs/docs`
- Funder sidebar still says Donate / Endow / Remove
- old labels `Deposit Into a Vault` and `Withdraw From a Vault` do not return in the core path

## Deferral Rules

Defer, do not force, when:

- the UI route or label is still changing
- seeded data is not available
- a screenshot would expose private data
- the screenshot would be mostly empty state
- a funder screenshot would age out quickly because the Donate/Endow UI is still settling
