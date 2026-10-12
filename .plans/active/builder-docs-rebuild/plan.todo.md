# Builder Docs Rebuild Plan

**Feature Slug**: `builder-docs-rebuild`
**Status**: ACTIVE
**Created**: 2026-09-02
**Last Updated**: 2026-10-10

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Five phases, each an independently shippable PR to `develop` | Diátaxis anti-big-bang; site never worse mid-migration; avoids stacked-PR CI Gate gaps |
| 2 | ~~One lane branch per phase~~ **Amended by Afo 2026-09-02: all phases proceed on `feature/builder-docs-rebuild`**; PR #795 grows with each phase | Afo's explicit direction after Phase 1 review; single review surface, one CI stream |
| 3 | Hybrid integration mechanism: pages become hand-owned MDX that render generated projection data via a component | Meaning stays human-editable (D4); concrete details keep digest-gated provenance |
| 4 | Skills catalog generated from `.claude/skills/*/README.md` with `SKILL.md` description fallback | Catalog complete on day one (D8); improves as READMEs land |
| 5 | Mermaid zoom implemented site-wide, not per-page | Every diagram benefits; one mechanism to maintain |
| 6 | Redirect entries land in the same PR as each slug move or deletion | No window where old links dead-end |
| 7 | QA pages (`quality/*`) stay owned by the qa-report stream; this effort only re-parents and cross-links | Avoid rework of pages rewritten 09-01/02 (#793) |
| 8 | Merge `develop` into the branch rather than rebase (Afo, 2026-09-22) | A rebase replays 18 commits over the same files, and a force-push would orphan the 46 open review threads |
| 9 | Keep `GG_PUSH_GATE_ARGS` on develop's pre-push gate line (Afo, 2026-09-22) | Does nothing unless set; this branch's full push plan needs explicit focus or a narrower base |
| 10 | Community invites follow the product: Telegram `+N3o3_43iRec1Y2Jh` (Afo, 2026-09-22) and Discord `discord.gg/greenpill` to match | One invite set across the app, the docs, and the repo |
| 11 | Develop's generated Command inventory and Contract operations pages stay under Packages (Afo, 2026-09-22) | Matches their slugs; Getting Started links Command inventory as the command source |
| 12 | The integration projection stays English-only (Afo, 2026-09-23) | The docs site ships no locales, so routing its labels through i18n would add keys nobody reads; revisit if the docs add locales |
| 13 | EAS and Tokenbound join the ontology's integration catalog, so every integration page with an on-chain footprint renders the deployment projection (2026-10-09, open to Afo's veto) | The catalog had been seeded from modules only; the resolvers and garden account contracts are deployed per network like any module, and Passkeys, with no deployment, says so in prose |
| 14 | Develop merged into the branch a third time on 2026-10-09 (1182 commits, the 2.0.0 release sync), by merge again | Same reasoning as decision 8; the review threads stay anchored |
| 15 | QA round 1 lands on the same PR (Afo, 2026-10-10): thirty review items from the local production build, all on `feature/builder-docs-rebuild` | One review surface and one CI stream, as decision 2 |
| 16 | One sidebar highlight everywhere, the primary green from the app tokens; builder teal survives only as the Builder role accent (Afo, 2026-10-10) | The teal was off-brand in the sidebar and three active looks coexisted; `docs/README.md` keeps brand artwork colors out of UI tokens |
| 17 | Personas and Surfaces moves under Architecture as its first entry, slug `/builders/architecture/personas`, with the old reference slug redirected (Afo, 2026-10-10) | The actors give the work-submission trace its context; the collapsed Reference group hid them |
| 18 | Product Experience QA becomes Product QA and is condensed, overriding decision 7 for this round (Afo, 2026-10-10) | Afo asked for the rename and a lighter page; the qa-report stream keeps ownership afterwards |
| 19 | Deployments & Addresses prints every recorded address and schema UID with explorer links from an explicit artifact allowlist; owners, deployers, managers, safes, signers and receipts are blocked by name and tested (2026-10-10) | Resolves the open Codex thread; the page is now the address reference its sidebar label promised |
| 20 | Architecture reframes "three ideas" as five (adding opt-in modules and local-first capture with indexed reads) and the dependency arrow reads `contracts → indexer → shared → client / admin / agent` as data flow (Afo, 2026-10-10) | "Three ideas" sold the protocol short; the indexer belongs in the arrow |
| 21 | QA round 2 lands on the same PR (Afo, 2026-10-10): eleven review items from the rebuilt local build plus a self-review pass | Same reasoning as decision 15 |
| 22 | Unlock Protocol joins the integration catalog through the GreenWill registry, with its own page and the `Unlock` matrix column (Afo, 2026-10-10: "Unlock protocol is integrated through GreenWill") | The column note called it vocabulary-only while the registry, three locks, shared hooks and an indexer handler exist; a catalog entry makes the status table, the matrix and the deployments page agree |
| 23 | The entity matrix reads per protocol (a two-column table under each protocol, a glance table above) and the personas page drops the route-literal appendix and reads the ontology alone (2026-10-10) | Afo found the grid dense and confusing and asked what the route literals were for; the literals had no reader and coupled the page to every client and admin route edit |
| 24 | Retired command names leave the generated Command inventory and Contract operations pages; both migration ledgers stay inputs to the docs authority audit only (Afo, 2026-10-10) | A reader needs what runs today; the audit still refuses retired callers everywhere |
| 25 | Architecture carries six ideas: Capital forms around verified work joins the five from decision 20 (Afo, 2026-10-10) | Five ideas still missed commitment pooling and capital formation |
| 26 | Package order is contracts, indexer, shared, agent, qa, admin, client in the Monorepo Map and the Packages sidebar (Afo, 2026-10-10); the Command inventory keeps the contributor order from round 1 unless Afo says otherwise | The map follows the dependency direction; the inventory order was a separate explicit ask |
| 27 | The builder track is Green Goods-centric: no dev-guild byline, guild-wide guide or blog link in First Contribution, and the closing section is Stay in touch (Afo, 2026-10-10) | Afo is stripping the dev-guild framing; the community pages, footer blog link and copyright line still name the guild and are his call |
| 28 | The community track, Credits and the FAQ drop the dev-guild framing as well (2026-10-10, applying Afo's round-2 direction); the footer copyright line and the License page keep the legal copyright holder until `LICENSE` changes | A byline and guild headings on Welcome, Why We Build and Credits contradicted the builder track; the copyright holder is a legal fact, not framing |
| 29 | Root `DESIGN.md`'s quick reference follows DL-029 and DL-038 for button corners (16px in the installed app, 12px while pressed, square on the public website) and the Design page says the same (2026-10-10) | The root file still carried DL-026's values a day after DL-029 replaced them; the docs follow the code and the decision log |
| 30 | Community guide captures are refreshed only where a current Storybook story exists (Create Garden, Create Action, the Garden overview, the Submit Work media and review steps, Your Work offline and pending, the Hub Hypercerts tab); Reviewing Work keeps its two old captures until the Hub work stories mount a seeded garden; no Hats tree or arbiscan visual (2026-10-10) | A stale screenshot beats a wrong one: the Hub work-detail story renders Work not found, the hats app draws tree 92 too small headlessly, and arbiscan sits behind a bot check |
| 31 | Deployments & Addresses labels every contract by name through a renderer label map with a words fallback; artifact keys appear only in the zero-address line (2026-10-10) | Raw keys such as `accountProxy` and `unifiedPowerRegistry` read as code, not as a reference page |
| 32 | Develop merged into the branch a fourth time on 2026-10-10 (`5d68e7eaf`, develop `8c57a9d56`, 43 commits), by merge again; the two generated-page conflicts were resolved by regenerating on the merged tree | Same reasoning as decisions 8 and 14; generated pages are never hand-merged |
| 33 | The pre-push hook forwards only `--check` and `--test-path` from `GG_PUSH_GATE_ARGS`; `--base` is refused (2026-10-10, Codex) | `--base HEAD` handed the gate an empty diff and an empty check list, so the hook could pass without validating the push; focus through test paths covers the budget case instead |
| 34 | Integration and architecture prose claims only what the contracts enforce, and names the application rule separately where the wizard adds one (2026-10-10, Codex round on Octant, Hypercerts, Karma, Unlock, the capital-formation gate) | A builder reading the docs as a contract reference must not be sent to entrypoints or guarantees that do not exist on-chain |
| 35 | Develop merged a fifth time on 2026-10-10 (`75ed33894`, develop `e602fc13d`, 5 commits), by merge; the one conflict was the generated Task Routing page, regenerated on the merged tree | Same reasoning as decisions 8, 14 and 32 |
| 36 | The docs generator's module graph imports with no packages installed: the YAML parser is resolved where a workflow is parsed, and a test walks the graph and refuses a static package import (2026-10-10) | CI Gate runs the selector suite before any install and that suite imports `scripts/docs/generate.mjs`; a top-level `js-yaml` import from round 1 failed the gate on every head that could run it |
| 37 | A component that draws page content from a data file has a Markdown rendering in the twins (design tokens, brand kit, role cards, steward path); link lists live in `docs/src/data` so the component and the twin read one source, and a test fails on any bare component tag left in a twin; interactive components stay as written (2026-10-10, Codex) | D5 promised a whole-site agent-readable copy, and a twin with a bare tag has a hole where the site shows content |
| 38 | Modules are described as wired to the garden token per chain, not opted into by a garden; at mint only the hat tree and the owner role are required and every other module call is best-effort (2026-10-10, corrects the wording of decision 20) | `GardenHooksLib` skips an unset module and swallows a failing one so a mint never reverts on an integration; the old heading sent readers to assume state that may not exist |
| 39 | The Personas page presents a persona's `surfaces` as where its name may appear, a vocabulary rule, and no longer as where the persona works; the ontology data is unchanged, and the Admin package page states who the cockpit admits, sourced from the eligibility hook (2026-10-11, Codex) | `OntologySurface` is documented as the surfaces a term is allowed on and the glossary guard locks its column to it; the page had read it as access, which marked gardeners and funders as admin users. Removing `admin` from the data, as the review suggested, would have said the cockpit may not name them |
| 40 | The ontology's Cookie Jar definition names both gates: the gardener Hat for a garden's own jar, an allowlist for a shared campaign jar (2026-10-11, Codex) | A garden jar is configured with an empty allowlist and ERC-1155 gating on the gardener hat; "allowlisted members" described only campaign jars |
| 41 | The API Index is read from the agent's route registrations and lists every public route (19, up from 9); route constants stay where Shared keeps them; the reader refuses a registration it cannot resolve (2026-10-11, Afo: do the task here, add it to this PR) | Three features had added public routes outside `PUBLIC_AGENT_ROUTES` (join requests, saved offers, profile avatars), so an index read from one constant map went incomplete without any signal. Shared already keeps route constants in three files, so moving them into one map would not have removed the need to read registrations |
| 42 | An integration's `deployment_fields` may be dotted paths into an artifact, each segment checked against the identity blocklist; the Unlock integration declares the GreenWill registry, the Unlock factory and the three lock addresses (2026-10-11, Codex) | With only `greenWill` declared, a registry deployed ahead of its locks read as deployed although no badge could be granted |
| 43 | Every integration page declares the implementation files its code map and its behavior claims rely on (2026-10-11, Codex on ENS, applied to all nine pages) | The ENS page described the mint-time skip, catch and refund and the Ethereum receiver while declaring only the Arbitrum sender; the same gap sat on the Cookie Jar and Karma pages, and the others cited code-map files they did not declare |
| 44 | An integration's completeness counts schema registrations: a deployment field ending in `SchemaUID` holds a schema UID, EAS declares its three registrations beside its resolvers, and Tokenbound declares the garden token; the chain's own EAS addresses are left out (2026-10-11, Codex) | Celo records the three resolvers and only the work schema, so EAS read as deployed there while two record types could not be written. Every artifact records `eas.address` and `eas.schemaRegistry`, including Ethereum where nothing of ours is deployed, so counting them would list Ethereum as a partial deployment |
| 45 | The ontology's Vault definition states custody as the contracts have it: funders hold the vault's shares, the yield is donated on (by default to the yield resolver), and the garden account is only a fallback destination (2026-10-11, Codex) | The old text said the garden's token-bound account holds the vault, which points integrations at the wrong account for balances and authority. The Garden and Tokenbound definitions keep "treasury": the account does hold the GOODS the Gardens module seeds |
| 46 | A page that describes module setup at mint, or a cross-chain delivery, says it is best-effort, names the read that shows what exists, and names who can repair it (Gardens, Octant, ENS; Cookie Jar already did) (2026-10-11, Codex) | `GardenHooksLib` swallows every module failure except the hat tree, and the ENS receiver records a name even when the ENS call reverts, so an unconditional flow sends readers to query state that may not exist |
| 47 | An integration whose contracts sit on two networks is judged across both: `remote_deployment_fields` in the ontology names the network that records a field for another, and ENS declares Arbitrum's receiver on Ethereum; a network that only hosts such a component gets no row of its own (2026-10-11, Codex) | Judged one artifact at a time, both production halves of ENS read Partial forever although the pair was complete, and the matrix and status table reported a staged rollout that was not one. A missing receiver still reads Partial for the sending network |
| 48 | No page promises an intact deposit: an endowment is vault shares the funder can redeem, subject to strategy and contract risk (Architecture, Octant, the Vault definition) (2026-10-11, Codex) | ERC-4626 shares redeem for what the vault holds; the Octant page already said a loss could reduce a withdrawal, and the other two contradicted it |
| 49 | Role pages separate holding the garden token from wearing its hats, and name open joining as a way a role is granted (Tokenbound, Hats) (2026-10-11, Codex) | A token transfer hands over the account but moves no hat, so the previous owner keeps authority until the hats are rotated; and with open joining on, `joinGarden` grants the gardener hat to any caller, which "only owners and stewards write roles" hid |
| 50 | The design page's type samples load the client's own Inter and Fraunces requests, with `font-synthesis` off, instead of the brand kit's files (2026-10-11, Codex) | The brand kit ships the regular weight only, so `app-title` (600), `label-md` (500) and `editorial` (700) were weights the browser made up on a page that presents itself as the token rendering. A docs test pins the requests to `packages/client/index.html` and fails when a token's weight is outside the range they carry. The docs site already loads its own faces from the same host, so no new third party |
| 51 | The Testing page's Docs row runs the selector-owned `docs-authority` check instead of a copied `node --test` file list (2026-10-11, Codex) | The copied list had fallen behind the Docs workflow and left out the Mermaid parser suite. The validation policy owns the check's file list, and the guide audit already rejects an unknown check id on that page |
| 52 | Getting Started keeps saying the fork-mode indexer reads live Arbitrum; the review comment asking for the opposite was declined with evidence (2026-10-11, Codex) | `packages/indexer/config.yaml` has no RPC source, so Envio syncs chain 42161 from HyperSync; the compose file passes no RPC variable into the container; `smoke-full.js` skips the head comparison in fork mode; `ONBOARDING.md` says the same. The comment above `applyGroupEnvironment` in `scripts/dev/stack.js` says fork writes land in the local indexer, which the code does not support: flagged to Afo, not changed here |
| 53 | The personas page is generated per persona and written for people: context, hat, and a when / what / where table for each, from `persona_journeys` in the ontology projection data (Afo, 2026-10-11: "Generated per persona but needs to be human friendly to read") | The old matrix showed where a persona's name may appear, which he read as wrong for this page: it should say which surfaces each persona works in. "Works in" is now the union of the surfaces a persona's own interactions name, and an interaction's availability comes from the capabilities it names, so a planned one cannot read as usable |
| 54 | A journey's code paths are pointers the ontology gate checks for existence, not capability evidence (2026-10-11) | Listing them as evidence would oblige the Ontology workflow's path filter to cover about thirty view files and rerun on most product changes. A renamed view is caught the next time the gate runs, not in the renaming PR |
| 55 | The entity matrix carries the five canonical personas, every integrated protocol, and the entities a partner protocol has its own word for; vocabulary-only columns and Octant's TAM roles are gone (Afo, 2026-10-11, all four options) | Funder and Evaluator were merged in one legacy row and a non-canonical researcher row remained; EAS and Tokenbound had integrations and no column; Silvi, Lido and FTC had no code. Cells the contracts contradict were corrected in the same pass (the garden wears an admin hat under the protocol's tree, not a top hat) |
| 56 | The public website's buttons go back to capsules, in their own PR against develop, and the docs keep the production site captures (Afo, 2026-10-11) | The site screenshots are from production, which still has capsules, while develop made website buttons square (DL-029). He chose the capsule; the reversal is client and design-system work, not docs |
| 57 | Builder-page screenshots follow one standard and are recaptured in this PR: one viewport per surface, light theme, develop's current UI through mock auth on localhost (Afo, 2026-10-11) | Thirty-one images came from three capture methods in seven sizes. Not done yet at this record |
| 58 | The MCP guide lists the hosted services agents reach through a connector, joined from a small catalog and the connectors each routine declares in its frontmatter (Afo, 2026-10-11) | The page covered only the repository's own MCP server. The routines already declare Linear, PostHog, Vercel and the rest; a routine may not name a connector the catalog lacks |
| 59 | The economics explorer's Markdown twin is written from a generated projection of its model (Codex, 2026-10-11) | The twin carried only the literal BrowserOnly block. The model is TypeScript with nothing to import, which the pinned Node loads when the projection is rendered; the twin walk now treats a BrowserOnly block as a hole |
| 60 | The docs audit fails when a hand-written page names a repository path that does not exist; a package page's directory table is read relative to its package (2026-10-11, from Afo's note on drift) | The hand-written pages carry path tables that nothing checked. Descriptions stay written by hand; the paths are checked against the tree. Paths git ignores, globs, placeholders and fenced examples are skipped. It found two wrong file names on the Client page |
| 61 | Decision 57 as applied: product screens are captured at the viewport only (desktop 1440x900 saved 2000x1250, phone 390x844 saved 780x1688), signed-in screens from Storybook's real views with fixture data, public pages from production (2026-10-11) | Afo picked mock auth on localhost as the source, but the deployer mock reads live gardens, whose member names and work photos do not belong in a public repository. Storybook's real views render the same components with seeded data. A component figure (sign-in) is cropped to its content |
| 62 | A persona journey names the messaging agent only for what the bot's handlers do: choosing a garden for the chat, a text or voice submission the bot holds, and a steward's pending, approve and reject. Joining a garden and following a review are app-only (2026-10-11, Codex) | The first journeys cited handlers by their names. `handlers/join.ts` only records the chat's garden and grants no hat; `handlers/status.ts` shows the chat's own state, not a review. A journey row is a claim about behavior, so its code path is read, not just located |
| 63 | Pages that describe changing roles say a grant reaches down the tree and a revoke removes one hat (Tokenbound, Hats) (2026-10-11, Codex) | `_grantRole` gives an owner the steward and gardener hats too, while `_revokeRole` burns only the named hat. A previous owner stripped of the owner hat alone stays a steward, and `grantRole` and `revokeRole` are open to any owner or steward |

## Requirements Coverage

| Requirement (decision) | Phase | Status |
|------------------------|-------|--------|
| D1 consolidated Testing Guide | 4 | ✅ |
| D2 journeys deleted + redirects | 3 | ✅ |
| D3 Economics Explorer → Reference | 4 | ✅ |
| D4 hybrid integration pages | 1 (mechanism) + 3 (prose) | ✅ |
| D5 llms.txt + .md twins | 5 | ✅ 44059edf3: `llms.txt` plus a Markdown twin of every page (67 in the build) |
| D7 real category landings | 1 (CSS fallback) + 3 (pages) | ✅ all categories |
| D8 Skills catalog + Working with Agents | 1 (generator) + 4 (prose/READMEs) | ✅ (13 READMEs authored) |
| D9 Design page under Architecture | 4 | ✅ |
| D10 License page in Reference | 4 | ✅ |
| D11 CI & GH Actions under Testing & QA | 4 | ✅ |
| D12 Anatomy of a Work Submission (tentative) | 3 | ✅ built; Afo judgment pending |
| ERD layered + zoomable | 1 | ✅ 26e2f6cf3 + ade03f693 |
| Spine rewrites (Getting Started, First Contribution, System Overview) | 2 | ✅ 6b7d408c4 (tone gate open) |
| Package template ×7 incl. new QA page | 3 | ✅ |
| Link audit: every page has next steps + external links | 5 | ✅ 295be57a9 + a2d5a207d: all 29 hand-written pages link out and end with next steps |
| CONTRIBUTING.md circularity fix | 5 | ✅ develop's CONTRIBUTING names First Contribution the full guide; First Contribution no longer defers its core flow back (merge round) |

## Phase 1 — Generators & mechanics (lanes `state_api` + `ui`, this branch)

### Step 1.1: Layered ERD
**Files**: `scripts/docs/renderers.mjs`, `scripts/docs/generate.test.mjs`, regenerated `docs/docs/builders/architecture/erd.mdx`
**Details**: `renderErd` emits three focused diagrams (core protocol / funding / commitments) from
the ontology projection instead of one 21-entity graph. Test asserts layer membership and that no
entity is dropped.

### Step 1.2: Site-wide Mermaid pan-zoom
**Files**: `docs/package.json`, `docs/docusaurus.config.ts` or `docs/src/` client module
**Details**: attach pan-zoom to rendered Mermaid SVGs (pinned dependency), keyboard-safe,
reduced-motion respectful. Verify on the regenerated ERD page via docs build.

### Step 1.3: Integration projection mechanism (hybrid, D4)
**Files**: `scripts/docs/generate.mjs`, `scripts/docs/renderers.mjs`, `scripts/docs/generate.test.mjs`, new docs component, converted `docs/docs/builders/integrations/*.mdx`
**Details**: generator emits one digest-gated projection data file; a docs component renders a
named integration's deployment/indexer tables (indexer section only when configured). The seven
generated integration MDX pages become hand-owned pages that keep their current intro text (Phase 3
rewrites prose) and embed the component. `check:docs-generated` covers the data file.

### Step 1.4: Skills catalog generator (D8)
**Files**: `scripts/docs/renderers.mjs`, `scripts/docs/generate.mjs`, `scripts/docs/source-readers.mjs`, `scripts/docs/generate.test.mjs`, new `docs/docs/builders/agentic/skills.mdx`, `docs/sidebars.ts`
**Details**: `renderSkills` reads `.claude/skills/*/README.md` (fallback: `SKILL.md` frontmatter
description), emits the generated catalog page with required trust frontmatter; sidebar entry under
Agentic Development.

### Step 1.5: Sidebar accent fallback
**Files**: `docs/src/css/custom.css` (+ small client module if needed)
**Details**: builders teal holds on every `/builders/*` route including category index pages, ahead
of the Phase 3 real-landing fix.

### Step 1.6: Redirects plumbing
**Files**: `docs/package.json`, `docs/docusaurus.config.ts`
**Details**: wire `@docusaurus/plugin-client-redirects` with an empty, documented redirect map;
entries land with each later move/deletion (Decision 6).

## Phase 2 — The spine
Getting Started (absorbs env-management) · First Contribution · System Overview (absorbs
modular-approach, local-vs-global, ethereum-alignment) + redirects. Tone check with Afo on the
first page before the other two.

## Phase 3 — Sections
Monorepo Map landing + package pages ×7 (incl. new `packages/qa`) · Integrations landing + meaning
blocks on all ten pages · Anatomy of a Work Submission (D12 — Afo judges rendered result) · Data
Model & Ontology consolidation (entity matrix + commitment state diagrams) · journeys deleted (D2)
+ redirects · Persona Surfaces → Reference.

## Phase 4 — Design, agents, testing
Design page under Architecture (D9) · Working with Agents landing + 13 skill READMEs (D8) ·
Testing Guide consolidation (D1) + redirects · CI & GH Actions under Testing & QA (D11) ·
Economics Explorer → Reference (D3) · License page (D10) + community Credits slimmed.

## Phase 5 — Sweep
`llms.txt` + `.md` twins (D5) · track-wide link audit (next steps + external links per page) ·
CONTRIBUTING.md one-way pointer · final `docs:audit` green · redirect map verification.

Status (2026-09-23): all five items done; the receipt is in `handoffs/claude-ui.md` and the gate
measurements are in `eval.md`. Two outcome gates wait on Afo: the page-length gate and whether
Reference gets a landing page.

Status (2026-10-09): develop merged in again (decision 14), the last three Codex threads fixed
(owner approvals, three next steps, projections on EAS and Tokenbound), and every gate re-run
green on the merged tree; receipt in `handoffs/claude-ui.md`. What remains is Afo's: the three
human gates below, the GitHub thread replies, and taking the PR out of draft.

Status (2026-10-10): QA round 1 from Afo's walk of the local build, thirty items, all landed on the
branch (decisions 15 to 20). Site chrome: flat canvas (the fixed gradient is gone), one sidebar
highlight, no Brand kit in the navbar or the Builders sidebar, Admin instead of Dashboard, four
links per footer column, a readable light-mode footer. Diagrams: per-mode mermaid palettes through
a swizzled component, lifecycle arrows carry a short clause with the full mechanism in a table,
and a jsdom parse test guards every generated diagram. Generated pages: Deployments & Addresses
prints linked addresses, the entity matrix derives integration status from the catalog and the
artifacts, Personas moved under Architecture, CI workflows explained from a catalog data file,
contract operations grouped by verb, task routing and skills restructured, commands root-first with
copy buttons, ONBOARDING.md and the design tokens embedded through projections. Hand-written pages:
Getting Started refreshed, First Contribution de-duplicated, five ideas on Architecture with the
indexer in the arrow, one package table, deeper package pages with screenshots, integrations status
table, Product QA, design page with tokens and six Storybook captures. Receipt in
`handoffs/claude-ui.md`.

Status (2026-10-10, later): QA round 2 from Afo's walk of the rebuilt build, eleven items, all landed
(decisions 21 to 27). Current admin and public-site captures replace the old admin screenshots in
the builder track (Storybook, deployed build, headless Chromium; the public site at greengoods.app),
First Contribution loses the guild framing, Architecture gains the capital-formation idea with the
Promises tab as its figure, the Anatomy infographic runs full width, the entity matrix reads per
protocol, the personas page is a persona-by-surface matrix from the ontology alone, the retired-name
ledgers leave the two command pages, Unlock Protocol gets a catalog entry and a page through
GreenWill, the Design page is one system then three dialects with captures, and the package order
follows the dependency direction. The self-review outline went to Afo in chat and the Linear comment.

Status (2026-10-10, review pass): the self-review follow-ups Afo accepted landed as `461515da2` (named
contracts on Deployments & Addresses) and `500082846` (guild framing off the community track, the
root DesignMD corner rule, current community captures, visuals for EAS, Shared and Passkeys, the
admin navigation claim softened); decisions 28 to 31. Left on purpose: the Command inventory
order, Lido and FTC in the matrix, moving the seven principles off the Design page, seeding the
Hub work stories (shared package), and the footer and License copyright lines.

Status (2026-10-10, merge and Codex round): develop merged (`5d68e7eaf`), the hook hardened
(`409f3e25a`), and the 19 Codex threads from rounds 1 and 2 addressed in `fd152d851` (decisions 32
to 34); every thread carries a reply naming its commit and is resolved. Pushed head `fd152d851`.

Status (2026-10-10, second merge and CI Gate): develop merged again (`75ed33894`); CI Gate, red
since the first merge let it run, fixed in `422606c9d` (the generator's reader loaded `js-yaml`
at import time and the gate job installs nothing); six new Codex threads addressed in
`422606c9d`, `99a4d0ff9` and `807b8ffc2` and resolved; decisions 35 to 38. Pushed head `807b8ffc2`.

Status (2026-10-10, Codex on `c839256b6`): two more threads, both valid and fixed in `a380cd0e9` under
decision 34. Copied contract commands carry every always-required value (13 of 92 operations), with
a test that runs each rendered command through the CLI resolver; the API Index is described as the
shared route contract's routes, since the agent serves six public paths outside that contract.

Status (2026-10-11, two Codex rounds and the route index): three threads on `2aae01200` fixed in
`01dce161d` and four on `01dce161d` fixed in `6f631c8dc`, all valid, one fixed differently from the
suggestion (decision 39); the API Index now lists every public agent route (`ea2b5f410`, decision
41), built at Afo's request and added to this PR by his choice; decisions 39 to 43. The duplicated
join-request paths in the agent and Shared's transport are left for a follow-up issue.

Status (2026-10-11, Codex on `fee71dd2e`): five more threads, all valid, fixed in `517e8cb49`: EAS
completeness counts schema registrations (Celo reads Partial), the Vault definition states custody
as the contracts have it, Gardens setup and ENS delivery are marked best-effort, and the Contracts
page's two library rows are swapped back; decisions 44 to 46. CI was green on `fee71dd2e`.

Status (2026-10-11, Codex on `61234a5a4`): five more threads, all valid, fixed in `fa3811a01`: ENS
completeness across its two chains, open joining on the Hats page, token ownership against role
ownership on the Tokenbound page, no intact-principal promise, and QA case `DOCS-033` reworded to
test the persona matrix as a naming rule; decisions 47 to 49. CI was green on `61234a5a4`. Afo is
doing a final pass on a local production build of the branch.

Status (2026-10-11, Codex on `da0163580`): four more threads, three valid and one declined, in
`c57faf305`: Architecture's transfer sentence now keeps the roles with their wearers (decision 49
applied to a second page), the type gallery loads the app's fonts, and the Docs row runs the
selector's check; the fork-indexer comment was answered with evidence and the sentence kept;
decisions 50 to 52. Afo sent fifteen items from his final pass the same hour; they are the next
round and are not in this commit.

Status (2026-10-11, Afo's final pass): fifteen notes. Fixed: the Prove it steps, the capital
paragraphs, the footer, the CI table (a width floor in the copy component), the API index groups,
the Octant TAM roles, the personas page, the entity matrix, and the MCP guide (`65e16b847`,
`a195e520e`); decisions 53 to 58. Filed as their own tasks: capsule buttons on the website, one
environment file instead of two, and the launcher's fork-indexer comment. Still open: the
screenshot recapture (decision 57) and a drift check for hand-written path tables. Develop was
merged in (`4610170d2`; four generated pages regenerated), and Codex's note on `270f78cb8` is
fixed in `154a382db` (decision 59).

Status (2026-10-11, final pass, second batch): the path check is in the audit (`e2548a283`,
decision 60) and the screenshot pass is done as far as a faithful source exists (`052c8ad82`,
decision 61): two phone frames retaken at the standard size, the sign-in figure cropped, two
outdated captures removed. Not replaced: the steward guide's two review captures (the Hub work
stories render an empty queue), the gardener guide's Start and Details captures, and the three QA
app captures. The launcher's fork-indexer comment went out as its own PR against develop at Afo's
request.

Status (2026-10-11, Codex on `2b9809c9e`): three threads, all valid, fixed in `f156d771e`: two
persona journey rows claimed the Telegram bot does what only the app does, and the Tokenbound page's
handoff instruction left a previous owner with the steward hat; decisions 62 and 63.

## CLAUDE.md Compliance
- [x] No package-level env files touched; docs generators read repo sources only
- [x] Generated pages keep trust frontmatter + digest gates
- [ ] Implementation Quality Contract applied per phase (no speculative abstractions)

## Test Strategy
- **Unit**: `scripts/docs/generate.test.mjs` covers renderer changes (layer membership, conditional
  sections, skills fallback); `docs/scripts/docs-audit.test.mjs` stays green.
- **Integration**: `bun run docs:generate` + `bun run check:docs-generated` (digest honesty),
  `bun run docs:audit:ci`, `bun run build:docs` (includes redirects plugin + pan-zoom).
- **E2E/manual**: rendered ERD zoom + sidebar accent verified in the built site preview.

## Validation
- [ ] Phase 1: docs generator tests pass · docs:generate idempotent · docs:audit:ci green · build:docs green
- [ ] Fresh Evidence Receipt recorded in `handoffs/claude-state-api.md` before lane marked passed

## Implementation Notes

- Phase 3 divergences: the entity matrix relocated to its own generated page under Architecture
  instead of being absorbed into Data Model (a 3,600-word merge helped no reader); all five
  lifecycle state machines live on Data Model, and Anatomy links the work-display-status anchor
  rather than embedding the diagram.
- Deferred (Afo, 2026-09-02): revisit the Architecture landing for stronger protocol capture once
  Phases 3-4 surround it; reassess what it should still say that Anatomy and Data Model now cover.
- Tone rule 6 (no em dashes) applied to all Phase 3 prose.
