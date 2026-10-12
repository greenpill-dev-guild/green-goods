# Community Docs Revamp - State/API Handoff

## Lane

- Owner: Claude
- Branch: `chore/community-docs-revamp-plan` (PR #896). Worked in the session branch
  `claude/green-goods-community-docs-b0ebe9`, which starts at that branch's head.
- Status: step 3.1 passed. Step 3.2 is not started and waits on Decision Q3.

## Scope

- Step 3.1: the glossary renderer leads with plain "Everyday terms" built from the existing
  `human_concepts` records, keeps every anchor and both canonical tables, and the ontology gate's
  term-heading guard reads the new section.
- Step 3.2 (claims renderer headings) is blocked on Decision Q3 and is not started.
- No shared hooks, query keys, or runtime state are involved. The lane covers repository scripts
  and the ontology projection data only.

## What changed

- `scripts/docs/renderers.mjs`
  - `GLOSSARY_EVERYDAY`: an explicit, ordered list of thirteen term references, each with the guide
    it links to. Eight entities (garden, action, work, work approval, assessment, hypercert, vault,
    cookie jar) and the five personas.
  - `glossaryEverydayEntries(ontology, projections, selection)`: resolves each reference to its
    ontology record, its `human_concepts` record, its aliases, and its capability availability.
    It throws when a reference is not a canonical entity or persona, when it has no
    `human_concepts` record, and when a heading override is neither the display name nor a
    declared alias.
  - `renderGlossary`: plain intro, then "Everyday terms" (one entry per term: plain name, why it
    matters, an example, also called, not the same as, availability when it is not live, and a
    guide link), then "Formal definitions" with the two canonical tables unchanged, then the term
    reference for every remaining term, then the language policy.
  - `GLOSSARY_LEGACY_ANCHORS`: the older anchors (`#operator`, `#pwa-progressive-web-app`) stay on
    the page wherever the term's heading lands.
- `scripts/quality/check-ontology.mjs`: `parseGlossaryTermHeadings` reads the headings under
  "Everyday terms" as well as "Term Reference", and the term-heading guard uses it. A heading in
  either section that resolves to no entity, persona, declared alias, or supporting term fails the
  gate. The definition lock on the two canonical tables is unchanged.
- `packages/shared/src/ontology/green-goods-projections.json`: wording in nine `human_concepts`
  records (garden, work, cookie jar, gardener, steward, community member, hypercert, vault,
  assessment), and two persona-journey guide links that follow the assessment page's move. No
  schema, capability, or maturity value changed. The runtime agent manifest reads only `aliases`
  from these records, and no alias changed.
- Regenerated with `node scripts/quality/check-ontology.mjs --generate` and
  `node scripts/docs/generate.mjs`: the glossary page, the Personas page (one guide route), the
  Test Cases page (QA scenario titles), and source digests on the other projections. No generated
  file was edited by hand.

What the reviewer asked for, and where it landed:

- "Surfaces" is not a reader group: the leading terms are an explicit list, not a predicate.
- Existing `human_concepts` records are reused. No `plain_definition` field or second schema.
- Anchors consumed by the app survive: the gate reports `client-glossary: 10 client terms and deep
  links resolved`, and the generator test asserts every earlier anchor.
- The gate cannot be bypassed by the new section: see the behavioral proof below.

## TDD Proof

- RED (2026-10-12T20:11:32Z): `node --test scripts/docs/generate.test.mjs` failed to load with
  "The requested module './renderers.mjs' does not provide an export named
  'glossaryEverydayEntries'". `node --test scripts/quality/check-ontology.test.mjs` failed to load
  with "does not provide an export named 'parseGlossaryTermHeadings'". The new tests name
  behavior that did not exist yet.
- GREEN (2026-10-12T20:16:13Z): `node --test scripts/docs/generate.test.mjs` 44 of 44 passed.
  `node --test scripts/quality/check-ontology.test.mjs` 69 of 69 passed.
- Behavioral proof of the guard: a heading `### Impact Report {#impact-report}` added by hand
  under "Everyday terms" made `node scripts/quality/check-ontology.mjs` report "unlisted drift:
  [docs-term-reference] docs:term:impact-report resolves to no entity, persona, declared alias, or
  supporting term". The page was then regenerated and the gate passed.
- Proof limit: none.

Tests added:

- `scripts/docs/generate.test.mjs`: "glossary leads with plain entries for the everyday terms and
  keeps every anchor people link to", and "an everyday glossary entry needs a plain-language
  record and a name the ontology knows".
- `scripts/quality/check-ontology.test.mjs`: "parseGlossaryTermHeadings reads the everyday section
  too, so both are held to declared terms".

## Validation

Run from the repository root on the tested commit, inside the planner run recorded in the `ui`
handoff (`bun run check -- --intent qa --no-fail-fast`: 14 fresh passes of 15 selected, with the
advisory browser proof pending).

| Check | Command | Result |
|---|---|---|
| `docs-authority` | `node --test scripts/docs/generate.test.mjs scripts/docs/mermaid-parse.test.mjs docs/scripts/docs-audit.test.mjs docs/scripts/developer-guides.test.mjs`, then the audit and the drift check | 72 tests passed, 0 failed; 17 projections current |
| `ontology` | `node scripts/dev/node-cli.js node --test scripts/quality/check-ontology.test.mjs && node scripts/quality/check-ontology.mjs` | 69 tests passed, 0 failed; "docs-term-reference: 42 glossary term entries resolved"; "client-glossary: 10 client terms and deep links resolved"; all guards passed, 7 findings baselined |
| `docs-generated` | `node scripts/docs/generate.mjs --check` | "Checked documentation projections (17)" |
| Consumers of the projection data | `shared-test`, `client-test`, `admin-test`, `agent-test`, `agent-tools-test`, and both typechecks | All passed; counts are in the `ui` handoff |
| `docs-build` | `bun run build` in `docs` | Built; the glossary page renders with its "Everyday terms" outline, and `/glossary#garden`, `#work-approval`, `#hypercert`, `#cookie-jar`, and `#formal-definitions` resolve in the rendered check |

## Validation Receipt

- Tested implementation commit SHA: `fb2064f6a86f58b127c351e914c6c517c28fd319`
- Run at (UTC): `2026-10-12T22:03:39Z`
- Exact command(s): `bun run check -- --intent qa --no-fail-fast`; `bun run check --only docs-generated`
- Result: 14 of 14 automated checks passed fresh, including `docs-authority` (72 tests), `ontology` (69 tests, all guards passed), and the drift check (17 projections). The planner run finished at `2026-10-12T22:10:11Z`; `docs-generated` ran again by itself at `2026-10-12T22:10:45Z`. This is the merged branch: `develop` (tip `8d22aabb3`) was merged in before the run, and the two earlier runs on `48c6220d0` and `0b22f55cc` passed the same way
- Validated paths: `scripts/docs scripts/quality packages/shared/src/ontology docs/docs docs/src/data`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- scripts/docs scripts/quality packages/shared/src/ontology docs/docs docs/src/data` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code fb2064f6a86f58b127c351e914c6c517c28fd319..HEAD -- scripts/docs scripts/quality packages/shared/src/ontology docs/docs docs/src/data` → exit 0, no output. The commit that carries this handoff changes only `.plans/active/community-docs-revamp/`
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- scripts/docs scripts/quality packages/shared/src/ontology docs/docs docs/src/data` → empty

## Risks / Blockers

- Step 3.2 waits for Decision Q3. If the claims page stays, its renderer gets human headings with
  the assertion in `scripts/quality/check-ontology.test.mjs`, and its sidebar label is settled at
  the same time: the renderer sets "Capability & Claims" while the guides call the page Honest
  Claims.
- The "Availability" line on an everyday entry comes from the capability records. Hypercert shows
  as still being built because its record says `in-build`. If that record changes, the glossary
  follows on the next generation.
- Pooling terms are deliberately absent from the everyday list. See
  `pooling-insertion-points.md`.
