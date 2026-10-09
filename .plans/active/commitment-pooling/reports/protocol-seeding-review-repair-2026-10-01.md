# PR 968 protocol seeding review repair

The seven attached review comments were actionable at live head
`595bf8fc7fe34267125fffed2429410c92584987`. The PR is open from
`greenpill-dev-guild/green-goods:fix/protocol-seeding-reference` into `develop`.
The existing tracked checkout matched that exact head before editing. This is
first-party prototype/reference work; production contracts and queue code are unchanged.

## Feedback and bounded closure

1. `4151812533`: Offer confirmation belongs to the claiming garden's eligible
   stewards. Every Offer review and lifecycle overlay now uses recipient authority.
2. `4151812539`: The other-garden read-only view has no confirmation-detail,
   claim-acceptance, or creation hotspot.
3. `4151812542`: Request and Offer both retain a missing-bound review. Switching
   direction preserves absent season/due date and disabled submission.
4. `4151812544`: Owner-only service creation is blocked. The reference preserves
   `CreationChecksLib.resolveCreator`'s root-garden membership requirement rather
   than changing the contract's authorization model.
5. `4151812549`: The validator requires the full review, queued, transient-failed,
   awaiting-index, indexed, terminal-failed, discarded, and saved-pool state set in
   both directions, plus both retry hotspots.
6. `4151812552`: Every unresolved overlay closes to a saved pool row that reopens
   the same direction and stage. Closing neither submits nor changes the job key.
7. `4151812555`: Transient failure keeps Retry. Terminal authority, pool, cycle,
   and creation-key errors show the contract cause and a local discard/draft-repair
   path. A submitted transaction is never discarded or resubmitted by this path.

The sweep covered W12 and its hotspot metadata, the `sb49` consumer, validator,
coverage projection, and adjacent W8/W10 confirmation references. Contract creation
checks and queue retry behavior were inspected as authority sources. Treasury
funding and other settlement owner rules are separate capabilities and were left
unchanged. The earlier dated implementation report remains immutable.

GitHub retrieval returned seven matching unresolved threads, one informational
submitted review, and two informational conversation comments. All seven attached
comments and replies were inspected and refreshed before publication. The connector
exposes no pagination-completion metadata; complete retrieval beyond the attached
scope remains unverified. GitHub CLI fallback failed certificate verification even
outside the network sandbox; certificate verification was not disabled.

## Verification

- RED: the new acceptance check run against an isolated snapshot of the original
  head failed because Offer recipient confirmation was absent.
- GREEN: `bun .plans/active/commitment-pooling/hifi/protocol-seeding.check.ts`
  passed positive authority/direction/recovery assertions and 46 negative mutation
  checks, including deleted lifecycle states and retries, missing reopen/discard
  controls, read-only writes, owner-only creation, and early publication.
- `bun .plans/active/commitment-pooling/prototypes-artifact.build.ts` passed:
  44 screens, 560 states, 786 hotspots, 56 journeys, 336 scenes, zero warnings.
- `git diff --check` passed.
- Push selector: sensitive plan evidence; format, lint, and immutable-plan-reports.
  The direct Plan Hub acceptance check and artifact build supply behavioral proof
  for these prototype files. Publication gate and current-head CI are recorded in
  GitHub after commit; this report does not claim future checks have passed.

Rendered proof: **Brave localhost static prototype**, 2026-10-01. Verified Offer
recipient confirmers; Request/Offer missing-bound switching with disabled submit;
read-only confirmation queue; blocked owner-only creation; failed Offer Back →
saved row → same failed Offer with Retry; and terminal conflict → discard → draft
→ Offer review. Screenshot is local at `/tmp/prd-812-preview/review-repair.png`.
This is prototype interaction proof, not live wallet, signing, or on-chain evidence.
