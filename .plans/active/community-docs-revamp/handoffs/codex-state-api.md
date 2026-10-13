# Community docs QA revision: ontology and generator handoff

- Owner: Codex
- Work branch: `claude/green-goods-community-docs-b0ebe9`; existing PR #896.
- Status: approved Phase 6 implementation and current-commit validation complete; Q3 claims work remains outside the accepted scope.
- Decision: L20. Definitions live with the existing generated Builders ontology. Community
  explains selected terms through `human_concepts`, with compatibility links to formal entries.

## Implementation

`renderOntologyMdx` owns entity/persona/supporting-term tables, capital ordering, language-policy
reference, and per-term destinations. `renderGlossary` owns everyday explanations and a stable
published-link contract. Personas links its allowed-surfaces explanation to the ontology.
G5 validates the formal tables; G6 checks both destinations; G7 retains all ten app terms/links.
The guard rejects missing destinations, stale definitions, and undeclared terms. The generators
reject removal of a published term without an explicit replacement. No schema, capability,
runtime flag, or drift baseline was changed. Seven pre-existing findings remain baselined.

The frozen 56-anchor fixture is a historical URL contract, not a second definition schema.
Formal table anchors and legacy aliases have a sticky-navbar scroll offset. Technical pointers
are linked headings so old fragment visits show a useful destination. Source guidance now names
both actual generator owners. Generated MDX was regenerated rather than edited.

## RED/GREEN proof

- RED, observed 2026-10-13T01:27:29Z: `bun run check --only docs-authority --base HEAD`
  failed the new glossary ownership contract because formal tables remained in Community.
  `bun run check --only ontology --base HEAD` failed for the missing `checkDomainDocumentation`
  export. These were intended failures before implementation.
- GREEN, observed 2026-10-13T01:43:43Z: `bun run check -- --intent qa --base HEAD`
  passed all five selected checks fresh: format, lint, docs-authority, docs-build, ontology.
  Authority suite: 73 tests passed, 17 projections consistent. Ontology: 71 tests passed;
  55 documented terms and ten app deep links resolved; three artifacts deterministic/current.
  Production search covers 72 of 72 live routes. No critical override was selected.
- Tests change a canonical definition and a human-concept example, prove changed output and
  stale check-mode rejection, regenerate to restore consistency, and reject removal of a
  published entity without replacement. Tampered definitions, absent sections, absent term
  anchors, and dead compatibility links fail the owning guard.
- Rendered proof: Codex In-app Browser, public localhost, class **none**.
  Desktop Attestation pointer opens its formal entry below the navbar; phone Hypercert alias
  opens the Impact Certificate entry. Remaining fragment/search/twin sweep belongs to Phase 7.

The proof above is the historical iteration record. The fresh current-commit Validation Receipt below certifies the approved migration; `claude-state-api.md` remains historical foundation proof.

## Limits and next action

Mechanical generation cannot establish live activation or the meaning of authored overview
prose. Pooling availability/source review remains explicit in `codex-ui.md`. The current receipt covers this migration. Remaining UI capture/product/reader evidence stays with its owners. Q3's claims renderer is
still undecided and unchanged. No publication or external record update is authorized.


## Rendered-link registration follow-up

The production build reported formal table links as unregistered, even though their native IDs
worked in the DOM. Docusaurus Heading is the existing heading owner but cannot represent an
empty table-cell target. The docs-owned TermAnchor now registers its actual native destination
with the same broken-link collector, rather than weakening anchor checking or adding another
anchor list. Markdown twins turn it back into a native HTML anchor. The definition parser ignores
the component markup; all definition and destination checks remain active.

RED: the new twin test failed for missing HTML anchor extraction (91 pass, 1 fail). GREEN: the selected six-check QA plan passed fresh; ontology 71 tests, docs tests 92,
authority 73, 17 projections current, and a production build with no broken-anchor warning.
The initial parser follow-up failed because it only recognized native HTML targets; adding
TermAnchor recognition restored the existing missing-destination tests. No term or URL is renamed.



## Final boundary fixes

A source-mutation probe confirmed a false definition alarm for MDX-sensitive `<`, `{`, and pipe
characters. The owning regression initially reported Garden and Gardener definition mismatches.
The gate now compares the formal renderer's escaped spelling; regenerated data passes, while a
changed meaning still fails. This is a comparison fix, with no schema, source meaning, or baseline
change. The current ontology suite has 72 tests.

Rendered inspection also found the frozen title target was inferred only from an H1, whose ID
Docusaurus removes. The parser no longer invents H1 targets; the frozen-link generator test then
failed with “published anchor lost: glossary”. A registered native title target restored it.
All 56 legacy IDs now exist in the rendered DOM; ten app links remain valid. The earlier count
of 57 was an iteration-record error, corrected against the frozen inventory and actual DOM.

## Validation Receipt

- Tested implementation commit SHA: `0c8ecf9e2d528d304766d22096e38974bb379123`
- Run at (UTC): `2026-10-13T03:13:16Z`
- Exact command(s): `bun run check --plan -- --intent qa --base 3a09d937b7a565718de0201907902dbba16ccdb1 --json`; `bun run check -- --intent qa --base 3a09d937b7a565718de0201907902dbba16ccdb1`; `bun run check --only docs-generated --base 3a09d937b7a565718de0201907902dbba16ccdb1`; `bun run check --only vocabulary --base 3a09d937b7a565718de0201907902dbba16ccdb1`; `bun run check --only guidance-links --base 3a09d937b7a565718de0201907902dbba16ccdb1`; `bun run --cwd docs typecheck`
- Result: all six selector checks passed fresh (format, lint, docs-authority, docs-test, docs-build, ontology), with no critical override selected for the 67-path QA revision. Authority 73 tests; Docs 92 tests; ontology 72 tests, 55 term entries, ten app links, three deterministic artifacts, seven unchanged baselined findings. The three explicit supplemental checks passed fresh: 17 docs projections consistent, vocabulary clean in three locales, and 91 guidance files valid. Docs typecheck passed. Build/search covers 72/72 routes, with no broken-link or broken-anchor warning. Audit has no hard error and two unchanged advisory endpoint warnings. Results observed through `2026-10-13T03:16:13Z`.
- Validated paths: `docs scripts .claude/context/ontology.md packages/shared/src/ontology package.json bun.lock`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs scripts .claude/context/ontology.md packages/shared/src/ontology package.json bun.lock` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 0c8ecf9e2d528d304766d22096e38974bb379123..HEAD -- docs scripts .claude/context/ontology.md packages/shared/src/ontology package.json bun.lock` → exit 0, no output; this follow-up changes only this Plan Hub
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- docs scripts .claude/context/ontology.md packages/shared/src/ontology package.json bun.lock` → empty
