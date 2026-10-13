# Community Docs Revamp

**Slug**: `community-docs-revamp`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-09-23`
**Last Updated**: `2026-10-13`

## Problem

The Community tab of the docs site is what gardeners, stewards, evaluators, and funders read when
they start using Green Goods. The 2026-09-01 Build Sync review found it unclear and uneven. Pages
lean on protocol names, mix a pitch-deck voice with spec language, and put two distinct roles
(steward and evaluator) in one guide. The pages people need most when something is uncertain
(tracking your work, recovering work that will not send, the FAQ) are the thinnest. Several
Reference pages mix community reading aids with technical definitions and internal history.
Formal definitions belong with the ontology on Builders; Product History should explain versions
in terms of what changed for people using Green Goods.

Since that review, onboarding calls and QA triage have filed the same gaps as Linear issues: a
plain-language guide to submitting work and getting rewarded, install guidance a gardener can
follow alone, and a clearer sense of what "garden" means.

Commitment Pooling is a separate gap with its own owner. A steward pooling guide already exists
(`docs/docs/community/steward-guide/commitment-pooling.mdx`, delivered by the pooling track and
linked from the sidebar). Gardener-facing pooling guidance is still missing. That work belongs to
the Commitment Pooling hub: PRD-1156 for the 2.0.0 release-essential slice and PRD-727 for the
full scope. After reviewing the foundation, Afo authorized Commitment Pooling orientation on
Welcome, How It Works, and Why We Build. That limited overview work is now in this hub; new
pooling user guides remain later work. See `plan.todo.md` L21 for the revised boundary.

## Current iteration

The first foundation was implemented and validated before the 12 October QA review. The review
identified navigation, density, screenshot, and role-flow improvements. Afo then settled three
structural choices: formal definitions move into the generated Builders ontology; Commitment
Pooling becomes part of the three overview pages; Product History explains the different versions
from a user's perspective. These decisions and the accepted QA work are recorded in
`plan.todo.md` L20 to L24 and Phases 5 to 7. Their implementation has local proof, with the
phone-review capture initially pending. W2 now supplies that fixture capture; released-product
and unfamiliar-reader evidence remain pending. Afo's subsequent review confirms
that overview imagery and page endings still need a visual pass. Phase 8 records that work and
a named review sequence. The latest direction (L27) mixes reused editorial website images and matching new imagery as
needed with app/admin screenshots, real photographs for named subjects, and minimal diagrams.
Native page endings and the L27 overview image mix are implemented and locally verified.
The review packet covers all three overview pages; owner visual approval remains pending.
L28 continues this approach into the gardener guides, beginning with Install and Update and
Join a Garden as review batch C1. Keep task instructions primary and source distinctions visible.
L29 selects Submit Work and Track Your Work as C2. Preserve the four submission stages and keep
public media, sending the record, review decisions and rewards distinct. C2's packet remains available;
the earlier owner reviews remain pending. Each pair has its own applicable proof.
L30 selects Recover Unsent Work as the single-page C3 packet. Keep data-loss and public-media
cautions beside the relevant action, preserve safe recovery and distinguish source/layout proof
from authenticated product replay.
L31 corrects the app screenshot standard: use realistic task-matched photos and coherent sample
records. W1's first bounded sample is Submit Work Media/Review, with a real sourced photo and
clearly fictional count/time/notes. Broader photographic refresh stays in the review queue.
L32 completes the remaining D1/D2/E1/E2/F and W2 implementation locally. Required Chromium
qualification cannot launch in this host context, so publication and current-head CI stay blocked.
`handoffs/final-merge-preparation.md` is the current execution record; `handoffs/qa-revision.md`
retains the owner review queue. No final closeout or archive has occurred.

## Desired Outcome

- A new gardener, steward, evaluator, or funder can find their path, finish a first real task,
  and recover when something goes wrong, without meeting protocol vocabulary.
- Every community page reads in one plain, warm voice that matches the product's own copy.
- Every task guide has the same shape: purpose and prerequisites, numbered actions with exact
  screen labels, an observable success signal, who acts next, recovery beside the problem, and one
  primary next step.
- Technical reference lives with the generated ontology on Builders. Community definitions remain
  plain-language projections of the same authoritative sources, with old links preserved.
- The codebase stays the source of truth. Generated pages, starting with the glossary, project
  plain language the ontology already holds instead of copying technical definitions.
- The later pooling documentation has known places to land, so it adds pages and sections without
  restructuring this foundation.
- The three overview pages explain where Commitment Pooling fits without implying unverified
  availability or guaranteed payment. Product History distinguishes released versions from plans.
- The overview pages use purposeful visuals that show the breadth of community work, and the
  page-ending flow matches the Builders document style. The owner receives small review batches,
  with implementation, validation, and visual approval reported separately.

What should not change: the generated-page discipline (digests and drift checks), the docs gates,
the funder guide's three flows, the structure of Submit Work, the existing steward pooling page and
its navigation, and any pooling capability flag or runtime availability.

## Scope Notes

- In scope (the non-pooling foundation, brought forward on 2026-10-12): Welcome, How It Works, and
  Why We Build; the gardener guides for installing, joining, submitting, tracking, and recovery;
  the steward guides and a separate evaluator guide; the existing funding flows; the FAQ and the
  glossary; the community sidebar, redirects, and every consumer of a moved path; a consistent page
  structure; and current screenshots with a named source.
- In scope after QA: the page and navigation corrections in Phase 5; an ontology-owned formal
  reference and smaller community glossary with drift checks (Phase 6); concise Commitment
  Pooling orientation on the three overview pages; and a user-facing version history.
- Deferred to the pooling hub: new pooling tutorials, diagrams, and screenshots; substantive
  expansion of the existing steward pooling guide; reconciling pooling claims and capability
  records; and the partner narrative in the Commitment Pooling Google Doc.
- Out of scope: reopening the wider Builders track (merged in PR #795), beyond the approved
  ontology/glossary migration and its consumers; product copy and renames, such as whether
  "garden" changes; translated docs; walkthrough-video production; and product code.

## Success Signal

Someone who has never used Green Goods goes from the Welcome page to a submitted, tracked piece of
work using only the docs, and a steward reviews that work the same way. Proof is a read-through
replayed against the product, with every step matching the screen, plus an unassisted reading by
people who have not seen the docs before (see `eval.md`).
