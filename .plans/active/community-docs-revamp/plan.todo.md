# Community Docs Revamp Plan

**Feature Slug**: `community-docs-revamp`
**Stage**: `active`
**Status**: `ACTIVE: the non-pooling foundation is written, validated, merged with develop, and in PR #896 for review; the replay on the released product and the read-through by people are still to do; pooling documentation is owned by the pooling hub`
**Created**: `2026-09-23`
**Last Updated**: `2026-10-12`
**Source**: 2026-09-01 Build Sync review and docs audit; reconciled on 2026-09-23 against
`develop`, PR #795, and Linear; reconciled again on 2026-10-12 against the merged Builders track,
the PR #896 review threads, and Afo's brief of that day (see [`spec.md`](./spec.md))
**Linear**: not mirrored (Decision Q10 is open; creating the mirror is an external write that
needs Afo's authorization)

## Decision Log

### Locked

| # | Decision | Source |
|---|---|---|
| L1 | Audit first, then plan section by section before editing | Build Sync, 2026-09-01 |
| L2 | Community pages stay focused, minimal, and nontechnical; technical depth lives on Builders | Build Sync, 2026-09-01 |
| L3 | The codebase is the source of truth; generate docs content from it where that pays | Build Sync, 2026-09-01 |
| L4 | Steward and Evaluator get separate guides | Build Sync, 2026-09-01 |
| L5 | The FAQ moves to the top level | Build Sync, 2026-09-01 |
| L6 | The full ontology moves to the Builders side | Build Sync, 2026-09-01 |
| L7 | The funder guide keeps its three flows | Build Sync, 2026-09-01; restated by Afo, 2026-10-12 |
| L8 | Submit Work is the model page for every guide, and keeps its structure | Build Sync, 2026-09-01; restated by Afo, 2026-10-12 |
| L9 | Check the skills, scripts, and routines that read these pages before moving anything | Build Sync, 2026-09-01 |
| L10 | No em dashes in hand-written docs prose | Afo, 2026-09-02 (builder-docs tone contract) |
| L11 | Design Rationale, the License split, and `llms.txt` belong to the Builders track | Builder-docs spec D5, D9, D10 (PR #795, merged) |
| L12 | The non-pooling foundation is brought forward from the post-release schedule and runs now, in PR #896. This does not approve every open recommendation in this plan | Afo, 2026-10-12 |
| L13 | Pooling boundary: PRD-727 keeps the full pooling documentation scope and is neither narrowed to builder documentation nor closed into PR #795; PRD-1156 holds the 2.0.0 release-essential slice. This hub writes no pooling tutorial, diagram, or screenshot, does not expand the existing steward pooling guide, keeps that page and its navigation, publishes no placeholder, makes no pooling availability claim, changes no capability flag, and records where the later work connects. Replaces the Q1 recommendation | Afo, 2026-10-12 |
| L14 | Welcome, How It Works, and Why We Build stay three pages (closes Q5) | Afo, 2026-10-12 |
| L15 | The docs explain "garden" without implying that Green Goods only supports literal gardening; renames stay a product call (PRD-820) | Afo, 2026-10-12 |
| L16 | Each task guide gives a brief purpose and prerequisites, numbered actions with exact screen labels, an observable success signal, who acts next, recovery beside the relevant problem, and one primary next step | Afo, 2026-10-12 |
| L17 | Where a structural choice is unresolved, the working content and navigation stay until it is decided | Afo, 2026-10-12 |
| L18 | Upload, review, approval, reward, and recovery behavior are verified against their owning implementation. Photo privacy and funding statements describe what the code does; no guarantee is inferred from interface copy | Afo, 2026-10-12 |
| L19 | No merge, deployment, publication, external record update, or unrelated product change happens from this work without separate authorization | Afo, 2026-10-12 |

### Resolved in execution

Routine editorial and mechanical choices, made by the executor on 2026-10-12 under L12 and
reversible in review.

| # | Choice | Why |
|---|---|---|
| E1 | Screenshots are scripted captures from Storybook fixture stories, at the Builders track's viewport standard (builder hub decision 61). Signed-in screens never come from a live garden. Each caption names source and date, because the deployed Storybook does not expose its commit. Closes Q7 | Mock auth reads live gardens, so it would publish members' names and photos |
| E2 | The Evaluator guide covers the role and assessments. Data access stays on Builders. Closes Q8 | L2 |
| E3 | The claim that the docs are translated is removed. Spanish and Portuguese pages remain a follow-on (the rest of Q9) | It is false today: `locales: ['en']` |
| E4 | The glossary reuses the existing `human_concepts` records and adds no schema. The terms that lead the page are an explicit list in the renderer. Replaces the Q6 recommendation | The data already exists and is gate-checked; `surfaces` is a vocabulary rule, not a reader group |
| E5 | File paths and slugs change only for the three approved moves (L4 to L6). Recovery and Track Your Work get new titles and labels on their existing URLs | A slug is not reader-facing text; redirects have a cost |
| E6 | FAQ questions are headings, not collapsible components | Linkable from a support chat, listed in the page outline, found by search, and clean in the Markdown twin |
| E7 | Task steps are Markdown numbered lists, not prop-driven components | The twin and search carry the steps |
| E8 | Formal Ontology lands in Builders, Reference | Lookup material sits there |
| E9 | Make an Assessment lives in the Evaluator guide and is also linked from the Steward sidebar category and steward path | Stewards write assessments too, and an assessment comes before the work it frames |
| E10 | Glossary joins the FAQ at the top level of the sidebar; Honest Claims, Product History, Brand kit, and Credits keep their places | The glossary is a reading aid; the rest are L17 or untouched |
| E11 | Pooling terms stay in the glossary's formal tables and are not added to the everyday section yet | Their availability records are being reconciled by PRD-1156 (L13) |
| E12 | A new steward page, Manage Members: adding people, roles, requests, and open joining | Those jobs had no page, and Create a Garden and the steward index pointed nowhere for them |
| E13 | The Welcome role cards gain Evaluator. The steward path becomes Create a Garden, Manage Members, Make an Assessment, Review Work, Mint Impact Certificate | The role guides are the navigation (L4) |
| E14 | Titles name the job: "Track Your Work" and "Recover Unsent Work". Slugs unchanged (E5) | "Recovery and Sync" and "Track Status and Attestations" were the product's words, not the reader's |
| E15 | The loop is told as Plan, Document, Review, Certify, Fund. The growth routine's fallback loop follows it and drops community signalling | An assessment comes before the work it frames; voting on priorities is switched off in the cockpit |
| E16 | Mint Impact Certificate is marked "In progress", and says what a minted certificate cannot do yet | Its capability record is `in-build` (L18) |
| E17 | The glossary heads the certificate entry "Impact Certificate", an alias the ontology declares, and keeps the `#hypercert` anchor | The guides and public site say impact certificate; the cockpit says Hypercert |
| E18 | Wording edits to nine `human_concepts` records. No field, capability, or maturity value changes | These records are now the first thing a glossary reader sees. Garden says it is not "a place only for growing plants" (L15); vault says it is not "a guaranteed deposit" (L18) |
| E19 | Credits: the privacy bullets are replaced with what the code does, and link to the FAQ's privacy answers | They promised protections the product does not have (L18) |
| E20 | Images: fourteen new fixture captures, seven kept, eight removed. Three deck graphics carried another organization's branding and protocol names; two old captures showed a real garden and a member's photo | L15, L18, and the repository is public |
| E21 | Text-only where no fixture renders the screen: Submit Work's Start and Details steps, the funder dialogs, the endowment tab, and an open submission | A screenshot of the wrong screen is worse than none. Listed in the `ui` handoff |
| E22 | QA catalog: DOCS-020's page path follows the move, and four scenario titles follow the new page titles. No case is added, removed, or retired | The catalog reads these pages (L9) |
| E23 | `sidebars.ts` labels repeat each page's own label, because the page's label is the one that renders | Five entries carried labels that never showed |

### Open

| # | Question | State | Blocks |
|---|---|---|---|
| Q2 | Where is the line between docs-site pooling pages and the Commitment Pooling Google Doc? | Routed to the pooling hub with L13; not decided here | Nothing in this hub |
| Q3 | Honest Claims: move to Builders with a humanized renderer, or remove? | Open. Page and navigation retained (L17). Its sidebar entry reads "Capability & Claims", set by the renderer, while the guides link to it as Honest Claims; settle the name with this decision | Step 3.2 |
| Q4 | Product History: remove, or keep a stub? | Open. Page, its eight redirects, and the Builders link to it retained (L17) | Nothing else |
| Q9 | Spanish and Portuguese gardener pages | Open, as a follow-on once the English settles | Nothing in this hub |
| Q10 | Linear: when and where to mirror this hub | Open. `plan-hub.mjs linear-sync` proposes creating a parent issue; not created (L19) | The implementation start gate's mirror step only |

Closed: Q1 (by L13), Q5 (by L14), Q6 (by E4), Q7 (by E1), Q8 (by E2).

## Review Reconciliation (PR #896 threads)

| Thread | Finding | Disposition |
|---|---|---|
| Codex, `brief.md` | A steward pooling guide already exists; the plan treated it as missing | Fixed. The brief and spec name the existing page, drop "Run Your Pool (new)", and route pooling work to the pooling hub (L13) |
| Codex, `spec.md` | The target sidebar dropped Brand kit | Fixed. Brand kit stays in the sidebar |
| Codex, `plan.todo.md` 0.5 | The docs-audit migration and its test already exist | Verified at `docs/scripts/docs-audit.mjs` (`isGuideLikeDoc`) and `docs/scripts/docs-audit.test.mjs`. Step and AC-5 removed |
| Codex, `spec.md` Generators (2026-10-12) | "Surfaces include community readers" is not a real predicate; anchors consumed by the client could be dropped | Fixed by E4: an explicit list, and every anchor preserved |
| Codex, `spec.md` Generators (2026-09-23) | The ontology gate's glossary lock would fail or be bypassed | Fixed. The canonical tables stay, so the definition lock is unchanged; the term-heading guard is extended and tested (step 3.1) |
| Afo, 2026-10-12 | Inspect `human_concepts` and projection fields before adding a schema | Done. E4 reuses them |
| Codex, `status.json` | Claims-renderer tests were assigned to the wrong suite | Fixed. Step 3.2 and the lane note name `scripts/quality/check-ontology.test.mjs` |
| Codex, `plan.todo.md` 2.12 | One voice-pass step bundled ten pages | Fixed. Phase 2 is page-or-pair checkpoints |
| CodeRabbit, `eval.md` AC-3 | Screenshot accessibility was not an acceptance check | Fixed in `eval.md` |
| CodeRabbit and Codex, `eval.md` AC-2 | The voice searches missed bare "Hats" and chain names | Fixed. `eval.md` holds one maintained list |
| CodeRabbit and Codex, `plan.todo.md` | Q1 and the release-day pooling copy had no pre-release step | Closed by L13. The release-day copy belongs to PRD-1156. Q10 no longer gates a release |
| Codex, `eval.md` gate 2 | The usability claim was only tested by an agent replay | Fixed. The replay proves accuracy; an unassisted reading by people is its own check, owned by a person |
| Codex, `eval.md` AC-4 | Truth fixes mixed lanes | Fixed. The `spec.md` table names an owner per fix; the generated claims entry belongs to the pooling hub and the audit fix is already done |
| Codex, `status.json` | `depends_on_features: ["commitment-pooling"]` would break validation when that hub closes | Fixed. The dependency is removed; the relationship is a note |

## Research / Plan Gate

- [x] Record research evidence in `spec.md` (2026-09-01 audit; reconciled 2026-09-23 and 2026-10-12)
- [x] Identify the patterns to mirror: Submit Work for pages; the builder-docs hub for lanes
- [x] List human judgment points (Decision Log)
- [x] Define what is out of scope (`brief.md`)
- [x] Choose the lightest honest validation commands (`eval.md`)

## Requirements Coverage

| Requirement | Source | Lane | Step | Status |
|---|---|---|---|---|
| Audit section by section, then plan | Build Sync | n/a | This hub | ✅ |
| Ground the work in strong reference docs | Build Sync | n/a | `spec.md` reference patterns | ✅ |
| Clear Welcome, How It Works, and Why We Build | Afo, 2026-10-12 | `ui` | 2.1 to 2.3 | ✅ Written; replay pending (4.3) |
| Gardener guides: install, join, submit, track, recover | Build Sync; Afo, 2026-10-12 | `ui` | 2.4 to 2.8 | ✅ Written; replay pending (4.3) |
| Use Submit Work as the model and keep its structure | L8 | `ui` | 0.2, every Phase 2 step | ✅ Written; replay pending (4.3) |
| Steward guidance, with evaluator guidance separated | L4 | `ui` | 1.2, 2.9 to 2.13 | ✅ Written; replay pending (4.3) |
| Existing funding flows, three funder flows kept | L7 | `ui` | 2.14 to 2.16 | ✅ Written; replay pending (4.3) |
| FAQ at the top level, grouped by worry | L5 | `ui` | 1.1, 2.17 | ✅ Written; replay pending (4.3) |
| Glossary in plain language, from the ontology | L3, E4 | `state_api` | 3.1 | ✅ Written; replay pending (4.3) |
| Move the ontology to Builders | L6 | `ui` | 1.3 | ✅ Written; replay pending (4.3) |
| Redirects and consumers for approved moves | L9 | `ui` | 1.1 to 1.4, 4.2 | ✅ Written; replay pending (4.3) |
| Consistent page structure | L16 | `ui` | 0.2, Phase 2 | ✅ Written; replay pending (4.3) |
| Current, accurate screenshots with a named source | Afo, 2026-10-12; E1 | `ui` | 4.1 | ✅ Where a fixture exists (E21) |
| Plain-language submit, approve, and reward guide | PRD-927 | `ui` | 2.2, 2.7 | ✅ Written; replay pending (4.3) |
| Self-serve Android install | PRD-925 | `ui` | 2.4 | ✅ Written; replay pending (4.3) |
| Explain what a garden is | PRD-820, L15 | `ui`, `state_api` | 2.1, 2.2, 3.1 | ✅ Written; replay pending (4.3) |
| Photo privacy answer | PRD-639, L18 | `ui` | 2.17 | ✅ Written; replay pending (4.3) |
| Glossary prose for Work and Work Approval | PRD-744 | `state_api` | 3.1 (verify only) | ✅ Written; replay pending (4.3) |
| Honest Claims and Product History | Build Sync | `ui`, `state_api` | Q3, Q4 | Blocked on a decision |
| Rework Design Rationale | Build Sync | n/a | PR #795 (L11) | ✅ |
| Pooling user guides | PRD-727, PRD-1156 | n/a | Pooling hub (L13) | Not this hub |

## Steps

### Phase 0: Reconcile and prepare

- [x] 0.1 Reconcile this hub with the review threads and Afo's 2026-10-12 brief, and promote it
  with `node scripts/harness/plan-hub.mjs move --feature community-docs-revamp --to active`.
  Verify: `node scripts/harness/plan-hub.mjs validate`.
- [x] 0.2 Write the page contract and voice contract from `spec.md` into `docs/README.md` §
  Authored pages, shared with the Builders track.
- [x] 0.3 Evidence pass: read the owning implementation for every flow the guides describe and
  record labels and behavior, with their sources, in `handoffs/claude-ui.md`.
- [ ] 0.4 Linear mirror per Q10. Blocked: needs Afo's authorization (L19).

### Phase 1: Structure (approved moves only)

- [x] 1.1 Move the FAQ's URL to `/faq`, redirect `/reference/faq`, and update the footer link.
- [x] 1.2 Add `community/evaluator-guide/` with an index, move Make an Assessment into it, redirect
  the old slug, retarget the redirects that pointed at it, and repoint its consumers
  (`steward-path.json`, the persona journey guide links, the builder pages, the agent context
  pointer, and QA case DOCS-020).
- [x] 1.3 Move Formal Ontology to the Builders sidebar. File path and slug unchanged.
- [x] 1.4 Sidebar: a Steward category and an Evaluator category; FAQ and Glossary at the top
  level; Brand kit, Honest Claims, and Product History kept; labels that match the page titles.
  Verify after Phase 1: the docs audit, the generated-output check, and a docs build.
- Deferred with L17: applying Q3 and Q4.

### Phase 2: Pages (one page or pair per checkpoint)

Each checkpoint: the page meets the page contract, uses on-screen labels checked against
`en.json` and the owning component, and the docs audit stays clean.

- [x] 2.1 Welcome, with what a garden is (PRD-820).
- [x] 2.2 How It Works, and the loop's stage list in `docs/routines/growth-pulse.md` if it changes.
- [x] 2.3 Why We Build.
- [x] 2.4 Gardener index and Install and Update (PRD-925).
- [x] 2.5 Join a Garden.
- [x] 2.6 Submit Work (voice and labels; structure kept).
- [x] 2.7 Track Your Work.
- [x] 2.8 Recovery.
- [x] 2.9 Steward index, including how to get access.
- [x] 2.10 Create a Garden, Manage Members (new, E12), and Manage Actions.
- [x] 2.11 Review Work.
- [x] 2.12 Evaluator Guide and Make an Assessment.
- [x] 2.13 Mint Impact Certificate.
- [x] 2.14 Funding and Governance.
- [x] 2.15 Funder index and Donate.
- [x] 2.16 Endow and Remove an Endowment.
- [x] 2.17 FAQ content.
- [x] 2.18 Credits intro.

### Phase 3: Generators

- [x] 3.1 `state_api`: `renderGlossary` leads with an "Everyday terms" section built from
  `human_concepts` for an explicit list of terms, keeps every anchor and both canonical tables, and
  the term-heading guard reads the new section. RED then GREEN in `scripts/docs/generate.test.mjs`
  and `scripts/quality/check-ontology.test.mjs`; `bun run check --only docs-generated` and
  `bun run check --only ontology` clean.
- [ ] 3.2 `state_api`: if Q3 keeps the claims page, give `renderMarketingClaimsMdx` human headings,
  with the assertion in `scripts/quality/check-ontology.test.mjs`. Blocked on Q3.
- [ ] 3.3 Optional: encode the page contract as docs-audit checks. Deferred.

### Phase 4: Screenshots and proof

- [x] 4.1 Screenshot pass: keep, replace, or remove each image; captions name source and date;
  no image without a consumer.
- [x] 4.2 Verification: the gate chain in `eval.md`, a production docs build, a rendered check of
  changed navigation and pages at phone and desktop widths, and redirects, search, links, and
  Markdown twins.
- [ ] 4.3 `qa_pass_1`: replay every guide on the released product, with authenticated Brave for
  sign-in, wallet, and installed-app surfaces. Needs a person's session. Not run.
- [ ] 4.4 Unassisted read-through by people who have not seen the docs (`eval.md` AC-9). Needs
  people. Not run.
- [ ] 4.5 `qa_pass_2`: consumers, redirects, links, and the full gate chain, after 4.3.

## Validation

See `eval.md` for the gate chain. Docs content is not unit-testable, so the `ui` lane's proof is
the gate chain, a rendered check, and the replayed read-through; the `state_api` lane records
RED/GREEN in its handoff.

## Implementation Notes

- 2026-10-12: The plan was written to start after the 2.0.0 release with pooling pages in scope.
  Afo brought the non-pooling foundation forward and moved every pooling page to the pooling hub
  (L12, L13). Steps that created `commitments.mdx` and "Run Your Pool", copied pooling gallery
  images, and added a pooling section to How It Works are removed from this plan and listed in
  `spec.md` § Pooling boundary and insertion points.
- 2026-10-12: The docs-audit step is removed because the fix already shipped on `develop`.
- 2026-10-12: Phases 0 to 2, step 3.1, and steps 4.1 and 4.2 are done on the branch. Receipts are
  in `handoffs/claude-ui.md` and `handoffs/claude-state-api.md`; where the pooling pages connect
  is in `handoffs/pooling-insertion-points.md`.
- 2026-10-12: `develop` was merged in (tip `8d22aabb3`) with plain git, at Afo's choice, after the
  app's sync tool refused over an unconfirmed origin. The one conflict was the generated Test
  Cases page, regenerated from the merged QA catalog. No label the pages quote changed in those
  56 commits; Create a Garden gained a row for the new "Awaiting wallet execution" state. The
  full check plan passed again on the merged branch, and Afo chose to push to PR #896.
- 2026-10-12: Found while reading the product, not fixed here (out of scope for a docs change):
  the Create Garden form may refuse to deploy from a fresh page, the public impact page's evidence
  links point at the wrong explorer, the in-app Help answers use retired names, and one public
  page links the old assessment URL (the redirect covers it). Each is described in the `ui`
  handoff.
