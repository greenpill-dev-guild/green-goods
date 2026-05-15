<!-- Fixture context (human-only — the skill does NOT parse this block).

  These are example shapes the skill would normally derive at runtime from
  Drive / Linear / Sheet / PostHog. They exist here so a human reading the
  fixture can mentally simulate Phase 3 — they are NOT injected into the
  skill's flow. The skill in `--fixture` mode short-circuits the live probes
  (per SKILL.md Phase 0) and produces empty cross-ref data unless a future
  enhancement parses these examples.

  Example: a tracker-known dedupe scenario
    - existing Defects row D-014 fuzzy-matches title "camera preview clips on iPhone"
    - linked to PRD-501
    - on a real run this would skip the Defects row write in Phase 6

  Example: a PostHog match scenario
    - keywords "radio + fund + selected state" match a recent client error
    - error_hash 9c2e1b40, 6 sessions / 4 users (7d), first_seen 2026-05-19T14:18Z
    - first_seen anchor triggers the Vercel deploy-correlation path in Phase 3a-bis

  Example: a failed-test backlink scenario
    - Test row ADM-007 has Result=Fail, Defect Link empty
    - Phase 3d would surface it as [derived:test-fail], or fold it into a
      matching extracted item (here, item 2)
-->

# Product Sync - 2026_05_20 10_00 PDT - Notes by Gemini

> **Note**: synthetic fixture for testing `/qa-triage`. Date is in the future so it doesn't collide with real notes. The bugs and references below deliberately exercise: surface mapping, PostHog cross-reference, Vercel deploy correlation, QA-sheet Test ID matching, dedupe against existing Defects, derived-from-test-fail candidates, the Docs surface, and the cross-surface secondary-package note.

## Attendees

- Afo (host)
- Gui (engineering)
- Lena (operator pilot — Hilltop Garden)

## Summary

Reviewed the v1.1 release readiness. Walked through four open bugs (one PWA iOS, one admin, one cross-surface funding-flow, one docs typo), discussed one feature idea around action templates, and noted a member-display bug that touches both admin and indexer.

## Discussion

### PWA iOS — camera preview clips on iPhone 15

Gui demoed the work-submission flow on his iPhone 15. After capturing a photo, the preview thumbnail is cropped to a 1:1 square even though the captured image is 4:3. Reproduces every time on iOS Safari standalone PWA. Gui thinks this looks like the **PWA-IOS-005** case but specific to camera-captured images (the existing test only covers HEIC/JPG library imports). Suspected `object-fit` regression on the preview component tied to the May 12 `WorkSubmissionPreview` refactor.

> "The thumbnail's square but the photo is 4:3 — the gardener thinks they cropped something they didn't."
> — Gui

### Admin Dashboard — Hub work queue doesn't refresh after approval

Lena reported that after approving a piece of work in the Hub, the queue still shows it as `Pending` until she does a hard refresh. Test **ADM-007** in the QA workbook already covers the post-approval refresh path and is currently marked Fail with no linked Defect — should attach to whatever Linear record comes out of this triage.

> "I approve the work, the modal closes, but the row still says Pending until I cmd-R."
> — Lena

### Cross-surface — selected state missing on radio buttons in funding dialog

Afo noticed during a smoke test that the radio buttons in the Fund dialog (when selecting a contribution amount) don't show a visible selected state. Affects both the public website (`/fund`) and the installed PWA. Test **XPLAT-001** covers visual regression generally — this would be a clear example. Suspected cause: the Warm Earth token rollout may have dropped the `ring-2 ring-primary` utility on the radio input.

> "I'm clicking the radios and nothing changes visually. The form still works though."
> — Afo

### Docs — glossary typo on "Operator"

Lena noticed the [glossary](https://greengoods.docs/glossary) defines `Operator` as "the gardner responsible for…" — should be `gardener`. Minor, but the glossary is what new operators read on day one, so let's not let it sit. No telemetry — this is a docs-only fix.

> "Just spell-check; the glossary says 'gardner' on the Operator entry."
> — Lena

### Cross-surface — member display shows raw address instead of ENS in admin Members tab

Gui flagged that the admin Members tab on Hilltop is showing `0x71C7…91aF` for one member who clearly has an ENS handle that resolves on the client side. The render path lives in `package:admin` but the resolved-handle field comes from the indexer enrichment in `package:indexer` — so the actual fix may span both packages. Primary surface is admin; secondary is indexer.

> "Members tab is showing the raw address. ENS resolves fine on the public profile, so it's the admin display path or the indexer enrichment."
> — Gui

### Action templates — not a bug, idea

Afo floated letting operators duplicate a previous successful action as a template. Not in scope for v1.1 but worth a Customer Need.

## Action items

- [ ] File the camera preview bug (PWA iOS, related to PWA-IOS-005)
- [ ] File the Hub work-queue refresh bug (Admin Dashboard, ADM-007 backfill)
- [ ] File the radio-button selected-state bug (Cross Surface, related to XPLAT-001)
- [ ] File the glossary typo (Docs)
- [ ] File the member-display bug (Cross-surface admin + indexer)
- [ ] Capture the action-template duplication idea as an attach-Issue + Customer Need

## Next sync

Next Wednesday, 10am PDT. Topic: PWA Android device review.
