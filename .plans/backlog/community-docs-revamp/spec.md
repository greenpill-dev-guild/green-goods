# Community Docs Revamp Spec

## Summary

Rebuild the Community tab of the docs site (`docs/docs/community/` plus the community Reference
pages) so that gardeners, stewards, evaluators, and funders can each find their path, finish a
first task, and recover from problems in one plain voice that matches the product. Cover Commitment
Pooling where community members meet it. Move technical reference to Builders, and let generators
project plain language from the codebase.

The plan comes from the 2026-09-01 Build Sync review and a section-by-section audit done the same
day (original audit, owner-only link:
https://claude.ai/code/artifact/2a9d634e-0eaf-4187-a85f-f29ea625da9b). On 2026-09-23 it was
reconciled against `develop`, the open Builders PR #795, and Linear. This spec is the reconciled
version; where it differs from the audit, this spec wins.

## Users

- Primary: gardeners on phones in the field, many with patchy connectivity; garden stewards
  running review, funding, and pools; evaluators writing assessments.
- Secondary: funders; the team walking new gardens through onboarding; agents and routines that
  read these pages (see Consumers).

## What changed since the 2026-09-01 audit

### Done on `develop` since the audit

- New guide: Install and Update (`gardener-guide/installing-and-updating.mdx`, 2026-09-15), now
  first in the gardener sidebar. It was written for the team to walk a user through; PRD-925 asks
  for guidance a gardener can follow alone.
- Upload all: Submit Work, Recovery and Sync, How It Works, and Why We Build now say that queued
  work waits on the device and the gardener sends it with **Upload all** (2026-09-15 to 09-18).
- The claims ledger's pooling entry was re-verified on 2026-09-03 and still reads "deployed, not
  available".
- Page links and FAQ commands follow the repo's command consolidation.

### Handled by the Builders track (PR #795, open)

- Design Rationale moves to Builders, Architecture, Design; its community slug redirects
  (builder spec D9).
- The MIT license moves to a Builders Reference page, and Credits keeps a pointer (D10; the
  Credits slimming sits in that track's final sweep).
- `llms.txt` and `.md` page twins are generated at build time (D5, final sweep).
- Agent-context persona pointers move to the ontology-projected persona page, which settles the
  old "where do personas live" question.
- Builders gains a Data Model & Ontology page, a natural home for the formal ontology page.
- Its spec leaves FAQ, Glossary, Ontology, Product History, and Credits on the community side for
  this track to decide.
- Its tone contract (no em dashes, second person, why before what) says builder pages adopt the
  community track's register, so this hub owns that register.

### Product changes the docs must follow

- Nothing uploads on its own anymore. "Sync" framing is stale; gardeners tap **Upload all**.
- The work list screen is titled **Your Work** (`app.workDashboard.title` in
  `packages/shared/src/i18n/en.json`). The gardener guides now use that name; Review Work still
  says "Work Dashboard".
- Commitment Pooling ships in 2.0.0. Gardeners can offer, request, take up, add proof, link work,
  and confirm (client `views/Home/Garden/Commitment`, `CommitmentsDrawer`,
  `Compose/ComposeCommitment.tsx`). Stewards get a pool console with step-by-step setup progress,
  a seeding tray, and seasons and campaigns (admin `routes/views.tsx` pool routes). Steward
  vocabulary is "Start a season" and "Start a campaign" (pooling Decision Log #66).
- The shipped pooling copy (`app.commitment.*` in `en.json`, for example "Take This Up", "Confirm
  It Was Kept", "Someone is asking for help") is the voice target for every community page.
- Demo mode (`?mockAuth=user&mockPooling=1&presentation=pwa`) and Storybook render pooling
  screens without live chain state, which makes screenshots practical.

### New demand from Linear

| Issue | Ask | Where it lands |
|---|---|---|
| PRD-927 | Plain-language guide to submitting work, approval, and reward | How It Works and Track Your Work |
| PRD-925 | Android install and first-run guidance a gardener can follow alone | Install and Update |
| PRD-820 | Newcomers read "garden" as literal gardening | Welcome and Glossary framing; any rename stays a product call |
| PRD-639 | Public visibility of gardener photos | FAQ privacy answer waits on it |
| PRD-744 | Glossary prose says approval creates the Work attestation | Glossary generator step |
| PRD-727 | Commitment Pooling docs lane (pooling hub), guides plus architecture | Decision Q1 |
| PRD-728 | Pooling walkthrough videos, blocked on PRD-727 | Candidate embeds; production out of scope |
| MAR-6, MAR-19 | Docs diagrams; a create-account demo video (Marketing) | Candidate inputs to How It Works and Install and Update |

## Target information architecture

Community sidebar after this work:

```text
Welcome
How It Works
Why We Build
Gardener      Install and Update · Join a Garden · Submit Work · Track Your Work ·
              Commitments (new) · Recovery (renamed from Recovery and Sync)
Steward       Create a Garden · Manage Actions · Review Work · Run Your Pool (new) ·
              Funding and Governance · Mint Impact Certificate
Evaluator     The Evaluator Role (new) · Make an Assessment (moved from Steward) ·
              How Assessments Shape Review (new)
Funder        Donate · Endow · Remove an Endowment
FAQ           top level, at /faq
Glossary
Credits
```

Leaving the community sidebar: Formal Ontology (to Builders), Honest Claims (Decision Q3),
Product History (Decision Q4), and Design Rationale (already moving in PR #795). Final page names
are settled while writing; the order follows the gardener's real sequence of tasks.

## Page-by-page scope

| Page | Action | Scope |
|---|---|---|
| Welcome | Rewrite | Keep the opening line and the "find your path" table. Drop protocol names and the role taxonomy. Say what a garden is: a community doing regenerative work in one place, such as solar, waste, education, or agroforestry (PRD-820). Point the evaluator row at the Evaluator guide. About half the current length. |
| How It Works | Rebuild | One diagram: Garden, Action, Work, Review, Assessment, Impact Certificate. The loop told as a story, including Commitment Pooling, using the pooling gallery images. A short "built for the field" section (install, sign-in, offline, Upload all, languages). Explain an approval record in four layers with a clear "what it is not". Carries PRD-927's core. |
| Why We Build | Trim | Keep the community stories and Eight Forms of Capital. Cut unsourced numbers and deck phrasing; compress the SDG table. |
| Install and Update | Revise | Make it self-serve for a gardener alone on Android (PRD-925). Add screenshots. Keep "What we cannot see". |
| Join a Garden | Rewrite | A screenshot per step. Passkey path first. Give the "ask your steward to add you" path equal weight. Move wallet and gas detail into one closing box. |
| Submit Work | Keep as the model | Voice pass. Refresh screenshots after release. Add linking work to a commitment. |
| Track Your Work | Rebuild | Built on the Your Work screen. Name every status and what it means. Follow one real submission through review in screenshots. Give an honest sense of review time. Treat rejection feedback as the fix list. Explorer verification becomes an optional closing section or a Builders link. |
| Commitments | New | What a commitment is and is not; offers and requests; taking one up; adding proof and linking work; confirmation. Uses the product's own words. |
| Recovery | Rebuild and rename | On the Upload all model: what is saved where, how to tell your work is safe, what to do when it will not send, and the one rule (never recreate work that is still waiting). Field tips such as checking before you leave the site. |
| Steward index | Split | Steward-only landing, benefits first. |
| Create a Garden, Manage Actions | Voice pass | Plain language; remove em dashes. |
| Review Work | Revise | Add a judgment frame: what good evidence looks like, choosing a confidence level, writing a rejection that helps. |
| Run Your Pool | New | Set up a pool, start a season or campaign, seed commitments, confirm what was kept, close out. Written after release against the shipped console. |
| Funding and Governance | Rebuild | Real on-screen labels, screenshots, and one plain decision table. |
| Mint Impact Certificate | Voice pass | Honest availability wording while certificate activation stays partial. |
| Evaluator guide | New | Two or three pages: the role, Make an Assessment (moved), how assessments frame review and certificates. |
| Funder guide | Voice pass | Keep the three flows. Add a short note on what Green Goods does and does not verify. |
| FAQ | Rebuild and promote | Top level at `/faq`, with a redirect. Builder questions move to Builders. Group by the reader's worry, in their own words, answer first. Inputs: onboarding support questions, PRD-639, PRD-843. |
| Glossary | Regenerate | Plain definitions for community-facing terms only (see Generators). |
| Formal Ontology | Move | To Builders. Keep the file path and slug so the ontology gates do not churn. |
| Honest Claims | Decide | Decision Q3. |
| Product History | Decide | Decision Q4. It receives eight legacy redirects and one footer link. |
| Credits | Keep | Intro only; the license pointer comes from PR #795. |

## Page contract

Task pages follow Submit Work's shape, with two additions from the reference study:

1. Title: a verb phrase naming one job.
2. Purpose: one or two sentences in the reader's words.
3. Before you start: a short list, including physical needs such as being at the garden.
4. Steps: three to eight numbered steps using the exact on-screen labels, with one screenshot per
   decision point, a real caption, and alt text.
5. Reassurance inside steps where people hesitate; firm wording only for evidence integrity (your
   own photos, real dates, real places).
6. Success signal (new): what the screen shows when it worked.
7. What happens next (new): who acts, against what, and roughly when.
8. If something goes wrong: symptom and action pairs, then one support path.
9. Next step: exactly one primary link.

Concept pages (Welcome, How It Works) use a one-line definition, an everyday comparison, a short
story, one real annotated example, and a plain "what it is not".

## Voice and tone contract

Shared with the Builders track:

- Second person, active voice, plain words, roughly an 8th-grade reading level.
- Why before what; condition before instruction; one idea per sentence.
- The product's own labels and copy are the vocabulary. No protocol names on community pages:
  EAS, Hats, Octant, Gardens V2, IPFS, CIDS, ERC standards, and chain names stay out, except in
  the one "using your own wallet" box a page may carry.
- No em dashes. Sentence-case headings. No marketing superlatives.
- Permission-giving where people hesitate ("It's OK to...", "You can always..."); strict where
  the integrity of the record is at stake.

## What the reference docs teach

From the 2026-09-01 study of Hypercerts, Karma GAP, EAS, GainForest, Silvi, and iNaturalist:

1. Navigation is the audience split, with a benefits-first landing per role (Karma GAP, GainForest).
2. Page shape changes by role: procedures for people doing the work, judgment frames for
   reviewers and funders (GainForest).
3. One job per page and one screenshot per step (Karma GAP, Hypercerts).
4. One hierarchy diagram, drawn once and assumed everywhere (Karma GAP).
5. Hard concepts in four layers plus a plain negative definition (EAS, Hypercerts).
6. The chain appears once as a confirmation step, or not at all (Karma GAP, GainForest).
7. Every review state is named, with checkable meaning and a worked example (iNaturalist). Silvi's
   unexplained review is the pattern to avoid.
8. The FAQ triages worries in the reader's own words, answer first (iNaturalist, EAS).

A gap worth owning: none of the three field apps studied has a real offline page. Green Goods is
offline-first, so the Recovery page can be the best in its category.

## Generators and scripts

- Glossary: add a `plain_definition` field to community-facing terms in
  `packages/shared/src/ontology/green-goods-ontology.json`. `renderGlossary`
  (`scripts/docs/renderers.mjs`) emits one plain entry per term whose surfaces include community
  readers, linked to its guide. Technical definitions stay on the Builders ontology page. This also
  closes PRD-744's glossary prose item. Tests live in `scripts/docs/generate.test.mjs`.
- Claims: if Decision Q3 keeps the page, the claims renderer in
  `scripts/quality/ontology-render.mjs` gets human headings instead of raw stage keys, and the page
  moves to Builders.
- Docs audit: `isGuideLikeDoc` in `docs/scripts/docs-audit.mjs` checks the retired
  `operator-guide/` path but not `steward-guide/`, so steward pages skip the guide checks today.
  Add `steward-guide/` (`evaluator-guide/` is already listed), drop `operator-guide/`, and cover it
  in `docs/scripts/docs-audit.test.mjs`. The guide check only requires frontmatter fields, which
  every steward page already has, so the fix is safe. It checks no page structure today; encoding
  the page contract would be new (optional step 3.3).

## Consumers and dependencies

| Consumer | Reads | Handling |
|---|---|---|
| `.claude/context/` agent, product, values, admin, client, shared, ontology | Community and Reference paths | Repoint in the structure change |
| `.claude/skills/design/*`, `.claude/skills/doc-feedback/SKILL.md` | Glossary and community paths | Same change |
| `docs/routines/growth-pulse.md` | How It Works (its five-stage loop) and the claims page, read at runtime from `main`, with a fallback | Update alongside the How It Works rebuild and any claims move |
| `scripts/quality/check-ontology.mjs`, `scripts/docs/generate.mjs`, `scripts/data/validation-policy.json`, `.github/workflows/ontology.yml`, and their tests | Generated page file paths | Move sidebar entries, not files |
| `docs/docusaurus.config.ts` | Redirects, navbar, footer | Redirect every moved slug; retarget Product History's eight redirects and footer link |
| `docs/scripts/developer-guides.mjs` | Commands mentioned in pages | Keep commands off community pages |
| PR #795 (Builders) | `docs/sidebars.ts`, `docs/docusaurus.config.ts`, Reference | Start structure work after it merges |
| Commitment Pooling hub | Gallery images in its `artifacts/visuals/`; PRD-727 scope | Copy the chosen images into `docs/static/img/` before that hub closes; settle Q1 |
| Docs deployment (Vercel) | The docs project | Confirm it deploys before publishing; it was blocking deployments in late September 2026 |

## Truth fixes

These are wrong today and can ship on their own, before or during the revamp:

1. How It Works says Spanish and Portuguese cover "documentation". The docs site is English-only
   (`docs/docusaurus.config.ts`, `locales: ['en']`).
2. Review Work says "Work Dashboard"; the screen is titled "Your Work".
3. Why We Build claims "20+ active garden communities" and "less than 60 seconds" to a first
   submission; How It Works says stewards spend "2-4 hours per week". None is sourced.
4. Welcome lists six roles, including Owner; the ontology defines five personas.
5. The claims ledger's pooling entry must match what is actually available after the release.
6. The docs audit skips steward pages (see Generators and scripts).
7. Em dashes remain in FAQ (3), Managing Actions (2), How It Works (2), and Why We Build (1).

## Human Judgment Points

Open decisions Q1 to Q10 are listed with recommendations in `plan.todo.md` § Decision Log. Q1
(ownership of pooling guides and what ships on release day) and Q10 (the Linear footprint) matter
before the release; the rest can be settled when the hub is promoted.

## Non-Functional Constraints

- Package boundaries: docs site, docs scripts, and the ontology sidecar only. No product code.
- Localization: the docs site is English-only. This hub removes the claim that it is translated;
  Decision Q9 covers any Spanish and Portuguese follow-on.
- Accessibility: every screenshot has alt text and a caption, and no instruction lives only inside
  an image.
- Privacy: the docs are public. Screenshots come from demo mode, Storybook, or test accounts, with
  no real addresses, names, or photos of people.
- Freshness: each screenshot notes the release it was taken from.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Community pages, sidebar, redirects, consumer pointers | `ui` | Docs content; TDD not applicable; proof is the docs gates plus a replayed read-through |
| Glossary and claims generators, docs-audit rules | `state_api` | Script changes with RED/GREEN tests |
| Contracts | `contracts` | n/a |
| Content replayed against the released product | `qa_pass_1` | Every step walked on the real screens |
| Links, redirects, consumers, and gates | `qa_pass_2` | Regression sweep |

## Risks

- Pooling guides written before the product settles. Mitigation: write after the release against
  the shipped screens, and label anything still planned.
- Collisions with PR #795 in shared files. Mitigation: start structure work after it merges.
- Screenshots go stale fast. Mitigation: capture after the release, date them, and use fewer,
  decisive screenshots.
- Scope creep into product renames. Mitigation: the docs frame terms; renames stay in their issues.
- Consumers break quietly (agents, routines). Mitigation: repoint in the same change, and
  `qa_pass_2` searches for every old path.
