# Community Docs Revamp Plan

**Feature Slug**: `community-docs-revamp`
**Stage**: `backlog`
**Status**: `BACKLOG: starts after the 2.0.0 release; open decisions are listed below`
**Created**: `2026-09-23`
**Last Updated**: `2026-09-23`
**Source**: 2026-09-01 Build Sync review and docs audit, reconciled on 2026-09-23 against
`develop`, PR #795, and Linear (see [`spec.md`](./spec.md))
**Linear**: not mirrored yet (Decision Q10)

## Decision Log

### Locked

| # | Decision | Source |
|---|---|---|
| L1 | Audit first, then plan section by section before editing | Build Sync, 2026-09-01 |
| L2 | Community pages stay focused, minimal, and nontechnical; technical depth lives on Builders | Build Sync, 2026-09-01 |
| L3 | The codebase is the source of truth; generate docs content from it where that pays | Build Sync, 2026-09-01 |
| L4 | Steward and Evaluator get separate guides | Build Sync, 2026-09-01 |
| L5 | The FAQ moves to the top level | Build Sync, 2026-09-01 |
| L6 | The full ontology moves to the Builders side | Build Sync, 2026-09-01 |
| L7 | The funder guide keeps its three flows for now | Build Sync, 2026-09-01 |
| L8 | Submit Work is the model page for every guide | Build Sync, 2026-09-01 |
| L9 | Check the skills, scripts, and routines that read these pages before moving anything | Build Sync, 2026-09-01 |
| L10 | No em dashes in hand-written docs prose | Afo, 2026-09-02 (builder-docs tone contract) |
| L11 | Design Rationale, the License split, and `llms.txt` belong to the Builders track | Builder-docs spec D5, D9, D10 (PR #795) |

### Open

| # | Question | Recommendation | Needed by |
|---|---|---|---|
| Q1 | Who owns user-facing Commitment Pooling docs, and what ships on release day? PRD-727 owns pooling guides today, under acceptance written in July in protocol terms, and is due with the release. | This hub owns the community pooling pages (How It Works section, Commitments, Run Your Pool) in the community voice, written after the release. PRD-727 narrows to builder-side architecture and settlement truth, or closes into PR #795's Data Model & Ontology page. On release day ship only truth fixes: the claims ledger entry and a short How It Works paragraph. | Before the release |
| Q2 | Where is the line between docs-site pooling pages and the Commitment Pooling Google Doc, which is the declared source for external pooling prose? | The docs site owns how-to pages for shipped flows in product words; the Google Doc keeps the partner and staged-growth narrative. Record the split in the pooling hub's `external-brief.md`. | Phase 0 |
| Q3 | Honest Claims: move to Builders with a humanized renderer, or remove? | Move it to Builders as the capability ledger. The FAQ answers "what works today" in plain words from the same ledger. | Phase 0 |
| Q4 | Product History: remove, or keep a stub? | Remove it. Point its eight redirects and footer link at a short "where retired specs went" note on Builders. | Phase 0 |
| Q5 | Why We Build: keep as its own page, or fold into Welcome? | Keep it, trimmed. The community stories deserve a page and Welcome stays short. | Phase 0 |
| Q6 | Glossary: add `plain_definition` to the ontology, or hand-write a community glossary? | Add `plain_definition`, so there is one source of truth. | Phase 0 |
| Q7 | Screenshots: capture by hand, or automate? | By hand after the release, from demo mode, Storybook, and test accounts. Automate later if freshness becomes a burden. | Phase 0 |
| Q8 | Evaluator guide: assessments only, or data access too? | Assessments only. Data access is Builders material. | Phase 0 |
| Q9 | Translation: the docs are English-only while the app ships English, Spanish, and Portuguese. | Remove the false claim now. Plan Spanish and Portuguese gardener pages as a follow-on once the English settles. | Phase 0 |
| Q10 | Linear: when and where to mirror? The old docs project is Completed and the release project ends at the cut. | Create one parent-only issue when the hub is promoted, unprojected per the routing rules. Make PRD-927 and PRD-925 children; relate PRD-820, PRD-639, PRD-744, and PRD-727. | Promotion |

## Research / Plan Gate

- [x] Record research evidence in `spec.md` (2026-09-01 audit, reconciled 2026-09-23)
- [x] Identify the patterns to mirror: Submit Work for pages; the builder-docs hub for lanes
- [x] List human judgment points (Q1 to Q10 above)
- [x] Define what is out of scope (`brief.md`)
- [x] Choose the lightest honest validation commands (`eval.md`)

## Requirements Coverage

| Requirement | Source | Lane | Step | Status |
|---|---|---|---|---|
| Audit section by section, then plan | Build Sync | n/a | This hub | ✅ |
| Ground the work in strong reference docs | Build Sync | n/a | `spec.md` reference patterns | ✅ |
| How It Works explains Commitment Pooling with the gallery images | Build Sync | `ui` | 0.6, 2.1 | ⏳ |
| Gardener guides: joining with screenshots, tracking, recovery, commitments | Build Sync | `ui` | 2.2 to 2.6 | ⏳ |
| Use Submit Work as the model | Build Sync | `ui` | 0.4, every Phase 2 step | ⏳ |
| Separate Steward and Evaluator; cover pooling and assessments | Build Sync | `ui` | 1.2, 2.7, 2.9 | ⏳ |
| Rework FAQ, Glossary, Claims, and Product History | Build Sync | `ui`, `state_api` | 1.1, 1.4, 2.10, 3.1, 3.2 | ⏳ |
| Rework Design Rationale | Build Sync | n/a | PR #795 (L11) | 🚧 |
| Move the ontology to Builders | Build Sync | `ui` | 1.3 | ⏳ |
| Check downstream consumers | Build Sync | `ui`, `qa_pass_2` | 1.5, 4.2 | ⏳ |
| Generators for authoritative content | Build Sync | `state_api` | 0.5, 3.1 to 3.3 | ⏳ |
| Plain-language submit, approve, and reward guide | PRD-927 | `ui` | 2.1, 2.2 | ⏳ |
| Self-serve Android install | PRD-925 | `ui` | 2.5 | ⏳ |
| Explain what a garden is | PRD-820 | `ui` | 2.11 | ⏳ |
| Photo privacy answer | PRD-639 | `ui` | 2.10 | ⏳ |
| Glossary prose for Work and Work Approval | PRD-744 | `state_api` | 3.1 | ⏳ |
| Pooling user guides | PRD-727 | `ui` | 2.6, 2.7 (per Q1) | ⏳ |

## Steps

### Phase 0: Promote and prepare

- [ ] 0.1 Settle Q1 to Q10 with Afo, move the answers into the Locked table, and promote the hub
  with `node scripts/harness/plan-hub.mjs move --feature community-docs-revamp --to active`.
  Verify: `node scripts/harness/plan-hub.mjs validate`.
- [ ] 0.2 Confirm the prerequisites: PR #795 is merged; the docs site deploys; the post-release
  state of pools and gardens is known, so pages and claims describe what people can actually use.
- [ ] 0.3 Mirror to Linear per Q10 and record it with `record-linear --lane-sync-mode parent_only`.
- [ ] 0.4 Write the page contract and voice contract from `spec.md` into `docs/README.md` §
  Authored pages, shared with the Builders track. Verify: `node docs/scripts/docs-audit.mjs --ci`.
- [ ] 0.5 `state_api`: in `docs/scripts/docs-audit.mjs`, treat `steward-guide/` as guide-like and
  drop `operator-guide/`. RED: a new case in `docs/scripts/docs-audit.test.mjs` expects a
  `steward-guide/` fixture without `goal` to be flagged, and fails. GREEN: it passes. The real
  steward pages already carry every required field (checked 2026-09-23), so the gate stays green.
- [ ] 0.6 Copy the chosen pooling gallery images (for example the loop, roles, and
  offer-that-continues images) into `docs/static/img/community/` before the pooling hub closes.
- [ ] 0.7 Take the screenshots after the release: install, join, Your Work statuses, Upload all
  states, commitments (demo mode), the pool console (Storybook or a test garden), an assessment,
  and the funding surfaces. Note the release on each.
- [ ] 0.8 Truth fixes (`spec.md` § Truth fixes). These can ship at any time, including before
  the release. Verify: the docs gate chain in `eval.md`.

### Phase 1: Structure (one PR, after PR #795 merges)

- [ ] 1.1 Move the FAQ to the top level at `/faq` with a redirect from `/reference/faq`, and move
  builder questions (chains, local development, APIs) to Builders.
- [ ] 1.2 Split Steward and Evaluator: add `community/evaluator-guide/` with an index and the
  moved Make an Assessment page, make the steward index steward-only, update `StewardPathNav`,
  and redirect the old assessment slug.
- [ ] 1.3 Move Formal Ontology to the Builders sidebar. Leave the file path and slug unchanged.
- [ ] 1.4 Apply Q3 (Honest Claims) and Q4 (Product History), retargeting Product History's eight
  redirects and footer link.
- [ ] 1.5 Repoint every consumer in `spec.md` § Consumers, plus Welcome's path table.
  Verify: the docs gate chain, and `git grep` for each old path returns only redirects.

### Phase 2: Rewrites (impact order, one page or pair per commit)

- [ ] 2.1 Rebuild How It Works and update the loop in `docs/routines/growth-pulse.md` with it.
- [ ] 2.2 Rebuild Track Your Work on the Your Work screen.
- [ ] 2.3 Rewrite Join a Garden with screenshots.
- [ ] 2.4 Rebuild and rename Recovery, with a redirect from the old slug.
- [ ] 2.5 Make Install and Update self-serve (PRD-925).
- [ ] 2.6 Write Commitments (per Q1).
- [ ] 2.7 Write Run Your Pool (per Q1).
- [ ] 2.8 Rebuild Funding and Governance.
- [ ] 2.9 Write the Evaluator guide pages.
- [ ] 2.10 Write the FAQ content. The photo privacy answer waits on PRD-639.
- [ ] 2.11 Rewrite Welcome (including what a garden is, PRD-820) and trim Why We Build.
- [ ] 2.12 Voice pass: Submit Work, Create a Garden, Manage Actions, Review Work, Mint Impact
  Certificate, the funder pages, and the Credits intro.

Each Phase 2 step: the page meets the page contract, uses on-screen labels from `en.json`, and
passes the docs gate chain.

### Phase 3: Generators

- [ ] 3.1 `state_api`: add `plain_definition` to community-facing ontology terms and make
  `renderGlossary` emit plain entries for them (per Q6), closing PRD-744's glossary item. RED/GREEN
  in `scripts/docs/generate.test.mjs`; `node scripts/docs/generate.mjs --check` is clean.
- [ ] 3.2 `state_api`: if Q3 keeps the claims page, give its renderer human headings.
- [ ] 3.3 Optional: encode the page contract as docs-audit checks.

### Phase 4: QA

- [ ] 4.1 `qa_pass_1`: replay every guide on the released product, using authenticated Brave for
  sign-in, wallet, and installed-app surfaces, and labeled demo mode elsewhere.
- [ ] 4.2 `qa_pass_2`: consumers, redirects, links, and the full gate chain.

Handoffs are written when the hub is promoted.

## Validation

See `eval.md` for the gate chain. Docs content is not unit-testable, so the `ui` lane's proof is
the gate chain plus the replayed read-through; the `state_api` lane records RED/GREEN in its
handoff.
