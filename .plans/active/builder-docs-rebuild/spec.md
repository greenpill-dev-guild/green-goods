# Builder Docs Rebuild — Spec

**Feature Slug**: `builder-docs-rebuild`
**Last Updated**: 2026-09-02

## Locked decisions

| # | Decision |
|---|----------|
| D1 | One consolidated Testing Guide replaces the four per-tool testing pages |
| D2 | User Journeys pages deleted outright (no replacements); redirects → Anatomy of a Work Submission |
| D3 | Economics Explorer moves to Builders → Reference; "Product Specifications" category dissolves |
| D4 | Integration pages are hybrid: hand-written meaning/purpose + generated concrete details (conditional sections) |
| D5 | Ship `llms.txt` + `.md` twins at build time |
| D6 | Root-scripts consolidation is a separate tracked follow-up (out of scope here) |
| D7 | Category landings are real doc pages: Monorepo Map = Packages landing; authority table = Integrations landing |
| D8 | Agentic section: human "Working with Agents" landing + generated Skills catalog from per-skill `README.md` (SKILL.md description fallback until READMEs exist) |
| D9 | Design page moves in from community-side Design Rationale, revamped; lives **under Architecture** |
| D10 | License (MIT) splits from community Credits & Licenses into Builders → Reference |
| D11 | CI & GitHub Actions lives under Testing & QA |
| D12 | "Anatomy of a Work Submission" is tentative — build it, Afo judges from the first rendered version |

## Target information architecture

```
Builders
├─ Getting Started                 rewrite; absorbs Environment Management; outcome-first, two named paths
├─ First Contribution              rewrite of How To Contribute; Dev Guild links; ends CONTRIBUTING.md circularity
├─ Architecture
│  ├─ System Overview (landing)    absorbs Modular Approach + Local vs Global + Ethereum Alignment
│  ├─ Data Model & Ontology        layered zoomable ERD (core/funding/commitments) + Entity Matrix + commitment state diagrams
│  ├─ Anatomy of a Work Submission trace one real submission end to end (capture→sync→attest→index→review→approve→display→onward)
│  └─ Design                       moved from community Design Rationale, revamped (D9)
├─ Packages
│  ├─ Monorepo Map (landing)       seven packages, dependency direction, where to start
│  ├─ Contracts · Shared · Client · Admin · Agent · Indexer · QA   package template ×7 (QA page is new)
│  └─ API Index (generated)
├─ Integrations
│  ├─ Landing                      authority table + catalog cards
│  └─ EAS · Hats · Tokenbound · Passkeys · Karma · Octant · ENS · Gardens · Hypercerts · Cookie Jar (hybrid, D4)
├─ Agentic Development
│  ├─ Working with Agents (landing, human)
│  ├─ Skills (generated, D8)
│  ├─ Task Routing (generated)
│  └─ MCP Guide (generated)
├─ Testing & QA
│  ├─ Testing Guide                consolidates Forge/Playwright/Vitest/Storybook (D1)
│  ├─ Product Experience QA        keep (qa-report stream owns); light alignment only
│  ├─ Test Cases (generated)       keep — already priority-banded
│  └─ CI & GitHub Actions (generated, D11)
└─ Reference
   ├─ Deployments & Addresses (generated)   canonical address/schema page, stubbed to from everywhere
   ├─ Persona Surfaces (generated)          moved from journeys
   ├─ Economics Explorer (D3)
   └─ License (D10)
```

Community-side effects: community Reference keeps FAQ, Glossary, Ontology, Product History, and a
slimmed Credits page (license section becomes a pointer). Design Rationale leaves the community
sidebar; its slug redirects.

## Page templates (from the blueprint)

- **Getting Started** — outcome first · prerequisites checklist · two named paths (full stack /
  single surface) · numbered steps with expected output (env setup absorbed, `?mockAuth` path) ·
  checkpoint screenshot · known failures · exactly three next steps.
- **Package page** — one-sentence purpose + production URL · 5–8-row directory map · scoped
  run/test commands · how it connects (links Architecture) · 3–5 gotchas · go-deeper links
  (AGENTS.md, Storybook, generated refs).
- **Integration page (hybrid, D4)** — why Green Goods uses it (hand) · flow diagram · where it
  lives in code · generated deployment projection (conditional indexer section) · working with it
  locally · 3–5 canonical upstream links.
- **Testing Guide** — test-map table (runner × coverage × location × docs link) · everyday loop ·
  per-surface commands · manual QA (`?mockAuth`, Storybook viewports, live Storybook link) ·
  reproducing CI locally · writing new tests with linked exemplars.
- **Skills catalog (generated)** — hand intro · per skill: name, purpose, when it fires, what it
  produces, GitHub folder link; source `.claude/skills/<name>/README.md`, fallback `SKILL.md`
  description.

## Tone contract

Hand-written pages adopt the community track's register adapted for developers; generated
reference pages stay terse. Rules: (1) second person, active voice; (2) why before what;
(3) goal/condition before instruction; (4) plain declaratives, one idea per sentence; (5) links
say where they go, and every page has next steps + external links. Sentence-case headings;
contractions fine; no marketing superlatives.

## Working rules (from reference-site research)

Hubs navigate, leaves teach · every page ends with next steps · facts live in exactly one place
(deployments page is canonical) · definition-first concept pages · one small diagram per concept ·
link density is context repair · migrate iteratively, never big-bang · redirects for every moved
or deleted slug.
