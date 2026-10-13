# Community Docs Revamp Plan

**Feature Slug**: `community-docs-revamp`
**Stage**: `active`
**Status**: `CLOSED: approved implementation prepared for delivery in PR #896; L34 requires exact-head CI before the authorized develop merge. Human QA remains separate.`

**Created**: `2026-09-23`
**Last Updated**: `2026-10-13`
**Source**: 2026-09-01 Build Sync review and docs audit; reconciled on 2026-09-23 against
`develop`, PR #795, and Linear; reconciled again on 2026-10-12 against the merged Builders track,
the PR #896 review threads, Afo's brief, and the subsequent QA and explicit scope decisions
(see [`spec.md`](./spec.md) and [`qa-revision.md`](./handoffs/qa-revision.md))
**Linear**: not mirrored (Decision Q10 is open; creating the mirror is an external write that
needs Afo's authorization)

## Resume here

**Current result:** D1/D2/E1/E2/F and W2 are implemented through
`f4dcad12b6bec65f2457db4309bdbf5db0617e28`. Real seedling photography and coherent fictional
records now cover submission, queued/offline work, gardener-owned Completed, recovery and the
actual phone review/feedback page. Funding and privacy feedback is corrected in source.
Current develop `6ac414285` was merged cleanly in the isolated checkout. No runtime behavior,
pooling page or capability flag changed. Human review remains separate.

**Validation:** full readiness on `649da00f6` has 30 fresh passes and fails only at Chromium
startup before browser-work-exploration reaches a test. The final approval-only Confidence
wording on `f4dcad12b` has three fresh selected passes; generated/vocabulary/guidance checks
also pass. Final rendered sweep: 29 pages × two widths, redirects, search, keyboard next steps,
fragments and eight Markdown twins. Exact results and limits: `handoffs/final-merge-preparation.md`.

**Next action:** run every selected local gate except the explicitly delegated Chromium check,
publish the exact tested tree to the existing branch, and require its matching GitHub browser
qualification and all required current-head CI. PR #896 still has head `3a09d937b` until publication;
old green CI does not prove this local tree. Merge into develop only after fresh proof, then send
the release handoff. Production merge and deployment remain unauthorized.
Preview: `http://localhost:3003/`. See the final handoff for the focused owner review packet.

**Scope:** L32 authorizes the remaining accepted implementation and ordinary publication to
PR #896, plus valid CI/review fixes. It does not decide Q3, authorize translated pages or Linear
writes, new pooling tutorials, a production deployment or a PR merge. No raw QA transcript or
book file belongs in this public hub. Keep fixes within the documentation intent.

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
| L13 | Original pooling boundary: PRD-727 keeps the full pooling documentation scope and is neither narrowed to builder documentation nor closed into PR #795; PRD-1156 holds the 2.0.0 release-essential slice. No new pooling tutorial, diagram, screenshot, placeholder, capability-flag change, or substantive expansion of the existing steward pooling guide. Its page and navigation stay. **L21 now brings orientation on the three overview pages into this hub; the remaining boundary still applies.** | Afo, 2026-10-12; amended by L21 |
| L14 | Welcome, How It Works, and Why We Build stay three pages (closes Q5) | Afo, 2026-10-12 |
| L15 | The docs explain "garden" without implying that Green Goods only supports literal gardening; renames stay a product call (PRD-820) | Afo, 2026-10-12 |
| L16 | Each task guide gives a brief purpose and prerequisites, numbered actions with exact screen labels, an observable success signal, who acts next, recovery beside the relevant problem, and one primary next step | Afo, 2026-10-12 |
| L17 | Where a structural choice is unresolved, the working content and navigation stay until it is decided | Afo, 2026-10-12 |
| L18 | Upload, review, approval, reward, and recovery behavior are verified against their owning implementation. Photo privacy and funding statements describe what the code does; no guarantee is inferred from interface copy | Afo, 2026-10-12 |
| L19 | No merge, deployment, publication, external record update, or unrelated product change happens from this work without separate authorization | Afo, 2026-10-12 |
| L20 | Move formal definitions out of the Community glossary and into the existing generated Builders ontology. Machine-readable ontology and projection data remain authoritative; do not copy definitions into authored prose. Preserve existing glossary links, and migrate definition and term checks with the content so ontology changes cannot silently leave either page stale | Afo, 2026-10-12, post-QA clarification |
| L21 | “Specific action funds” means Commitment Pooling. Integrate it coherently into Welcome, How It Works, and Why We Build now, as concise explanation supported by current sources. New pooling user-guide instructions come later. Preserve the existing steward pooling guide and nav, PRD-727/PRD-1156 ownership, and runtime flags. Describe intended mechanics separately from verified availability; do not turn approval into a promise of payment | Afo, 2026-10-12, post-QA clarification; partially supersedes L13 |
| L22 | Keep Product History and explain the different Green Goods versions from a user's perspective: what people could do, what changed, and any practical migration consequence. Verify versions and release status; distinguish specifications, previews, and planned versions from shipped releases. Preserve old URLs and anchors. Closes Q4 | Afo, 2026-10-12, post-QA clarification |
| L23 | Apply the QA refinements in Phase 5: clearer role navigation and next steps; concise introductory pages; agriculture context; passkey explanation; shorter recovery and troubleshooting; steward dashboard wording; permission-aware steward paths; phone and desktop review; faithful screenshots; accessible FAQ disclosures; brand and Credits consistency. Keep task completeness, privacy, and funding accuracy | Afo's QA supplied 2026-10-12 and subsequent implementation clarification; routine choices resolved within these bounds |
| L24 | Keep this existing hub as execution truth across context compaction. Record each page/pair checkpoint, source decisions, actual validation, and next action; previous foundation receipts are historical evidence, not proof of the revision | Afo, 2026-10-12, continuity request |
| L25 | Overview imagery and page-ending consistency remain open after the content revision. Align the next visual work and give Afo a named, bounded review batch. Existing local validation is not visual approval | Afo's subsequent visual QA feedback, 2026-10-12 |
| L26 | Use approved real photography paired with current product screenshots. Page endings and Welcome are the first sample; How It Works and Why We Build follow after that direction is reviewed. Do not use synthetic photography as a substitute | Afo's explicit image-direction answer, 2026-10-12 |
| L27 | Reuse editorial website images where applicable and create new images with the same style and feel as needed. Mix these with current app/admin screenshots; use real images when highlighting actual people, places, or things. Use minimal diagrams to explain architecture. This supersedes L26's real-photography-only restriction, not the pooling or truth boundaries | Afo's revised visual direction, 2026-10-12 |
| L28 | Continue the gardener guides with L27's visual approach, starting with Install and Update and Join a Garden. Keep the existing Plan Hub current and deliver a bounded review pair. This authorizes C1's implementation, not a rewrite of all remaining guides or visual sign-off on earlier batches | Afo's explicit continuation request, 2026-10-12 |
| L29 | Continue with Submit Work and Track Your Work using the same visual approach. Preserve the useful submission flow, update this hub and deliver the two-page C2 review packet. This is direction/implementation approval, not owner visual sign-off or permission for later pooling procedures | Afo's explicit continuation request, 2026-10-13 |
| L30 | Continue Recover Unsent Work with the accepted visual approach. Keep data-loss and privacy guidance clear, update this hub and deliver a focused C3 review packet. This selects one page; it is not owner visual approval, product replay or permission for later guide/pooling work | Afo's explicit continuation request, 2026-10-13 |
| L31 | App documentation screenshots should show realistic, task-matched images and plausible action data rather than generic drawings. Keep demo records clearly fictional and source media honestly; this is a quality correction, not approval of earlier screenshots or permission to use live private evidence | Afo's screenshot QA feedback, 2026-10-13 |
| L32 | Finish the remaining approved plan after W1, update PR #896, fix valid CI issues and review comments, and prepare a green PR for the owner's morning merge. This selects the remaining named visual batches and ordinary PR publication; human evidence stays honestly pending, unresolved structural choices retain their content, later pooling guides/Linear writes/deployment/merge remain outside this request | Afo's explicit completion/publication request, 2026-10-13 |
| L33 | After this work is complete and current-head checks pass, merge PR #896 into develop; outline later work/QA and message the existing release session to bring the release branch up to date and prepare it for the production merge. This authorizes the docs merge and release-preparation handoff, not the production merge, deployment, tags, capability activation or live financial/signing actions. Local validation exceptions remain a separate explicit decision | Afo's explicit merge/release-session instruction, 2026-10-13 |
| L34 | Use GitHub CI for the single unavailable local Chromium qualification; keep every other local gate and require the matching browser qualification plus all required CI green on the actual PR head before merging #896 into develop. Then send the release-session handoff. This changes no validation policy and authorizes no production merge or deployment | Afo's explicit one-check exception and merge/handoff confirmation, 2026-10-13 |

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
| E6 | Initial foundation: FAQ questions are headings, not collapsible components. Superseded by L23 and step 5.12 for presentation only | Preserve its original protections: direct links, search, readable questions, and Markdown twins |
| E7 | Task steps are Markdown numbered lists, not prop-driven components | The twin and search carry the steps |
| E8 | Formal Ontology lands in Builders, Reference | Lookup material sits there |
| E9 | Make an Assessment lives in the Evaluator guide and is also linked from the Steward sidebar category and steward path | Stewards write assessments too, and an assessment comes before the work it frames |
| E10 | Glossary joins the FAQ at the top level of the sidebar; Honest Claims, Product History, Brand kit, and Credits keep their places | The glossary is a reading aid; the rest are L17 or untouched |
| E11 | Initial foundation: pooling terms stay in the formal tables. L20 moves those definitions to the ontology; L21 does not by itself add an everyday pooling tutorial or change capability records | Pooling availability remains owned by its sources and release work |
| E12 | A new steward page, Manage Members: adding people, roles, requests, and open joining | Those jobs had no page, and Create a Garden and the steward index pointed nowhere for them |
| E13 | Initial foundation: add Evaluator to Welcome; steward path starts with Create a Garden. Revisit the presentation and deployer-only start under L23, retaining the role destinations | The role guides remain navigation; not every steward can create a garden |
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

W1 reuse decision: `submitWorkControllerFixture` already owns the seeded action and controller;
`stagedWorkPhoto` already creates deterministic JPEG Files from an inline asset. Their drawings
lack realistic evidence. Extend the submission fixture with an opt-in documentation photo;
keep the default behavior and shared category images unchanged. Two new actual-component
stories select the photo with no promise link, 36 plants, 90 minutes and a short field note.
Use Leon Brooks' public-domain Seedlings photograph as illustrative sample evidence, not as a
record of this fictional garden or proof of a count. Later screenshot sets remain a separate batch.

### Open

| # | Question | State | Blocks |
|---|---|---|---|
| Q2 | Where is the line between docs-site pooling pages and the Commitment Pooling Google Doc? | Routed to the pooling hub with L13; not decided here | Nothing in this hub |
| Q3 | Honest Claims: move to Builders with a humanized renderer, or remove? | Open. Page and navigation retained (L17). Its sidebar entry reads "Capability & Claims", set by the renderer, while the guides link to it as Honest Claims; settle the name with this decision | Step 3.2 |
| Q9 | Spanish and Portuguese gardener pages | Open, as a follow-on once the English settles | Nothing in this hub |
| Q10 | Linear: when and where to mirror this hub | Open. `plan-hub.mjs linear-sync` proposes creating a parent issue; not created (L19) | The implementation start gate's mirror step only |

Closed: Q1 (by L13, amended by L21), Q4 (user-facing versions, L22), Q5 (by L14),
Q6 (by E4, extended by L20), Q7 (by E1), Q8 (by E2).

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
| Honest Claims | Build Sync | `ui`, `state_api` | Q3 | Blocked on a decision; preserve content and nav |
| Product History by user-facing version | L22 | `ui` | 5.13 | Implemented with release/source evidence |
| QA navigation, task clarity, screenshots, FAQ, brand and Credits | L23 | `ui` | 5.1 to 5.14 | Implemented; phone fixture capture supplied in W2; product/reader proof pending |
| Formal definitions with ontology, without drift or broken links | L20 | `state_api` | 6.1 to 6.3 | Passed; fresh receipt in codex-state-api.md |
| Commitment Pooling in the three overview pages | L21 | `ui` | 5.1, 5.3, 5.4 | Implemented; tutorials later |
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
- Deferred with L17: applying Q3. Q4 is resolved by L22 and scheduled for 5.13.

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

### Phase 5: QA revision (page or pair checkpoints)

The scope below is accepted; checked checkpoints have implementation and working-tree proof. Use the resources and acceptance
checks in `spec.md` and `eval.md`. Each checkpoint must keep the page's task complete, audit its
links, and record a phone/desktop check when layout or interaction changes. Prefer at most four
authored/code files per checkpoint; capture assets and generated companions travel with their
consumer. Split a larger checkpoint before editing rather than silently batching the whole site.

- [x] 5.1 Welcome and role chooser: remove duplicate role selection and heading hierarchy,
  use descriptive destinations, balance the layout, clarify “What is a Green Goods garden?”,
  and introduce pooling after verifying its meaning and availability sources (L21).
  Owners: `welcome.mdx`, `Hero.tsx`, component CSS, role-path data. Verify role links and twin.
- [x] 5.2 Install and Update: explain passkey versus wallet at the choice, simplify update and
  recovery guidance, and establish the revised task-page example. Verify exact labels and
  account/recovery claims against owning code; keep authenticated replay pending if unavailable.
- [x] 5.3 How It Works: number the start-to-finish example, integrate pooling into the explanation
  of work, review, and funding without making approval imply payment. Preserve its downstream
  routine consumer; update that consumer only if the named loop changes. Verify L21 and AC-12.
- [x] 5.4 Why We Build: improve the problem explanation, include agriculture within supported
  domains, explain pooling's purpose coherently, and give the SDG context relevant source links.
  Keep the page short and avoid claims of measured impact or automatic funding.
- [x] 5.5 Recover Unsent Work: replace wide, repeated troubleshooting with label-led recovery,
  add faithful pending-work evidence where available, and preserve duplicate-upload and data-loss
  warnings. Verify all statuses, who acts next, privacy wording, and phone readability.
- [x] 5.6 Join a Garden and Submit Work: apply the established task presentation, check media-step
  framing/padding against the current product, keep Submit Work's useful sequence, and recapture
  only faithful screens. No new pooling tutorial steps. Verify text-only completeness and labels.
- [x] 5.7 Track Your Work: align success and recovery explanations with 5.5 and the current work
  list; keep approval and rewards distinct. Verify links between track, submit, and recovery.
- [x] 5.8 Steward landing and navigation: say “steward dashboard”, remove Manage Actions from the
  ordinary steward task path without orphaning its existing content, separate role permissions
  from the starting task, and stop implying that every steward can create a garden. Retain the
  existing pooling nav. Verify sidebar, path component, current item, and twins together.
- [x] 5.9 Create a Garden and Manage Members: improve task presentation and desktop capture
  framing; check current product behavior and any delivered fix before removing recovery advice.
  Keep product UI fixes outside this docs change. Verify success and failure instructions.
- [x] 5.10 Review Work: document phone/PWA and dashboard paths separately with corresponding
  screenshots and shared judgment guidance. Verify exact labels, permanent decisions, and the
  next actor on both paths, with session evidence labeled honestly. L32 adds faithful actual-page
  phone review/feedback stories and captures; released-product signing/replay remains separate.
- [x] 5.11a Assessment: staged goals, reporting-period, and Review captures; task guidance and shorter recovery. Fixture sources/build limitations recorded.
- [x] 5.11b Endowment: staged amount/result captures and task guidance. Preserve Donate, Endow, Withdraw and money limits; record missing full-dialog capture capability.
- [x] 5.12 FAQ: accessible question disclosures while preserving all anchors, search, browser
  find, keyboard behavior, and Markdown twins. Revise E6's presentation, not its protections.
- [x] 5.13 Product History: research version/release evidence and rewrite by user-visible changes
  (L22). Keep existing routes and anchors, route historical research through a compact historical
  pointer rather than presenting it as released functionality. Verify each version claim.
- [x] 5.14a Brand: asset/color consistency against the current manifest and design authorities; keep Brand kit discoverable and public asset URLs stable. No palette invention.
- [x] 5.14b Credits: current, verifiable acknowledgments and tooling. No unsupported sponsor, partner, contributor, or reward claims.

### Phase 6: Ontology-owned reference and compact glossary

- [x] 6.1 `state_api`: inventory all current glossary anchors, G5/G6/G7 checks, generated output
  owners, and definition/surface consumers. Add RED tests for the approved formal-reference
  destination, retained links, source-change regeneration, and rejection of stale output.
- [x] 6.2 `state_api`: extend the existing ontology renderer, reduce the community glossary to
  selected human concepts plus compact compatibility links, and migrate G5/G6 ownership with the
  definitions. Update affected source declarations, docs-authority guidance, and Personas links;
  regenerate, never edit MDX by hand. Treat the gate/renderer/output migration as one coherent
  exception to the four-file preference because splitting it would leave the checks broken.
- [x] 6.3 `state_api`: prove GREEN in the owning generator and ontology suites, then prove an
  ontology/projection change updates the appropriate outputs and stale/tampered output fails.
  Preserve the ten app anchors and all prior public anchors, including technical-term pointers.
  Record what mechanical checks cannot prove about authored overview prose.

### Phase 7: Revision verification and handoff

- [x] 7.1 Reconcile `docs/README.md` with the final page pattern and ontology ownership; render the
  validation plan for actual changed paths and run its selected checks plus the applicable docs
  audit, generated consistency, vocabulary, ontology, production build, and search-index proof.
- [x] 7.2 Inspect all changed pages/navigation at phone and desktop widths; verify direct fragments,
  redirects, search, FAQ disclosures, links, and Markdown twins. Add meaningful regression tests
  only for changed behavior. Write fresh lane receipts before marking implementation passed.
- [x] 7.3 Refresh the later pooling insertion points and continuation handoff, then retain or
  complete the product replay and unassisted-reader checks (4.3 to 4.5) according to actual evidence.
  The owner's QA review does not substitute for those checks. Publishing remains separately gated.

### Phase 8: Visual pass and explicit owner review

Status: L27's overview visuals and Batch A's native page endings are implemented and locally
verified. The direction choice and mechanical proof are separate from owner visual sign-off.
Keep the Docs dialect and all L20 to L22 boundaries. See the review queue in
`handoffs/qa-revision.md`; do not mark a page approved because a build passes.

- [x] 8.0 Inspect the overview sources, image inventory, and rendered Community/Builders endings;
  record the remaining visual work, proposed batch, and review questions in this existing hub.
- [x] 8.1 Page endings: align the shared next-step treatment with Builders' document typography,
  spacing, borders, and links. Resolve the custom NextBestAction section plus Docusaurus Next
  duplication. Keep one clear recommended destination and useful previous-page navigation.
  Compare Welcome, Submit Work, and Getting Started; check the two Builders NextBestAction
  consumers as well. Verify phone/desktop, keyboard links, route destinations, and Markdown twins.
- [x] 8.2 Welcome visual sample revised under L27: reuse an applicable editorial website image,
  keep the role chooser easy to reach, and retain the useful product view. Move the real waste
  photograph to a section that names that community. Present phone/desktop and light/dark views
  with source notes and a short review packet. Owner visual approval remains pending; L27
  authorized the overview pair independently of that approval.
- [x] 8.3 How It Works: lead with a concrete human example and a visual of recording and review.
  Use a compact diagram later in the page to explain the app, review, and public record.
  Keep the five-stage loop in the text and preserve its useful anchors. Use the approved visual family and faithful product captures. Preserve the
  distinctions between work review, promise confirmation, and payment; no new pooling diagram.
- [x] 8.4 Why We Build: add two purposeful supporting visuals, one about community work and one
  about the kinds of value it creates. Place them beside the relevant explanation. Avoid images
  implying measured outcomes, automatic rewards, or that Green Goods only supports planting.
- [x] 8.5 Review the remaining role guides in the named page/pair queue. Capture specific gaps
  before selecting each fix batch; retain complete text and existing useful procedures. Released-product proof stays separate; L32 closes the missing phone fixture gap with the
  real component and inert write callbacks. D1/D2/E1/E2/F source and visual work is implemented.
  - [x] 8.5a C1, authorized by L28: Install and Update plus Join a Garden. Keep purpose and
    prerequisites ahead of the actions; use compact editorial context and faithful screenshots
    beside their steps. Preserve platform-specific install guidance, account/update/data-loss
    cautions, all joining paths and fee qualifications. Verify phone/desktop, light/dark,
    anchors, next destinations, image source notes and Markdown twins. Owner approval separate.
  - [x] 8.5b C2, authorized by L29: Submit Work plus Track Your Work. Preserve Start, Media,
    Details and Review and their numbered actions. Use compact editorial context and faithful
    screenshots beside the relevant stages/statuses. Keep public-media privacy, queued-work
    uncertainty, review/approval/reward distinctions and recovery clear. Verify phone/desktop,
    light/dark, preserved anchors, native next links, search and Markdown twins. No new pooling
    screenshot/tutorial; retain the existing Review example without expanding its pooling content.
  - [x] 8.5c C3, authorized by L30: Recover Unsent Work. Retain its safe three-step recovery
    sequence and existing fragments. Use compact editorial context, the Pending fixture and a
    faithful discard confirmation. Put irreversible local-data/public-media cautions before
    Discard; keep Checking, partial sends, same-phone/account and storage limits clear. Verify
    phone/desktop/light/dark, source notes, fragments, FAQ links, native next, search and twin.
    No deletion, signing, runtime or pooling procedure is replayed or changed.
- [x] 8.6 Run the checks selected for actual implementation paths, capture phone/desktop proof,
  and hand off each batch with exact review URLs, changed sections, limits, and questions.
  Record implementation, mechanical validation, and owner visual review separately.
  Completed for Batch A, the L27 overview batch, C1, C2 and C3; stays open for later bounded guide batches.

- [x] 8.7 W1: replace Submit Work's drawing-based Media and Review captures with an actual
  task-relevant photograph and coherent fictional action/count/time/notes. Add dedicated
  photo stories; retain existing test fixtures and current app UI. Record rights, source build,
  capture dimensions, and all downstream image consumers. Review this sample before broadening
  the source-media refresh to queue, garden and admin screenshots. No new pooling procedure.
  Implementation/local proof complete on `cd79c36ce`; owner visual review remains open.

### Phase 9: Final implementation and merge preparation (L32)

- [x] 9.1 Finish the named D1/D2 steward/evaluator visual checkpoints, including a faithful
  phone-review example where a safe story can render it. Preserve permissions and permanent
  decision guidance; add no real account data or signing action.
- [x] 9.2 Finish E1/E2 funder and money follow-through, preserve Donate/Endow/Withdraw, verify
  current public labels and permissionless yield behavior, and label unavailable full-dialog proof.
- [x] 9.3 Finish F reference/navigation scan and remaining screenshot realism using deterministic
  task-matched examples. Keep defaults/test scenarios, stable links and the existing pooling page.
- [x] 9.4 Classify all current PR review surfaces to pagination completion; fix valid bounded
  manifestations, verify already-fixed local changes, and preserve unresolved decisions.
  Initial complete snapshot/20-item ledger: `artifacts/pr-review-ledger.md`; refresh before
  publication. Financial/privacy siblings fixed from owning sources; no runtime behavior change.
- [x] 9.5 Run selected proof and required readiness checks on the final source tree; verify
  phone/desktop pages, search, redirects, anchors, image provenance and Markdown twins.
  Source/consumer proof is recorded; L34 delegates only Chromium qualification to exact-head GitHub CI.
- [ ] 9.6 Update the existing PR with the proven tree, verify publication identity, address valid
  current-head CI failures and new review feedback, and record exact green checks. L33/L34 then authorize the develop merge and release handoff.
- [x] 9.7 Record the honest closeout resolution and destination of every deferred/human-owned
  item, commit the closeout separately, and leave archival until after the human merge.

## Validation

See `eval.md` for the gate chain. Prose needs source and rendered proof; changed docs interaction
or Markdown generation gets focused regression proof where meaningful. The `state_api` lane
records fresh RED/GREEN for Phase 6. First-foundation receipts remain historical.

## Implementation Notes

- 2026-10-12, after QA: L20 to L24 record the approved glossary/ontology ownership, overview-only
  pooling expansion, version-history direction, QA corrections, and compaction-safe continuity.
  Q4 is closed. Phases 5 to 7 are in progress; current lane state and next work are recorded separately
  from the earlier foundation evidence. No publication or external-record write is implied.

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


### Final QA revision checkpoint

Approved implementation and local proof are committed; Phase 7 records current receipts, the
rendered sweep, and updated pooling connections. Step 5.10 was blocked at that historical checkpoint. L32/9.1 now supplies actual-page
fixture captures, and its implementation checkbox is complete. Released-product replay remains pending. This is a
content/implementation checkpoint, not visual sign-off: Phase 8 now records the requested
overview imagery and page-ending alignment. State_api passes the approved Phase 6 scope. Product
replay, unfamiliar readers, later QA and external publication are not falsely marked complete.

## Closeout (2026-10-13)

Closed as `closed` for the approved English foundation, QA revision and visual implementation
prepared in PR #896. This record precedes publication/merge; 9.6 remains open until the exact
published tree, required CI and authorized develop merge are verified. The resolution is not
`completed`: released-product, unfamiliar-reader and owner visual certification remain pending.
Fifteen remaining local automated checks pass under L34 in 114 seconds. Only the unavailable
Chromium qualification is delegated to the matching GitHub job; no policy or hook changed.

Still open and destinations:

- New pooling tutorials/screens/diagrams and substantive steward guide → Commitment Pooling hub,
  PRD-1156 release-essential slice and PRD-727 full scope. Neither issue is completed by this PR.
- Product/authenticated-PWA recovery and signing, QA-app catalog proof, full funding-dialog/wallet
  outcomes, owner visual acceptance and three unfamiliar-reader walkthroughs → explicitly dropped
  from this implementation delivery, retained as the release-session/operator QA handoff. Existing
  QA lanes remain uncertified; a fixture is not relabeled as live product or human usability proof.
- Q3 claims structure → explicitly dropped from this delivery until a new owner decision; working
  page, renderer and navigation retained. Q9 translated docs and Q10 Linear mirror → explicitly
  dropped from this delivery pending separate selection; no new issue, translation or mirror created.
- Publication, exact-head CI and develop merge → PR #896 / step 9.6; production merge/deploy/tagging
  remain unperformed and separately gated. The release session receives the verified merge facts.
- Archive → after the authorized merge, as separate housekeeping with plan-hub tooling and the
  pre-archive commit preserved for the pooling insertion handoff. No report edited or hand-deleted.

The outside-hub reference scan found no dependency on this active hub. No Linear issue is linked
by an integration reference line; merge does not create or close a pooling issue or a new mirror.
