# Commitment Pooling: 2.0 release-essential documentation

**Created:** 2026-10-11. **Updated:** 2026-10-15 (America/Los_Angeles).
**Status:** Release-essential guides implemented in the working tree; selected automated checks passed. Final reading evidence and remaining human QA are recorded below.
**Owner:** Afo. **Executor:** Codex.
**Release slice:** [PRD-1156](https://linear.app/greenpill-dev-guild/issue/PRD-1156).
**Broader feature scope:** [PRD-727](https://linear.app/greenpill-dev-guild/issue/PRD-727).
**Videos:** [PRD-728](https://linear.app/greenpill-dev-guild/issue/PRD-728).

## Outcome and scope

A gardener can make or take up a promise, provide the right evidence, and identify who acts next.
A steward can open the pool, seed promises, review participation and confirmation, and end a
season safely. Both distinguish linked work, approved work, counted work, confirmation, and money.

The October 15 implementation instruction authorized these guides. The later user instruction
also authorizes committing, pushing and opening a draft PR against develop under PRD-1156,
including a guide coverage and visual consistency pass. It does not authorize merge, deployment,
financial transactions, or external issue updates. PRD-727 retains the full
community and builder scope, settlement/recovery operations, pilot limits, and partner narrative.
Its historical blocked docs lane is not certified by this release slice.

## Refreshed baseline

- [#795](https://github.com/greenpill-dev-guild/green-goods/pull/795) and
  [#896](https://github.com/greenpill-dev-guild/green-goods/pull/896) are merged. #896 merged as
  `f98a3543acba084e997ebfa4f92f879cc8df3d0a`, with the same tree as published `6e112284462f8d5576d025c7094ccadbd214533b`.
- Authoring uses an isolated checkout at `b9176994beddb74c1f32240a1829a7e2c3805896`, containing
  both docs foundations and the released 2.0.1 recovery patch. The shared planning checkout remains
  untouched. Live develop was `754accee69770e06a809f636d741b9abda357ca3` when work began; fetching
  it is network-blocked. GitHub comparison shows the intervening test-maintenance merge changes
  no pooling runtime or Community guide. No claim is made that this is a new release candidate.
- 2.0.0 shipped October 14; production now serves 2.0.1. The
  [release pack](../../../../docs/releases/2.0.0/README.md) owns deployment, indexer read-back,
  owner acceptance, and the narrowed settlement scope. Preserve its provenance rather than
  repeating a signed or financial ceremony.
- #896 already added the overview narrative. Update its availability and links rather than
  writing a second explanation. Its
  [pooling insertion handoff](https://github.com/greenpill-dev-guild/green-goods/blob/6e112284462f8d5576d025c7094ccadbd214533b/.plans/active/community-docs-revamp/handoffs/pooling-insertion-points.md)
  records the new FAQ route, evaluator location, task contract, glossary, and next-step components.

## Decisions and inherited contracts

| # | Decision | Reason |
|---|---|---|
| 1 | PRD-1156 owns these release guides; PRD-727 remains open for full pooling documentation. | The user retained this boundary, and live issue descriptions agree. |
| 2 | Keep the existing gardener/steward categories and pooling slug; add `/community/gardener-guide/commitments`. | The merged foundation supplies the navigation. |
| 3 | Use #896's task page contract and one primary `NextBestAction`. | Readers need a consistent purpose, prerequisites, actions, success, next actor, and recovery. |
| 4 | Describe released Garden coordination, not new money-reward or settlement procedures. | The October 13 scope decision and `SETTLEMENT_ENABLED = false` exclude those writes. |
| 5 | Reconcile the documentary claim and stale Commitment/Cycle integration evidence; preserve the pool chain gates. | Application availability reads those capability fields. |
| 6 | Keep everyday definitions inline; defer adding pooling terms to the generated glossary. | The guides explain their terms inline; the broader glossary expansion remains PRD-727 work. No new schema is needed. |
| 7 | Reuse `FaqQuestions` with explicit stable question IDs at `/faq`. | Preserve direct links, search, and complete Markdown twins. |
| 8 | Label illustrations by fixture/build/date and keep instructions complete without them. | A fixture is not signed production evidence. English text does not wait for video or translation. |

The docs [guide](../../../../docs/AGENTS.md), [page contract](../../../../docs/README.md), and
[ontology workflow](../../../../.claude/context/ontology.md) own implementation rules. The
existing `human_concepts`, formal ontology destinations, and 56 glossary anchors remain authoritative.
The steward task component remains an unordered list; pooling does not become a mandatory step
for every steward. Assessment instructions remain in the Evaluator guide.

## Availability evidence, October 15

| Boundary | Observed evidence | Conclusion / limit |
|---|---|---|
| Released scope | 2.0 release pack and GitHub 2.0.1 release; checked-in Client/Admin deployment and read-back receipts dated October 14 | Garden promises are included. Historical deployment evidence is not a fresh signed-action test. |
| Public live reads | Brave extension, production public Garden page: active season and text saying neighbours can offer and take up commitments; opened the Garden's actual Promises tab read-only | Live public read path verified. No membership, role change, work upload, or confirmation was sent. No private identities or screenshots of member data are stored here. |
| Chain availability | `useCommitmentPoolingAvailability` → `selectCommitmentPoolingAvailability` → `entity:commitment-pool` chain capability | Supported deployment, activation, integration, and availability are all required. Arbitrum is declared available; Sepolia is not deployed. A missing read is not proof of absence. |
| Money boundary | `packages/shared/src/config/app.ts`; creation/mutation guards and `useSettlement.ts` | New money-reward promises and settlement writes are blocked in this app release. Existing history may be readable. Kept is not paid; dispatch is not arrival. |
| Garden work | Client `CommitmentWork`/`LinkWorkSheet`; shared `acts.ts`; contract `WorkCreditLib` and `ConfirmLib` | Counted required work plus any required assessment drives readiness. No manual Send for Confirmation step for garden work. |
| Other evidence and confirmation | Shared `acts.ts`; Client proof/confirmation screens; contract `ConfirmLib`/`CreditLib` | The lead sends other proof when offered. Readiness freezes contributions. Contributors cannot self-confirm; the required threshold must land. |
| Fresh RPC/indexer probe | Public RPC is blocked by the sandbox network allowlist; direct indexer request returned HTTP 403 | Do not relabel these attempts as live protocol verification. Use the dated release read-back and observed public UI, retaining signed-flow QA as pending. |

The checker rejected the available marketing claim while its referenced Commitment still said
product integration was blocked. Source/consumer inspection showed all application availability
checks read `entity:commitment-pool` chain maturity. The stale Commitment and Cycle integration
records are corrected using the release and live reading evidence above. The pool record and
every chain gate remain identical, and `SETTLEMENT_ENABLED` stays false. Series, exchange and
other unverified capabilities are not promoted. No new runtime action is enabled by these edits.

## Implementation checkpoints

| Step | Task-owned files / output | Status and completion check |
|---|---|---|
| 1 | This plan; existing release records and source authorities | Evidence above gathered; current action labels and guards inspected. Live signed replay remains pending. |
| 2 | New gardener `commitments.mdx`, gardener index, sidebar | Written: offer/request roles, making/taking up, approval-gated requests, work/proof paths, confirmation, withdrawal and queue recovery. Verify built route/sidebar/search/twin. |
| 3 | Existing steward `commitment-pooling.mdx`, steward index | Written: setup, fixed split, seeding without money rewards, participation review, counting/confirmation, End versus Archive, partial-send recovery. Verify labels, source paths and reading order. |
| 4 | Gardener Submit Work, Track Your Work, Recover Unsent Work | Written: optional promise selection, linked/approved/counted distinction, action-specific queued recovery. Ordinary work remains independent. |
| 5 | Welcome, How It Works, Why We Build | #896 narrative retained; stale pre-release wording replaced and guides connected. |
| 6 | FAQ, steward Funding and Governance, funder index | Written: six recovery questions and the boundary between promises, shared funds and endowments. Verify disclosure anchors and twins. |
| 7 | Projection source plus declared generated consumers | Claim and stale Commitment/Cycle documentary integration records updated; pool chain gates unchanged. Regenerate and inspect diffs. New glossary terms and runtime activation deferred. |
| 8 | Gardener illustration and guide | Optional illustration deferred: the existing Storybook fixture failed during mock initialization (`mockObject` in `useWalletModalOpen`). Text is complete; fixture repair and illustration follow-up remain under PRD-727. No live member records were captured. |
| 9 | Steward illustration and guide | Optional illustration deferred with the fixture limit in step 8. The written setup and confirmation paths are complete and keep money actions outside the release. |
| 10 | Builder Architecture and release entry links | Add direct guide links where relevant. Published release notes are not republished by editing their local source. |
| 11 | Validation and rendered proof receipt below | Selected checks passed cumulatively; see the receipt below. Responsive pages, FAQ fragments and Markdown twins inspected; final build/search reading pass recorded separately. |
| 12 | Full docs handoff, index and this plan | Delivered pages and PRD-727 remainder recorded here and linked from the full docs handoff. Lane certification and external states preserved. |

## Coverage and visual consistency review, October 15

The publication follow-up checked the released tasks against the owning Client and Admin views,
Submit Work, Review Work, Make an Assessment, Mint Impact Certificate, and Docs' page contract.
Two gaps were completed: how a gardener joins an open team, and the steward's exact Count Linked
Work recovery with its indexed result and newer-decision recovery. The required-assessment path
now links to the existing Evaluator guide and explains attaching a current provider-garden
assessment before readiness.

| Released user job | Guide / section | Coverage |
|---|---|---|
| Make an offer/request; take it up or wait for approval | Gardener Commitments, steps 1–2 | Covered, including whose turn it is and uncertain sends |
| Join a contributing team | Gardener Commitments, step 2 | Added Join the Team, online-only behavior, lead-chosen teams, and contribution distinction |
| Provide proof or link exact required garden work | Gardener Commitments, step 3; Submit Work | Covered; work remains valid without a promise |
| Track approval, counting, readiness and confirmation | Track Your Work; both commitment guides, steps 3–4 | Covered, including independent confirmers, thresholds and the freeze boundary |
| Record and attach a required assessment | Existing Make an Assessment; steward step 4 | Reused existing guide; added provider-garden attachment instructions |
| Withdraw before take-up; recover pending sends | Gardener recovery section; Recover Unsent Work; FAQ | Covered; direct online actions are distinguished from saved sends |
| Set up/open the pool, season or campaign; fixed recognition split | Steward step 1 | Covered; opening warning precedes action |
| Seed promises; review requests and partial batches | Steward steps 2–3 | Covered with new money rewards deferred |
| Count approved links and check read-back | Steward step 4 | Added exact action, success, pending and newer-review states |
| End or archive a season; find certificate guidance | Steward step 5; existing Mint Impact Certificate | Covered with certificate availability and final archive limits retained |
| Understand rewards, donations and endowments | Both guides; FAQ; existing funder/funding guides | Covered by clear release limits; no unavailable payment tutorial |

No additional standalone guide is needed for the released gardener/steward slice. Detailed
fallback/dispute/cancellation/expiry operations, protocol coordination, settlement account/recovery
and payouts, ongoing offers/exchange/credit, full builder documentation, translations, glossary
expansion and fresh illustrations remain PRD-727; videos remain PRD-728. This is not a claim that
all pooling documentation is finished.

Visual alignment uses the existing Docusaurus shell and Docs typography/tokens, standard numbered
steps, compact native callouts, comparison/recovery tables, one primary NextBestAction, and an
explicit Next step heading. The steward guide now reuses StewardPathNav, and its shared unordered
task list links to Commitment Pool without making it a prerequisite for other steward work.
No custom styles, theme components, or dependencies were added. An existing older pool screenshot
was inspected but not reused: it shows outdated button labels. Fresh product figures stay deferred
under the recorded Storybook limit; instructions remain complete without an image.

Publication base: live develop was verified through GitHub as
`754accee69770e06a809f636d741b9abda357ca3`, matching the complete local origin/develop objects.
The isolated branch was advanced to that base before regeneration and validation. Git's SSH and
HTTPS transports are network-blocked here; the connected GitHub API will publish the exact tree,
with its root tree hash checked against the local commit. The repository's branch-name checker
requires a work-type prefix and rejects agent-name prefixes. The remote already has a standalone
`docs` branch, which blocks the `docs/...` namespace. Publication uses
`chore/pooling-release-docs`; no existing branch is removed or rewritten.

## Validation

TDD is not applicable to prose, navigation links and screenshots. No runtime or generator behavior
is being added. The existing query test is refreshed for the released coordination/deferred-money
boundary; its old unavailability assertion failed before that update. Ontology CI and local
selection gain only the three new evidence source paths, retaining every previous check. Existing generator/ontology tests and output checks protect the documentary source
change. Select fresh checks against the full task path set:

```bash
bun run check --plan -- --intent qa --changed <complete-task-path-list>
bun run --cwd docs audit -- --ci
bun run check --only docs-generated
bun run check --only vocabulary
bun run check --only ontology
bun run --cwd docs build
```

Use the merged source's generation commands before consistency checks:

```bash
bun ./scripts/quality/check-ontology.mjs --generate
bun ./scripts/docs/generate.mjs
```

The build already checks route search coverage. Inspect the gardener/steward pages on phone and
desktop widths, sidebar and direct links, FAQ fragments, search, and Markdown twins. Every new image
needs an existing path, alt text and a source/date/build caption. Preserve accessibility and legacy
anchors. Browser observations name the engine/session and what was actually read.

No automated or agent read-through is unfamiliar-reader usability testing. Owner visual acceptance,
physical-device/offline/signing replay, and three unfamiliar readers remain human QA inputs; report
their absence rather than certifying them. Production availability does not make a local edit deployed.

## Broader handback

PRD-727 retains full architecture and settlement operations/recovery, confirmation provenance depth,
pilot boundaries, ongoing offers/exchange/credit when verified, and the partner Google Doc. PRD-728
owns videos. Translations, glossary expansion, new runtime activation and broader IA remain outside
these release guides. The Google Doc narrative boundary is resolved in that full work, not by making
new user instructions depend on it.

At start, `linear-sync --feature commitment-pooling --json` returned `preserve_existing` for all
existing records. PRD-1156 and PRD-727 were read live; no record was written or reparented, and the
completed foundation project was not reused for new scope. Preserve the existing machine lane's
uncertified state while recording this slice's working-copy evidence.

## Implementation receipt

Source base: `b9176994beddb74c1f32240a1829a7e2c3805896`, in the attached isolated worktree.
Evidence describes the changed working tree, not edits contained in HEAD. No commit, push,
merge, deployment, external issue write, or financial action is included.

Delivered: gardener Make and Keep a Promise; expanded steward Run a Commitment Pool; optional
work-linking and recovery guidance; six stable FAQ questions; navigation, orientation, funding,
builder and release-source links. Generated projections now reflect the released coordination
scope. No application runtime, chain gate, glossary schema or settlement flag changed.

Observed checks:

- `bun run --cwd docs test`: 92 passed, zero failed.
- `bun run --cwd docs audit -- --ci`: zero hard findings; two pre-existing advisory endpoint
  warnings (Anatomy and EAS).
- `bun run check --only vocabulary`: passed.
- `bun run check --only docs-generated`: all 17 projections current after full generation.
- `bun run check --only ontology`: 73 fixture tests and all guards passed; seven existing
  baselined findings retained.
- `bun run check --only validation-system-test`: 389 passed, zero failed.
- `bun run --cwd packages/shared test -- src/__tests__/ontology/query.test.ts`: four passed.
  The prior unavailable-Commitment expectation failed before the documentary update; the revised
  test checks released coordination, deferred money, unavailable Series, and both chain gates.
- The `qa` selection covered all 37 task paths and selected 13 checks: format, lint,
  validation-system-test, Shared typecheck/test-typecheck/test, Client test, Admin test,
  Agent typecheck/test, docs-authority, docs-build, ontology. Eight passed before the isolated
  checkout's missing Agent dependency link stopped the run. Existing dependencies were then
  reused without installation; all five remaining checks passed with:

  ```bash
  bun run check --only agent-typecheck --only agent-test --only docs-authority --only docs-build --only ontology --test-path agent:src/__tests__/public-commitment-impact-api.test.ts
  ```

  Focused consumer test paths were Shared `src/__tests__/ontology/query.test.ts` (4), Client
  `src/__tests__/views/GardenCommitment.test.tsx` (45), Admin
  `src/__tests__/views/CommitmentDialog.test.tsx` (31), and Agent
  `src/__tests__/public-commitment-impact-api.test.ts` (12). All passed. Biome matched five
  files for format and zero for lint; prose proof comes from audit, build and reading, not that
  zero-file lint result.
- `bun run --cwd docs build`: static build and search coverage passed (73/73 live routes).
- `node scripts/harness/plan-hub.mjs validate`: 27 hubs passed.
- `node scripts/quality/check-guidance-links.mjs`: 91 guidance files passed; seven local plan links resolved.
- `git diff --check`: passed.
- Plan lane, follow-on and Linear configuration records were compared with the base and remain identical.

Sensitive configuration changes are limited to adding the release receipt, app configuration,
and availability selector as ontology evidence paths in `.github/workflows/ontology.yml` and
`scripts/data/validation-policy.json`. No existing selection or gate was removed or weakened.
Package manifests and lockfiles are unchanged. Temporary dependency links reuse the existing
local installation; no dependencies were installed or upgraded.

Rendered proof: Brave extension, public localhost static Docs build, October 15. These are
public documentation pages, not authenticated signing proof. The gardener and steward guides
were read at 390px phone and 1440px desktop widths; the gardener role table fits the phone;
no page-wide horizontal overflow was observed. Sidebar routes, primary next links, FAQ direct
fragment auto-opening and keyboard disclosure were checked. Markdown twins contain complete
instructions and all FAQ answers; the LLM index includes the new gardener route. Next-step MDX
attributes remain in guide twins, matching the existing generator contract; FAQ wrappers flatten.
Final static build passed after moving the fixed-split warning before the opening steps. Local search for `promise` lists the new gardener guide first, followed by FAQ and supporting guidance. Desktop gardener and phone steward screenshots are retained as local review artifacts outside Git.

Availability limits: production public Garden/Promises reading is verified, alongside dated
release/indexer receipts and source guards. Fresh RPC access was network-blocked and the direct
indexer request returned 403. Signed mutation replay, physical-device/offline replay, owner visual
acceptance and unfamiliar-reader testing were not performed. Those remain explicit QA work;
this slice does not certify PRD-727's full lane. Optional fixture images are deferred after the
Storybook mock initialization failure; the guides do not depend on them.

Task record: PRD-1156 release-essential pooling docs / PRD-727 | Type: guidance | Outcome: release-essential implementation complete; broader QA pending
Agent/model: Codex / GPT-6 | Coverage: October 15 implementation, after the completed research/review

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | 2026-10-15 22:38:07 → 22:43:32 | Refreshed #896, live issue boundaries, production release receipts, source and live public reading path. |
| Implement | 2026-10-15 22:43:32 → end unknown | Guides, supporting links, FAQ and documentary availability prepared in isolated checkout. Small clarity changes continued during verification. |
| Verify | 2026-10-15 22:56:23 → 23:07:40 | Selected checks passed cumulatively; public Docs browser proof and final handoff checks. Earlier checks ran during implementation; their phase start is unknown. |

Human corrections: 0 observed in this segment; attention: unknown.

## Planning record

Task record: PRD-1156 release-essential pooling docs / PRD-727 | Type: guidance | Outcome: complete (plan only)
Agent/model: Codex / model unknown | Coverage: this planning follow-up, excluding the earlier research pass

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | 2026-10-12 02:36:08 → 02:41:38 | Refreshed PR/issue scope, source boundaries, and repository guidance. |
| Implement | 2026-10-12 02:41:38 → 02:43:43 | Wrote this plan and linked it from the two existing handoffs. No product docs or runtime changes. |
| Verify | 2026-10-12 02:43:43 → 02:44:15 | Hub validation: 27 hubs passed. Guidance checker: 78 files passed. All 13 local link targets across the three task files resolved; whitespace checks passed. |

The scoped `qa` selector selected only `format` and passed, but Biome matched zero Markdown
files; that result is not prose-format validation. The direct link/whitespace review supplies
the task-file evidence. Checks describe this shared working copy, not the committed HEAD or a
release candidate. Rendered proof: none; this change only creates a planning handoff.

Human corrections: 0 observed in this segment; attention: unknown.

## Publication follow-up record

Task record: PRD-1156 publication, guide coverage and visual consistency | Type: guidance | Outcome: ongoing
Agent/model: Codex / GPT-6 | Coverage: follow-up after local implementation

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate / review | 2026-10-15 23:46:35 → 23:51:09 | Live develop, owning team/counting/assessment controls, shared guide structure and old image inspected. |
| Implement | 2026-10-15 23:51:09 → 23:54:05 | Completed coverage and navigation gaps on verified develop. |
| Verify | 2026-10-15 23:54:05 → ongoing | Fresh Docs tests 92/92, build/search 73/73, authority/ontology/vocabulary, public Brave navigation and reading checks passed; post-commit push gate follows. |

Human corrections: 0 observed in this segment; attention: unknown.

Publication review batches: (1) authored guides, role navigation and FAQ; (2) ontology claim,
generated output and query expectation; (3) evidence-path CI selection and hub records. All task
files were inspected; runtime gates, package manifests/lockfiles and existing lane state remain
unchanged. The full test-maintenance merge on develop is upstream context, not part of this PR.

Rendered publication proof: Brave extension, public localhost static Docs build, October 15;
390px phone and desktop. Shared steward tasks wrap within the phone width. Both guide pages keep
the existing heading/body fonts, article shell, numbered instructions, native callouts, recovery
tables and a single primary next action. Product signing, real-device/offline behavior, owner
visual acceptance and unfamiliar-reader testing remain pending; these Docs reads do not certify
those workflows. Fresh illustrations and detailed exception/settlement operations remain PRD-727.

## PR #1109 pre-merge review, October 15

Inspected live head `f9d8c49c2a4179502e7498feb610629d1a4dd1d7` on
`chore/pooling-release-docs`, targeting `develop` at
`754accee69770e06a809f636d741b9abda357ca3`. The tracked repository/ref and clean
checkout match the live head. This is the trusted same-repository documentation branch; no
dependency, hook, or runtime changes are introduced by the corrections below.

Feedback snapshot: zero reviews, zero inline comments/threads, and one informational CodeRabbit
draft-skip notice (comment 6204945387, last updated 2026-10-16T00:09:05Z). REST review, inline and
conversation pages were exhausted at fewer than 100 items; the thread connector also returned zero.
There is no external actionable feedback to close. Do not treat a skipped bot review as an approval.

The full 38-file union was reviewed in three batches: authored guides/navigation and release links;
ontology/projections/query expectation and CI evidence coverage; then hub/plan records. Generated
digest-only deltas and the changed projection fields were checked structurally. Pool chain gates,
settlement flags, existing lane states and Linear state-preservation configuration are unchanged.

| Finding | Root cause and bounded correction | Status |
|---|---|---|
| R1: Optional pooling inside required onboarding | Keep the five-step ordinary work/recovery sequence; put Promises in an optional paragraph. Checked steward task navigation remains unordered. | Fixed in working tree |
| R2: Not Yet described as a note without its state change | Document the final Send to the Stewards action, Under review by stewards result, blocked ordinary confirmation, and failed-send recovery. Sweep the guide, FAQ and recovery page. Exact confirmation labels and irreversible confirmation are stated before acting. | Fixed in working tree |
| R3: Client Help path given to dashboard users | Use dashboard Settings → Support, with the phone Profile entry; keep Client Profile → Help guidance unchanged. | Fixed in working tree |

Source proof: Client ConfirmSheet/ConfirmNotYet and its controller map Not Yet to
TerminalLib.raiseDispute; ConfirmLib accepts ordinary confirmation only from ReadyForConfirmation.
Admin AccountSurface and AccountSettingsPanel own the dashboard support entry. No runtime behavior
is changed, so TDD is not applicable; document audit, build/twins, source comparison and rendered
reading supply closure proof. Targeted validation and publication results follow in the PR/chat.

PRD-727 retains detailed dispute resolution/fallback/cancellation/expiry operations, settlement,
full builder/partner documentation, fresh illustrations and the outstanding signed/device/human QA.
No lane is certified and no Linear record is changed by this bounded review.

Task record: PRD-1156 / PR #1109 review | Type: guidance | Outcome: fixes prepared
Agent/model: Codex / GPT-6 | Coverage: this pre-merge follow-up

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate / review | 2026-10-16 00:18:39 → 00:22:24 | Exact live head, complete feedback, three diff batches and owning control/state paths inspected. |
| Implement / verify | 2026-10-16 00:22:24 → ongoing | Six scoped Markdown/MDX files; no runtime change. |

Human corrections: 0 observed; attention: unknown.

Targeted closure proof: Docs audit passed with zero hard findings and the same two advisory
endpoint warnings; Docs tests passed 92/92; production Docs build/search covered 73/73 routes;
plan-hub validation passed 27 hubs; guidance links passed 91 files; whitespace checks passed.
Brave public localhost static Docs rendering verified the five-step onboarding list excludes
Promises, the confirmation section explains the sent review state and failed-send distinction,
the dashboard Support path is correct, and the existing FAQ fragment opens its updated answer.
No page-wide overflow was observed at the desktop viewport. Rendered Docs proof is not signed
product or device/offline proof. The post-commit Push Gate covers the full 38-file PR union,
including the four focused consumer tests selected by the review plan; fresh CI must follow.


## Action guides and visual consistency follow-up, October 15

The user approved the preceding audit plan for PRD-1156 and requested implementation and a push
into draft #1109, without merging. This section supersedes earlier scope notes that deferred
release-essential illustrations and glossary explanations. It does not complete the PRD-727 hub.

- The two pooling pages now become seven task pages: Make, Keep and Confirm a Promise; Open a
  Pool, Seed Promises, Review Promises and End a Season. Existing broad URLs redirect to the
  appropriate role guide's Promises section. Promises stays outside required onboarding.
- Make an Initial Assessment names the supported baseline task. Evaluator guidance distinguishes
  later/post/delta assessment without inventing a submission path: the current command creates
  initial assessments only. A delta procedure, full pooling operations and product QA remain PRD-727.
- Community navigation no longer contains Capability & Claims, Product History or a nested
  Reference bucket. The claims evidence is still generated and checked at `docs/claims.generated.md`.
  Historical research redirects to the actual archived files at tag v1.1.0; releases go to GitHub.
  Brand and credits remain in the footer. Builder Reference loses the extra Garden setup level.
- The glossary has 17 everyday concepts and 26 source-backed UI explanations. Promise keeps the
  old Commitment fragment. Formal/technical legacy fragments lead to Builders ontology without
  visible stub sections. Season and contributor notes distinguish live coordination from the
  broader model or deferred payouts; application capability flags and chain gates are untouched.
- All 26 community guides now have a visible opening image at desktop and phone sizes. Seventeen
  distinct images were generated with the built-in image tool and reviewed; prompts, dimensions
  and hashes live in `docs/assets/illustrations.json`. After the user's no-faces correction, all
  seventeen were replaced with distinct scenes of tools, places and completed work without people.
  The older generated artwork still used by the site was visually checked and has no faces.
  The README and image ledger preserve that constraint. Editorial openings fill the article.
  Standalone figures center; existing product figures pair the screenshot with explanation on
  desktop and center it above the text on phones. Required third-party attribution is retained.
- Three new Storybook captures show richer Your Work: multiple work items, linked drafts and
  proofs, plus two approvals and a rejection. Recovery has its own To upload variant. Provenance
  moved to `docs/assets/capture-ledger.json`; visible captions explain the task instead of saying
  editorial illustration or repeating website/source metadata.

Reuse: the existing role indexes, StewardPathNav, NextBestAction, figure CSS, projection renderer,
TermAnchor and documentation fixture branch own this work. No new documentation framework or
runtime pooling behavior was introduced. TermAnchor retains build-time anchor collection and
adds legacy fragment forwarding. Docs audit explicitly checks valid credential-free HTTPS archive
redirects while retaining internal target validation, with negative HTTP/credentials/script tests.
New projection evidence inputs are added to Docs workflow and validation selection. The claims
output path is updated in ontology workflow/selection; no check or baseline is weakened.

Verification: Docs tests pass 96/96; generator/ontology tests pass 118/118, including the final availability-note
assertions. The authority audit has zero hard findings and two existing endpoint advisories.
Production Docs build and search cover 76/76 routes. The selected QA checks pass across Shared,
Client, Admin and Agent, plus validation-system tests, source structure, test quality, ontology,
generated outputs and story quality. Storybook production build passes (422 components / 2260
stories). A temporary cross-checkout dependency-link issue was corrected locally without installing
packages, changing manifests or changing the lockfile. The initial preview bootstrap caused the
published Storybook interaction job to load a second mocker. The follow-up moves initialization
into ordinary-preview annotations only; Vitest retains its own runtime. The normal Storybook
preview renders the rich recovery fixture. Local interaction-test attempts stop at Chromium's
macOS MachPort permission failure before importing a story, so CI must confirm interaction proof.

Rendered proof: Brave extension, public localhost Docs static build and Storybook, 2026-10-15;
26 community openings at 390×844 and 1440×1000, all with images in the initial viewport and no
page-wide overflow. Screenshot/text pairs intentionally use side-by-side layout on desktop.
Both light and dark appearance, navigation, glossary fragments, retired routes and search are
checked as described in the PR. These are fictional fixture/public Docs reads, not authenticated
wallet, signed mutation, physical-device, offline-storage, owner or unfamiliar-reader acceptance.
The local static server has an existing `/brand` directory collision; Brand is outside the changed guide routes. Product route/deployment behavior was not changed
for that preview quirk.

Remaining PRD-727: detailed dispute/fallback/cancellation/expiry and protocol coordination;
settlement/recovery/payouts, ongoing offers/exchange/credit, complete builder/partner narratives,
post/delta assessment UX and guide, translations and outstanding signed/device/human QA. Videos
remain PRD-728. Live PRD-1156 was observed In Progress and PRD-727 Todo; no Linear records or hub
lane states were changed. The PR remains draft and unmerged.

Task record: PRD-1156 / #1109 action guides | Type: guidance | Outcome: implementation verified
Agent/model: Codex / GPT-6 | Coverage: this implementation follow-up

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate / implement | 2026-10-16 01:50:18 → 02:26:02 | Current PR checked; approved source, navigation, glossary, imagery and fixture changes prepared. |
| Verify / review | 2026-10-16 02:26:02 → ongoing | Docs/build, source checks, Storybook and rendered reading; publication evidence follows in PR/chat. |

Human corrections: 1 observed in this segment (generated artwork must not show human faces); attention: unknown.


No-faces follow-up, October 15: all 17 replacements, alt text, dimensions and asset hashes are
current. Docs tests pass 96/96; production build/search cover 76/76 routes; authority and generated
checks pass with the same two advisory endpoint warnings. Brave extension, public localhost Docs:
all 26 opening images load in the initial phone viewport without page-wide overflow; the desktop
openings were visually reviewed again at 1440×1000. The new still-life/landscape images have no
people, including within the small photographs in Track Your Work. Existing third-party photography
and actual UI captures retain their provenance. The Storybook configuration is the only harness
change in this correction; dependencies, lockfile, permissions, tests and CI requirements remain intact.

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Publish / inspect CI | 2026-10-16 02:55:56 → 03:29:35 | ad473e2ee published; Docs CI passed, Design interaction bootstrap regression identified. |
| Implement / verify correction | 2026-10-16 03:29:35 → ongoing | No-face artwork, ordinary-preview-only initialization, repeated Docs/rendered proof; final publication and current-head CI follow in PR/chat. |

## Deep-review fixes, October 15

The user authorized all six findings from the follow-up review for PRD-1156 / #1109.

1. Keep a Promise now distinguishes making an offer, fulfilling a request, making a request,
   receiving an offer, and contributing to a team. Recipients follow confirmation guidance;
   providers follow the evidence steps. The existing FAQ fragment remains valid.
2. Seed Promises explains grouped partial results: created copies are published; copies that
   did not send remain queued within the group. Finish Creating sends only those pending
   copies. Individual queued rows retain Send Now / Try Again instructions and the example
   explicitly avoids recreating successful copies.
3. The old PWA glossary fragment sits beside Installed app. Both smart-account fragments lead
   to the formal Builders definition. A regression assertion failed before the generator fix
   and passed afterward; published anchor retention and uniqueness still pass.
4. End a Season, the minting guide, the Hypercerts integration and glossary distinguish the
   generic approved-work wizard from unavailable cycle-specific certification. The cycle can
   remain Reconciled. Archiving is final. Future cycle certification stays under PRD-727.
5. Nine Builder pages now open with distinct contextual diagrams, covering the previously
   missing Agent, Contracts, Indexer and Monorepo Map visuals. Repeated Builder screenshots
   were replaced or linked from their owning guide. Diagrams center in the article, and the
   package map was simplified after phone review. No generated raster artwork was added or
   changed; the no-human-faces requirement remains in force.
6. Three historical correction counts accidentally overwritten by the no-faces follow-up were
   restored to their earlier values. The actual no-faces correction remains recorded once in
   its own implementation segment.

The additional local Brand preview limitation is addressed: the page lives at `/brand-kit`,
with a static `/brand` forwarding page. Download URLs stay unchanged. The footer, credits and
Docs README name the canonical page. The two certificate-form evidence inputs are added to
Docs workflow path selection and validation inputs; no gate, permission, dependency, lockfile
or baseline was weakened.

Verification: Docs tests 96/96 and source generator/ontology tests 118/118 pass. The selected
bounded review checks pass (validation-system tests, Shared ontology query test and the focused
Docs tests). The production build and search cover 76/76 live routes without broken-anchor
warnings. The authority audit has zero hard findings and the same two existing endpoint
advisories; all 17 generated projections are current. The post-commit Push Gate and current-head
CI evidence follow in the PR publication record. All nine workflows passed on the preceding
head e510e0806c15e1bfb974b30efa47342b310e22bd, including Storybook interactions.

Rendered proof: Brave extension, public localhost Docs, 2026-10-15. Nine Builder openings and
four corrected task guides were reviewed at 1440×1000 and 390×844; opening diagrams are visible,
centered, and have no page-wide overflow. The package map also renders in dark appearance.
Both legacy glossary links reach their definitions in the production preview, the existing FAQ
fragment reaches the role explanation, and a fresh `/brand` request reaches Brand kit. The
checked production build is served on localhost:3003 for user review. These are public Docs
reads, not signed product, physical-device/offline or unfamiliar-reader acceptance. Those QA
limits and broader pooling, settlement, delta assessment and partner narratives remain PRD-727.
No Linear records or hub lane states were changed; the PR remains draft and unmerged.

Task record: PRD-1156 / #1109 deep-review fixes | Type: fix | Outcome: implementation verified
Agent/model: Codex / GPT-6 | Coverage: this six-finding correction segment

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate | 2026-10-16 05:16:15 → 05:20:07 | Clean isolated PR head and current behavior verified. |
| Implement | 2026-10-16 05:20:07 → 05:28:43 | Approved guide, visual, alias, route and historical-record fixes; focused checks also ran during implementation. |
| Verify / review | 2026-10-16 05:28:43 → 05:33:26 | Final source checks, rendered reading and production-preview review. |
| Publish | 2026-10-16 05:33:26 → ongoing | Exact task staging, pre-commit, post-commit gate and current-head CI follow in PR/chat. |

Human corrections: 0 observed in this segment; attention: unknown.


## Task screenshots, October 17

The accepted PRD-1156 follow-up adds 37 distinct product captures across 16 task guides. Each
capture renders the actual product component with fictional records, and the capture ledger
records its story, dimensions, hash and limits. Three new generated task photographs show
seedlings and a fence before and after repair; none contains people or faces. Opening visuals
remain in place, and the new figures center beside the instructions they explain.

The guides now show promise creation, teams, linked work, proof and confirmation; pool opening,
seeding, participation, counting and season close; giving, endowing and withdrawing; installation
and settings; garden setup, actions, funding and certificates; and one coherent initial assessment.
The installation captures show the app's instructions, not simulated operating-system menus.
The seeding example has no reward, and the certificate guide retains the cycle-certification limit.
The participation instruction now uses the actual Approve control.

The supporting changes are stories, fictional fixtures and four Storybook spy registrations.
Application behavior, dependencies, lockfiles, permissions and CI requirements are unchanged.
No new business behavior or delta assessment functionality is implied.

Verification: Docs tests pass 96/96, production build/search cover 76/76 routes, and the authority
audit reports zero hard findings with the same two existing endpoint advisories. Shared, Client
and Admin story/test typechecks pass, as do the story-quality checks and production Storybook
build. All 37 asset hashes and dimensions match the ledger and their guide references. The
focused Shared ontology test passes; the existing ontology baseline is unchanged.

Rendered proof: Storybook component captures and Chromium in-app browser, public localhost
Docs. All 16 updated guides were reviewed at 1440×1000; figures load, center and have no
page-wide overflow. Eight guides were also checked at 390×844: Make, Keep and Confirm a
Promise; Open a Pool; Seed and Review Promises; End a Season; Donate to a Garden. The other
eight phone checks remain pending because local browser use became disabled in Work settings.
The checked production preview remains available at localhost:3003.

Broader QA limits: Agent unit tests passed 526 with one existing skip. The native SQLite suite
passed 185 but had 11 timeout or hook-timeout failures; those unchanged paths are outside this
documentation task. Aggregate validation-harness tests initially timed out; the final isolated
three-case recheck passed under the original limits. No timeout, test or gate was weakened.
The post-commit Push Gate and current-head CI results follow in the PR publication record.
These captures and Docs reads do not prove authenticated signing, money movement, physical-device
installation, offline recovery or unfamiliar-reader acceptance. Broader pooling, settlement,
post/delta assessment and outstanding product QA remain under PRD-727; videos remain PRD-728.
No Linear state or Plan Hub lane was changed. The PR remains draft and unmerged.

Task record: PRD-1156 / #1109 task screenshots | Type: guidance | Outcome: implementation complete; publication pending
Agent/model: Codex / unknown | Coverage: accepted screenshot follow-up

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate | 2026-10-18 01:44:28 → unknown | Existing guide coverage and real component stories inspected. |
| Implement | unknown → 2026-10-18 02:31:28 | Guides, realistic fixtures, captures and provenance updated; rendered corrections included. |
| Verify / review | 2026-10-18 02:31:28 → 03:16:43 | Targeted checks and desktop review passed; remaining phone review blocked by disabled browser access. |
| Publish | 2026-10-18 03:16:43 → ongoing | Exact staging, pre-commit, post-commit Push Gate and current-head CI follow in PR/chat. |

Human corrections: 0 observed in this segment; attention: unknown.


## Publication blockers and mobile completion, October 19

The user authorized resolving the six expired E2E exemptions, finishing the eight remaining
mobile reviews and pushing #1109 without merging. The screenshot commit fac60a75 remains
part of this publication; no generated artwork or application business behavior changed.

The expired skips were resolved without new expiry dates or test-quality exemptions:

- Six existing session/navigation cases now share `client.session-navigation.ci.spec.ts`,
  discovered by the existing Client CI pattern. They use the canonical mock-auth/backend
  fixtures and test reload, profile logout, protected routes, mobile navigation, garden Back
  and browser history. Conditional early returns and assumptions about retired menu/breadcrumb
  controls were removed. The Playwright configuration is unchanged.
- The wallet-storage smoke diagnostic now verifies rejection when no real connector exists,
  including on iOS, rather than treating a login redirect as authentication success.
- The unreachable authenticated-offline reload case was removed from the development-worker
  suite. Development workers do not precache navigation, and production deliberately omits
  dev mock auth. The production navigation-cache proof and missing-cache control remain in
  `client.pwa-preview.spec.ts`; authenticated offline replay remains a separate PRD-727 limit.
- Test-guide references and the stale passkey claim were corrected to name the surviving proof.

Test-quality, format, lint, source structure and Docs consistency pass. The affected Playwright
selection discovers 17 cases across three files with no conditional test skips. A local execution
attempt stopped before the first case: macOS denied Chromium MachPort startup. This is an
execution limit, not a passing browser test; current-head Client CI must supply executable proof.
Docs tests pass 96/96. Final production build, post-commit Push Gate and current-head GitHub CI
results follow in the PR publication record. No gate, timeout, baseline or permission was weakened.

Rendered proof: Chromium in-app browser, public localhost Docs, October 19. The remaining eight
guides were reviewed at 390×844: Endow a Garden, Remove an Endowment, Install and Update the App,
Make an Initial Assessment, Create a Garden, Manage Actions, Manage Garden Funding and Mint Impact
Certificate. Their captures load, center within the article and fit without page-wide overflow.
Full-page views were also inspected. Combined with the prior eight phone reviews, all 16 updated
task guides now have phone and desktop layout proof. This does not establish physical-device
installation, authenticated sessions, signed transactions or offline storage behavior.

Broader pooling, dispute/fallback/cancellation/expiry, settlement and payouts, post/delta assessment,
complete Builder/partner narratives, translations, signed/device/offline and unfamiliar-reader QA
remain under PRD-727. The earlier Agent SQLite timeout failures remain a broader QA follow-up.
Videos remain PRD-728. No Linear state or hub lane was changed.

Task record: PRD-1156 / #1109 task screenshots | Type: fix | Outcome: verification complete; publication pending
Agent/model: Codex / unknown | Coverage: publication blockers and eight remaining mobile reviews

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate | 2026-10-20 01:39:14 → unknown | Clean isolated fac60a75, live PR head/base, expired skips and supported proof seams inspected. |
| Implement | unknown → 2026-10-20 01:47:34 | Existing cases consolidated and corrected; no test exemptions or config changes. |
| Verify / review | unknown → ongoing | Test governance passes, 17 cases discovered, local Chromium startup blocked; eight mobile guide reviews complete. Final Docs build and publication evidence follow in PR/chat. |

Human corrections: 0 observed in this segment; attention: unknown.


## Develop integration, October 19

The user explicitly authorized integrating current develop into #1109. The first merge
resolved 29 conflicts against 2f78c495, retaining the action guides, 37 captures and face-free
artwork while incorporating develop's current 2.0 availability evidence, US spelling and copy
checks. Both plan history entries survive; upstream Linear routing and the broader blocked
PRD-727 lane remain unchanged. Generated outputs were rebuilt from their owning sources.
The Promise glossary entry keeps develop's alias wording without appearing twice.

Develop then advanced to f2eb2ef8. Its routines update was integrated as well; the only added
conflict was a generated MCP-guide digest, resolved by regeneration. Git's configured SSH proxy
was unavailable and the public HTTPS fetch returned 403. The connected GitHub API supplied the
public commit and blob objects; their Git hashes, signed commit bytes and complete target tree
were verified before integration. No credential, signing or persistent transport setting changed.
The merge commits use the same unsigned GitHub API path as the earlier publication.

Before the final tip refresh, Docs tests passed 99/99, generator/ontology tests 118/118 and the
Shared ontology query tests 5/5. Docs authority and the em-dash check passed; production build
and search covered 76/76 routes. The two existing endpoint advisories remain. Exact installed
parser dependencies were linked into this isolated worktree; no dependencies were installed or
upgraded and no lockfile was changed by this work. Final committed-tree validation and current-head
CI are recorded on #1109.

Rendered proof: Chromium in-app browser, public localhost Docs, October 19. Open a Pool was
reviewed at desktop and 390px phone width; all three figures loaded, centered and fit. Join a
Garden and Review Work were read on phone, and the glossary rendered one Promise heading with
no visible Builder reference section or horizontal overflow. The earlier full 16-guide mobile
review remains applicable to the unchanged capture assets. This is public Docs layout proof,
not authenticated signing or device QA. The production preview remains on localhost:3003.

PRD-727 still owns broader pooling, settlement/payouts, post/delta assessment and signed,
physical-device, offline and unfamiliar-reader QA. The local Chromium startup and earlier
Agent SQLite timeouts remain limits until their owning executable checks establish otherwise.
Videos remain PRD-728. Keep #1109 draft and unmerged; no Linear state or hub lane was closed.

Task record: PRD-1156 / #1109 task screenshots | Type: integration | Outcome: integration complete; final publication proof pending
Agent/model: Codex / unknown | Coverage: authorized develop integration

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate | 2026-10-20 02:09:40 → unknown | Clean branch, live develop and conflict authorities inspected. |
| Implement | unknown → 2026-10-20 02:22:09 | Original 29 conflicts resolved; the advanced tip integrated and projections regenerated. |
| Verify / review | unknown → ongoing | Focused tests and rendered Docs proof passed; final post-commit gate and CI follow on #1109. |

Human corrections: 0 observed in this segment; attention: unknown.
