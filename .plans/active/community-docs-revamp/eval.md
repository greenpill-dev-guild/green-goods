# Community Docs Revamp Evaluation Plan

## Release Gates

1. Correctness: every guide step matches the product's screens and on-screen labels. First proof
   is a source check of each label against `en.json` and its component; the gate is met when the
   steps are replayed on the released product (AC-7).
2. Usability: someone new to Green Goods can finish a first task (join, submit, track) from the
   docs alone. An agent replay does not prove this. It is met by AC-9, a reading by people.
3. Regression safety: the docs gate chain is green, every moved slug redirects, and no consumer
   points at a moved path.
4. Evidence quality: screenshots name their source and capture date, and no page states an
   availability, money, or privacy fact that its named source does not support.
5. Human judgment: an open decision never ships as a change. Q3 keeps its page until decided.
   Q4 is resolved by L22; Product History must have version/release evidence before revision.

The earlier foundation receipts do not certify the post-QA revision. Phases 5 to 7 need fresh
proof. The owner's QA feedback is useful review input, not AC-7 product replay or AC-9 evidence
from three previously unfamiliar readers.

Phase 8 Batch A navigation and L27's three-page image mix are implemented and locally verified;
owner visual review is still separate from direction approval. Existing receipts describe their tested implementation;
they do not prove new imagery, page-ending consistency, or owner visual approval. Each new batch
needs its own applicable mechanical and rendered evidence before it is offered for review.

L28's gardener C1 pair uses AC-3, AC-4, AC-14 and AC-17: task completeness, faithful captions,
phone readability and clear next navigation. Check light/dark, existing section links, search
and Markdown twins for both pages. Editorial pictures are illustration; installed-PWA, signing
and membership behavior need their separate AC-7 evidence and cannot be passed by a Docs render.

L29's C2 pair uses the same checks plus AC-5 for the public-preparation/record distinction.
Verify all four submission-stage anchors, all six Pending labels, the separate claim steps,
Submit → Track → Recovery native cards, privacy fragments, search and both Markdown twins.
The five product images remain unchanged; two have unrecorded original capture dates/builds,
which must remain an explicit limit. The deployed Completed fixture is a steward view, so it
cannot stand in for gardener review evidence. No new generator/audit behavior or test scope.

L30's C3 uses AC-3, AC-4, AC-5, AC-14 and AC-17. Verify all three step links and the existing
storage/privacy heading, all six Pending labels, discard/Keep wording, uncertain/partial sends,
FAQ privacy fragments, native Track destination, search and complete Markdown twin. Inspect
phone/desktop/light/dark and a narrow phone. Label the new confirmation capture Storybook;
opening it is not a deletion test. Actual queue recovery, data-loss and signing replay stay AC-7.

W1/L31 adds source-media/record coherence to AC-4: the screenshot's action, photo, count, time
and note should read as one plausible example. Exact values remain explicitly fictional, not
facts inferred from the source photo. Verify real JPEG decoding, both opt-in stories, existing
defaults, all image consumers/captions and two widths. Run the selected story/type/build and Docs
checks; do not add artificial regression tests for static example values. Source hashes/build,
rights and scrolled capture state must be recorded. No pixel reconstruction or live private data.

L32/W2 supplies the formerly missing phone review capture and replaces the old steward-perspective
Completed image with a gardener-owned fixture. It extends W1's source/record coherence checks
through Pending, Offline, recovery and review, preserving default stories. Final rendered evidence
covers 29 pages at both widths. Required browser-work-exploration is blocked at macOS Chromium
registration before any test; builds and CUA renders do not substitute for it. Publication,
current-head CI, owner sign-off, AC-7 and AC-9 remain pending in the final handoff.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Structure | The sidebar matches `spec.md`: FAQ at `/faq`, separate Evaluator guide, Formal Ontology on Builders, Brand kit and existing Commitment Pool still listed; deployer-only work is not presented as the ordinary steward sequence; no live page is orphaned | `ui` | Sidebar/path diff, docs audit, and production build |
| AC-2 | Voice | No em dashes in hand-written community or Reference prose, and every protocol or chain name is inside a "using your own wallet" box or reviewed as necessary | `ui` | The two searches below, each remaining hit reviewed in the `ui` handoff |
| AC-3 | Page contract | Every task page has a purpose, before you start, numbered steps with on-screen labels, how you know it worked, what happens next, recovery, and one next step | `ui` | Checklist in the `ui` handoff |
| AC-4 | Screenshots | Every screenshot has alt text and a caption that names its source and capture date; the steps read complete with images turned off; no image shows a live garden's members or photos | `ui` | Image list in the `ui` handoff |
| AC-5 | Truth | Every `ui` item in `spec.md` § Truth fixes is resolved | `ui` | Search results plus a read-through |
| AC-6 | Ontology and glossary ownership | Formal definitions are rendered with the existing Builders ontology from canonical sources; Community contains selected human concepts and useful compatibility pointers. No copied formal definition tables. G5/G6/G7 still fail on missing definitions, mismatched sets/surfaces, undeclared terms, and broken app links | `state_api` | Fresh RED/GREEN in the owning generator and ontology suites; docs-generated and ontology gates |
| AC-7 | Replay | Every guide is walked on the released product | `qa_pass_1` | Handoff with engine and session labeled per `AGENTS.md` § Browser Evidence |
| AC-8 | Consumers and gates | Each moved path returns only redirects and history under `git grep`, and the full gate chain passes | `ui`, then `qa_pass_2` | Command output in the handoffs |
| AC-9 | Unassisted read-through | Three readers who have not seen the docs, spanning gardener and steward tasks, each find their task, say who acts next, and recover a waiting item without coaching | a person (Afo or the onboarding team) | Notes on what confused them and what changed. If no readers are available it stays pending; an agent replay is never relabeled as this check |
| AC-10 | Prevent definition/output drift | In an isolated fixture, changing a canonical definition updates formal output; changing a selected human concept updates Community; stale or tampered output fails check mode; regeneration restores passing checks. Term additions, renames, removals, and compatibility destinations are covered without relaxing a guard | `state_api` | Behavioral source-mutation tests and negative/positive check-mode evidence in the owning suites |
| AC-11 | Stable public links | Every previously published glossary heading/alias resolves usefully; ten app anchors land on everyday entries, former technical anchors lead to the matching ontology term/section; Personas and other formal-section consumers point to the new owner | `state_api`, `ui` | Frozen pre-move anchor inventory, generator tests, audit, and direct-fragment rendered checks |
| AC-12 | Pooling overview boundary | Welcome, How It Works, and Why We Build give one coherent explanation grounded in named ontology and implementation sources. Approval, qualification, and payment are distinct. Availability is supported or explicitly uncertain; no new tutorial/guide/diagram/screenshot, placeholder, capability-state change, or runtime flag change | `ui` | Source-to-claim checklist, page read-through, and focused diff review |
| AC-13 | Version history | Each version explains user-visible changes and any migration consequence, backed by historical code/release evidence. Planned/preview/specification status is explicit; no elapsed schedule is treated as a release receipt. Old history routes and anchors still resolve | `ui` | Version-to-source map and redirect/fragment checks |
| AC-14 | Task and navigation usability | One clear role chooser, descriptive destinations, coherent heading hierarchy, consistent next action, readable recovery on phones, and separately labeled phone/dashboard review instructions. Required guidance works without screenshots | `ui` | Phone/desktop rendered checks, semantic heading/link inspection, and source-matched steps |
| AC-15 | FAQ disclosures | Questions remain visible and keyboard-operable; direct fragments, browser find, site search, and Markdown twins reveal or carry the correct complete answer. Do not hide task-critical warnings exclusively in the FAQ | `ui` | Focused interaction/twin regression proof where behavior changes and rendered search/fragment checks |
| AC-16 | Overview visuals (Phase 8) | Welcome has a purposeful compact opening image; How It Works opens with a concrete example and editorial imagery before a minimal architecture diagram; Why We Build has supporting visuals beside their explanation. The set shows more than literal gardening and adds no unsupported impact, availability, or payment claim. Essential text works without images | `ui`, then Afo | Named image purposes/provenance; phone/desktop and light/dark views; explicit owner review recorded separately from build results |
| AC-17 | Page endings (Phase 8) | Community and Builders use a consistent document pattern for next steps, with one clear recommended destination, readable optional links, and previous-page access. Custom guidance and Docusaurus pagination do not compete or repeat the same instruction | `ui` | Compare Welcome, Submit Work, Getting Started, and both Builders NextBestAction consumers; keyboard, destinations, and Markdown twins |

Voice searches for AC-2. One list, kept here:

```bash
# Em dashes in hand-written community and Reference prose
grep -rn "—" docs/docs/community docs/docs/reference --include='*.mdx' --include='*.md' | grep -v "\.generated\."

# Protocol, standard, and chain names on community pages
grep -rnE "\bEAS\b|\bHats\b|Octant|Gardens V2|\bIPFS\b|\bCIDS\b|ERC-?[0-9]+|Arbitrum|Celo|Sepolia|Ethereum|\bGnosis\b|\bSafe\b|Karma GAP|Pimlico|Tokenbound" docs/docs/community docs/docs/reference/faq.mdx --include='*.mdx' | grep -v "\.generated\."
```

The existing steward pooling page is outside this hub (`spec.md` § Pooling boundary), so its hits
are recorded, not changed.

## Gate Chain

Render the plan first, then run what it selects for the changed paths:

```bash
bun run check --plan -- --intent qa
```

The docs commands it draws on, from the repository root:

```bash
bun run --cwd docs audit -- --ci        # document authorities, links, anchors, navigation, assets
bun run check --only docs-authority     # generator and audit tests, the audit, and the drift check
bun run check --only docs-generated     # every projection rendered in memory against its file
bun run check --only vocabulary
bun run check --only ontology           # when the ontology data, its checker, or its pages change
bun run check --only guidance-links     # when .claude pointers change
bun run --cwd docs test
bun run --cwd docs build                # also checks that the search index covers every route
```

## Test Strategy

- Unit: `state_api` changes get RED then GREEN tests in the suite that owns the code: the glossary
  renderer in `scripts/docs/generate.test.mjs`, and formal ontology rendering plus definition,
  term, and anchor guards in `scripts/quality/check-ontology.test.mjs`. Claims-renderer tests also
  belong there if Q3 later authorizes that change. Add meaningful source-mutation/drift tests, not
  assertions that simply copy the generated table text.
- Integration: `bun run check --only docs-generated` and the docs build.
- Docs interactions: FAQ disclosure, deep-link, browser-find, and search behavior need focused
  browser proof. Update existing twin tests when extraction changes. Do not add product E2E tests
  or prose unit tests for this docs revision.
- Rendered check: changed navigation and pages at a phone width and a desktop width, with redirects,
  search, links, and Markdown twins, on a production build of the docs. Labeled per `AGENTS.md` §
  Browser Evidence.
- Manual checks: the replayed read-through (`qa_pass_1`) and the unassisted read-through (AC-9).
- TDD proof: prose-only `ui` checkpoints use `not_applicable`; interaction or extraction changes
  record the meaningful regression or a precise proof limit. `state_api` records new RED/GREEN
  in its current handoff and `status.json`; old foundation proof is not reused for Phase 6.

## QA Sequence

### Claude QA Pass 1

- Walk every guide on the released product and fix wording, labels, and screenshots that drift.
- Record the engine and session behind each observation. Authenticated surfaces (sign-in, wallet
  and passkey signing, the installed app, the offline queue) use the authenticated Brave profile;
  everything else may use labeled mock auth, Storybook, or a clean-room browser.

### Codex QA Pass 2

- Start only after `qa_pass_1` passes.
- Search for every old path, check redirects and links, and run the full gate chain.
