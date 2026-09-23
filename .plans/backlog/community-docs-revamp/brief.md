# Community Docs Revamp

**Slug**: `community-docs-revamp`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-09-23`

## Problem

The Community tab of the docs site is what gardeners, stewards, evaluators, and funders read when
they start using Green Goods. The 2026-09-01 Build Sync review found it unclear and uneven. Pages
lean on protocol names, mix a pitch-deck voice with spec language, and put two distinct roles
(steward and evaluator) in one guide. Nothing explains Commitment Pooling, which ships in 2.0.0.
The pages people need most when something is uncertain (tracking your work, recovering work that
will not send, the FAQ) are the thinnest. Several Reference pages (the formal ontology, product
history, the claims ledger) are internal material that belongs on the Builders tab or nowhere.

Since that review, onboarding calls and QA triage have filed the same gaps as Linear issues: a
plain-language guide to submitting work and getting rewarded, install guidance a gardener can
follow alone, and a clearer sense of what "garden" means.

## Desired Outcome

- A new gardener, steward, evaluator, or funder can find their path, finish a first real task,
  and recover when something goes wrong, without meeting protocol vocabulary.
- Every community page reads in one plain, warm voice that matches the product's own copy.
- Commitment Pooling is explained where community members meet it: the story in How It Works,
  and how-to pages for gardeners and stewards.
- Technical reference (the ontology, the claims ledger, data-model detail) lives on Builders.
- The codebase stays the source of truth. Generated pages, starting with the glossary, project
  plain language from the ontology instead of copying technical definitions.

What should not change: the generated-page discipline (digests and drift checks), the docs gates,
the funder guide's three flows, and the structure of Submit Work.

## Scope Notes

- In scope: every page under `docs/docs/community/`; the community Reference pages (FAQ,
  Glossary, Formal Ontology, Product History, and the Credits intro); the community sidebar and
  redirects; the glossary and claims generators; the docs audit's guide rules; and every consumer
  of these paths (agent context, skills, routines, footer).
- Out of scope: the Builders track in PR #795 (including its Design page, License page, and
  `llms.txt` generation); product copy and renames, such as whether "garden" changes; translated
  docs (see Decision Q9); walkthrough-video production; and the external Commitment Pooling
  narrative, which lives in its Google Doc.

## Success Signal

Someone who has never used Green Goods goes from the Welcome page to a submitted, tracked piece
of work using only the docs, and a steward reviews work and runs a pool season the same way.
Proof is a read-through replayed against the released product, with every step matching the
screen.
