# Community docs QA revision: UI handoff

- Owner: Codex
- Work branch: `claude/green-goods-community-docs-b0ebe9`; existing PR #896.
- Status: L31/W1 realistic screenshot sample implemented and locally verified on `cd79c36ce`. C3 is locally verified on `04cfbcea1`. C2, C1 and overview packets remain available. Owner review, missing captures, product replay and unfamiliar-reader checks remain pending.
- Read first: `qa-revision.md`, `../plan.todo.md` L20 to L31 and Phases 5 to 8, `../spec.md`,
  and `../eval.md`.

## Scope and next checkpoint

The accepted page/navigation/visual refinements and user-facing Product History are committed.
Next: Afo reviews W1, Submit Work Media and Review with realistic imagery/data. The
prior C2, C1 and overview packets remain available. Native page endings are unchanged;
later guide batches follow the review queue. Phone/product/reader evidence remains pending.
Publication needs separate authorization.
Each checkpoint records changed paths, source evidence, validation, and next work.
Keep later pooling procedures and the undecided Honest Claims change out of scope.

## TDD and validation

Prose-only edits need source and rendered proof, not artificial unit tests. When FAQ interaction,
navigation behavior, or Markdown-twin extraction changes, add a meaningful regression check or
record the exact proof limit. Follow `eval.md`, including the phone/desktop and anchor checks.

The current receipt is below. `claude-ui.md` remains historical foundation evidence; current
local proof does not complete the phone capture or released-product/reader gates.

## Risks and remaining work

Checkpoint 5.10 is partial only for its unavailable phone capture. Product replay and unassisted readers remain pending. Current local proof is recorded below; it does not certify released-product behavior.
Record unavailable captures honestly and do not use real garden members or media in public docs.
See `qa-revision.md` for current decisions, boundaries, and the task/phase record.

## W1 screenshot realism: checkpoint 8.7

L31 is owner QA correction: placeholder drawings do not show what actual action/data looks like.
This first sample uses a real, sourced public-domain photo with coherent fictional submission
values. Captures are Media and scrolled Review; Welcome's reused Media figure follows its new
bytes/source note. Existing four stages and complete task/privacy/own-photo guidance remain.
Dedicated opt-in photo stories retain the existing default stories/category fixtures. Existing
stagedWorkPhoto owns File construction; no duplicate helper or runtime change. The seeded action,
36-plant count, 90-minute duration and note agree across the two states. They are not facts about
the source photograph. Rights, bytes, source hashes/build and rejected capture are in the ledger.

Initial selected proof: `bun run check --plan -- --intent qa --base HEAD --json`; format/lint by
automatic-hygiene, shared/client test typechecks and story-quality by validation-only, staged
modules by client:staged-boundary, static build by shared:storybook-config. Sensitive, no critical
override. `bun run check -- --intent qa --base HEAD` passed seven fresh checks, no reused/unrun;
complete static build/gallery: 421 components, 2252 stories, 42 groups. No new artificial tests;
fixture values only, no generator/audit/runtime behavior change. Final combined proof follows.

Rendered source: Codex In-app Browser, **Storybook session**, engine family unreported, local
static build, light 390×844. Actual JPEG loads, 1 photo added; Review shows Action, Time Spent
1h 30m, Plants moved 36, Description and Upload Work. No sending/signing action performed.
Full-page capture overlaid the fixed footer on a field; rejected. The published Review frame is
a real scrolled viewport, not a composited image. Docs source/alt notes match this view.

Tool limits resolved: direct Commons download 403; the browser exported its already-observed
preview. Dev Storybook had watcher/indexing failure; owned process stopped, full static build
passes. Serve the static output through the existing Docusaurus CLI on loopback port 3004;
its clean URL /iframe retains the story query. No tracked config, permission or dependency
change. A failed temporary tab remains for automatic cleanup after its network error; the
selected browser stayed the same. Real/private app activity was not used as screenshot data.

Task record: PR #896 / community-docs-revamp | Type: screenshot QA | Outcome: W1 implemented
and locally verified; owner review pending | Agent/model: Codex / identifier unknown.
Coverage: L31's first sample.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | unknown → 2026-10-13T08:22:20Z | Traced SVG/category fixtures, inspected available assets and source/rights |
| implement | 2026-10-13T08:22:20Z → 2026-10-13T08:29:05Z | Retrieved/normalized photo; dedicated stories and opt-in fixture values; L31/W1 recorded |
| verify | 2026-10-13T08:29:05Z → 2026-10-13T08:37:09Z | Dev failed before serving; owned process stopped; seven selected checks and full static build pass |
| review | 2026-10-13T08:37:09Z → 2026-10-13T08:52:02Z | Static renderer checked, phone Media/Review captured; full-page artifact rejected; captions/consumers updated |
| implement | 2026-10-13T08:52:02Z → 2026-10-13T09:10:32Z | Local implementation checkpoint `cd79c36ce`; hooks retained |
| verify | 2026-10-13T09:10:32Z → 2026-10-13T09:14:08Z | Nine fresh combined selected checks pass on the committed tree |
| review | 2026-10-13T09:14:08Z → 2026-10-13T09:20:59Z | Vocabulary, final twins/assets, phone/desktop figures, native next link; browser restored and owned static preview stopped |

Human corrections: one, screenshot-media realism. Human attention unknown. No publish phase.
Owner review, remaining screenshot sets and authenticated product/reader gates remain open.

Rendered Docs proof: **Codex In-app Browser, public localhost, class `none`, engine family
unreported**, 1440×1000 and 390×844. Submit Media/Review and Welcome's reused Media load;
desktop dark/light and phone light inspected. No horizontal overflow at either width. Captions
remain readable and correctly distinguish the photo from fictional data. The four step IDs,
own-photo/privacy instructions and source credit remain in the final Markdown twins. Enter on
the native Next Track Your Work link reaches that page. Source/asset checks pass. Private layout
captures stay outside Git. Theme restored to system, viewport reset; Submit Step 4 tab retained.
Owned Storybook static preview stopped; the existing Docs preview on port 3003 remains available.
This is rendered documentation/fixture proof, not authenticated PWA or released-product replay.

### W1 Validation Receipt

- Tested implementation commit SHA: `cd79c36ce8cff98f53518d438ef4cc3ad515b081`
- Run at (UTC): `2026-10-13T09:10:32Z` through `2026-10-13T09:20:59Z`
- Exact command(s): `bun run check --plan -- --intent qa --base e238436e7 --json`;
  `bun run check -- --intent qa --base e238436e7`;
  `bun run check --only vocabulary --base e238436e7`
- Result: nine fresh selected passes, zero reused/unrun: format, lint, shared-test-typecheck,
  client-test-typecheck, docs-authority, docs-build, staged-modules, story-quality,
  storybook-build. Selector: sensitive, 15 changed paths, no critical override. Format/lint
  selected by automatic-hygiene; typechecks/story-quality by validation-only; Docs by
  surface:docs; staged-modules by client:staged-boundary; full Storybook by
  validation-only:shared:storybook-config. Authority 73/73, generated outputs 17 consistent,
  production Docs build/search 72/72, full static gallery 421 components/2252 stories/42 groups.
  Supplementary vocabulary passes fresh in three locales. Zero hard audit errors; two unchanged
  advisory endpoint warnings on Builders Anatomy and EAS integration. Existing blog/Browserslist,
  build chunk/timing notices remain. No dependency/config change. Final rendered/twin evidence
  and its limits are above. No generator/audit/runtime change requiring a new regression test.
- Validated paths: `docs`, `scripts`, `packages/shared`, `packages/client`,
  `.claude/context/ontology.md`, `package.json`, `bun.lock`.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs scripts packages/shared packages/client .claude/context/ontology.md package.json bun.lock` → empty.
- Evidence-only diff command and result (if applicable): `git diff --exit-code cd79c36ce8cff98f53518d438ef4cc3ad515b081..HEAD -- docs scripts packages/shared packages/client .claude/context/ontology.md package.json bun.lock` → exit 0, no output; this follow-up changes only Plan Hub evidence and is rechecked after its commit.
- Evidence-only worktree-status command and result (if applicable): the same worktree identity
  command → empty. No reader/fixture source changes after the tested commit.

Checkpoint 8.7 is complete for implementation/local proof. UI stays in_progress for subsequent
bounded batches and owner review. No push/merge/deploy/external records, transactions, new
pooling procedure, runtime/capability, manifest/lockfile/agent-instruction/CI changes. Per-command
signing override retains hooks because the configured signer is unavailable.

## Historical C3 recovery visual page: checkpoint 8.5c

L30 selects Recover Unsent Work. Implemented and locally verified on `04cfbcea1`. Owner review is separate. Exact URL/sections: `qa-revision.md` § Current C3.

The three-step sequence, six statuses, original five blocked-item cases and published headings
remain. Compact field-preparation context follows prerequisites; Pending uses the established
responsive guide-figure style. A new faithful Discard confirmation sits beside its explanation.
Warnings precede the destructive instruction: save any photos/notes needed, no restore of the
local item, and no removal of already-public files. Keep leaves the item saved. Checking stays
uncertain; actively preparing/sent work is guarded against discard. Upload now and Upload all
send records separately from Prepare now/background preparation. Partial batches keep sent
records and retry only saved items. Storage guidance no longer promises unconditional survival
or cross-device restore; sign-out preserves jobs/drafts while app storage remains intact.

Owning sources inspected: PendingTab, buildPendingRows, uploadActions, queuedWorkCopy,
workUploadGroup, WorkUploadFooter/WorkStatusNotice; useWorkDetailController, useQueuedWorkActions,
job-recovery/queue-policy, draft snapshots/lifecycle, Auth.signOut, upload-queued-work and the
existing preparation/upload-kind/encoder chain; exact en.json notices/actions. Authority paths
are added to frontmatter. No owning runtime or critical queue code changed.

Image source/class: the new `client-work-discard.png` is a 390×844 deployed Storybook
Client/Work/WorkDashboard Pending Discard capture, 13 October 2026, Codex In-app Browser,
**Storybook session**, engine family/build revision unavailable. Real PendingTab confirmation
with deterministic example data; no acceptance/deletion. Field-preparation and Pending assets
retain their bytes and earlier provenance. Ledger: `../artifacts/editorial-image-sources.md` § C3.

Initial working-tree checks: `bun run check --plan -- --intent qa --base HEAD --json` selects
format by automatic-hygiene, docs-authority/build by surface:docs; sensitive, ten changed paths,
no critical override. `bun run check -- --intent qa --base HEAD` passes three fresh checks,
zero reused/unrun: authority 73/73, 17 projections current, production/search 72/72, zero hard
audit errors/two unchanged advisory endpoint warnings. This preceded the final spinner/caption
wording. Source paths and all three image files exist; authored prose has no em dash. Desktop
light opening/figure inspection passed. Fresh committed-tree and full responsive proof follows.
Local Modern Web Guidance search/accessibility retrieval executed with telemetry disabled.
No artificial regression test: generator/audit/interaction behavior is unchanged.
Authenticated queue/recovery/signing, app-removal/data-loss behavior, released-product replay,
unassisted readers and owner approval remain pending. No real person/media, pooling procedure,
runtime/capability, dependency, manifest, lockfile, agent instruction, CI or external-record change.

Task record: PR #896 / community-docs-revamp | Type: documentation UX | Outcome: C3 implemented
and locally verified; owner review pending | Agent/model: Codex / identifier unknown. Coverage: L30's one recovery page.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | 2026-10-13T07:44:00Z → 2026-10-13T07:47:22Z | Guidance, recovery/source/guard/storage read-through; reused existing docs server |
| implement | 2026-10-13T07:47:22Z → 2026-10-13T07:54:08Z | Confirmation fixture captured without acceptance; page/hub updated; initial selected checks passed |
| review | 2026-10-13T07:54:08Z → 2026-10-13T07:55:52Z | Desktop opening/confirmation figure inspected; spinner and discard caption wording tightened |
| implement | 2026-10-13T07:55:52Z → 2026-10-13T07:59:58Z | Local implementation commit `304cbe53a`, hooks retained |
| verify | 2026-10-13T07:59:58Z → 2026-10-13T08:01:18Z | Initial committed-tree selected checks pass; source review identified missing Try Again follow-through |
| implement | 2026-10-13T08:01:18Z → 2026-10-13T08:02:32Z | Added source-verified prepare-then-send instruction; commit `04cfbcea1` |
| verify | 2026-10-13T08:02:32Z → 2026-10-13T08:03:21Z | Fresh selected checks pass on the final reader implementation |
| review | 2026-10-13T08:03:21Z → 2026-10-13T08:08:33Z | Vocabulary, final twin/headings, responsive themes, keyboard privacy/next, search; browser restored |

Human corrections: zero in this segment; initial request selects C3. Human attention unknown.
No publish phase. The current committed-tree receipt follows.

Rendered/twin proof: **Codex In-app Browser, public localhost, class `none`, engine family
unreported**, 1440×1000 and 390×844 in light/dark, plus width 320. All three image placements
load. No horizontal overflow; product figures are 320px at 390 and all images cap at 288px at
320. The data-loss/public-media callout precedes Discard; source/caption text stays readable.
Existing three step IDs and storage/privacy fragment work. Final rendering contains the explicit
Try Again → preparation → Upload now/Upload all follow-through. Enter follows the native Track
next card; search for Recover Unsent Work opens this route. Enter on the privacy link opens the
correct FAQ disclosure with the full public/permanent/media/name answer. One pointer attempt
immediately after resizing did not navigate; keyboard navigation verified that destination.
A literal twin-text assertion initially missed Markdown's bold delimiters; normalizing those
markers confirmed the text, without a content or generator change. All prior headings and six
labels remain, and the twin carries task steps, warnings, sources, AI/fixture labels and next.
Theme restored to system, viewport reset, search cleared. Preview remains port 3003; temporary
Storybook tab closed and recovery Docs tab retained. Private layout captures stay outside Git.

### C3 Validation Receipt

- Tested implementation commit SHA: `04cfbcea137df627f1b0ce986932b1cec8032fdc`
- Run at (UTC): `2026-10-13T08:02:32Z` through `2026-10-13T08:08:33Z`
- Exact command(s): `bun run check --plan -- --intent qa --base d59d8de7e25e56dda34d081990a1e87c47b31eb5 --json`; `bun run check -- --intent qa --base d59d8de7e25e56dda34d081990a1e87c47b31eb5`; `bun run check --only vocabulary --base d59d8de7e25e56dda34d081990a1e87c47b31eb5`
- Result: three fresh selected passes (format, docs-authority, docs-build), zero reused/unrun;
  supplemental vocabulary passes fresh in three locales. Selector: sensitive, ten changed paths,
  no critical override; format by automatic-hygiene, authority/build by surface:docs. Authority
  73/73, generated projections 17 consistent, production build/search 72/72 routes. Zero hard
  audit errors, the same two advisory endpoint warnings on Builders Anatomy and EAS integration.
  No broken-link/anchor warning. Existing missing-blog and stale Browserslist notices remain;
  no dependency update made. Final source/image paths, voice, preserved headings/statuses and
  complete Markdown twin checks pass. Labeled rendered proof and limits are above.
- Validated paths: `docs`, `scripts`, `packages/shared/src/ontology`, `.claude/context/ontology.md`,
  `package.json`, `bun.lock`; actual C3 changes are one MDX, one PNG and eight owning hub files.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → empty.
- Evidence-only diff command and result (if applicable): `git diff --exit-code 04cfbcea137df627f1b0ce986932b1cec8032fdc..HEAD -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → exit 0, no output. This follow-up changes only the Plan Hub; rechecked after its commit.
- Evidence-only worktree-status command and result (if applicable): the same worktree identity
  command → empty. No reader-facing change after the tested commit.

Checkpoint 8.5c is complete for implementation/local proof; UI remains in_progress for later
bounded batches. Owner review, authenticated product recovery/data-loss/signing, AC-7/AC-9 and
missing earlier captures stay open. No runtime/CSS/navigation/generator/ontology/capability,
sensitive manifest/agent-instruction/CI change or external write. No publication. Per-command
signing override retained because the configured signer is unavailable; commit hooks ran.

## Historical C2 gardener visual pair: checkpoint 8.5b

L29 authorizes Submit Work and Track Your Work. Implemented and locally verified on
`bb195c199`. Owner review is separate. Current packet: `qa-revision.md` § Current C2.

- Submit keeps all four stages and numbered actions, existing headings/anchors, required-media
  limits, details/location cautions, observable online/offline results, next steward, eight
  recovery cases and the Track destination. Reused journal context comes after prerequisites;
  three unchanged product images use C1's responsive figure style beside Media, Review and
  offline follow-through. Privacy is visible before choosing media. Cancelled signing means
  the record was not sent, while media may already have been prepared publicly. The next-step
  explanation now covers queued, sent and reviewed records rather than assuming review began.
- Track keeps six Pending labels, all decision/approval/rejection guidance and five recovery
  cases. A two-column table puts meaning and next actor together, reducing phone width. Reused
  solar context remains explicitly fictional. Unchanged Pending and jar fixtures have useful
  captions. The separate jar claim has four numbered actions; no approval/payment guarantee.
  Reviewers can use My work to find decisions on their own submissions. Native next: Recovery.

Source read-through: Intro/Media/Details/Review, WorkDashboard/CompletedTab and buildPendingRows;
SubmitWork/WorkDashboard stories; work media/attachment validation; CookieJarTab and approval
sources. JobQueue, prepare-queued-work, upload-kinds and encodeWorkData show that background
preparation can upload photos and metadata separately from signing/sending the work record.
The added source_of_truth paths all exist. This is a documentation correction, not a queue fix.
FAQ privacy already explains public media/metadata and consent. L18's truth boundary stays.

Image provenance is in `../artifacts/editorial-image-sources.md` § C2. Seven image placements
reuse existing bytes (two editorial, five product); no new asset, CSS or illustration generation.
Three product captures retain the known 12 October date. Review/offline original capture dates
and build revisions are unrecorded; inspection on 13 October is labeled separately. Example
work, promise/proof rows and amounts are explicitly fixtures, not live evidence or receipts.
The original optional promise example stays without a new pooling tutorial/image.

Working-tree proof:

- `bun run check --plan -- --intent qa --base HEAD --json`: format by automatic-hygiene,
  docs-authority/build by surface:docs; sensitive, no critical override.
- `bun run check -- --intent qa --base HEAD`: three fresh passes, zero reused/unrun; authority
  73/73, 17 generated projections current, production build/search 72/72. Audit has zero hard
  errors and the same two advisory endpoint warnings on Builders Anatomy/EAS. This first run
  preceded the final Track source metadata and Plan handoff updates; fresh committed proof next.
- `bun run check --only vocabulary --base HEAD`: fresh pass, three locales. `git diff --check`
  passes. Biome's unmatched MDX result is not claimed as prose/CSS formatting; changed text and
  source paths were reviewed directly. No generator/audit behavior changes or artificial tests.
- Rendered Docs proof: **Codex In-app Browser, public localhost, class `none`, engine family
  unreported**, 390×844 and 1440×1000, light/dark, plus width 320. All seven placements load;
  no page overflow. At 320, images cap at 288 and both Track tables at 288. Media/Review/offline,
  privacy, status, claim and source captions are readable; complete text precedes the captures.
- Enter follows native Submit → Track → Recovery. Search for Track Your Work opens the correct
  guide. The photo-privacy fragment opens its full FAQ disclosure. Existing four stage IDs and
  offline/status/approval/rejection/reward headings remain. Theme preference restored to system,
  viewport reset, search cleared; the public static preview remains on port 3003.

Limits: no authenticated signing, installed-PWA, offline queue/recovery, review decision or
payment replay. Current code/fixtures support the instructions; the Docs render does not prove
those behaviors. The deployed English Completed fixture remains a steward “Reviewed by you”
view; its controls did not expose a gardener filter, so no mislabeled screenshot was published.
Start/Details captures remain unavailable. Owner approval, AC-7, AC-9, missing phone Review Work
capture and later QA stay open. No dependency, lockfile, manifest, agent-instruction, CI,
capability, runtime, sidebar, slug, redirect, ontology or generated-output change in C2. Linear
manifest read only under L19; no publication or external record write.

Task record: PR #896 / community-docs-revamp | Type: documentation UX | Outcome: C2 implemented
and locally verified; owner review pending | Agent/model: Codex / identifier unknown.
Coverage: L29's two gardener pages only; earlier records keep their own coverage.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | unknown → 2026-10-13T07:06:58Z | Current guidance, page/figure/source read-through; queue preparation evidence |
| implement | 2026-10-13T07:06:58Z → 2026-10-13T07:20:35Z | Recorded L29; two-page changes; initial selected checks passed |
| review | 2026-10-13T07:20:35Z → 2026-10-13T07:34:09Z | Phone/desktop/light/dark/narrow checks, captions, native links, privacy disclosure, search and source diff |
| implement | 2026-10-13T07:34:09Z → 2026-10-13T07:37:17Z | Updated the owning hub and bounded packet; local implementation commit `bb195c199`, hooks retained |
| verify | 2026-10-13T07:37:17Z → 2026-10-13T07:38:50Z | Fresh committed-tree selector/checks/vocabulary and final Markdown/source/voice proof pass |

Human corrections: zero in this segment; the request selects the next batch. Human attention:
unknown. No publish phase entered. The committed-tree receipt follows.

### C2 Validation Receipt

- Tested implementation commit SHA: `bb195c199fd216df2ffe032adffda7195ef77187`
- Run at (UTC): `2026-10-13T07:37:17Z` through `2026-10-13T07:38:50Z`
- Exact command(s): `bun run check --plan -- --intent qa --base 5501c68436b3f8e91a73672b05ed376629dd1f19 --json`; `bun run check -- --intent qa --base 5501c68436b3f8e91a73672b05ed376629dd1f19`; `bun run check --only vocabulary --base 5501c68436b3f8e91a73672b05ed376629dd1f19`
- Result: three fresh selected passes (format, docs-authority, docs-build), zero reused/unrun;
  supplemental vocabulary passes fresh in three locales. Selector: sensitive, ten changed paths,
  no critical override; format by automatic-hygiene, authority/build by surface:docs. Authority
  73/73, generated projections 17 consistent, production build/search 72/72 routes. Zero hard
  audit errors, two unchanged advisory endpoint warnings on Builders Anatomy and EAS integration.
  No broken-link/anchor warning. Existing missing-blog and stale Browserslist build notices do
  not prevent the build; no dependency update was made. Final Markdown twins carry the complete
  contract, four stages/six labels, sources, privacy, claim/recovery and next destinations.
  All source_of_truth paths exist; authored two-page prose contains no em dash or technical
  vocabulary beyond legacy route/filename strings. Rendered proof above applies to this source.
- Validated paths: `docs`, `scripts`, `packages/shared/src/ontology`, `.claude/context/ontology.md`,
  `package.json`, `bun.lock`; the actual batch is two MDX pages and eight owning hub files.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → empty.
- Evidence-only diff command and result (if applicable): `git diff --exit-code bb195c199fd216df2ffe032adffda7195ef77187..HEAD -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → exit 0, no output. The follow-up changes only the Plan Hub; rechecked after its commit.
- Evidence-only worktree-status command and result (if applicable): the same worktree identity
  command → empty. No reader-facing change after the tested commit.

Checkpoint 8.5b is complete for implementation/local proof. UI remains in_progress for later
bounded batches; owner review and AC-7/AC-9 stay pending. The public preview remains on port 3003.
QA screenshots stay outside public Git. No publication. Per-command signing override retained
because the configured signer is unavailable; hooks ran.

## Historical C1 gardener visual pair: checkpoint 8.5a

L28 authorizes Install and Update and Join a Garden using the accepted visual approach. Implemented;
locally verified on `07293ce5c`; owner review pending. Review only these pages and the named sections:

- `http://localhost:3003/community/gardener-guide/installing-and-updating`: platform/update
  shortcuts; prerequisites and compact field-preparation illustration; sign-in figure at
  `#create-your-account`; update steps and storage warning at `#update-the-app`; next card.
- `http://localhost:3003/community/gardener-guide/joining-a-garden`: prerequisites and reused
  Gardens illustration; filter figure at `#1-find-the-garden`; fee note and confirmation figure
  at `#2-join-it`; request/steward paths, success, next actor and concise problem sections.

Install retains Android/iPhone actions, account-route and passkey-loss guidance, observable
installation/sign-in/update outcomes, offline preparation, and the unsent-work warning. It removes
the unstable download-size estimate and avoids a general claim about every browser's install
capability. Join keeps all three paths and all seven recovery cases; its table becomes three
problem sections. Wallet-fee guidance comes before joining. “Cancel confirmation” now explicitly
means wallet/passkey confirmation; the sheet's Cancel simply closes it.

The new guide-figure class shares the overview's typography/source treatment, with a 320px
instructional capture beside the caption on desktop and above it on phones. It is capped by
available width, so a 320px phone displays a 288px image without overflow. The original 210px
overview product view remains unchanged. Docusaurus still owns heading navigation and native
previous/next cards; no custom interaction, new component or runtime behavior was added.

Image decisions, prompt, source owners, dimensions and hashes are in
`../artifacts/editorial-image-sources.md` § C1 gardener pair. The reused website Gardens image is
byte-identical to its source. The new built-in imagegen still life is explicitly illustrative
and contains no app interface. Three existing screenshots retain their bytes; their captions
now name story, local date, viewport, crop dimensions, example data and unavailable build revision.
Current Splash/Login, GardensFilterSheet, JoinGardenConfirmDialog/JoinGardenButton,
GardenJoinRequestStatus, AppSettings and useInstallGuidance were inspected for matching labels.

Working-tree evidence:

- `bun run check --plan -- --intent qa --base HEAD --json`: format by `automatic-hygiene`,
  docs-authority/build by `surface:docs`, sensitive with no critical override.
- `bun run check -- --intent qa --base HEAD`: three fresh passes; authority 73/73, 17 generated
  projections current, production build/search 72/72. Audit: no hard errors, two unchanged
  advisory endpoint warnings. This initial run preceded the final caption/size and prose refinements.
- `bun run --cwd docs build`: rebuilt after the caption and screenshot-size corrections;
  72/72 search routes. `bun run check --only vocabulary --base HEAD`: fresh pass in three locales.
  CSS and MDX are manually reviewed; Biome's unmatched-file pass is not claimed as a CSS formatter.
- Rendered layout proof: **Codex In-app Browser, public localhost, class `none`, engine family
  unreported**, 390×844 and 1440×1000 in light/dark; extra width check at 320×844. Five image
  placements load; no horizontal page overflow. Prerequisites precede editorial images, captions
  identify illustration/fixtures, and the sign-in/filter/confirmation views sit by their actions.
  A caption-title selector that missed MDX's paragraph wrapper was corrected and rechecked.
- Android, iPhone and Update section links reach their headings. Enter follows the native
  Install → Join → Submit Work next cards. Search for “Install and Update” opens the revised
  guide. Existing update/data-loss guidance and all joining paths remain visible. Markdown twins
  carry complete instructions, image sources, AI label, fee note and next destinations.
- Source/style control: Welcome's overview product image remains 210px wide and its single next
  destination is unchanged. No redirect, slug, sidebar or ontology/generated-output move.

Limits: no installed-PWA, wallet/passkey signing, service-worker update or membership completion
was replayed. Current source and unchanged fixtures support the instructions; they do not prove
those authenticated behaviors. No faithful update-row, browser install prompt or full join-request
fixture was substituted. AC-7, AC-9, missing phone Review Work image, later QA and owner approval
stay open. No generator/audit change, so no new regression test; existing authority proof is used.
No dependency, lockfile, manifest, agent-instruction, CI, capability or runtime-flag change.
The Linear manifest was read only under L19; no external write or publication.

Task record: PR #896 / community-docs-revamp | Type: documentation UX | Outcome: C1 implemented
and locally verified; owner review pending | Agent/model: Codex / identifier unknown.
Coverage: L28's two gardener pages only; earlier records keep their own coverage.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | unknown → 2026-10-13T05:13:18Z | Read current guidance/pages, inspected website Garden imagery and the three product captures |
| implement | 2026-10-13T05:13:18Z → 2026-10-13T05:20:24Z | Recorded L28, made/copied two editorial assets, updated two pages and guide-figure CSS; initial selected checks passed |
| review | 2026-10-13T05:20:24Z → 2026-10-13T05:36:01Z | Corrected caption layout, widened captures, checked phone/desktop/light/dark and keyboard/search; final source read-through |
| implement | 2026-10-13T05:36:01Z → 2026-10-13T05:37:57Z | Local implementation commit `07293ce5c`, with hooks retained |
| verify | 2026-10-13T05:37:57Z → 2026-10-13T05:41:35Z | Fresh committed-tree checks, rebuilt prose/Markdown confirmation, cleared QA search and restored theme/viewport |

Human corrections: zero in this segment; the initial request selects the next batch. Human
attention: unknown. No publish phase entered. The current committed-tree receipt follows.

### C1 Validation Receipt

- Tested implementation commit SHA: `07293ce5c78f633ca19f332e5ac276569231c10a`
- Run at (UTC): `2026-10-13T05:38:22Z` through `2026-10-13T05:41:35Z`
- Exact command(s): `bun run check --plan -- --intent qa --base 9c58b9ae675b0cd55b5b3e479d67d17cf0ccbd36 --json`; `bun run check -- --intent qa --base 9c58b9ae675b0cd55b5b3e479d67d17cf0ccbd36`; `bun run check --only vocabulary --base 9c58b9ae675b0cd55b5b3e479d67d17cf0ccbd36`
- Result: three fresh selected passes (format, docs-authority, docs-build), zero reused/unrun;
  supplemental vocabulary passes fresh. Selector: sensitive, 13 changed paths, no critical
  override; format by `automatic-hygiene`, authority/build by `surface:docs`. Authority 73/73,
  generated projections 17 consistent, production build/search 72/72 routes. Zero hard audit
  errors, two unchanged advisory endpoint warnings on Builders Anatomy and EAS integration.
  No broken-link or anchor warning. Final Markdown carries both prose refinements, all sources,
  complete task/fee/recovery guidance and next targets. Rendered layout/keyboard/search proof
  above applies to the committed source; final rebuilt prerequisites were also confirmed.
- Validated paths: `docs`, `scripts`, `packages/shared/src/ontology`, `.claude/context/ontology.md`,
  `package.json`, `bun.lock`; actual batch paths are in the selector.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → empty.
- Evidence-only diff command and result (if applicable): `git diff --exit-code 07293ce5c78f633ca19f332e5ac276569231c10a..HEAD -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → exit 0, no output. This follow-up changes only the Plan Hub; rechecked after its commit.
- Evidence-only worktree-status command and result (if applicable): the same worktree identity
  command → empty. No reader-facing change after the tested commit.

The local preview remains on port 3003; the original system theme and default viewport were
restored. QA screenshots stay outside public Git. C1 has implementation and mechanical proof,
with owner review and authenticated product/reader evidence still pending. No publication.
Per-command signing override retained because the configured signer is unavailable; hooks ran.

## Historical L27 overview visual batch: checkpoints 8.2 to 8.4

Implemented; mechanically verified; owner visual review pending. Review URLs and focus are in
`qa-revision.md` § Previous three-page overview review packet. The L27 direction plan was committed first
as `7a418614b`, then the three pages were implemented within that scope.

- Welcome reuses the website's Home image and retains its role chooser, app Media fixture,
  pooling orientation, and native next card. Its alternative text describes the visible crop.
- How It Works reuses Actions imagery, moves the numbered example before the loop, and pairs
  it with the actual steward-review fixture. A four-node conceptual map follows under
  “Where the tools meet.” It shows recording, separate review decisions, and public reading;
  it does not depict funding transactions or pooling procedures. The five stages and all
  previous approval/pooling headings and anchors remain.
- Why We Build reuses Fund imagery, places the real waste-sorting photo beside its named
  community example, and adds a fictional solar-workshop illustration beside “More than money.”
  It preserves the eight forms of capital, agriculture context, status and funding qualifications.

Three editorial assets are byte-identical snapshots of their website sources. Their original
photography/generation provenance is not recorded; captions identify editorial illustration
without inventing a real subject. The new solar scene was made with built-in imagegen, inspected,
and encoded to WebP without a content edit. The prompt, source owners, sizes and SHA-256 hashes
are in `../artifacts/editorial-image-sources.md`. The named real photograph keeps author,
source/license links, and display-crop disclosure. Product images remain Storybook fixtures
with example data and unavailable build revision, not live garden or transaction evidence.

Working-tree proof, observed through 2026-10-13T04:52:31Z:

- `bun run check --plan -- --intent qa --base HEAD --json`: format by automatic hygiene;
  docs-authority and docs-build by changed Docs paths. Sensitive, no critical override.
- `bun run check -- --intent qa --base HEAD`: three fresh selected passes, zero reused/unrun;
  authority 73 tests, generated outputs 17 consistent, build/search 72/72 routes. Audit: zero
  hard errors and the same two advisory Builders endpoint warnings. Committed-tree proof follows.
- `bun run check --only vocabulary --base HEAD`: fresh pass, three locale files. Focused authored
  overview search found no em dash or protocol/chain terms; public prose remained nontechnical.
- Markdown twins retain all image references, source notes, real credits/license, AI label,
  diagram text, next destinations and the existing pooling/approval fragments. All seven overview
  image placements load when scrolled into view; the three copied assets match their sources.
- Rendered proof: **Codex In-app Browser, public localhost, class `none`, engine family
  unreported**; 390×844 and 1440×1000, light and dark. No horizontal overflow on the three pages.
  The new map renders on both widths, opens its named expanded dialog, and closes with Escape.
  The native How It Works next card opens Why We Build. Existing `#commitment-pooling` and
  `#impact-reporting-verification` links still land on their sections. Original system theme
  restored; viewport reset at handoff. Screenshot files remain local QA artifacts, not public Git.

Proof limit: no generator/audit behavior or runtime code changed, so no new regression tests.
Existing authority tests and actual rendered/twin proof cover this batch. Owner visual approval,
faithful phone-review capture, authenticated product replay and unfamiliar readers remain open.
No sidebar or redirect move, generated MDX edit, dependency, lockfile, agent instruction, CI,
capability or runtime-flag change. No publication or external record write.

Task record: PR #896 / community-docs-revamp | Type: documentation visuals | Outcome: L27
overview batch implemented and locally verified; owner review pending | Agent/model: Codex /
identifier unknown. Coverage: revised image direction through the three-page review packet.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | unknown → unknown | Inspected website source owners/history, existing captures, and the established image style |
| implement | unknown → 2026-10-13T04:52:31Z | Plan commit `7a418614b`; three pages, four editorial assets and source ledger; essential text retained |
| review | unknown → 2026-10-13T04:52:31Z | Phone/desktop, light/dark, map, links, image captions and source read-through above |
| implement | 2026-10-13T04:52:31Z → 2026-10-13T04:56:35Z | Final crop alt text, hub completion states, and local implementation commit `338894c53`; hooks retained |
| verify | 2026-10-13T04:56:35Z → 2026-10-13T04:58:18Z | Fresh committed-tree checks below; rebuilt Welcome alt text and Markdown output confirmed |

Human corrections: zero in this segment; L27 is a scope refinement. Human attention: unknown.
No publish phase entered. Earlier task records retain their own coverage and corrections.

### L27 Validation Receipt

- Tested implementation commit SHA: `338894c53f34b2f91811dcd8ca97afa5d317039a`
- Run at (UTC): `2026-10-13T04:56:58Z` through `2026-10-13T04:58:18Z`
- Exact command(s): `bun run check --plan -- --intent qa --base 7a418614b6a1ad8205e306738e7e1f924d78db00 --json`; `bun run check -- --intent qa --base 7a418614b6a1ad8205e306738e7e1f924d78db00`; `bun run check --only vocabulary --base 7a418614b6a1ad8205e306738e7e1f924d78db00`
- Result: three fresh selected passes (format, docs-authority, docs-build), zero reused/unrun;
  supplemental vocabulary passes fresh. Selector: sensitive, 15 changed paths; format selected
  by `automatic-hygiene`, authority/build by `surface:docs`, no critical override. Authority
  73/73 tests, 17 generated projections consistent, production search 72/72 routes. No hard
  audit error; two unchanged advisory endpoint warnings on Builders Anatomy and EAS integration.
  No broken-link/anchor build warning. Markdown twins and rebuilt Welcome crop alt confirmed.
  Manual page/image/map/fragment proof above applies to the committed source; owner review stays pending.
- Validated paths: `docs`, `scripts`, `packages/shared/src/ontology`, `.claude/context/ontology.md`,
  `package.json`, `bun.lock`; the selector identifies the actual 15-path batch.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → empty.
- Evidence-only diff command and result (if applicable): `git diff --exit-code 338894c53f34b2f91811dcd8ca97afa5d317039a..HEAD -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → exit 0, no output. This follow-up changes only this Plan Hub; rechecked after its commit.
- Evidence-only worktree-status command and result (if applicable): the same worktree identity
  command → empty. No reader-facing source changes after the tested commit.

The original system theme was restored and the temporary viewport reset. Preview remains at
`http://localhost:3003/`. Local-only checkpoint: neither implementation nor evidence was pushed.
Per-command signing override was retained because the configured signer is unavailable; hooks ran.

## Historical Phase 8 Batch A: Welcome photography and shared page endings

Implemented; owner visual review pending. Review only:

- `http://localhost:3003/`: opening photograph, role chooser, product view, and Next step.
- `http://localhost:3003/community/gardener-guide/uploading-your-work#next-step`: the guide's
  previous/next pair, compared with Builders Getting Started.

Welcome uses Victor Janjić's photograph of Wings of the Ocean volunteers sorting waste in Mallorca
(2021), sourced from Wikimedia Commons under CC BY-SA 4.0. The 1280×853 source is 386 KiB;
the file is unchanged, and CSS crops it for the article. The visible caption credits author and
license, states the display crop, and identifies it as an example rather than a Green Goods
project. No permission or participation by that organization is implied. The source is public
photography, not a screenshot from a live garden. The supporting product view reuses the already
verified SubmitWork Media Without a Promise fixture, with its sample illustration and missing
build revision explicitly named. It does not claim to show actual submitted evidence.

NextBestAction now composes the original Docusaurus DocItem paginator. A small context and
DocPaginator theme wrapper replace only the next destination with the page's authored
recommendation. Docusaurus owns the previous metadata, card labels, styling, and links. A return
to the previous destination renders one card. CSS hides the redundant footer paginator only
when the authored section exists. Getting Started keeps its original native paginator. No
generated MDX, sidebar order, role destination, or product behavior changes.

Proof limit: no automated RED test was added for this visual-only batch. The user limits new
regression tests to changed generator/audit behavior; neither changed here. Earlier FAQ/twin
RED/GREEN remains historical. Fallback proof covers actual rendered routes and keyboard use,
with the existing authority suite and production build. The native API import attempt failed
typecheck/build because the docs-client package is not a declared dependency; it and the temporary
type declaration were removed. The final composition uses existing theme exports, with no
dependency install, manifest/lockfile change, or relaxed check.

Working-tree proof observed through 2026-10-13T04:16:21Z:

- `bun run check --plan -- --intent qa --base HEAD --json`: format/lint by automatic hygiene;
  docs-authority/docs-build by Docs paths. No critical override. Final committed-scope plan and
  receipt follow below; these working-tree passes do not claim the new commit SHA.
- `bun run check -- --intent qa --base HEAD`: four fresh selected passes, no reused or unrun
  checks. Authority tests 73, generated projections 17, production search 72/72. Audit has no
  hard errors and the same two Builders endpoint advisories.
- `bun run --cwd docs typecheck`: passed. `bun run check --only vocabulary --base HEAD`: passed,
  three locales. Welcome's twin retains image, credit, license, crop note, product view and next
  destination; Submit Work and both Builders consumer twins retain their recommended targets.
- Rendered proof: Codex In-app Browser, public localhost, class `none`, engine family unreported.
  Welcome inspected in light/dark at 390×844 and 1440×1000. Submit Work, Recovery, Getting Started,
  Entity Matrix, and Economics Explorer endings checked at both widths. One visible paginator
  on each, with no horizontal overflow. Previous links retained; Recovery deduplicates its
  return to Track Your Work. Enter on the Economics Explorer next card opened Product History.
  Source photo and fixture view were inspected before use. The original system theme was restored.
- React review: synchronous context composition, no effects/fetching/new state, source-derived
  destinations, native link semantics and keyboard focus. No new runtime dependency.

Next: owner reviews photography, visual rhythm and page-ending parity. How It Works and Why We
Build imagery is queued after that sample; phone review, product replay and unfamiliar readers
remain pending. This is not overall visual approval or release readiness.

### Batch A Validation Receipt

- Tested implementation commit SHA: `5dcdac95a0ba6cea89758792be471f180d456e16`
- Run at (UTC): `2026-10-13T04:19:14Z` through `2026-10-13T04:20:36Z`
- Exact command(s): `bun run check --plan -- --intent qa --base 259bd3943020e15452e153bca9c16dffd8a0c1ed --json`; `bun run check -- --intent qa --base 259bd3943020e15452e153bca9c16dffd8a0c1ed`; `bun run --cwd docs typecheck`; `bun run check --only vocabulary --base 259bd3943020e15452e153bca9c16dffd8a0c1ed`
- Result: four fresh selected passes (format, lint, docs-authority, docs-build), zero reused or
  unrun. Authority 73/73, generated projections 17 consistent, search 72/72; no hard audit errors,
  two unchanged advisory endpoint warnings. Typecheck and vocabulary pass. Selector: sensitive,
  15 changed paths, no critical override. Browser and twin proof above remains source-identical.
- Validated paths: `docs`, `scripts`, `packages/shared/src/ontology`, `.claude/context/ontology.md`,
  `package.json`, `bun.lock`; the selector identifies the actual batch paths.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → empty.
- Evidence-only diff command and result (if applicable): `git diff --exit-code 5dcdac95a0ba6cea89758792be471f180d456e16..HEAD -- docs scripts packages/shared/src/ontology .claude/context/ontology.md package.json bun.lock` → empty. The evidence-only follow-up is restricted to Plan Hub files; the same scoped diff is checked after its commit.
- Evidence-only worktree-status command and result (if applicable): the same scoped worktree
  identity command → empty. The only follow-up edits are Plan Hub evidence and review state.

Task record: PR #896 / community-docs-revamp | Type: documentation UX | Outcome: Batch A
implemented and locally verified; owner review pending | Agent/model: Codex / identifier unknown.
Coverage: photography choice through the first visual sample and shared page-ending checkpoint.

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | unknown → 2026-10-13T03:58:33Z | Verified public photo source/license; inspected native Docusaurus ownership and existing captures |
| implement | unknown → 2026-10-13T04:09:48Z | Welcome photo/product view and native page cards; unsupported API import removed; no new dependency |
| review | 2026-10-13T04:09:48Z → 2026-10-13T04:16:21Z | Phone/desktop, light/dark, route and keyboard comparisons; React/source review |
| implement | 2026-10-13T04:16:21Z → 2026-10-13T04:19:14Z | Local commit 5dcdac95a with hooks retained |
| verify | 2026-10-13T04:19:14Z → 2026-10-13T04:20:36Z | Fresh committed-tree receipt above |

Human corrections: zero in this implementation batch; the earlier reporting correction remains
in the planning record. Human attention: unknown. No publish phase. Signing was disabled only
for the commit command because the previously configured signer is unavailable; hooks remained.

## Historical checkpoints 5.1 to 5.4

- Welcome: one role chooser, descriptive whole-row links, one main heading, retained garden and
  path anchors, agriculture example, concise pooling orientation. The shared role data also feeds
  the Markdown twin; unsupported time estimates were removed from the chooser and twin together.
- Install and Update: passkey/wallet explanation before account creation, explicit limits of
  passkey sync/recovery, short update guidance, and problem sections instead of two wide tables.
- How It Works: numbered example plus `/community/how-it-works#commitment-pooling`, separating
  work linkage, work review, promise confirmation, and payment. The five-stage loop is unchanged,
  so its growth routine consumer requires no change.
- Why We Build: clearer evidence/trust problem, agroforestry/farming context, pooling purpose,
  and relevant official SDG links with a qualification that recording work is not proof of impact.

Pooling meaning was checked against the ontology and the WorkCredit/Confirm contract libraries.
Current projection evidence calls the product flow pre-release and records settlement as inactive;
the overviews do not promise live payment or alter capability values. The existing pooling guide
and navigation were not changed. SDG context was verified on the official UN Goal 2, 7, and 15 pages.
Account labels and cross-device passkey wording were checked in the owning Login view.

Working-tree proof before the implementation commit:

- `bun run check --plan -- --intent qa --base HEAD --json`: inspected selectedBy; selected format,
  lint, docs-authority, docs-test, docs-build. No critical override.
- `bun run check -- --intent qa --base HEAD`: all five selected checks passed, fresh.
  Docs tests: 90 passed. Production build and search: 72 of 72 live routes indexed.
- `bun run --cwd docs audit -- --ci`: no hard errors; two pre-existing advisory endpoint warnings
  on builder Anatomy and EAS integration pages.
- Rendered proof: Codex In-app Browser, public localhost, session class **none**.
  Welcome and account guidance inspected at 390×844 and 1440×1000; pooling direct fragment and
  Why We Build orientation rendered correctly. No product sign-in or transaction replay claimed.
- Existing twin extraction test updated for the chooser's actual title/link/description data;
  no new test added for presentation-only prose or CSS.

The role chooser and its twin data were one coupled checkpoint, exceeding the four-file preference
because changing one without the other would leave public Markdown misleading. How It Works was
updated alongside Welcome so its new pooling fragment was live before the audit.

At that checkpoint, post-commit evidence was pending. The fresh receipt below supersedes this
working-tree proof; the lane now waits only for its recorded evidence gap.


## Checkpoints 5.5 to 5.9

- Recovery: replaced three wide/repeated tables with status-led advice and short problem sections.
  Kept background-media privacy, discard, account, and duplicate-submission warnings. Added a
  fresh Pending screenshot from the actual Storybook component.
- Submit Work: recaptured Media Without a Promise without CSS overrides; its padding is intact.
  Clarified the voice-note control. Join a Garden was inspected and kept: its conditional
  join/request/add routes already fit the task pattern. Start and Details remain text-only.
- Track: uses the fresh Pending capture. Checking means the outcome is uncertain, so the former
  claim that every item outside In review has definitely not arrived was corrected.
- Steward tasks: ordinary task links are unordered, show the current page, and match their twins.
  Deployer setup lives under Builders/Reference/Garden setup (deployer), with stable guide URLs
  and a pointer from the steward landing. Manage Actions remains reachable for domain selection.
- Role permissions moved beside Manage Members. The old steward roles anchor remains a useful
  pointer. The audit caught one old internal link; it was repointed and the audit then passed.
- Community prose uses steward dashboard, including FAQ and evaluator pages. The preserved
  pooling guide is untouched. The former Review Work cockpit-section fragment is retained.
- Create Garden shows a cropped view of the actual desktop detail fields, with crop, story,
  date, and unavailable build identifier stated. Removed its unused old image. PR #1089 and
  #1090 are open/unmerged; recovery advice does not assume either is deployed.

Proof: selector with `--base HEAD` selected format, lint, docs-authority, docs-test, docs-build;
all five fresh checks passed. Docs tests 90/90, generated projections 17 consistent, production
search 72/72 routes. Docs typecheck passed. Two unchanged builder endpoint warnings are advisory.
Statuses were checked in queuedWorkCopy, buildPendingRows, uploadActions, and the owning sources.
Rendered docs proof: Codex In-app Browser, public localhost, class **none**; Recovery and task navigation
inspected at phone and desktop widths. Captures are Codex In-app Browser **Storybook** fixture evidence.
The deployed fixture build identifiers are unavailable. Phone captures: 390×844; desktop source:
1440×900; Garden details crop: 1104×440. No component CSS overrides, live garden media, signing,
or fabricated transaction result. Current-commit proof is recorded in the final receipt below.


## Checkpoint 5.12: FAQ

The existing Docusaurus Details wrapper animates a second collapsible container and does not
reveal fragment destinations itself. The docs-owned FAQ component uses native details/summary
without that hidden wrapper, Docusaurus route-aware fragment reveal, and Open/Close all
controls. Direct links reveal their answer, and highlighted search visits open answers; the explicit Open all path supports browser find
on browsers whose find behavior does not reveal collapsed details. Headings and all old IDs stay.
Markdown twins flatten the wrappers to headings and complete answers, preserving fenced examples.

RED observed 2026-10-13T01:46:52Z: `bun run --cwd docs test`, the new twin contract failed
(90 pass, 1 fail). GREEN: 91 tests passed. Docs typecheck passed. First build caught the local
Markdown-file link before post-build emission; a native file link avoids the route collector
while leaving broken-link checking enabled. The subsequent build/search passed 72/72 routes.
Rendered Codex In-app Browser/public localhost/**none** proof: phone direct privacy link opened its answer
below the navbar, Enter/Space toggled the question, and accessibly named controls were present.
The In-app Browser did not expose a browser-find toolbar when its shortcut was invoked; direct
browser-find proof is unavailable here. Open all and Close all toggled all 32 answers. Site search for “endowment safe” opened
`/faq?...#is-an-endowment-safe-can-i-lose-money` and visibly revealed its warning. Desktop
layout was checked at 1440×1000. The first search probe exposed a missing heading hash-link;
using Docusaurus Heading restored the indexed destination. All 32 old question IDs remain. No authenticated product behavior claimed.


## Checkpoint 5.10: review

Review Work keeps separate phone/dashboard steps and one shared judgment frame. Recovery is
label-led, with a pointer to the unsent queue rather than a repeated wide table. Dashboard
captures remain. Phone labels were checked against GardenWork/WorkView/feedback sources; no
faithful phone review fixture or authenticated garden session was available. The phone capture
remains blocked, and 5.10 stays unchecked for that evidence gap. Text steps are complete.
Rendered docs proof: Codex In-app Browser/public localhost/**none**, phone and desktop; no page overflow.
Working-tree docs audit and production build passed. Final current-SHA receipt follows in Phase 7.

## Checkpoint 5.11a: assessment

Three native Storybook captures cover StrategyKernelStep/Prefilled (800×864 crop),
ActionsHarvestStep/WithSelection (800×504), and ReviewStep/InFlowReady (1024×854), from
1440×1000. Captions identify source, date, crop, unavailable deployed build revision, and no
submission. These are separate stage fixtures, not a replayed transaction. No private media or
CSS overrides. Short recovery replaces the wide table. Codex In-app Browser/public localhost/**none**
rendered inspection at 390×844 and 1440×1000 passed; instructions remain complete without images.
The selected working-tree QA plan passed; final commit-attributed proof belongs to Phase 7.

## Checkpoint 5.11b: endowment

Endow keeps purpose, prerequisites, risks, amount/currency, wallet confirmation, success, next
actor, recovery, and withdrawal as the primary next step. Dollar entry is the default; the
existing WETH denomination toggle is now explained. The opening does not imply a guaranteed
withdrawal or yield. Donate and Remove an Endowment remain the other two funder flows.
Native Storybook captures cover AmountInputWithValue (448×240) and SuccessEndow (448×400),
cropped from 1440×1000. They are isolated component examples, not a full public dialog or
payment receipt. No wallet transaction occurred. Caption source/build limits are explicit.
The available staged card-payment flow is not wired into the live checkout, and the installed
EndowmentSheet is a different journey; neither is used to illustrate the public Fund dialog.
Full-dialog and wallet replay remain unavailable. PublicFundingCard and en.json own labels.

## Checkpoint 5.13: Product History

Used focused historical source tracing: January v0.4.0 commit 8ba29dbbe and its client work/sign-in
code; v1.1.0 tag and merged PR #509; GitHub releases v1.2.0 (8 July), v1.2.1 (30 July), and
v1.2.2 (12 September). The live release collection still lists v1.2.2 as latest. Early v0.1 and
v1.0 specifications remain labeled design context, and v0.4 specification features are not all
asserted shipped. v2.0 remains unverified as a production release, with no elapsed-schedule
guarantee. All historical fragments remain, including the four compact research pointers.

## Checkpoint 5.14a: brand

Brand source already identifies the navbar PNG's dark green as #367D44. It is retained at its
existing size and URL. The authoritative v3 favicon bytes replace the legacy favicon bytes at
/img/favicon.ico, preserving its public URL. No vector shape, palette, manifest, ZIP, or product
asset is changed. Brand explains the distinction between logo color and UI accents.

## Checkpoint 5.14b: Credits

Credits removesunsupported sponsor/partner placeholders, reward promises, and network slogans.
It points to actual contributors/releases, integrations and dependencies; confirms SQLite in
the messaging runtime instead of repeating PostgreSQL as that runtime's database. License and
privacy meaning remain, and old section anchors are preserved. Legal naming does not create
new terms or an endorsement.


## Final local verification and limits

Inspected the revised pages/navigation at 390×844 and 1440×1000, including role chooser,
account guidance, recovery, steward tasks, phone/dashboard review text, assessment, endowment,
FAQ, history, Brand kit, Credits, glossary and formal destinations. No page overflow was found.
All 65 image references exist. FAQ twin carries 32 complete answers; formal twins use native
anchors. Both moved-page redirects resolve. Privacy and evaluator fragments reveal their
answers; FAQ search for “endowment safe” reaches and opens its answer. Enter/Space and the
open/close-all controls work. All 32 questions open for browser-find fallback.

Rendered proof is **Codex In-app Browser, public localhost, class none**; captures are the
same browser with class **Storybook**. The provider exposes no engine family, and navigator
metadata is unavailable in its read-only page scope. Earlier iteration notes used Chromium
shorthand; engine identity is not verified and no authenticated-session proof is claimed.
The In-app Browser exposes no find toolbar; actual browser-find behavior is not replayed.
A transient Brand visit reported a redirect loop; the footer link and a fresh query-bearing
direct visit rendered correctly, and the local HTTP endpoint returned 200. This is not treated
as an authenticated or production walk.

Voice searches: zero em dashes in authored Community/Reference; 25 protocol/network matches,
reviewed as source declarations, required wallet/network choices or transaction success signals,
and the exact “Ethereum Address or ENS Name” label. Existing pooling content remains untouched.

Remaining: phone Evaluate Work/Add Feedback capture; full public funding dialog and wallet
replay; installed-PWA/offline/recovery/signing replay (AC-7); three unfamiliar readers (AC-9);
the later QA pass and current-head CI before approval. Local tests do not replace these.
No capability flag, runtime behavior, dependency, lockfile, CI or agent instruction file changed.
Sensitive changes are ontology guidance and the owning drift guard/renderer.



Final glossary DOM inspection found all 56 frozen legacy targets, including the explicit
title target and Operator alias. The prior shorthand count of 57 was incorrect and is corrected
here. Docusaurus strips H1 IDs; the registered title target makes the inventory real rather
than merely inferred from source headings. The final build follows both that fix and the
definition-encoding fix. All prior interaction/rendered checks apply to unchanged UI behavior.

## Validation Receipt

- Tested implementation commit SHA: `0c8ecf9e2d528d304766d22096e38974bb379123`
- Run at (UTC): `2026-10-13T03:13:16Z`
- Exact command(s): `bun run check --plan -- --intent qa --base 3a09d937b7a565718de0201907902dbba16ccdb1 --json`; `bun run check -- --intent qa --base 3a09d937b7a565718de0201907902dbba16ccdb1`; `bun run check --only docs-generated --base 3a09d937b7a565718de0201907902dbba16ccdb1`; `bun run check --only vocabulary --base 3a09d937b7a565718de0201907902dbba16ccdb1`; `bun run check --only guidance-links --base 3a09d937b7a565718de0201907902dbba16ccdb1`; `bun run --cwd docs typecheck`
- Result: all six selector checks passed fresh (format, lint, docs-authority, docs-test, docs-build, ontology), with no critical override selected for the 67-path QA revision. Authority 73 tests; Docs 92 tests; ontology 72 tests, 55 term entries, ten app links, three deterministic artifacts, seven unchanged baselined findings. The three explicit supplemental checks passed fresh: 17 docs projections consistent, vocabulary clean in three locales, and 91 guidance files valid. Docs typecheck passed. Build/search covers 72/72 routes, with no broken-link or broken-anchor warning. Audit has no hard error and two unchanged advisory endpoint warnings. Results observed through `2026-10-13T03:16:13Z`.
- Validated paths: `docs scripts .claude/context/ontology.md packages/shared/src/ontology package.json bun.lock`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs scripts .claude/context/ontology.md packages/shared/src/ontology package.json bun.lock` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 0c8ecf9e2d528d304766d22096e38974bb379123..HEAD -- docs scripts .claude/context/ontology.md packages/shared/src/ontology package.json bun.lock` → exit 0, no output; this follow-up changes only this Plan Hub
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- docs scripts .claude/context/ontology.md packages/shared/src/ontology package.json bun.lock` → empty
