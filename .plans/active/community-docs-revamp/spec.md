# Community Docs Revamp Spec

## Summary

Rebuild the Community tab of the docs site (`docs/docs/community/` plus the community Reference
pages) so that gardeners, stewards, evaluators, and funders can each find their path, finish a
first task, and recover from problems in one plain voice that matches the product. Move technical
reference to Builders, and let the glossary project the plain language the ontology already holds.

The plan comes from the 2026-09-01 Build Sync review and a section-by-section audit done the same
day (original audit, owner-only link:
https://claude.ai/code/artifact/2a9d634e-0eaf-4187-a85f-f29ea625da9b). It was reconciled against
`develop`, the Builders PR #795, and Linear on 2026-09-23, and again on 2026-10-12 against the
merged Builders track, the PR #896 review threads, and Afo's instruction to bring the non-pooling
foundation forward. This spec is the reconciled version; where it differs from the audit or from
an earlier revision of this file, this spec wins.

Commitment Pooling documentation is not in this hub's scope. See
[Pooling boundary and insertion points](#pooling-boundary-and-insertion-points).

## Users

- Primary: gardeners on phones in the field, many with patchy connectivity; garden stewards
  running review and funding; evaluators writing assessments.
- Secondary: funders; the team walking new gardens through onboarding; agents and routines that
  read these pages (see Consumers).

## What changed since the 2026-09-01 audit

### Done on `develop` before this work started

- Install and Update guide (`gardener-guide/installing-and-updating.mdx`, 2026-09-15), first in the
  gardener sidebar. It was written for the team to walk a user through; PRD-925 asks for guidance a
  gardener can follow alone.
- Upload all: Submit Work, Recovery and Sync, How It Works, and Why We Build say that queued work
  waits on the device and the gardener sends it with **Upload all** (2026-09-15 to 09-18).
- A steward pooling guide, `steward-guide/commitment-pooling.mdx` ("Run a Commitment Pool"), linked
  from the Steward sidebar category and the steward index (pooling track, last verified
  2026-10-09).
- The docs audit treats `steward-guide/` and `evaluator-guide/` as guides and no longer names
  `operator-guide/`; `docs/scripts/docs-audit.test.mjs` already covers a steward page with a
  missing `goal`. The fix this hub once planned is done.
- The glossary's canonical Work and Work Approval definitions say that approval is a separate
  record (the PRD-744 glossary item).

### Delivered by the Builders track (PR #795, merged 2026-10-12)

- Design Rationale moved to Builders, Architecture, Design; its community slug redirects.
- The MIT license has a Builders Reference page; Credits keeps a pointer.
- `llms.txt` and a Markdown twin of every page are generated at build time.
- Personas are projected to `builders/architecture/personas`, from `persona_journeys` and
  `human_concepts` in `packages/shared/src/ontology/green-goods-projections.json`.
- Builders has a Data Model & Ontology page and its own Reference category.
- The docs footer no longer links Product History.
- Its tone contract (no em dashes, second person, why before what) says builder pages adopt the
  community track's register, so this hub owns that register.

### Product changes the docs must follow

- Nothing uploads on its own. "Sync" framing is stale; gardeners tap **Upload all**.
- The work list screen is titled **Your Work** (`app.workDashboard.title` in
  `packages/shared/src/i18n/en.json`).
- The 2.0 candidate separates membership requests from steward access requests, rebuilds the
  steward cockpit, and adds passkey account continuity. Pages describe the product on the branch
  they ship with and name their evidence.

### Demand from Linear

| Issue | Ask | Where it lands |
|---|---|---|
| PRD-927 | Plain-language guide to submitting work, approval, and reward | How It Works and Track Your Work |
| PRD-925 | Android install and first-run guidance a gardener can follow alone | Install and Update |
| PRD-820 | Newcomers read "garden" as literal gardening | Welcome, How It Works, and the glossary's Garden entry; any rename stays a product call |
| PRD-639 | Public visibility of gardener photos | FAQ privacy answer states what the code does today; a product change stays with the issue |
| PRD-744 | Glossary prose says approval creates the Work attestation | Already corrected in the ontology; verified in the glossary step |
| PRD-727, PRD-1156 | Commitment Pooling documentation | Not this hub. See the pooling boundary |
| PRD-728 | Pooling walkthrough videos | Not this hub |
| MAR-6, MAR-19 | Docs diagrams; a create-account demo video (Marketing) | Candidate inputs to How It Works and Install and Update |

## Target information architecture

Community sidebar after the foundation:

```text
Welcome
How It Works
Why We Build
Gardener      Install and Update · Join a Garden · Submit Work · Track Your Work · Recovery
Steward       Create a Garden · Manage Actions · Make an Assessment (link to the Evaluator page) ·
              Review Work · Commitment Pool (existing, unchanged) · Mint Impact Certificate ·
              Funding and Governance
Evaluator     Evaluator Guide (the role) · Make an Assessment (moved from Steward)
Funder        Donate · Endow · Remove an Endowment
FAQ           top level, at /faq
Glossary      top level, at /glossary (unchanged URL)
Honest Claims kept where it is until Decision Q3
Reference     Product History (kept until Decision Q4) · Brand kit · Credits
```

Three page moves are approved (Locked L4 to L6): the FAQ's URL, the assessment page into the
Evaluator guide, and Formal Ontology into the Builders sidebar. Everything else keeps its file
path and slug. Brand kit stays in the sidebar; it is a live page and nothing decided to move it.

## Page-by-page scope

| Page | Action | Scope |
|---|---|---|
| Welcome | Rewrite | Keep the opening line and the "find your path" table. Drop protocol names and the role taxonomy. Say what a garden is: a community doing regenerative work together in a place, such as a solar team, a waste cooperative, a tree-planting group, or a school program (PRD-820). Point the evaluator row at the Evaluator guide. About half the current length. |
| How It Works | Rebuild | The loop told as one story: Garden, Action, Work, Review, Assessment, Impact Certificate, Funding. A short "built for the field" section (install, sign-in, offline, Upload all, languages). What an approval is and is not. Carries PRD-927's core. |
| Why We Build | Trim | Keep the community stories and Eight Forms of Capital. Cut unsourced numbers and deck phrasing; compress the SDG table. |
| Gardener index | Rewrite | Benefits first, then the path in order. |
| Install and Update | Revise | Make it self-serve for a gardener alone on Android (PRD-925). Keep "What we cannot see". |
| Join a Garden | Rewrite | Passkey path first. Give the "ask your steward to add you" path equal weight. Move wallet and fee detail into one closing box. |
| Submit Work | Keep as the model | Voice pass and current labels. Structure preserved. |
| Track Your Work | Rebuild | Built on the Your Work screen. Name every status and what it means. Treat rejection feedback as the fix list. Say honestly what approval does and does not bring. Record verification becomes an optional closing section. |
| Recovery | Rebuild, retitle | On the Upload all model: what is saved where, how to tell your work is safe, what to do when it will not send, and the one rule (never recreate work that is still waiting). File path and slug unchanged. |
| Steward index | Rewrite | Steward-only landing, benefits first, with how to get access. |
| Create a Garden, Manage Actions | Voice pass | Plain language, current labels, page contract. |
| Review Work | Revise | Add a judgment frame: what good evidence looks like, choosing a confidence level, writing a rejection that helps. |
| Funding and Governance | Rebuild | Real on-screen labels and one plain decision table. Say what is and is not offered. |
| Mint Impact Certificate | Voice pass | Honest availability wording while certificate activation stays partial. |
| Evaluator guide | New | The role (what an evaluator does and does not do, how to get access), plus Make an Assessment (moved). |
| Funder guide | Voice pass | Keep the three flows. Say what Green Goods does and does not promise about money. |
| FAQ | Rebuild and promote | Top level at `/faq`, with a redirect. Group by the reader's worry, in their own words, answer first. Builder questions become one pointer to Builders. |
| Glossary | Regenerate | Plain entries first for the terms community readers meet, formal definitions after (see Generators). |
| Formal Ontology | Move | To the Builders sidebar. File path and slug unchanged, so the ontology gates do not churn. |
| Honest Claims | Keep, pending Q3 | Content and navigation retained. |
| Product History | Keep, pending Q4 | Content, its eight redirects, and the Builders link to it retained. |
| Credits | Voice pass on the intro | Legal and license text untouched. |
| Commitment Pool (steward) | Preserve | No substantive change. Owned by the pooling hub. |
| Commitments (gardener) | Not this hub | Planned by PRD-1156 as `gardener-guide/commitments.mdx`. |

## Page contract

Task pages follow Submit Work's shape:

1. Title: a verb phrase naming one job.
2. Purpose: one or two sentences in the reader's words.
3. Before you start: a short list, including physical needs such as being at the garden.
4. Steps: numbered actions written as Markdown lists, using the exact on-screen labels in bold.
5. Reassurance inside steps where people hesitate; firm wording only for evidence integrity (your
   own photos, real dates, real places).
6. How you know it worked: what the screen shows.
7. What happens next: who acts, and what you will see when they do.
8. If something goes wrong: each problem paired with its fix, then one support path.
9. Next step: exactly one primary link.

Each page must also make sense when opened directly from a message or a search result.

Concept pages (Welcome, How It Works) use a one-line definition, an everyday comparison, a short
story, and a plain "what it is not".

Screenshots support the text; they never carry a step alone. Each has alt text and a caption that
names its source and capture date (for example "Storybook fixture, 12 October 2026"), and comes
from a fixture, demo, or public page, never a live garden's members or photos. The deployed
Storybook does not expose the commit it was built from, so a caption cannot name a build; add the
commit when a source does expose one.

## Voice and tone contract

Shared with the Builders track:

- Second person, active voice, plain words, roughly an 8th-grade reading level.
- Why before what; condition before instruction; one idea per sentence.
- The product's own labels and copy are the vocabulary. No protocol names on community pages:
  EAS, Hats, Octant, Gardens V2, IPFS, CIDS, ERC standards, and chain names stay out, except in
  the one "using your own wallet" box a page may carry. `eval.md` holds the maintained search list.
- No em dashes. Sentence-case section headings. No marketing superlatives.
- Permission-giving where people hesitate ("It's OK to...", "You can always..."); strict where
  the integrity of the record is at stake.
- Money and privacy statements describe what the contracts and code do. They never repeat a
  guarantee from interface copy.

## What the reference docs teach

From the 2026-09-01 study of Hypercerts, Karma GAP, EAS, GainForest, Silvi, and iNaturalist:

1. Navigation is the audience split, with a benefits-first landing per role (Karma GAP, GainForest).
2. Page shape changes by role: procedures for people doing the work, judgment frames for
   reviewers and funders (GainForest).
3. One job per page (Karma GAP, Hypercerts).
4. One hierarchy told once and assumed everywhere (Karma GAP).
5. Hard concepts in layers plus a plain negative definition (EAS, Hypercerts).
6. The chain appears once as a confirmation step, or not at all (Karma GAP, GainForest).
7. Every review state is named, with checkable meaning (iNaturalist). Silvi's unexplained review
   is the pattern to avoid.
8. The FAQ triages worries in the reader's own words, answer first (iNaturalist, EAS).

A gap worth owning: none of the three field apps studied has a real offline page. Green Goods is
offline-first, so the Recovery page can be the best in its category.

## Generators and scripts

- **Glossary.** `packages/shared/src/ontology/green-goods-projections.json` already carries a
  plain-language record for every entity and persona: `human_concepts`, with `plain_name`,
  `why_it_matters`, `example`, `aliases`, and `not_confused_with`. `scripts/quality/check-ontology.mjs`
  requires one per term. The glossary reuses it. No `plain_definition` field or second schema is
  added.
- **Which terms lead the page.** The ontology's `surfaces` field says where a term may appear in
  product copy. It is a vocabulary rule, not a list of reader groups, so it cannot select
  community terms. `renderGlossary` (`scripts/docs/renderers.mjs`) instead holds an explicit,
  ordered list of term references for an "Everyday terms" section, each with the guide it links to.
  The renderer fails on a reference without a `human_concepts` record and on a heading that is
  neither the term's display name nor one of its declared aliases.
- **Anchors.** The app deep-links ten glossary anchors from
  `packages/client/src/views/Public/Glossary.tsx` (`#action`, `#assessment`, `#cookie-jar`,
  `#evaluator`, `#garden`, `#gardener`, `#impact-certificate`, `#steward`, `#vault`, `#work`).
  Every existing heading anchor and alias anchor stays, and those ten land on plain entries.
- **Locks.** The Domain Entities and Personas tables stay on the page with their canonical
  definitions and allowed surfaces, so the ontology gate's definition lock (G5) is unchanged and
  the Personas page's pointer to the allowed-surfaces column stays true. The term-heading guard
  (G6) reads the "Everyday terms" section as well as "Term Reference", so an undeclared heading
  fails in either. Tests: renderer behavior in `scripts/docs/generate.test.mjs`; parser and guard
  behavior in `scripts/quality/check-ontology.test.mjs`.
- **Claims.** `renderMarketingClaimsMdx` lives in `scripts/quality/ontology-render.mjs`. If
  Decision Q3 keeps the page, human headings replace the raw stage keys, with the heading assertion
  in `scripts/quality/check-ontology.test.mjs`, the suite that owns that renderer. Until Q3 is
  decided the page is left as it is.
- **Docs audit.** Nothing to do (see "Done on `develop`"). Encoding the page contract as audit
  checks stays optional (step 3.3).

## Consumers and dependencies

| Consumer | Reads | Handling |
|---|---|---|
| `.claude/context/admin.md` | The assessment page's file path | Repoint with the move |
| `.claude/context/` client, agent, product, values, shared, ontology | Community and Reference file paths that do not move | Verify; no change expected |
| `docs/routines/growth-pulse.md` | How It Works (its five-stage loop) and the claims page, read at runtime, with a fallback | Keep a five-stage loop readable on How It Works, and update the routine's stage list in the same change if the stages are renamed |
| `packages/shared/src/ontology/green-goods-projections.json` `persona_journeys[].guide` | The assessment page's route, printed on the Personas page | Repoint, then regenerate |
| `docs/src/data/steward-path.json` | The assessment page's route | Repoint |
| `docs/docs/builders/` hand-written pages | Links to moved community routes | Repoint |
| `scripts/data/qa-test-catalog.json` | DOCS-020 names the assessment page by path | Repoint the precondition, then regenerate the Test Cases page |
| `scripts/quality/check-ontology.mjs`, `scripts/docs/generate.mjs`, `scripts/data/validation-policy.json`, `.github/workflows/ontology.yml`, and their tests | Generated page file paths | Generated files do not move |
| `docs/docusaurus.config.ts` | Redirects, navbar, footer | Redirect every moved slug; retarget redirects that pointed at one; update the footer's FAQ link |
| Product code (`packages/client`, `packages/admin`) | Docs URLs in links | Not edited. One client link (`PublicWhoTendsAGarden.tsx`) points at the old assessment URL and is served by the new redirect; repointing it is a follow-up outside this hub |
| Markdown twins and `llms.txt` | Page sources | Steps are plain Markdown so twins carry them |
| Docs deployment (Vercel) | The docs project, production branch `main` | Publication is a separate, authorized step |

## Truth fixes

| # | Fix | Owner | State at reconciliation |
|---|---|---|---|
| 1 | How It Works says Spanish and Portuguese cover "documentation"; the docs site is English-only (`docs/docusaurus.config.ts`, `locales: ['en']`) | `ui` | Open |
| 2 | Review Work says "Work Dashboard"; the screen is titled "Your Work" | `ui` | Open |
| 3 | Why We Build claims "20+ active garden communities" and "less than 60 seconds"; How It Works says stewards spend "2-4 hours per week". None is sourced | `ui` | Open |
| 4 | Welcome lists six roles, including Owner; the ontology defines five personas | `ui` | Open |
| 5 | The funder guide says the vault "is designed to preserve your principal"; the contracts make shares redeemable and do not guarantee principal | `ui` | Open |
| 6 | Em dashes in hand-written community and Reference prose | `ui` | Open |
| 7 | The claims ledger's pooling entry must match what is available after the release | pooling hub (PRD-1156) | Not this hub |
| 8 | The docs audit skipped steward pages | none | Already fixed on `develop` |

## Pooling boundary and insertion points

Decided by Afo on 2026-10-12 (Locked L13):

- PRD-727 keeps the full pooling documentation scope, community and builder. It is not narrowed to
  builder documentation and is not closed into PR #795.
- PRD-1156 holds the 2.0.0 release-essential slice. Its plan is the pooling hub's
  `handoffs/release-essential-docs.md`, which on 2026-10-12 existed only in the checkout where
  that work is being prepared, not on `develop`.
- This hub writes no pooling tutorial, diagram, or screenshot, does not expand the existing steward
  pooling guide, publishes no placeholder page, makes no availability claim about pooling, and
  changes no capability record.

Where the later work connects, each recorded in `handoffs/pooling-insertion-points.md`:

| Later work | Where it lands |
|---|---|
| Gardener guide "Make and keep a promise" | New `docs/docs/community/gardener-guide/commitments.mdx`; sidebar item after Track Your Work and before Recovery; one line in the gardener index path |
| Steward setup and run sequence | The existing `steward-guide/commitment-pooling.mdx`, same slug and sidebar label |
| Linking work to a commitment; linked, approved, counted | New sections in Submit Work, Track Your Work, and Recovery |
| Where pooling fits | One orientation paragraph each in Welcome and How It Works |
| Support and payment | A row in Funding and Governance's decision table, a note in the funder index, and FAQ answers under a new group |
| Everyday glossary entries for Commitment and Commitment Pool | Two references added to the glossary renderer's everyday list, once their availability wording is reconciled |
| Claims and capability records | `green-goods-projections.json`, through its generators |
| Illustrations | `docs/static/img/community/commitment-pooling/` |

## Human Judgment Points

`plan.todo.md` § Decision Log lists what is locked, what the executor resolved, and what is still
open. Open and blocking nothing in the foundation: Q3 (Honest Claims), Q4 (Product History), the
translation follow-on in Q9, and Q10 (the Linear footprint, which needs an authorized external
write).

## Non-Functional Constraints

- Package boundaries: docs site, docs scripts, and the ontology projection data only. No product
  code.
- Localization: the docs site is English-only. This hub removes the claim that it is translated.
- Accessibility: every screenshot has alt text and a caption, and no instruction lives only inside
  an image.
- Privacy: the docs are public. Screenshots come from fixtures, demo mode, or public pages, with no
  real addresses, names, or photos of people from a live garden.
- Freshness: each screenshot caption names its source and capture date.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Community pages, sidebar, redirects, consumer pointers, screenshots | `ui` | Docs content; TDD not applicable; proof is the docs gates, a rendered check, and the replayed read-through |
| Glossary renderer, the term-heading guard, and (if Q3 keeps it) the claims renderer | `state_api` | Script changes with RED/GREEN tests in the owning suites |
| Contracts | `contracts` | n/a |
| Content replayed against the released product | `qa_pass_1` | Every step walked on the real screens |
| Links, redirects, consumers, and gates | `qa_pass_2` | Regression sweep |

## Risks

- A guide step that does not match the screen. Mitigation: every label is checked against
  `en.json` and the owning component before it is written, and the evidence is recorded in the
  `ui` handoff; `qa_pass_1` replays it on the released product.
- Screenshots go stale fast. Mitigation: few, decisive screenshots, each naming its source and
  build.
- Scope creep into product renames or pooling. Mitigation: the docs frame terms; renames stay in
  their issues; the pooling boundary above is explicit.
- Consumers break quietly (agents, routines, QA cases). Mitigation: repoint in the same change,
  and search for every old path.
- Two tracks editing the same pages. Mitigation: the insertion points above, and the pooling slice
  builds on this foundation once it merges.
