# Protocol seeding reference correction

PRD-812 is implemented locally and ready for review. The prototype now distinguishes
root-garden stewardship and module-owner authority from an ordinary garden steward's
read-only view. Both Request and Offer reviews show season and due date, and a review
with neither disables submission. Each direction has queued, failed/retry, awaiting-index,
and indexed-publication states. Retry preserves the direction and original queued creation.
The stopped ongoing-offer row shows an existing open commitment instead of implying
that stopping makes every previous offer unavailable.

The storyboard and coverage ledger follow these states. The prototype validator rejects
unauthorized or unbounded creation, direct publication on submission, a missing Offer
review, missing review lifecycle fields, premature publication chips, and Offer retries
that switch direction. No production runtime code, permissions, dependencies, or harness
configuration changed.

## Validation

This evidence applies to the uncommitted working tree on 2026-09-30, not to a committed
or published revision. Production-runtime behavior was inspected and existing tests run;
no signing or on-chain transaction was performed.

- `bun .plans/active/commitment-pooling/prototypes-artifact.build.ts`: passed;
  44 screens, 535 states, 750 hotspots, 56 journeys, 336 scenes, zero warnings.
- `bun /tmp/prd-812-proof.ts`: seven one-shot negative mutation checks passed,
  covering unauthorized creation, an unbounded review, direct publication, missing
  deadline, missing Offer direction, premature publication, and direction-changing retry.
  The lasting protections are in `hifi/validate.ts`; the mutation runner is temporary.
- `bun run --cwd packages/admin test src/__tests__/views/SeedCommitment.test.tsx src/__tests__/views/GardenPool.test.tsx`:
  2 files and 44 tests passed. These are supporting checks of the existing app, not
  proof that the updated prototype has been shipped into production.
- `node scripts/dev/ci-local.js --intent qa`: selected format/lint passed, but Biome
  matched zero files because `.plans` is excluded. The artifact build is the direct gate.
- `git diff --check`: passed.
- Rendered proof: authenticated Brave profile, static localhost prototype (no authenticated
  app behavior claimed), 2026-09-30. Request/Offer switching, Offer queued/retry direction
  preservation, missing-bound disabled submission, other-garden read-only authority,
  awaiting-index copy, and indexed-publication copy were observed. Review content scrolls
  while the action footer stays available. Screenshot: `/tmp/prd-812-preview/offer-review.png`.

The generated artifact is `/tmp/commitment-pooling-prototypes.html`; the local preview
is `http://127.0.0.1:4601/`. Publication and remote artifact replacement remain pending.
