# Offer Once and Offer Over Time — Canonical Google Doc Reconciliation

**Date**: 2026-08-02
**Owner**: Codex
**Target**: [Green Goods Commitment Pooling](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit)
**Repo authority**: `../standing-commitments-spec.md`

This is an edit and verification checklist, not a prose mirror of the external document. It
supersedes the earlier same-day reconciliation that introduced an extra product noun.

## Required edits

- [x] Remove **Practice** as a defined product/domain noun.
- [x] Present **Offer once** and **Offer over time** as two ways of using an Offer.
- [x] State that `CommitmentSeries` is the internal durable identity for an Offer used over time
  in one pool; do not expose it as a required gardener-facing noun.
- [x] Explain that reusable saved Offer metadata is signed offchain/private by default, while only
  unsaved drafts may be device-local; do not model it as a separate product object.
- [x] Clarify that one available place is one pre-created Offer instance with real provider
  capacity already reserved; claiming accepts it rather than creating it.
- [x] Preserve exact Story across linked instances and cycles, never a score, rank, reliability
  rate, public personal history, or cross-pool reputation.
- [x] Preserve **Ask me again next cycle** as the default renewal posture; no automatic obligation
  creation.
- [x] Preserve **Rest**, **Resume**, and **Retire**, including the independence of existing
  commitments and history.
- [x] Keep succession as later consent-based work: co-holding, apprenticeship, handover,
  fork/adoption, and community-held stewardship.
- [x] Keep **pool participation history** separate from one ongoing Offer’s Story.
- [x] Remove the “I’m learning this” branch from the Commitment Pooling Offer flow.
- [x] Keep Planned/Built/Evidence-gated labels accurate. Do not describe the amendment as live.
- [x] Preserve existing settlement, exchange, confirmation-fallback, privacy, and no-fourth-garden
  corrections.

## Verification

- [x] Re-read every edited paragraph in the rendered document.
- [x] Search the document for stale product copy: `Practice`, `Add a practice`,
  `Saved practices`, `standing commitment`, `standing offer`, and `I’m learning this`.
- [x] Search the document for stale behavioral claims: `counts-only standing`, `claim creates`,
  `device only`, `automatic renewal`, `reliability score`, and unsupported `participant count`.
- [x] Confirm no fourth-garden identity appears.
- [x] Confirm the document reports Saved to Drive.
- [x] Reload the edited tabs and verify the corrections survived.
- [x] Record the verified edit time and any proof limit in `status.json` only after the re-read.

## Verified result

- Verified at `2026-08-03T01:15:28Z` in the authenticated Google Docs editor.
- Replaced defined-noun uses across all document tabs, then re-read the corrected Start Here and
  Deeper Reference sections.
- Post-reload all-tab searches returned zero for `Practice`, `standing commitment`,
  `standing offer`, and `I’m learning this`.
- Post-reload searches confirmed **Offer once**, **Offer over time**, `CommitmentSeries`,
  pre-created availability, Story, and **Ask me again next cycle**.
- Both named tabs retained their corrected URLs after reload and reported
  `Document status: Saved to Drive.`
- Proof limit: this was text and document-state verification, not a page-export or image-placement
  pass. Corrected image placement remains gated on PRD-789.

## Image follow-up

Claude Code owns the corrected canonical prototype and gallery visuals through PRD-789 and
`../handoffs/claude-offer-vocabulary-correction.md`. After both artifacts are rebuilt, fully
verified, republished, and re-fetched, Codex may place approved images in the Google Doc without
changing their semantics. Until then, keep the document prose-only rather than using the private
Fable exploration or the currently stale published assets as canonical imagery.
