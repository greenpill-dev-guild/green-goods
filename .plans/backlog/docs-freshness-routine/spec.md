# Docs Freshness Routine Spec

## Summary

This backlog hub now captures the concrete follow-up from the Green Goods community docs audit remediation. The copy pass for the six reviewed flows plus Gardener, Operator, and Funder overviews is complete. The remaining work is a targeted media refresh after the active UI updates land, focused on screenshots and illustrations that no longer line up cleanly with the revised docs.

This is a docs/media quality plan, not an app-code plan.

## Users

- Primary: gardeners, operators, and funders reading the public community docs.
- Secondary: Green Goods maintainers who need a reliable checklist for recapturing docs media after UI changes.
- Reviewers: Matt/Matty, Afo, and docs QA agents checking whether the docs translate to real users.

## Functional Requirements

1. Preserve the completed copy remediation for the scoped community docs.
2. Wait for the active UI updates before replacing UI screenshots.
3. Recapture stale admin screenshots for Create Garden, Review Work, and Mint Impact Certificate.
4. Recapture or replace the Submit Work dashboard screenshot so it shows the Work Dashboard state described by the page.
5. Add a distinct Donate to a Garden social/hero image instead of reusing the Endow image for both Donate and Endow.
6. Decide whether the Funder guide needs actual Donate / Endow / Remove screenshots after the UI lands.
7. Keep the sidebar narrowed to the core path: Join, Submit, Create, Assess, Review, Mint, Donate, Endow, Remove.
8. Prove image references, layout, edit links, pagination labels, and docs build behavior after replacement.

## Research Evidence

### Existing Pattern References

- `docs/static/img/social/` stores 1440x900 WebP social/hero images.
- `docs/static/img/screenshots/` stores PNG screenshots used inside MDX pages.
- `GuideOpener`, `RolePathCard`, `NextBestAction`, and `StepFlow` are the current docs components for flow pages.
- `docs/sidebars.ts` is the canonical listed navigation source.
- `docs/docusaurus.config.ts` owns the GitHub edit URL.

### Source Files Reviewed

- `docs/docs/community/gardener-guide/index.mdx`
- `docs/docs/community/gardener-guide/joining-a-garden.mdx`
- `docs/docs/community/gardener-guide/uploading-your-work.mdx`
- `docs/docs/community/operator-guide/index.mdx`
- `docs/docs/community/operator-guide/creating-a-garden.mdx`
- `docs/docs/community/operator-guide/making-an-assessment.mdx`
- `docs/docs/community/operator-guide/reviewing-work.mdx`
- `docs/docs/community/operator-guide/creating-impact-certificates.mdx`
- `docs/docs/community/funder-guide/index.mdx`
- `docs/docs/community/funder-guide/donating-to-a-garden.mdx`
- `docs/docs/community/funder-guide/funding-a-garden.mdx`
- `docs/docs/community/funder-guide/withdraw-from-a-vault.mdx`
- `docs/sidebars.ts`
- `docs/docusaurus.config.ts`
- `docs/src/components/docs/OperatorPathNav.tsx`
- `docs/static/img/social/*`
- `docs/static/img/screenshots/*`

### Evidence Confirmed

- All referenced scoped images currently exist.
- Social images are consistently 1440x900.
- Client Submit Work step screenshots are consistently phone-shaped and render cleanly.
- Built docs pages render on desktop and mobile without obvious image overlap.
- Generated HTML checks passed for pagination labels, edit URL behavior, funder labels, and core cross-links.
- `bun run build:docs` passed.
- `bun run lint:vocab` passed.
- `bun run docs:audit` passed with pre-existing warnings only in untouched builder/reference docs.

### Visual Findings To Carry Forward

1. `docs/static/img/screenshots/admin-create-garden.png`
   - Current state: dark empty admin create surface with a visible "Claude is active" toast.
   - Problem: does not show the create form fields/domains described in the page.
   - Desired replacement: focused desktop admin capture showing the Create Garden form with name, ENS, location, description, and domain selection visible.

2. `docs/static/img/screenshots/admin-work-queue.png`
   - Current state: dark, zoomed-out admin surface with an empty/placeholder-looking queue.
   - Problem: weak support for "filter to Pending" and "clear a queue".
   - Desired replacement: focused desktop admin capture with at least one pending work submission visible.

3. `docs/static/img/screenshots/admin-work-detail.png`
   - Current state: dark, zoomed-out admin detail surface with empty placeholder content.
   - Problem: weak support for the detailed review and approve/reject instructions.
   - Desired replacement: focused desktop admin capture showing a selected submission with action, evidence/media, details, notes, and review controls.

4. `docs/static/img/screenshots/admin-garden-impact.png`
   - Current state: dark admin impact surface with no hypercerts and no assessments.
   - Problem: weak support for the Certify/Create Hypercert flow described in the page.
   - Desired replacement: focused desktop admin capture showing Certify/Create Hypercert context, available assessment/certificate context, or the start of the Hypercert wizard/form.

5. `docs/static/img/screenshots/client-work-dashboard.png`
   - Current state: visually reads as Home/garden list, not Work Dashboard.
   - Problem: mismatch with "open the Work Dashboard" copy.
   - Desired replacement: phone-shaped capture showing Work Dashboard with a queued/pending/reviewed submission.

6. `docs/static/img/social/funding-a-garden.webp`
   - Current state: reused for Donate to a Garden and Endow a Garden.
   - Problem: the Funder Guide now exposes three distinct flows, but Donate and Endow look identical.
   - Desired replacement/addition: create `docs/static/img/social/donating-to-a-garden.webp` or another distinct Donate asset, then wire Donate to that image while Endow keeps the vault image.

## Human Judgment Points

- Confirm the active UI update is stable enough to capture screenshots.
- Decide whether funder pages should receive actual UI screenshots or stay illustration-led until the funding UI settles further.
- Approve the exact Donate visual metaphor: Cookie Jar/direct support should feel distinct from vault/endowment.
- Decide whether to replace only broken/stale images or also refresh the full illustration set for consistency.
- Confirm whether admin captures should use seeded demo data, real staging data, or a local deterministic fixture.

## Non-Functional Constraints

- Package boundaries: docs-only unless the user explicitly starts a UI/app pass.
- Performance: keep image sizes reasonable; social images should remain WebP and screenshots should avoid oversized PNGs when cropping can solve it.
- Security/privacy: screenshots must not expose private keys, real personal data, private funding amounts, sensitive wallet names, or unrelated browser/toast overlays.
- Offline/sync: only relevant to screenshots that show Submit Work/Work Dashboard state.
- Localization: no new app user-facing strings in this plan.
- Accessibility: every image used in MDX must have meaningful alt text that matches the current image.
- Source truth: do not invent a screenshot state that the current UI cannot produce.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Docs/media implementation | `state_api` | Existing routine uses this lane for docs tooling/assets. No runtime API work is intended. |
| Visual QA | `qa_pass_1` | Check screenshot relevance, cropping, desktop/mobile render, and user comprehension. |
| Regression QA | `qa_pass_2` | Re-run docs gates and generated-page scans after visual QA. |
| UI | `ui` | `n/a` unless the user explicitly asks for docs UI component changes. |
| Contracts | `contracts` | `n/a`. |

## Risks

- Risk: Screenshots are captured before UI labels/routes settle.
  - Mitigation: keep this hub in backlog until the UI work is declared ready for docs alignment.
- Risk: Admin screenshots stay too zoomed out to be useful.
  - Mitigation: crop or capture the specific panel/state named by the docs step.
- Risk: Docs start teaching UI details that are still changing.
  - Mitigation: only update screenshots after source/UI verification, and keep copy plain enough to survive minor label changes.
- Risk: Duplicate plan truth with broader docs freshness work.
  - Mitigation: keep this concrete media plan inside the existing `docs-freshness-routine` hub.
- Risk: Visual assets are fabricated rather than source-backed.
  - Mitigation: require capture commands or generated asset provenance in the implementation handoff.
