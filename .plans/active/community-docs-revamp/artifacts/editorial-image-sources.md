# Community documentation image sources

L27 authorizes reuse of the Green Goods editorial website's imagery and new scenes with the
same style where needed. Reuse is for illustration, not evidence that an identified person,
place, or project uses Green Goods. Named real subjects use real, credited photography.

## Existing assets

The public website's owner is `packages/client/src/content/publicCuration.ts`:

- `packages/client/public/images/hero-home.webp`: Home, introduced by `a384cd7d1`.
- `packages/client/public/images/hero-actions.webp`: Actions, introduced by `946b1cc58`.
- `packages/client/public/images/hero-fund.webp`: Fund, introduced by `946b1cc58`.

Copy the selected source bytes into Docs' own static output; the sites are separately built.
Record matching hashes after copying. Original generation/photography provenance is not recorded
in these commits. Label their use as editorial illustration, not documentary proof. The user
explicitly authorized their reuse; no new origin or depicted identity is inferred.

`docs/static/img/community/community-waste-sorting.jpg` is the real photograph of Wings of the
Ocean volunteers in Mallorca, 2021, by Victor Janjić. Its Commons source, CC BY-SA 4.0 link,
resize and display-crop note remain in the visible caption when moved to Why We Build.

Existing Storybook captures: `client-work-media-current.png` and `admin-review-form.webp`.
Captions name fixture, 12 October 2026, viewport/dimensions and unavailable build revision.
They show the actual components with example data, not a real garden or the fictional walkthrough.

## New solar workshop image

Purpose: extend the plant-focused editorial set to solar work and shared practical learning.
Mode: built-in imagegen; not the CLI. Generated 12 October 2026, inspected in the tool output,
then encoded to WebP (quality 84) for the site without a content edit. The original generated PNG
is retained in the local imagegen output; the consumed workspace asset is below.
This fictional scene must remain explicitly illustrative; no real identity/location claim.

Final prompt:

```text
Use case: photorealistic-natural
Asset type: a supporting editorial image for Green Goods documentation, landscape composition, about 2:1.
Primary request: Create a fictional community solar-maintenance and learning workshop in the same visual family as Green Goods' editorial website: warm natural afternoon light, reclaimed wood, earthy beige and ochre clothing, quiet greens, tactile materials, close attention to the work.
Scene and subject: Close view of two adults' hands inspecting a small training solar panel resting flat on an old wooden workbench under an open-sided workshop shelter. One person points out a detail on the panel frame to the other. A simple screwdriver, folded cloth, and open notebook with no readable writing sit nearby. Soft garden greenery in the distant background, with the panel and shared practical learning as the clear subject.
Composition: Natural documentary-style framing, realistic hands and tools, subjects centered so the picture can crop gently for a wide article image. Include the workbench and context, not an extreme macro. Faces remain out of frame.
Lighting and material: Soft warm sunlight from one side, believable shadows, muted color, modest depth of field, visible wood grain and worn fabric. Calm, unposed, grounded, like a field journal photograph. Avoid glossy stock-advertising treatment.
Constraints: This is an illustrative fictional scene, not a depiction of a named person or real location. No app screen, text overlay, logo, brand mark, watermark, cryptocurrency imagery, money, exaggerated environmental transformation, live electrical wiring, rooftop work, or invented product UI. No extra fingers or impossible tools.
```

## Diagram boundary

How It Works gains a minimal conceptual map of recording, steward review and reading the public
record, below the human example. The five-stage loop stays in prose with its current anchors and
status/money qualifications. Technical depth stays on Builders. No pooling procedure, diagram,
screenshot, capability state, or runtime flag change is authorized by this image-direction update.

## Saved assets and consistency proof

| Docs asset | Source / role | Size | SHA-256 |
|---|---|---|---|
| `docs/static/img/community/editorial-home.webp` | Byte-identical copy of `packages/client/public/images/hero-home.webp`; Welcome | 1672×941, 307752 bytes | `fdc3f7b7591a9b3afc2cb685861441f8ef6ecabe79c0ca958e6abb9957f1600f` |
| `docs/static/img/community/editorial-actions.webp` | Byte-identical copy of `packages/client/public/images/hero-actions.webp`; How It Works | 1536×1024, 253508 bytes | `47f97582266aa2258de240a8d61d3292a6494eaefd0bae3461ee757cebbeabe7` |
| `docs/static/img/community/editorial-fund.webp` | Byte-identical copy of `packages/client/public/images/hero-fund.webp`; Why We Build | 1536×1024, 277080 bytes | `1948d1777ebf0590ae2adf0dff6e3aa711df989488c41658e6feeb75bea36aca` |
| `docs/static/img/community/editorial-solar-workshop.webp` | New fictional editorial illustration from the prompt above; Why We Build | 1774×887, 158258 bytes | `48b2d68930b986707d728e1e6b88a125a06ec4cb289bd1a48e79eb3cc71b4398` |

All three copied sources were compared byte-for-byte with their Docs assets. When the editorial
source changes, recopy it and update this receipt; the Docs files are explicit snapshots, not
an independent image origin. CSS crops overview images for phone/desktop; captions preserve
the distinction between illustration, actual screenshot fixture, and a named real community.

No new runtime dependency or generator was added. The new image extends solar/education context
without inventing a named garden, measured outcome, or working product screen. No original image
was overwritten, and the real waste-sorting photograph remains unchanged.

## C1 gardener pair: Install and Update, Join a Garden

L28 authorizes this pair using the existing L27 image approach. Task purpose and prerequisites
come before a compact illustration. Actual screenshots remain beside the actions they explain;
no editorial scene contains an app interface or impersonates a real garden.

- Join reuses `packages/client/public/images/hero-garden.webp`, owned by
  `publicCuration.viewHeroImages.gardens` and introduced by `946b1cc58`. The Docs copy is
  byte-identical. Original photographic/generation provenance is unrecorded, so its visible
  caption identifies editorial illustration and names no actual person or location.
- Install gains a fictional field-preparation still life: a phone face down beside notebook,
  gloves and bottle. Mode: built-in imagegen. Generated and inspected 12 October 2026; encoded
  to WebP at quality 84 without a content edit. The original PNG remains in local imagegen output;
  the final consuming asset is saved in the Docs workspace below.
- Existing product captures are unchanged: `client-sign-in.webp` from
  `client-layout-splash--entry-first-install`; `client-garden-filters.webp` from
  `client-sheets-gardensfiltersheet--defaults`; `client-join-garden.webp` from
  `client-sheets-joingardenconfirmdialog--default`. Historical capture inventory is in
  `../handoffs/claude-ui.md`. All were captured on 12 October 2026 at 390×844, 2× and cropped;
  captions now distinguish image dimensions from viewport, identify example data, and state
  that the deployed Storybook's build revision is unavailable. Labels were checked against
  Splash/Login, GardensFilterSheet, JoinGardenConfirmDialog and their owning current callers.

No faithful installation-prompt, service-worker update, or live join-request capture was added.
The complete platform/update/request instructions remain text. These images do not prove
installed-PWA behavior, passkey/wallet signing, or a completed join.

Final field-preparation prompt:

```text
Use case: photorealistic-natural
Asset type: compact supporting editorial image for the Green Goods Install and Update documentation, landscape composition about 2:1.
Primary request: A fictional field-preparation still life in the visual family of Green Goods' editorial website: warm natural daylight, reclaimed wood, ochre fabric, quiet greens, tactile everyday tools.
Scene and subject: On a modest wooden workbench under an open-sided shelter, an unbranded smartphone lies face down beside an open field notebook with no readable writing, a folded pair of well-used work gloves, and a plain reusable water bottle. The phone is the clear subject. Soft greenery beyond the bench suggests going out to work.
Composition: Natural photographic framing, calm and unposed, medium-close view with the phone and notebook near the centre. Keep all essential objects in the central crop for both wide desktop and phone article images.
Lighting and material: Soft warm sunlight from one side, believable shadows, visible worn wood grain and fabric, muted earthy colour, modest depth of field. Quiet field-journal feeling rather than glossy advertising.
Constraints: Fictional illustrative scene, not a named real person, location or object. No people or faces, no screen display, invented interface, app icon, text overlay, logo, brand, watermark, money, cryptocurrency, measurable environmental outcome, or unsafe tools. The smartphone remains face down; this picture must not imply that it is a screenshot of Green Goods.
```

| Docs asset | Source / role | Size | SHA-256 |
|---|---|---|---|
| `docs/static/img/community/editorial-garden.webp` | Byte-identical copy of `packages/client/public/images/hero-garden.webp`; Join a Garden | 1857×847, 225082 bytes | `836fc411dc5c95d899c27e8d352552a6d3be1f491049dca5f82a7d988c74e5ed` |
| `docs/static/img/community/editorial-field-preparation.webp` | New fictional illustration from the prompt above; Install and Update | 1774×887, 173786 bytes | `e6cbd9beadb220ee92912b344b45389ae6f34682f1abb11d88bc84357ce33a88` |

The garden source copy passed byte equality. Neither original source nor existing screenshots
were overwritten. Recopy and update this ledger if the editorial source changes. Screenshots
are presented without a crop added by Docs CSS; the compact editorial scenes use its existing
responsive photo treatment. No new generation script, dependency, tutorial diagram, or
technical architecture was added for these task guides.

## C2 gardener pair: Submit Work, Track Your Work

L29 authorizes this pair and preserves the Start → Media → Details → Review submission flow.
Both pages reuse existing Docs assets; no new illustration, public photo, product capture or
pooling image is added. Submit reuses `editorial-actions.webp` for evidence/context; Track
reuses the explicitly AI-generated `editorial-solar-workshop.webp` for work beyond planting.
Their sources, prompt, dimensions and hashes remain the earlier records above.

| Existing product asset | Use in C2 | Source and limit |
|---|---|---|
| `client-work-media-current.png` | Submit, Step 2 | SubmitWork Media Without a Promise fixture; captured 12 October 2026, 390×844; build unavailable; illustration stands in for evidence |
| `client-work-review.webp` | Submit, Step 4 | Earlier SubmitWork Review fixture; 780×1688; original capture date/build unrecorded; inspected 13 October 2026. Existing optional Work for card retained, with no pooling tutorial expansion |
| `client-work-offline.webp` | Submit, offline follow-through | Earlier WorkDashboard offline fixture; 780×1688; original capture date/build unrecorded; inspected 13 October 2026. Existing promise/proof rows retained |
| `client-work-pending.png` | Track, status labels | WorkDashboard Pending fixture; captured 12 October 2026, 390×844; build unavailable; example queue, including promise/proof rows |
| `client-cookie-jar-claim.webp` | Track, separate shared-fund claim | CookieJarTab Claimable Jar fixture; captured 12 October 2026; 780×900 crop from 390×844 at 2×; build unavailable; example amounts/purpose, not a receipt or promised reward |

All five assets were inspected before reuse; their bytes stay unchanged. Original Review/offline
assets were introduced into the current Builders capture set by `052c8ad82` on 11 October 2026;
that is a Docs asset commit, not proof of their capture date or product build. Captions now say
which dates are known and which evidence is unavailable rather than inventing a capture date.

Completed-view limit: the deployed English WorkDashboard Completed story renders “Reviewed by
you,” and its manager exposes only tab/items controls. A direct completed-filter argument did
not change the rendered view. No gardener Completed screenshot is published from that probe.
Current CompletedTab source and complete text instructions cover Approved/Rejected and My work.
No new Start/Details, signing, installed-PWA or payment screenshot was fabricated.

Privacy labels describe the work record, not exclusive storage on the phone. `prepare-queued-work`,
the work upload kind and `encodeWorkData` prepare/upload media and metadata separately from the
signed record. C2 brings that distinction beside media/offline/status guidance; no runtime change.

## C3: Recover Unsent Work

L30 selects one recovery page. Reuse `editorial-field-preparation.webp` from C1 as compact
same-phone context; its original prompt, AI label and hash remain above. Reuse the unchanged
`client-work-pending.png`, with its known 12 October capture and unavailable build revision.
No real subject, new illustration or pooling screenshot is added.

| Docs asset | Source / role | Size | SHA-256 |
|---|---|---|---|
| `docs/static/img/screenshots/client-work-discard.png` | New deployed Storybook Client/Work/WorkDashboard Pending Discard fixture; discard/Keep caution | 390×844, 34303 bytes | `09babc68d5677ae3dcd533be8378b25c32007c42ba00bc73089754fc76561e2c` |

Captured 13 October 2026 using Codex In-app Browser, **Storybook session**, 390×844; engine
family and deployed build revision unavailable. Source story:
`packages/client/src/views/Home/WorkDashboard/WorkDashboard.stories.tsx` (`PendingDiscard`).
It renders the real PendingTab confirmation with deterministic example work/promise/proof rows
and illustrations. The play function opens the confirmation. The agent observed the warning,
Discard and Keep, saved the frame and closed the temporary tab; it did not accept Discard.
This is interface evidence, not proof of queue deletion, public-file removal or recovery.
The full phone viewport is retained without an added crop or interface reconstruction.

Privacy/storage claims come from Auth's sign-out boundary, draft snapshots, job-recovery's
send/discard guards, useQueuedWorkActions' local-draft deletion and the existing upload
preparation/encoder chain. C3 distinguishes losing the editable saved item from persistent
public files; no new backup, export, unpublish or cross-device recovery is claimed.

## W1: realistic submission-media sample

L31 corrects the drawing-based app captures. First bounded sample: Submit Work Media and Review,
using dedicated opt-in stories and one real photograph. Existing default stories/category art,
UI behavior, and current pooling content are retained. Broader queue/garden/admin refresh is
subsequent work; a realistic source photo must match the displayed task.

- Photo: [Seedlings](https://commons.wikimedia.org/wiki/File:Seedlings.jpg), Leon Brooks.
  Commons records a worldwide public-domain release by the author. Date of original photograph
  unrecorded; the Commons file was transferred in 2013. Verified 13 October 2026.
- Saved asset: `packages/shared/.storybook/fixture-art/documentation-seedlings.jpg`, 1200×900,
  SHA-256 `45eb6bee9030addf12d33c5aa073c43d3fab963e3bdb5fbd2a4595453e8988d5`.
  Retrieved the observed 1920px Commons preview through the browser's asset export after direct
  HTTP download returned 403. Normalized to JPEG quality 84, proportionally resized, no content
  edit/crop; fixture encoding contains no EXIF. This is asset preparation, not an app privacy claim.
- The photograph shows planted lettuce rows, with no visible people or private documents.
  It illustrates the fictional Seedling Transplant record; it is not evidence of this fictional
  garden, the 36-plant count, 90-minute duration, or the field note. No adoption/endorsement claim.
- `submitWorkControllerFixture` reuses `stagedWorkPhoto` for an actual JPEG File, with no synthetic
  size padding. The photo mode is opt-in; default drawing-based cases remain unchanged.
- New source stories: `MediaWithExamplePhoto`, `ReviewWithExamplePhoto` in the existing
  `Client/Work/SubmitWork` family, with no promise link and the same sample across both steps.
  Capture source build, dates/dimensions and downstream consumers will be recorded after proof.

Local dev preview initially failed to serve: watcher exhaustion and acorn indexing errors across
unrelated admin stories. The owned process was interrupted; no other server or product code was
changed. A static Storybook build will test whether the failure is limited to the dev watcher.
No realistic capture is claimed yet.

W1 capture build: local static Storybook built from base `e238436e7` plus the W1 fixture edits,
with the repository's unchanged config/decorators/component code. Source SHA-256 at capture:
`submitWorkFixtures.ts` = `79b9f137cd324f545d525a00e0395f95b1ee3f9cb2856693b228e3d36671c2f3`;
`SubmitWork.stories.tsx` = `97afac11621fd3d87c96f52a953dd210ed87d2899188938091ea56a41d68b017`;
photo hash above. The seven selected fixture checks passed fresh, including a complete static
build (2252 stories). The static build avoids the dev watch failure; it is not a released app.

Rendered proof: Codex In-app Browser, **Storybook session**, engine family unreported, 390×844,
light theme, 13 October 2026. Media renders one actual JPEG (natural width 1200) and 1 photo added.
Review renders the same file, 36 plants, 1h 30m and the exact field note. No upload button pressed.
The chosen Review capture is scrolled to Details; its fixed stepper/footer remain as the app draws
them. A full-page experiment overlaid the fixed footer on Time Spent and was rejected, not edited
or published. These figures are actual renders, with no pixel replacement or fabricated interface.

| Capture | Consumers / dimensions | SHA-256 |
|---|---|---|
| `client-work-media-current.png` | Submit Step 2 and Welcome; replaces the drawing-based frame, 390×844 | `eefab05fe7357738d0ea566661ef8033b9f22bd74771462b431af07b8d033994` |
| `client-work-review-example.png` | Submit Step 4; new scrolled Details frame, 390×844 | `3b638fb5c0070d3854b84fd31b03762cb9b8efcbdbb65c84cd272b1d8dd44088` |

Both visible captions credit Leon Brooks/link Commons, identify the fictional record and local
fixture build, and distinguish sample values from facts verified by the photo. The guide retains
its instruction to use one's own photos from where/when the work happened. The existing drawing-
based `client-work-review.webp` remains for Builders Anatomy; its consumer and alt text are
unchanged. Generic queue, garden and admin captures remain later refresh work, not claimed fixed
by this sample. Earlier ledger entries describe historical bytes/captures; this table owns W1.

Final committed-source verification: `cd79c36ce8cff98f53518d438ef4cc3ad515b081`, 13 October 2026.
The combined selector passed all nine fresh checks, including full static Storybook and the
production Docs build. Fixture line wrapping after capture was formatting only; the capture
source snapshot above remains its precise provenance, rather than being relabeled as a capture
from this commit. Final Docs Media/Review and Welcome consumers were inspected at desktop and
phone widths; source/credit, fictional-data labels and Markdown twins match. Exact receipt and
engine/session labels are in `../handoffs/codex-ui.md` § W1 Validation Receipt.

## Final W2: work queue, gardener result and phone review

L32 extends the same sourced Leon Brooks photograph to the remaining media-bearing examples.
`DOCUMENTATION_SUBMISSION` in the existing submit fixture owns the action, photo, 36-plant
count, 90-minute duration and note. Queue/result/review stories consume that example; generic
stories and test scenarios retain their defaults. The submitted-file example uses inline JPEG
bytes, while read views load the same JPEG as a served static asset. No interface pixels were
replaced. Early loading/transition frames were rejected; only settled images with decoded media
were saved. The source photo remains illustration, not proof of any fictional record or decision.

Build: local static Storybook from checkpoint `940e4666e` plus the final fixture edits;
`bun run --filter @green-goods/shared build-storybook` passed (422 components, 2256 stories,
42 groups). Capture date 13 October 2026. Source proof: **Codex In-app Browser, Storybook
session, engine family unreported**, light 390×844 for phones and 1440×900 for the admin card.
No Upload, Submit, approval, wallet confirmation or final Discard action was performed.

Source SHA-256 at capture:

| Source | SHA-256 |
|---|---|
| `submitWorkFixtures.ts` | `05a0fe8dc47e50d7855a846c77cf373e969ebef293a6f6a3eb7276eedafcca7f` |
| `pendingWorkFixtures.ts` | `6c6cbf8567a332d85c080eec721c855040926403777c4dd8a896173d857fd65a` |
| `.storybook/preview.tsx` | `a871110bd12c30edf4789251529493afae37ee825fed215c6b2cc7e43a672d0b` |
| Client `Garden/Work.stories.tsx` | `2bbffe619faaca653753799e47c7f98ee108b5f94f902a46cc3afdb956fa2cac` |
| `WorkDashboard.stories.tsx` | `ab9529754069f2ef9c7903b7cc23ab7b44faf9e398c45647d2db74116fa32cef` |
| `HubWorkQueue.stories.tsx` | `3e6fe1dd0f6bdb761f8ebed182cd4a97db93effed394e3e45f22f863f150a980` |

| Capture | Story and consumer | Dimensions / SHA-256 |
|---|---|---|
| `client-work-pending-example.png` | WorkDashboard / Pending With Example Photo; Track and Recovery | 390×844 / `48b09bfa9e7476286b72efeacbfe5d955c37b0a34de2680443cae4b22a2d3b08` |
| `client-work-offline-example.png` | WorkDashboard / Offline With Example Photo; Submit | 390×844 / `45e5767bcb662f34d5a6c31317355f5b7a4c43e3418e02a6851f803a11719ece` |
| `client-work-completed-example.png` | WorkDashboard / Completed With Example Photo; Track | 390×844 / `389b0a0bbe9b223fc4bbab1ba8f11ec9cc31534d053c6fe91bd11f83e819d826` |
| `client-work-discard.png` | Pending With Example Photo, confirmation opened; Recovery | 390×844 / `a27bbbfd2182b278dbb45e36a8ccfcfc531cd97c831d54da818950c590e2f371` |
| `client-review-work.png` | ReviewWork / Evaluate Example; Review Work | 390×844 / `a9cfb23fc90b68cb6a76ac7d65da16916463ef9e396082a91aa840b8f8369529` |
| `client-review-feedback.png` | ReviewWork / Feedback Example; Review Work | 390×844 / `f4fba14d3f977c40aee3771487e32035df83d0c0a9e03900669bd3efd33740ee` |
| `admin-review-queue-example.png` | HubWorkQueue / With Example Photo; Review Work | 366×358 crop at x16/y16 from 1440×900 / `43caab1de098356e1da7f26af14650326b99373eea9c8443f89da697e7efbb15` |

The three unconsumed drawing-based Pending/offline/admin queue assets are removed. Earlier ledger entries
are historical. Existing Builders images retain their consumers/bytes. Administrative forms
that do not show work media remain faithful UI captures rather than acquiring decorative photos.
