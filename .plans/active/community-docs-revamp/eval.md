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
5. Human judgment: an open decision never ships as a change. Q3 and Q4 keep their pages until
   decided.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Structure | The community sidebar matches `spec.md` § Target information architecture: FAQ at `/faq`, a separate Evaluator guide, Formal Ontology on Builders, Brand kit still listed, and the existing Commitment Pool page still listed | `ui` | Sidebar diff plus a docs build |
| AC-2 | Voice | No em dashes in hand-written community or Reference prose, and every protocol or chain name is inside a "using your own wallet" box or reviewed as necessary | `ui` | The two searches below, each remaining hit reviewed in the `ui` handoff |
| AC-3 | Page contract | Every task page has a purpose, before you start, numbered steps with on-screen labels, how you know it worked, what happens next, recovery, and one next step | `ui` | Checklist in the `ui` handoff |
| AC-4 | Screenshots | Every screenshot has alt text and a caption that names its source and capture date; the steps read complete with images turned off; no image shows a live garden's members or photos | `ui` | Image list in the `ui` handoff |
| AC-5 | Truth | Every `ui` item in `spec.md` § Truth fixes is resolved | `ui` | Search results plus a read-through |
| AC-6 | Glossary generator | The page leads with plain entries for the listed terms; all prior anchors resolve; both canonical tables are unchanged; an undeclared heading in either term section fails the ontology gate | `state_api` | RED/GREEN in `scripts/docs/generate.test.mjs` and `scripts/quality/check-ontology.test.mjs`; `bun run check --only docs-generated` and `bun run check --only ontology` clean |
| AC-7 | Replay | Every guide is walked on the released product | `qa_pass_1` | Handoff with engine and session labeled per `AGENTS.md` § Browser Evidence |
| AC-8 | Consumers and gates | Each moved path returns only redirects and history under `git grep`, and the full gate chain passes | `ui`, then `qa_pass_2` | Command output in the handoffs |
| AC-9 | Unassisted read-through | Three readers who have not seen the docs, spanning gardener and steward tasks, each find their task, say who acts next, and recover a waiting item without coaching | a person (Afo or the onboarding team) | Notes on what confused them and what changed. If no readers are available it stays pending; an agent replay is never relabeled as this check |

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
  renderer in `scripts/docs/generate.test.mjs`, and the ontology gate's parsers and the claims
  renderer in `scripts/quality/check-ontology.test.mjs`.
- Integration: `bun run check --only docs-generated` and the docs build.
- E2E / Playwright: none. Docs content has no runtime behavior.
- Rendered check: changed navigation and pages at a phone width and a desktop width, with redirects,
  search, links, and Markdown twins, on a production build of the docs. Labeled per `AGENTS.md` §
  Browser Evidence.
- Manual checks: the replayed read-through (`qa_pass_1`) and the unassisted read-through (AC-9).
- TDD proof: `ui` records `not_applicable` with this note; `state_api` records RED/GREEN in its
  handoff and in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Walk every guide on the released product and fix wording, labels, and screenshots that drift.
- Record the engine and session behind each observation. Authenticated surfaces (sign-in, wallet
  and passkey signing, the installed app, the offline queue) use the authenticated Brave profile;
  everything else may use labeled mock auth, Storybook, or a clean-room browser.

### Codex QA Pass 2

- Start only after `qa_pass_1` passes.
- Search for every old path, check redirects and links, and run the full gate chain.
