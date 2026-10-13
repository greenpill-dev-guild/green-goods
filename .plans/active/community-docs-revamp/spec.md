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
foundation forward. The post-QA revision on 12 October adds L20 to L24: formal definitions with
the generated ontology, Commitment Pooling on the three overview pages, user-facing version
history, and the accepted reading and layout corrections. Where this spec differs from the
audit or an earlier revision, the current decisions win.

Commitment Pooling orientation on Welcome, How It Works, and Why We Build is now in scope.
New pooling user guides remain later work. See
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

- Adding work to the garden's record requires the gardener's **Upload all** confirmation.
  Background preparation can upload media to public storage before that confirmation; do not
  describe all uploading as manual or imply that unsent work is necessarily private.
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
| PRD-727, PRD-1156 | Commitment Pooling documentation | This hub handles the three-page orientation under L21; the full scope and release-essential slice keep their existing owners |
| PRD-728 | Pooling walkthrough videos | Not this hub |
| MAR-6, MAR-19 | Docs diagrams; a create-account demo video (Marketing) | Candidate inputs to How It Works and Install and Update |

## Target information architecture

Community information architecture for the revision (exact task ordering is verified in 5.8):

```text
Welcome
How It Works
Why We Build
Gardener      Install and Update · Join a Garden · Submit Work · Track Your Work · Recovery
Steward       Manage Members · Make an Assessment (link to the Evaluator page) ·
              Review Work · Commitment Pool (existing, unchanged) · Mint Impact Certificate ·
              Funding and Governance
Evaluator     Evaluator Guide (the role) · Make an Assessment (moved from Steward)
Funder        Donate · Endow · Remove an Endowment
FAQ           top level, at /faq
Glossary      everyday terms, at /glossary; compact links preserve prior technical anchors
Honest Claims kept where it is until Decision Q3
Reference     Product History (user-facing versions, L22) · Brand kit · Credits
Builders      Formal Ontology owns canonical definitions and technical reference (L20)
```

The three foundation moves (L4 to L6) are complete. L20 changes where formal content is rendered,
using the existing ontology page at `/reference/ontology` under Builders; it does not require a new
reference page or URL. Keep glossary, history, and existing guide URLs stable. Create a Garden and
Manage Actions remain discoverable as restricted tasks, not a required sequence for ordinary
stewards; 5.8 resolves their placement without orphaning content. Brand kit and the existing
Commitment Pool guide retain navigation.

## Page-by-page scope

| Page | Action | Scope |
|---|---|---|
| Welcome | Revise after QA | One compact role chooser with descriptive destinations; remove duplicated role selection and competing main headings. Clarify what a Green Goods garden is, include supported agriculture examples, and explain pooling's place briefly (L21). Keep all five role destinations. |
| How It Works | Revise after QA | Keep the coherent loop and number the start-to-finish example. Explain how Commitment Pooling connects commitments, evidence, review, and conditional funding, grounded in the current ontology and implementation. Distinguish approval from eligibility and payment. Keep the routine consumer consistent. |
| Why We Build | Revise after QA | Retain the funder-verification problem, community stories, and Eight Forms of Capital; include agriculture and concise linked SDG context. Explain the purpose of pooling without unverified outcome, yield, or availability claims. |
| Gardener index | Rewrite | Benefits first, then the path in order. |
| Install and Update | Revise | Explain passkeys versus a wallet at the choice, keep phone-specific instructions, and replace dense update/troubleshooting tables with concise local guidance. Use this as the revised task-page example. |
| Join a Garden | Rewrite | Passkey path first. Give the "ask your steward to add you" path equal weight. Move wallet and fee detail into one closing box. |
| Submit Work | Keep as the model | Voice pass and current labels. Structure preserved. |
| Track Your Work | Rebuild | Built on the Your Work screen. Name every status and what it means. Treat rejection feedback as the fix list. Say honestly what approval does and does not bring. Record verification becomes an optional closing section. |
| Recovery | Rebuild, retitle | On the Upload all model: what is saved where, how to tell your work is safe, what to do when it will not send, and the one rule (never recreate work that is still waiting). File path and slug unchanged. |
| Steward index | Revise | Say steward dashboard, explain how to get access, distinguish restricted tasks, simplify the path design, and put role-permission detail where it helps a task. Do not imply every steward can create gardens or maintain actions. |
| Create a Garden, Manage Actions | Voice pass | Plain language, current labels, page contract. |
| Review Work | Revise | Separate phone/PWA and desktop dashboard instructions and captures; share the judgment frame for evidence, confidence, and useful rejection reasons. |
| Funding and Governance | Rebuild | Real on-screen labels and one plain decision table. Say what is and is not offered. |
| Mint Impact Certificate | Voice pass | Honest availability wording while certificate activation stays partial. |
| Evaluator guide | New | The role (what an evaluator does and does not do, how to get access), plus Make an Assessment (moved). |
| Funder guide | Voice pass | Keep the three flows. Say what Green Goods does and does not promise about money. |
| FAQ | Revise | Semantic question disclosures grouped by worry. Preserve question anchors, direct links, search, keyboard access, and Markdown answers. Keep critical warnings in the task guides too. |
| Glossary | Regenerate | Selected plain entries from human concepts, plus compact compatibility links for former technical sections/terms. Formal definitions move to the ontology (L20). |
| Formal Ontology | Extend existing renderer | The existing generated Builders page owns formal definitions and technical term reference. Migrate definition and term checks with the content; do not weaken them to permit the move. |
| Honest Claims | Keep, pending Q3 | Content and navigation retained. |
| Product History | Rewrite by version | User-visible changes, practical consequences, and sourced release status. Preserve all old links; separate historical specifications and research from shipped functionality (L22). |
| Brand kit | Verify consistency | Check symbol and downloads against the current manifest and confirmed brand color; keep UI accents distinct from artwork colors and preserve download URLs. No new palette. |
| Credits | Verify and simplify | Check current tooling, links, and acknowledgments against evidence. Do not invent names or sponsors; preserve legal meaning. |
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

This is a completeness contract, not a requirement for equally long pages or repeated tables.
Group long procedures into meaningful stages. Keep the relevant problem and recovery together.
Use tables for comparisons, not as the default container for every instruction. Add compact
callouts only when they help a decision, warning, or optional deeper explanation. Keep critical
privacy, money, and irreversible-action information visible before the relevant action.

Concept pages (Welcome, How It Works, Why We Build) remain concise explanations. Pooling is woven
into their existing story under L21; the pages do not become substitute user guides.

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

### Resources adopted for the QA revision

- [Write the Docs, beginner's guide](https://www.writethedocs.org/guide/writing/beginners-guide-to-docs/):
  identify the reader and task, explain purpose, then provide use and help paths. Do not let the FAQ
  substitute for maintained task guides. Apply its developer-oriented examples selectively.
- [Google documentation style](https://developers.google.com/style) and
  [highlights](https://developers.google.com/style/highlights): direct, respectful language,
  conditions before actions, numbered procedures, exact UI labels, and descriptive links. The
  repository's style and product authorities still govern.
- Steve Krug, *Don't Make Me Think, Revisited*: scanning, visual hierarchy, and obvious choices
  inform the role chooser, headings, and next steps.
- Julie Dirksen, *Design for How People Learn*, supplied memory-chapter excerpt: chunk procedures
  into meaningful stages and use nearby instructions as a job aid rather than relying on recall.
- Robin Williams, *The Non-Designer's Design Book*: alignment, proximity, repetition, and contrast
  inform the task-page and navigation patterns.

These are design inputs, not product authority. Do not commit the private QA transcript, book
files, or reproduced book illustrations. The learning-book input is an excerpt, not the full book.

## Visual pass

Afo's latest review asks for images on Welcome, a stronger human opening on How It Works before
the Mermaid loop, supporting visuals on Why We Build, and page endings that look consistent with
Builders. Afo selected real photography with current product screenshots for the first Phase 8 batch.
Earlier page/checkpoint completion describes content and local proof, not visual approval.

**Selected direction (L27):** use the editorial website's existing images as the visual baseline.
Reuse appropriate assets; create matching illustrative scenes for real gaps. Mix these with
current app/admin screenshots. Use licensed or otherwise approved real photographs when naming
an actual community, person, place, or object. Generated or unidentified editorial imagery must
not become evidence of a real project. Record its illustrative use without inventing provenance.
Across the set, include solar, agroforestry, education, and waste work. Keep source ownership,
build/capture identity, rights, and adaptation notes in `artifacts/editorial-image-sources.md`.

Keep the Docusaurus document shell, comfortable article width, calm typography, and role chooser.
Use a compact opening image, not a full-screen marketing hero. Give each image a specific job:
Welcome introduces the community; How It Works shows a person recording and another reviewing;
Why We Build connects visible work to community value. Keep meaningful labels and explanations
in HTML, rather than baked into images. All essential content must work without the pictures.

For How It Works, editorial imagery and the human example come first. A minimal diagram later
explains how the phone app, steward review, and public record connect. Preserve the five-stage
loop in the prose, its anchors, and funding qualifications. This is not permission to add
a pooling diagram, tutorial, screenshot, or payment promise. L21's overview explanation stays.

**Page endings:** the initial review found both the bespoke NextBestAction section and a
Docusaurus Next card for How It Works. Batch A resolved this with native pagination inside
the authored next-step section. It preserves one primary destination, previous-page access,
and descriptive optional links. Builders Getting Started retains its default paginator;
Entity Matrix and Economics Explorer were checked as shared-component consumers. This behavior
is unchanged in L27's image batch; no Builders content-track redesign is required.

**Review sequence:** native page endings were delivered in Batch A. Afo's L27 response accepts
the revised image mix for Welcome and the How It Works / Why We Build pair. These three pages
are implemented and locally verified, with owner approval pending. They are the next review
packet. Remaining guides are reviewed in the
page/pair queue in `handoffs/qa-revision.md`. That queue does not authorize speculative rewrites.
L28 selects Install and Update and Join a Garden as C1, now implemented with local proof and
awaiting owner review. On task pages,
prerequisites precede compact editorial context; readable screenshots sit beside their complete
text steps. Retain platform, account, storage, joining-path and fee qualifications.
Each packet names exact pages, changed sections, review questions, and known gaps. Track three
separate states: implemented, mechanically verified, and visually reviewed by the owner.

L29 selects C2: Submit Work and Track Your Work. Preserve Start, Media, Details and Review,
their numbered actions and existing anchors. Reuse the compact guide-figure style and current
faithful captures; do not substitute a steward Completed list for the gardener's decision view.
Clarify that queued media may be prepared publicly before the signed record is sent. Keep
Checking uncertain, In review actionable by a steward, and approval separate from a jar claim.
No new pooling image or guide procedure is part of this pair. Unknown capture dates/builds stay
explicitly unrecorded, with the actual inspection date recorded separately.

L30 selects C3: Recover Unsent Work. Preserve its three-step task and published headings.
Reuse compact field-preparation context and Pending; a faithful confirmation capture supports
Discard and Keep. Put irreversible local-data loss and persistent public-file consequences
before discarding. Do not promise that storage or app removal preserves unsent work, or that
another phone/public files can restore a saved item. Preparation is distinct from Upload all
and Upload now. Partial success and Checking must not encourage a duplicate. One next: Track.
No runtime, generator, pooling or new recovery/export capability is part of this page.

L31 adds screenshot realism: use task-matched photos and plausible, coherent action data.
Do not put generic category art where work evidence belongs, retouch pixels into app captures,
or relabel stock/sample media as a real Green Goods submission. First W1 sample is Media/Review;
use a sourced real photo, fictional count/time/notes, actual UI and a normal scrolled viewport.
Record build/source hashes and rights; keep the instruction to submit one's own work photos.
Keep default test cases and unrelated screenshot sets intact until their bounded refresh.

Use responsive image dimensions, useful alt text and captions, modest file sizes, and loading
appropriate to placement. Record asset source and rights; generated illustrations name their
illustrative status. Product captures also name build, date, viewport, and session when known.
Check 390px phone and 1440px desktop views in light and dark mode, plus keyboard navigation and
text-only completeness. No new dependency, runtime behavior, ontology definition, or capability
change is part of this pass.

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
- **Formal reference owner (L20).** Extend `renderOntologyMdx` in
  `scripts/quality/ontology-render.mjs`, which already renders entity and persona definitions,
  surfaces, capabilities, and supporting terms to `docs/docs/reference/ontology.generated.mdx`.
  Do not introduce another formal glossary or duplicate those tables in Community. Meaning stays
  in `green-goods-ontology.json`; human concepts and availability stay in
  `green-goods-projections.json`. The two pages are generated views of those sources.
- **Compatibility.** Inventory every public glossary heading and alias before migration. The ten
  app anchors still land on everyday entries. Other old anchors, including formal section and
  technical-term anchors, land on compact generated links to the corresponding ontology section
  or term. Avoid empty anchors with no useful destination. Preserve the source-controlled legacy
  alias mapping and prove destinations exist; do not rely on server redirects to receive fragments.
- **Locks move with their content.** G5 currently parses glossary tables. Change its owner to the
  formal ontology projection and retain set/count, definition, surfaces, persona, and capital-order
  checks. G6 must resolve terms where they are now defined, including Builders supporting terms;
  keep the community selection explicit. G7 still checks all ten app links. A missing formal
  section, undeclared term, stale definition, orphaned alias, or dead destination must fail.
- **Drift proof.** Both generators retain deterministic output and declared source digests. Test
  that changing a canonical definition changes only the appropriate formal output, changing a
  human concept changes its selected community entry, and adding/renaming/removing a term cannot
  silently remove a public link. Run check mode against stale/tampered output and prove it fails,
  then regenerate and prove it passes. No baseline addition or skipped guard to make the move pass.
- **Consumers and guidance.** Update `renderPersonas` and its generated allowed-surfaces link,
  `.claude/context/ontology.md` (currently says the glossary wins and holds the tables), and other
  discovered references to the formal glossary sections. Keep source ownership explicit in
  `docs/README.md`. Audit source manifests for both generator entrypoints rather than assuming
  they already include the moved render logic. Tests belong in `scripts/docs/generate.test.mjs`
  for community projection and `scripts/quality/check-ontology.test.mjs` for ontology rendering
  and guards. Do not hand-edit generated MDX.
- **Limit of automation.** Deterministic projections and guards catch structural/output drift.
  They cannot prove that a separately authored overview still captures every changed business
  rule. Keep overview definitions short, link to generated terms, declare implementation sources,
  and require a focused overview review when pooling semantics or availability changes. Do not
  add a second plain-language schema or build a new documentation framework for this task.
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
| `renderPersonas`, ontology context, and formal-section links | Glossary tables and technical terms | Repoint to the generated ontology in the same Phase 6 migration; preserve old public anchors |
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

Decided by Afo on 2026-10-12 (L13, amended after QA by L21):

- PRD-727 keeps the full pooling documentation scope, community and builder. It is not narrowed to
  builder documentation and is not closed into PR #795.
- PRD-1156 holds the 2.0.0 release-essential slice. Its plan is the pooling hub's
  `handoffs/release-essential-docs.md`, which on 2026-10-12 existed only in the checkout where
  that work is being prepared, not on `develop`.
- **Now:** explain Commitment Pooling coherently on Welcome, How It Works, and Why We Build.
  Welcome gives the short purpose and place in the product; How It Works connects commitments,
  work evidence, review, and conditional funding; Why We Build explains the problem this addresses.
  Verify the actual semantics against the ontology, capability projections, and owning implementation
  before writing. Do not imply that every approved piece of work receives a pool payment or that
  contracts present in the repository prove production availability.
- **Later:** new pooling user-guide instructions, tutorials, diagrams, screenshots, FAQ flow
  expansions, and substantive updates to the existing steward pooling guide. No placeholder pages.
  Keep that guide's existing navigation. This hub changes no runtime flags or capability status to
  make a narrative true; conflicts go to the owning pooling work and the prose remains qualified.

Where the later work connects, each recorded in `handoffs/pooling-insertion-points.md`:

| Later work | Where it lands |
|---|---|
| Gardener guide "Make and keep a promise" | New `docs/docs/community/gardener-guide/commitments.mdx`; sidebar item after Track Your Work and before Recovery; one line in the gardener index path |
| Steward setup and run sequence | The existing `steward-guide/commitment-pooling.mdx`, same slug and sidebar label |
| Linking work to a commitment; linked, approved, counted | New sections in Submit Work, Track Your Work, and Recovery |
| Where pooling fits | Brought forward into this hub by L21: Welcome, How It Works, Why We Build. Later guides link back to these explanations instead of adding a second story |
| Support and payment | A row in Funding and Governance's decision table, a note in the funder index, and FAQ answers under a new group |
| Everyday glossary entries for Commitment and Commitment Pool | Two references added to the glossary renderer's everyday list, once their availability wording is reconciled |
| Claims and capability records | `green-goods-projections.json`, through its generators |
| Illustrations | `docs/static/img/community/commitment-pooling/` |

## Human Judgment Points

`plan.todo.md` § Decision Log lists what is locked, what the executor resolved, and what is still
open. Q4 is settled by L22. Open and blocking nothing in the QA revision: Q3 (Honest Claims), the
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
| Community pages, sidebar, redirects, consumer pointers, screenshots | `ui` | Source and rendered proof; focused regression tests for changed interactions or twin behavior where meaningful |
| Glossary and ontology renderers, definition/term/anchor guards, and (if Q3 keeps it) claims renderer | `state_api` | Script changes with fresh RED/GREEN tests in the owning suites |
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
