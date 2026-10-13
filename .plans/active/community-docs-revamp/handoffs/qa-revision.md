# QA revision: continuation entry point

Updated 13 October 2026 through Afo's L32 completion/publication decision. This is an actionable handoff, not a copy
of the private QA transcript. The original PDFs and raw review evidence stay outside public Git.

## What is settled

- **Formal definitions move to Builders, with the ontology.** Extend the existing ontology
  projection, not a second authored reference. Community keeps selected everyday explanations
  from `human_concepts`. Preserve every old glossary link and the ten app-consumed anchors.
  Move G5/G6 checks with the definitions; retain G7, deterministic regeneration, and stale-output
  failure. Phase 6 and `spec.md` explain the ownership and tests. This is L20, already approved.
- **Commitment Pooling belongs in all three overview pages now.** “Specific action funds” meant
  pooling. Weave concise, coherent explanations into Welcome, How It Works, and Why We Build.
  Later user guides add procedures. No new pooling tutorial, diagram, screenshot, placeholder,
  runtime flag change, or capability-state change. Verify meaning and availability separately.
  Existing steward pooling content/nav and PRD-727/PRD-1156 ownership stay. This is L21.
- **Product History explains versions for users.** Describe what changed for gardeners, stewards,
  evaluators, and funders and what they need to do differently, when supported by evidence.
  Research release/tag/historical implementation evidence first. The current v0.1/v0.4/v1.0
  specifications are not automatically shipped versions; the v2.0 schedule is not a release
  receipt. Keep routes and anchors; classify uncertain historical entries honestly. L22 closes Q4.

These instructions amend the earlier boundary. Do not resurrect “all pooling explanations are
deferred,” “formal tables must remain in Community,” or “Product History awaits a decision.”

## QA work to retain across compaction

The numbered implementation checkpoints are Phase 5 in `plan.todo.md`:

| Checkpoint | Reader outcome |
|---|---|
| 5.1 | Welcome has one clear role chooser, useful labels, balanced layout, a clear garden definition, and concise pooling orientation |
| 5.2 | Install and Update explains passkeys/wallets and gives concise local troubleshooting |
| 5.3 | How It Works numbers its example and connects pooling to the work/review/funding story |
| 5.4 | Why We Build preserves the verification problem, includes agriculture, links useful SDG context, and explains pooling's purpose |
| 5.5 | Recovery begins with what the reader sees and gives the next safe action without wide repeated tables |
| 5.6–5.7 | Join, Submit, and Track use the same clear task pattern and faithful screenshots, retaining the useful submission sequence |
| 5.8–5.9 | Steward dashboard wording, permission-aware paths, restricted creation/action tasks, clearer member guidance, and current desktop captures |
| 5.10 | Review Work covers phone and dashboard routes with their own instructions and screenshots |
| 5.11 | Assessment and endowment each gain staged guidance and faithful captures; the funder's three flows stay |
| 5.12 | FAQ questions can expand while direct links, search, keyboard use, browser find, and Markdown answers keep working |
| 5.13 | Product History presents supported user-facing version milestones |
| 5.14 | Brand assets follow the existing color/manifest authority; Credits contains supported, current acknowledgments |

Keep task purpose, prerequisites, exact labels, success, next actor, recovery, and one primary next
step. Consistency does not mean identical page length. Do not hide critical risk guidance in
disclosures. The books and style guides inform presentation, not product facts; resource links
and principles are recorded in `spec.md` so continuation does not depend on private local files.

## Where to work and what is already done

- Existing worktree: `.claude/worktrees/great-wu-e0fe08`; branch
  `claude/green-goods-community-docs-b0ebe9`, associated with PR #896
  (`chore/community-docs-revamp-plan`). Inspect status before editing; do not switch the shared
  checkout's branch. Base of this planning update: `3a09d937b7a565718de0201907902dbba16ccdb1`.
- The first foundation is implemented. Its checked steps and evidence remain intact in Phases
  0 to 4 and the `claude-*` implementation handoffs. Phases 5 to 7 are implemented and locally verified; W2 now supplies the formerly blocked 5.10 phone capture. Released-product evidence stays pending.
- Plan committed as `1af59af01`. Checkpoints 5.1 to 5.4 committed as `dbdeaad69`: Welcome role
  navigation, Install and Update clarity, numbered How It Works example and pooling explanation,
  Why We Build context. Checkpoints 5.5 to 5.9 are in `dd419495d`; Phase 6 is implemented with proof in `codex-state-api.md`. Remaining page checkpoints are committed through `0c8ecf9e2`; current receipts and limits are in the lane handoffs.
- Separate product follow-ups were opened as draft PR #1089 (Create Garden submission gating)
  and #1090 (public explorer links and Help wording). Verify their current delivery state before
  claiming those fixes are present in a screenshot build or removing recovery instructions. Do
  not duplicate their patches in this docs branch. The client assessment URL waits for #896's
  destination to be available before repointing.

## Next action

Review the final D1/D2/E1/E2/F and W2 packet in `final-merge-preparation.md`. W2 carries the
same realistic seedling example into Pending, Offline, gardener-owned Completed, recovery and
phone/dashboard review. The final source tree is committed; publication is blocked on the
required Chromium qualification, not on remaining page edits. Do not treat old published-head
CI or these fixtures as current-head merge readiness or actual Green Goods activity.
Preview remains `http://localhost:3003/`; prior owner packets stay available below.

## Visual review queue

Latest feedback: the overview pages need imagery, How It Works needs a stronger opening before
the Mermaid loop, and page endings do not match Builders. The previous completion report blurred
local implementation proof with visual readiness. This queue corrects that reporting boundary.

Current state: content/ontology revision committed through `259bd3943`; native page endings from
`5dcdac95a` remain unchanged. L27's plan is committed as `7a418614b`; the overview visuals are
committed as `338894c53` with fresh proof in `codex-ui.md`. All three overview pages are now ready for a
bounded owner review. Older receipts describe their tested implementation, not this new batch.

Approved first batch: align page endings with Builders and develop Welcome as the visual
sample. Afo first selected real photography with screenshots, then refined this in L27: reuse editorial
website images, create matching illustrative images as needed, and mix in app/admin captures.
Named real subjects use real photography; no generated scene is relabeled as actual evidence. Image choice and rendered
layout still need owner review; the answer is direction approval, not a visual sign-off.

| Batch | Pages to review | Proposed change / review focus | Current review state |
|---|---|---|---|
| A: first sample (8.1–8.2) | Welcome; endings of Submit Work and Builders Getting Started | Reused website Home image; clear role chooser and app view; native page-ending parity; one recommended destination | Implemented and locally verified; owner visual review pending |
| B: overview pair (8.3–8.4) | How It Works; Why We Build | Actions image and numbered example before the steward screenshot and compact map; Fund imagery, named real community example, and new solar illustration beside their explanations | Implemented and locally verified under L27; owner visual review pending |
| C1: first gardener tasks | Install and Update; Join a Garden | Compact editorial context, screenshots beside the actions, readable phone instructions, success and next step | Implemented and locally verified on `07293ce5c`; owner visual review pending |
| C2: gardener work | Submit Work; Track Your Work | Preserve the submission stages; screenshots match the adjacent step; privacy, queue/approval/reward distinctions and page-ending continuity | Implemented and locally verified on `bb195c199`; owner visual review pending |
| C3: recovery | Recover Unsent Work | Start with the visible problem, make the safe action easy to scan, keep data-loss/privacy cautions near it | Implemented and locally verified on `04cfbcea1`; owner visual review pending |
| D1: steward entry | Steward Guide; Manage Members | Permissions and starting tasks clear; task links and screenshot framing fit the document style | Implemented and final responsive proof; owner review pending |
| D2: judgment tasks | Make an Assessment; Review Work | Staged screenshots and review guidance; separate phone/dashboard paths | Implemented with W2 actual-page phone captures; final responsive proof; owner/product review pending |
| E1: supporting a garden | Donate to a Garden; Endow a Garden | Three funding flows preserved across the guide; clear risks, amounts and success; faithful screens only | Implemented with verified funding/privacy corrections and responsive proof; owner review pending; full public dialog capture unavailable |
| E2: money follow-through | Withdraw; Funding and Governance | Withdrawal/reward distinctions; recovery and next step; consistent figure/callout treatment | Implemented and final responsive proof; owner review pending |
| F: reference scan | FAQ; Glossary; Product History; Brand kit; Credits | Heading/figure rhythm, compact reference presentation, useful links and preserved anchors | Implemented and final reference/anchor scan verified; owner review pending; Q3 remains separate |

For batch A, ask only: Does the image convey Green Goods beyond literal gardening? Can you find
your role quickly? Does the page-ending flow match Builders and make the next destination clear?
For batch B: Do the visuals help explain the work and its purpose? Does the three-page story feel
coherent, including pooling's place and its limits? For later guide batches: Can you scan the
task, match each screenshot to its step, and see success, recovery, and what to do next?

Every handoff names the exact review URLs and changed sections, provides phone/desktop images,
and lists known gaps. A batch can be implemented and mechanically validated while still awaiting
owner review. Record owner feedback as pending, accepted, or changes requested without replacing
the existing lane schema or claiming product/unassisted-reader proof. Do not ask Afo to review
the entire docs site after every small change. Review queues select the next fix scope; they do
not authorize unrelated page rewrites.

### Current W1 screenshot-realism sample

- `http://localhost:3003/community/gardener-guide/uploading-your-work#step-2-add-evidence`:
  actual seedling photo with the Media requirement/counter and Details control.
- `http://localhost:3003/community/gardener-guide/uploading-your-work#step-4-review-and-upload`:
  scrolled Review, Seedling Transplant, 1h 30m, 36 plants, a field note and Upload Work.
- Welcome reuses the new Media bytes; check only that figure and its updated credit/source note.

Review focus: whether the sample resembles the work/data a gardener would record and whether
it helps explain the adjacent instruction. The photo is real, the record is fictional; it does
not verify the sample count or imply that the photographer uses Green Goods. Captions say so.
Four submission stages, privacy/own-photo guidance and native next cards remain intact. No
runtime UI, transaction, pooling procedure or generic fixture default was changed. Queue,
garden and admin photographic refresh remains subsequent work, not part of this first sample.
Source/build/provenance: `../artifacts/editorial-image-sources.md` § W1; proof in `codex-ui.md`.
Checkpoint 8.7 is complete for implementation/local proof; owner review is pending. Docs
preview remains on port 3003. The temporary Storybook preview is stopped. No publication.

### Previous C3 recovery review packet

`http://localhost:3003/community/gardener-guide/recovery-and-sync`

Review only this page, in this order:

1. Opening and prerequisites: same phone/account, no duplicate, and do not remove app/storage
   while work is waiting. Compact field-preparation illustration is context, not an app view.
2. `#1-see-what-is-waiting` and `#2-send-it`: six labels, Pending screenshot, preparation versus
   sending, phone/wallet confirmation, Checking and cancelled or partial batches.
3. `#3-fix-what-will-not-send`: permanent local-data loss and public-file warning before Discard;
   original five problem fixes; actual confirmation showing Discard and Keep.
4. `#what-keeps-your-work-safe-and-what-does-not`: sign-out/restart/storage distinctions, no
   another-phone recovery, persistent public preparation, and the privacy FAQ link.
5. Safe field habits, local problem fixes and the native Track Your Work next card.

Review focus: can you find your item's safe action, recognize when to wait, and explain what
Discard removes versus what remains public? Text remains complete without the images. The
new capture is a real Storybook confirmation opened without accepting Discard, not a deletion
or recovery receipt. Build revision is unavailable. No signing, app removal, local data deletion
or authenticated queue recovery was replayed. See `codex-ui.md` § C3 for current proof/limits
and `../artifacts/editorial-image-sources.md` § C3 for provenance. Prior owner reviews remain open.

### Previous C2 gardener review packet

- `http://localhost:3003/community/gardener-guide/uploading-your-work`: compact journal context
  after prerequisites; Start → Media → Details → Review and their numbered actions; privacy
  warning at `#step-2-add-evidence`; Media and Review figures beside their stages; queued-record
  guidance at `#if-you-are-offline`; success, recovery and the Track Your Work next card.
- `http://localhost:3003/community/gardener-guide/track-status-and-attestations`: compact solar
  illustration; two-column labels/next actor at `#2-read-the-status`; Pending figure; decisions,
  review-time and rejection guidance; numbered shared-fund claim and fixture at
  `#how-gardeners-get-rewarded`; Recover Unsent Work next card.

Review focus: is the four-stage flow still easy to follow, can you match screenshots to the
right step, and can you distinguish queued files, a sent record, approval and a separate reward
claim? Check the source notes and next cards on a phone. Essential instructions remain complete
without images. No new pooling procedure, screenshot or runtime behavior was added.

`codex-ui.md` § C2 records current proof and its limits; `../artifacts/editorial-image-sources.md`
records reused assets. Completed's English fixture shows the steward's “Reviewed by you” list,
so no gardener decision screenshot was published. Start/Details captures remain unavailable.
Two retained images have unrecorded original capture dates/builds; all build limits are explicit.
Docs layout proof does not establish signing, installed-PWA, offline upload or payment behavior.
Owner approval and product/reader gates remain open; this packet is not a whole-site review.

### Previous C1 gardener review packet

- `http://localhost:3003/community/gardener-guide/installing-and-updating`: choose Android,
  iPhone or Update; scan prerequisites and the field-preparation illustration; check the sign-in
  figure beside `#create-your-account`, the restart/storage guidance and the Join a Garden next card.
- `http://localhost:3003/community/gardener-guide/joining-a-garden`: opening context, filter
  figure at `#1-find-the-garden`, fee note and confirmation at `#2-join-it`, all three joining
  paths, success/next actor, recovery and the Submit Work next card.

Review focus: can you find the right action quickly, read the screenshot labels on a phone,
recognize the correct joining path, and see the safe recovery and next step? Text remains complete
without images. The image mix follows the overview direction but is compact and comes after
prerequisites. Source notes identify illustration and Storybook fixtures separately.

See `codex-ui.md` § C1 for the source read-through, phone/desktop/light/dark evidence, exact
receipt and task record. The ledger records the generated phone still life's prompt and the
byte-identical Gardens source. Live install/update/signing/join completion is not claimed.
This packet does not imply visual sign-off on the earlier overview batch or authorize unrelated
role-guide work. Later gardener pairs follow the existing review queue.

### Previous three-page overview review packet

- `http://localhost:3003/`: opening Home image, role chooser, app Media example, and native Next card.
- `http://localhost:3003/community/how-it-works`: journal opening and numbered example; steward
  screenshot and `#where-the-tools-meet` map. The five-stage loop and existing pooling/approval
  anchors remain. The diagram shows records and decisions, not funding or pooling procedures.
- `http://localhost:3003/community/why-we-build`: Fund image; real waste-sorting example at
  `#who-it-is-for`; solar workshop illustration at `#more-than-money`, beside the capital explanation.

Review focus: whether the set feels coherent with the website, represents more than planting,
supports the surrounding explanation, and makes the next page clear. Source notes distinguish
illustration, real photography, and product fixtures. Image provenance, copy hashes and the exact
generation prompt are in `../artifacts/editorial-image-sources.md`.

Rendered proof: Codex In-app Browser, public localhost, class `none`, engine family unreported;
390×844 and 1440×1000, light/dark. No horizontal overflow. All seven overview image placements
load once scrolled into view; native next links and retained fragments work. The map's expanded
dialog opens and Escape closes it. `codex-ui.md` records the current mechanical receipt and
task/phase record. This does not close product replay, unfamiliar-reader QA, or owner approval.

### Evidence for this planning checkpoint

- Source inspection: all three overview MDX files; NextBestAction and its CSS; Builders Getting
  Started and both shared-component consumers; docs DESIGN.md; existing public image inventory.
- Rendered comparison: Codex In-app Browser, public localhost (Browser Evidence class `none`,
  engine family unreported), 390×844 and 1440×1000, current dark/system theme. Welcome repeats
  How It Works in the custom section and Docusaurus Next card. Builders Getting Started uses a
  plain Next steps list followed by Docusaurus pagination. How It Works leads with Mermaid after
  the opening paragraph. This is comparative docs evidence, not authenticated product replay.
- Existing public hero-home and hero-impact assets were viewed. Both emphasize literal garden
  landscapes; provenance and appropriateness must be checked before any new reuse.
- Local modern-web-guidance search and accessibility retrieval executed with telemetry disabled.
  Semantic navigation, useful alt text, and text-only completeness inform the proposed pass.
- Reader-facing code, assets, generators, runtime behavior, and prior proof are unchanged in this
  planning checkpoint. Fresh plan-only checks are recorded below after execution.

Plan-only working-tree proof, observed 2026-10-13T03:45:27Z:

- `bun run check --plan -- --intent qa --base HEAD --json`: seven hub paths, format selected
  by `automatic-hygiene`, no critical override or docs implementation gate selected.
- `bun run check -- --intent qa --base HEAD`: passed, one fresh check, zero reused, zero unrun.
  Biome checked the JSON; Markdown was reviewed directly.
- `bun run scripts/harness/plan-hub.mjs validate`: passed, 28 feature hubs.
- `git diff --check`: passed. `git diff --name-only -- docs scripts packages .claude package.json
  bun.lock` was empty: this is a planning update, not new page/build proof.

Task record: PR #896 / community-docs-revamp | Type: planning and design review | Outcome: next
visual batch proposed; image preference pending | Agent/model: Codex / identifier unknown.
Coverage: latest owner feedback and visual review queue only.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | unknown → 2026-10-13T03:40:46Z | Source/asset comparison and rendered Community/Builders differences above |
| implement | 2026-10-13T03:40:46Z → 2026-10-13T03:45:27Z | Updated the existing hub only; Phase 8 and owner review queue proposed |
| verify | unknown → 2026-10-13T03:45:27Z | Plan-only checks above passed; not a commit-attributed implementation receipt |

Human corrections: one reporting correction (local implementation was described too broadly as
visual completion). Human attention: unknown. No publish phase entered. Do not turn the unanswered
image preference into approval or mark the new visuals complete.

## Still open or dependent on evidence

- Q3: Honest Claims placement/name/renderer. Keep the working page and nav until decided.
- Q9: translated docs, later. Q10: Linear mirror, no authorized external write here.
- Current live pooling activation and historical release facts need source verification, not
  another structural approval. If sources disagree, record the limitation rather than inventing
  availability or changing flags.
- Faithful fixtures or authenticated replay may be unavailable. Record the actual source, build,
  viewport, capture date, and browser/session class. Never substitute private garden media.
- AC-7 product replay and AC-9 unassisted readers remain pending; this QA review does not pass them.

## Verification and task record

Plan-only working-tree validation, observed 2026-10-13T00:54:21Z:

- `bun run check --plan -- --intent qa`: rendered the whole PR branch scope (95 paths), including
  already committed foundation work. This is not the scope of the current planning checkpoint.
- `bun run check --plan -- --intent qa --base HEAD --json`: selected format via
  `automatic-hygiene` for the current uncommitted plan changes; no critical override selected.
- `bun run check -- --intent qa --base HEAD`: passed, 1 fresh check, 0 reused, 0 unrun, 11 changed
  plan paths. Biome checked the JSON; Markdown remains covered by review and the hub validator.
- `bun run scripts/harness/plan-hub.mjs validate`: passed, 28 feature hubs.
- `git diff --check`: passed.

The first lane-update attempts were rejected because the existing local session branch does not
match the hub's branch convention and the proof reset preceded reopening both passed lanes.
Corrected the state together and retained `chore/community-docs-revamp-plan` as the hub's PR
branch, with the actual local branch recorded above. Both `set-lane` commands then passed. No
checkout branch was changed and no historical receipt was rewritten.

This evidence describes uncommitted plan files, not an implementation commit receipt. No public
page, generator, runtime, build, or product workflow was changed or retested in this checkpoint.
Implementation needs new proof under `eval.md`; old passing evidence is not reused for it.

Task: PR #896 / community-docs-revamp | Type: planning | Coverage: post-QA scope reconciliation.
Agent: Codex; model identifier: unknown. Human attention: unknown. No correction to implemented
code occurred in this segment; the user's clarification expanded the accepted scope.

| Phase | Start → end (UTC) | Result |
|---|---|---|
| investigate | unknown → 2026-10-13T00:45:44Z | Read current hub, renderer/guard owners, version-history content, and repository guidance |
| implement | 2026-10-13T00:45:44Z → 2026-10-13T00:54:21Z | Updated this hub only; reader-facing implementation remains pending |
| verify | unknown → 2026-10-13T00:54:21Z | Plan-only checks above passed; implementation proof remains pending |


## Implementation continuation record

Task record: PR #896 / community-docs-revamp | Type: documentation implementation | Outcome: approved code and local proof complete; capture/product/reader evidence partial
Agent/model: Codex / model identifier unknown | Coverage: approved QA revision after the first foundation

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| implement | 2026-10-13T00:58:16Z → 2026-10-13T02:35:38Z | Small local commits from 1af59af01 through 957b0128f; checkpoints recorded in lane handoffs |
| implement | timestamps unknown → 2026-10-13T03:13:16Z | Two confirmed reference-boundary fixes: escaped definition comparison and a real title target; committed through 0c8ecf9e2 |
| verify | 2026-10-13T03:13:16Z → 2026-10-13T03:16:13Z | Fresh committed-tree selector and supplemental checks; current receipts in both lane handoffs |
| review | timestamps unknown | Source-to-claim review, phone/desktop screenshots, search/redirect/fragment/twin checks; remaining limits explicit |

Human corrections: zero observed in this implementation segment; earlier scope clarifications
are retained in L20–L24, not counted as corrections. Human attention: unknown. Intervals include
tools and waits and do not estimate active effort. No publish phase was entered.

Commits were made with hooks retained and per-command GPG signing disabled because the
configured signer was unavailable. No global Git setting or branch was changed. They are local;
PR #896 has not been updated with this QA revision.
