# Community Docs Revamp

**Slug**: `community-docs-revamp`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-09-23`
**Last Updated**: `2026-10-12`

## Problem

The Community tab of the docs site is what gardeners, stewards, evaluators, and funders read when
they start using Green Goods. The 2026-09-01 Build Sync review found it unclear and uneven. Pages
lean on protocol names, mix a pitch-deck voice with spec language, and put two distinct roles
(steward and evaluator) in one guide. The pages people need most when something is uncertain
(tracking your work, recovering work that will not send, the FAQ) are the thinnest. Several
Reference pages (the formal ontology, product history, the claims ledger) are internal material
that belongs on the Builders tab or nowhere.

Since that review, onboarding calls and QA triage have filed the same gaps as Linear issues: a
plain-language guide to submitting work and getting rewarded, install guidance a gardener can
follow alone, and a clearer sense of what "garden" means.

Commitment Pooling is a separate gap with its own owner. A steward pooling guide already exists
(`docs/docs/community/steward-guide/commitment-pooling.mdx`, delivered by the pooling track and
linked from the sidebar). Gardener-facing pooling guidance is still missing. That work belongs to
the Commitment Pooling hub: PRD-1156 for the 2.0.0 release-essential slice and PRD-727 for the
full scope. This hub does not write it.

## Desired Outcome

- A new gardener, steward, evaluator, or funder can find their path, finish a first real task,
  and recover when something goes wrong, without meeting protocol vocabulary.
- Every community page reads in one plain, warm voice that matches the product's own copy.
- Every task guide has the same shape: purpose and prerequisites, numbered actions with exact
  screen labels, an observable success signal, who acts next, recovery beside the problem, and one
  primary next step.
- Technical reference (the ontology, data-model detail) lives on Builders.
- The codebase stays the source of truth. Generated pages, starting with the glossary, project
  plain language the ontology already holds instead of copying technical definitions.
- The later pooling documentation has known places to land, so it adds pages and sections without
  restructuring this foundation.

What should not change: the generated-page discipline (digests and drift checks), the docs gates,
the funder guide's three flows, the structure of Submit Work, the existing steward pooling page and
its navigation, and any pooling capability flag or runtime availability.

## Scope Notes

- In scope (the non-pooling foundation, brought forward on 2026-10-12): Welcome, How It Works, and
  Why We Build; the gardener guides for installing, joining, submitting, tracking, and recovery;
  the steward guides and a separate evaluator guide; the existing funding flows; the FAQ and the
  glossary; the community sidebar, redirects, and every consumer of a moved path; a consistent page
  structure; and current screenshots with a named source.
- Deferred to the pooling hub: new pooling tutorials, diagrams, and screenshots; substantive
  expansion of the existing steward pooling guide; reconciling pooling claims and capability
  records; and the partner narrative in the Commitment Pooling Google Doc.
- Out of scope: the Builders track (merged in PR #795); product copy and renames, such as whether
  "garden" changes; translated docs; walkthrough-video production; and product code.

## Success Signal

Someone who has never used Green Goods goes from the Welcome page to a submitted, tracked piece of
work using only the docs, and a steward reviews that work the same way. Proof is a read-through
replayed against the product, with every step matching the screen, plus an unassisted reading by
people who have not seen the docs before (see `eval.md`).
