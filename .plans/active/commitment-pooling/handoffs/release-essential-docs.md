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
