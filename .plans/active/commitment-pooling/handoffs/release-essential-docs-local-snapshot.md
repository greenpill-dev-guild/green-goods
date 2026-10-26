> Historical local planning snapshot preserved during 21 October checkout reconciliation.
> The current release state is [release-essential-docs.md](release-essential-docs.md).
> Original snapshot bytes follow unchanged; this does not reopen completed release work.

# Commitment Pooling: 2.0.0 release-essential documentation plan

**Created / updated:** 2026-10-11 (America/Los_Angeles)
**Status:** Scope accepted for planning; implementation and release verification pending.
**Accountable owner:** Afo; implementation executor to be assigned.
**Release slice:** [PRD-1156](https://linear.app/greenpill-dev-guild/issue/PRD-1156).
**Full feature documentation:** [PRD-727](https://linear.app/greenpill-dev-guild/issue/PRD-727),
with walkthrough videos remaining under [PRD-728](https://linear.app/greenpill-dev-guild/issue/PRD-728).
**Placement:** A bounded execution plan in the existing Commitment Pooling hub, reached through
[the handoff index](README.md) and [the full docs handoff](claude-docs.md). This is not a new
machine lane, a replacement feature plan, or certification of the existing blocked docs lane.

## Outcome and scope

A gardener can find the pooling guide, understand an offer or request, take part in an available
commitment, provide the right evidence, and identify who acts next. A steward can set up and run
the released pool flow. Both can distinguish work approval, confirmation that a promise was kept,
and any associated payment. The release notes lead to these instructions.

This plan delivers one new gardener guide, bounded additions to existing pages, release-specific
claim reconciliation, and a few current screenshots. The wider community information architecture,
full pooling reference, and partner narrative remain with their existing owners.

The user requested this plan after the research pass and explicitly retained broader pooling work
under PRD-727. Planning does not authorize starting implementation, changing branches, publishing,
merging, sending transactions, or updating external records.

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Track the release-essential slice with PRD-1156; retain PRD-727's full community and builder scope. | The live issues already define this boundary. Completing this slice does not close PRD-727. |
| 2 | Build against #795's integrated docs structure; use #896 as a writing and follow-on planning input. | #795 changes routes and generated projections. #896 is a post-release plan, not a content dependency to wait on. |
| 3 | Add `community/gardener-guide/commitments.mdx`, titled **Make and keep a promise**, with sidebar label **Commitments**. | Gardeners need a discoverable path that matches the Promises interface. |
| 4 | Preserve existing slugs and role categories. Put short term definitions beside the first use. | This slice can ship without the broader navigation and glossary redesign. |
| 5 | Describe capabilities by verified environment and action. | Deployed contracts, visible controls, successful coordination, and working payments prove different things. |
| 6 | Put optional support in the existing funding guide and FAQ. | A separate payment tutorial would overstate the release while activation remains evidence-dependent. |
| 7 | Reuse existing docs components and authoritative projections; add no generator feature or new glossary schema. | The release needs accurate guidance and navigation, not new documentation infrastructure. |
| 8 | Ship English text and a small number of cleared screenshots; videos and translation do not block this slice. | The docs site currently has only the English locale. The app's languages are a separate fact. |

## Inputs and dependencies

Research baseline, observed on 2026-10-11:

- [PR #795](https://github.com/greenpill-dev-guild/green-goods/pull/795), open at
  `270f78cb8db3d7aa5e58860db9d4d53d0f4108e4`: builder architecture, Data Model & Ontology,
  revised navigation, projections, Markdown twins, and current visual sources.
- [PR #896](https://github.com/greenpill-dev-guild/green-goods/pull/896), draft/open at
  `875c4d60178a23c8c200779e91bfecfa858243e4`: community page contract and post-release scope.
  Its Q1 proposal to narrow PRD-727 is not adopted. Its steward-audit repair is already present
  in this checkout; do not repeat it. Its broad glossary and navigation work remains deferred.
- Local implementation inspected at `06a31dbf55c25e1edfca35423f0e3a7c77184c16`. The checkout also
  contains other sessions' planning and UI changes. It is not the verified release candidate.
- [Release pack](../../../../docs/releases/2.0.0/README.md),
  [docs guide](../../../../docs/AGENTS.md), and [docs source map](../../../../docs/README.md).
- [Acceptance matrix](../acceptance-matrix.md), [deferred UI scope](ui-deferred-scope.md), and
  the named implementation sources below. Historical prototypes and lane completion are not
  substitutes for current product evidence.

Authoring can start once implementation is authorized and a source candidate is selected. Final
navigation, generated output, and integrated proof use a base containing #795. If #795 is still
open, prepare the text and mapping without merging, switching branches, or copying its generator
changes into this slice. Record the unresolved integration dependency. Do not wait for #896's
entire redesign to finish.

At implementation start, inspect `git status`, the applicable guides, and the existing hub state.
Run `node scripts/harness/plan-hub.mjs linear-sync --feature commitment-pooling --json` as the
plan skill's coordination preview. Respect `preserve_existing`: verify referenced records rather
than applying a bulk update, reassigning them to the completed foundation project, or advancing
the blocked docs lane. Reuse PRD-1156 and PRD-727; no new issue or lane is needed for this plan.

## Release evidence checkpoint

Before assigning **Live** or writing an unconditional instruction, record the candidate SHA,
environment, verification date, source, and observed result for each row in the implementation
receipt. A read failure is unknown, not evidence that a capability is disabled.

| Capability | Implementation authority | Required evidence / wording decision |
|---|---|---|
| Membership and taking up offers/requests | `packages/shared/src/modules/commitment-pooling/acts.ts`; client `Commitment/JoinToAct.tsx` and `CommitmentClaimPanel.tsx` | Distinguish direct acceptance, approval-gated requests, and joining first. Readability does not imply authority to act. |
| Creation and evidence | Client `Compose/ComposeCommitment.tsx`, `Commitment/CommitmentEvidence.tsx`, and shared commitment hooks | Verify exact labels, local draft/queue behavior, successful send, and recovery on the selected candidate. |
| Garden work and confirmation | Shared `acts.ts`; client `Commitment/CommitmentWork.tsx`; contract `lib/CommitmentPooling/ConfirmLib.sol` and `CreditLib.sol` | Approved and counted required work drives garden-work readiness. Other supported types use Send for Confirmation. Confirmers exclude active contributors; thresholds and roster freeze remain explicit. |
| Steward setup and seasons | `packages/admin/src/views/Garden/Pool`; Hub confirmation queue | Replay setup, seeding, scoped claim/confirmation review, and End/Archive distinctions. Record missing or disabled actions honestly. |
| Support and payment | `docs/releases/2.0.0/release-notes.md`; contract `lib/Settlement/PlanLib.sol` and `AcknowledgmentLib.sol`; live activation evidence | Coordination may be available while payment is gated. Kept is not paid; a dispatched transfer is not arrival. Verify existing receipts without initiating a value transfer for documentation. |
| Ongoing offers, exchange, credit, vouchers, and Community Needs | Deferred UI handoff, owning specs, and current routes | Do not infer a released journey from a spec or backend. Give a short availability boundary when needed; full tutorials remain outside this slice. |

Client paths above are relative to `packages/client/src/views/Home/Garden/`. Contract paths are
relative to `packages/contracts/src/`. These are inspection pointers, not permission to edit
runtime code. Public pages name user actions; internal contracts belong in source metadata.

## Page contract

Use a task title, a two-sentence purpose, prerequisites, numbered actions with exact screen labels,
an observable success signal, who acts next, and symptom/action recovery. End with one primary
next step. Each page must also make sense when opened directly from a message or search result.

Keep gardener prose free of protocol terminology. Explain a garden as a community doing work
together; explain the pool as its shared space for coordinating promises under agreed rules.
Use one explicitly illustrative example throughout, with a short variant for the other direction.
Keep warnings beside the decision they affect, including the team freeze and final archive action.
Images supplement text and carry captions, alt text, release/build provenance, and capture source.
The research basis is Steve Krug, *Don't Make Me Think, Revisited*, especially scanning,
navigation, concise instructions, goodwill, and small qualitative usability tests.

## Implementation sequence and coverage

All steps are pending. Each numbered step is a bounded checkpoint. Review the text after steps
1-4 before expanding to the remaining pages; a review is not permission to publish.

| Step | Files / output | Change and completion evidence |
|---|---|---|
| 1. Establish the release boundary | This plan's evidence checkpoint and eventual receipt | Refresh #795/#896 and the candidate, inspect the six capability groups, and record verified/limited/unverified outcomes. Name any prerequisite that prevents an accurate release instruction. No production readiness claim from source inspection alone. |
| 2. Add the gardener path | New `docs/docs/community/gardener-guide/commitments.mdx`; gardener `index.mdx`; `docs/sidebars.ts` | Cover offer/request, prerequisites, direct versus approval-gated taking up, both evidence paths, confirmation, permitted withdrawal, and recovery. Link from the gardener landing and sidebar. A reader can reach the new route and explain who acts next. |
| 3. Expand the steward guide | `docs/docs/community/steward-guide/commitment-pooling.mdx`; steward `index.mdx` | Write the setup and run sequence described below, retaining the existing pooling slug. Verify each action against the candidate and identify its success state. |
| 4. Connect the existing work journey | Gardener `uploading-your-work.mdx`, `track-status-and-attestations.mdx`, `recovery-and-sync.mdx` | Add optional commitment linking, linked/approved/counted distinctions, and queue recovery. A work submission remains valid without a commitment; do not tell users to recreate an uncertain or queued send. |
| 5. Explain where pooling fits | `docs/docs/community/welcome.mdx`; `how-it-works.mdx` | Add a short orientation and links to both guides. Show the promise-to-evidence-to-confirmation sequence with payment as a separate optional outcome. Correct the claim that the docs are translated; preserve #795's unrelated edits. |
| 6. Explain support and answer worries | Steward `funding-and-governance.mdx`; funder `index.mdx`; `docs/docs/reference/faq.mdx` | Add pooling to the mechanism comparison, clarify optional rewards and payment evidence, and add the six FAQ answers below. Use the current funding destinations; do not introduce a new funding product. |
| 7. Reconcile public claims and generated reference | `packages/shared/src/ontology/green-goods-projections.json` and its declared generated consumers | Resolve release-relevant contradictions using step 1 evidence and the source boundary below. Preserve conditional availability. Regenerate through the integrated #795 generators and inspect every resulting diff. This is one atomic checkpoint even if the generator emits more than four files. |
| 8. Add gardener illustrations | Up to two new images under `docs/static/img/community/commitment-pooling/`; new gardener guide | Show a decisive offer/request action and the evidence/confirmation handoff. Verify captions against the image and candidate; all instructions work without the images. |
| 9. Add steward illustrations | Up to two new images in the same directory; existing steward pooling guide | Show setup/seeding and scoped confirmation or season closeout. Use cleared demo/Storybook data; never treat that image as authenticated transaction proof. |
| 10. Connect builders and release entrypoints | #795's `docs/docs/builders/architecture.mdx`; `docs/releases/2.0.0/release-notes.md`; `announcement.md` | Add direct gardener/steward guide links where relevant and retain qualified funding language. Link existing builder reference rather than adding a new architecture tutorial. Verify target slugs against the integrated build. |
| 11. Verify the complete reading path | This plan's implementation receipt | Run the selected checks and rendered reading pass below, replay the documented flows, and record results and limits. Fix failures inside scope; return product defects to their owner. |
| 12. Hand back the remaining scope | `claude-docs.md`; this plan | Record delivered pages and exact deferred items for PRD-727. Prepare the #896 reconciliation and minimal Google Doc correction list below. Completion of this slice leaves wider issues and machine lane state open. |

Step paths with a role-relative filename are under the corresponding `docs/docs/community/`
role directory. New paths are planned outputs, not existing sources. Steps may be committed in
coherent groups only after publication work is separately authorized; do not fragment generated
source and output into different changes.

### Content acceptance for the two principal guides

**Make and keep a promise:** start with the member's reason to use a commitment. Show who provides
and who receives for an offer and for a request. Explain the available take-up action, then branch
between linking required garden work and adding other proof. Name who may confirm and why the
provider/contributor cannot. Explain the team freeze before the action that causes it, show the
confirmed-as-kept result, and point to support status separately. Explain why an action may be
missing: membership, permission, pending acceptance, pool state, an outstanding send, or someone
else's turn. Do not send every reader to the steward dashboard.

**Run a Commitment Pool:** explain Promises and pool readiness; set the shared rules and per-person
limit; review season/campaign settings and the split that becomes fixed at opening; seed promises
with their work, reward, and independent confirmers; review participation requests; distinguish
work approval from commitment confirmation; close and archive only in the supported order.
Include partial multi-prompt setup/seeding recovery and distinguish Garden-scoped confirmation
from protocol coordination. Keep advanced payout execution out of the basic runbook.

**FAQ additions:** Why can't I take this up? Who confirms it? My work was approved; why is the
promise still waiting? Can I withdraw? What happens without internet? Does kept mean paid?
Each answer states the next action or person and links to the owning section. Verify withdrawal
and offline wording per action rather than promising a universal undo or automatic send.

### Source reconciliation boundary

The current steward guide's Live badge, the claims ledger's pre-release wording, and the glossary's
per-entity availability do not tell one clear release story. Resolve the distinctions explicitly;
do not set every entity to available because one coordination journey works.

`green-goods-projections.json` is sensitive shared data: the generated ontology manifest and
`useCommitmentPoolingAvailability` consume maturity for application availability. Step 7 may
correct evidence-backed claim wording, dates, explanatory text, and documentary projections.
Before changing maturity/capability fields, inspect all consumers and compare the resulting
availability decisions. If the change would enable or disable product behavior, separate it into
an explicitly authorized runtime change with its owning proof. Until then, document the actual
limitation and record the dependency. Never use docs work to turn on a feature.

Use existing term definitions and inline explanations. The community glossary presentation and
schema redesign belong to #896. If a canonical definition needs a semantic correction, route it
through the ontology/domain workflow instead of introducing a competing definition in this plan.
Do not hand-edit generated MDX or import a stale diagram into a route #795 retires.

## Verification and completion

TDD is **not applicable** to authored prose, links, and approved screenshots. Evidence consists of
source comparison, generator checks, a built reading pass, and replay against the named product
candidate. No new tests should mirror prose. Generator/runtime behavior changes are outside this
slice and require a separate scope decision and meaningful regression proof.

At execution, read the current validation policy and render the plan from the repository root:

```bash
bun run check --plan -- --intent qa
```

Inspect `selectedBy` reasons and retain applicable overrides. In a shared dirty checkout, use the
selector's explicit `--changed` scope for the complete task-owned path set and report that scope;
do not treat another session's changes as validated. The relevant docs commands, verified against
the current scripts, are:

```bash
bun run --cwd docs audit -- --ci
bun run check --only docs-generated
bun run check --only vocabulary
bun run --cwd docs build
bun run --cwd docs check:search-index
```

For step 7, inspect the merged generator declarations, regenerate with their owning commands,
then check ontology consistency:

```bash
node scripts/quality/check-ontology.mjs --generate
node scripts/docs/generate.mjs
bun run check --only ontology
```

Run only in the authorized implementation checkout: generation writes tracked outputs. The docs
build already checks the search index; its standalone command is useful when diagnosing that
check and need not be repeated after an unchanged successful build. Run `bun run --cwd docs test`
or generator-specific suites when selected, including after integrating generator changes from
#795. A plan-only change does not require building the apps or running their test suites.

Rendered and journey proof:

- Read every changed page at narrow phone and desktop widths, from its direct URL, sidebar, and
  search. Check headings, captions, legibility, next links, and no reliance on images for steps.
  On the #795 base, check that the new route appears in search and the Markdown/LLM output.
- Load `modern-web-guidance` and `dev-surfaces` before browser inspection or service management.
  Label every capture using [the repository browser evidence rules](../../../../AGENTS.md#browser-evidence).
  Storybook/mock-auth can illustrate controls; authenticated evidence owns signing, session,
  installed-PWA, and offline-queue claims. Pending authenticated proof remains visible and is
  advisory for ordinary docs publication; release attestation follows the release gate.
- Replay offer and request participation, approval-gated acceptance, both evidence paths, and
  the steward sequence against the selected build or cite valid matching receipts. For unknown
  sends and payment states, inspect existing evidence; do not send money or mutate production
  merely to capture a guide.
- Run a small qualitative read-through with three available readers spanning gardener and
  steward tasks. Ask them to find their task, identify who acts next, explain kept versus paid,
  and recover a waiting item without coaching. Fix observed confusion. This is usability evidence,
  not a statistical guarantee. If participants are unavailable, record it as pending and let the
  release owner decide its scheduling; do not relabel an agent replay as user testing.

Implementation is ready for review when all scoped pages are reachable, instructions match the
candidate, contradictory availability statements are resolved or explicitly qualified, generated
outputs agree with their sources, required automated checks pass, and remaining evidence limits
have an owner. Use the `ship` workflow only when publication is requested; current-head CI and
the release owner's deployment/attestation gates remain independent requirements.

After separately authorized publication, verify the real docs URLs and release-note links against
the deployed build. A local build does not prove that the docs deployment is active or current.

## Deferred work and dependency handback

| Owner | Remains outside this slice |
|---|---|
| PRD-727 | Full pooling architecture and settlement operations/recovery, recognition and payout-plan detail, ongoing-offer and exchange tutorials when verified, pilot boundaries, and complete partner narrative reconciliation. |
| PRD-728 | Recorded pooling walkthrough videos after the documented product behavior and evidence are ready. |
| #896 community revamp | Role-category restructuring, evaluator track, FAQ relocation, plain-language glossary projection/schema, broad page rewrites, translation, and site-wide screenshot refresh. |
| Product/release owners | Runtime defects, capability activation, financial transfers, deployment repair, merge and production release. |

For #896, record that the new gardener guide and expanded steward guide are delivered here, remove
its already-fixed steward-audit task, and retain the broader backlog. Its Q1 must reflect the
user's decision to keep PRD-727 authoritative for full pooling documentation. This is a handback
prepared locally; updating that PR or Linear is a separate authorized action.

The Google Doc remains the external partner narrative. Prepare a precise correction list for
its **00 Start Here** and **01 External Brief** tabs: replace stale August implementation status
with the step 1 evidence, qualify current release availability, and point task instructions at
the docs site. Reconcile any equivalent availability statements in its remaining tabs before
that document is promoted as current release guidance. Broader narrative/visual changes stay
with PRD-727. Do not copy old rollout promises or unsupported pilot claims into the release docs.

## Implementation receipt (pending)

Implementation has not started. At completion record the full source and docs SHAs, environment,
UTC timestamps, exact commands/results, task-owned path status, reviewed routes, capture labels,
and remaining evidence limitations. A dirty-tree check is working-copy evidence, not a receipt
attributed to HEAD. Follow the [task/phase record](../../../../.claude/context/task-handoffs.md)
and [validation pipeline](../../../../.claude/context/validation-pipeline.md).

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
