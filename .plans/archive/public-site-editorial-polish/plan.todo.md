# Green Goods — Public/Editorial Website Polish Pass (Audit + Plan)

> **Archived record:** implementation is closed. Operational handoffs, reports, artifacts, and lane files were removed; any such references below describe historical execution, not live work.

## Context

Light editorial polish over the Green Goods public/editorial website (client browser presentation mode) so community members and funders can more easily learn, understand, and participate. Not in scope: redesign, restructure, new visual system, sweeping rewrites, new product sections, media production. Copy is already strong after the recent Wave D pass; this pass fixes meaning failures, closes two audience comprehension gaps, and applies the tone rules (warm and direct, with punctuation chosen case by case).

**Decisions locked with Afo**:
1. Evaluators framed as coming from many backgrounds everywhere (loop + persona + glossary aligned together).
2. Funder persona lists live capabilities only (no action sponsorship, no certificate holding).
3. Kickers normalize to colon style ("§ 04: Who tends a Garden") with renumbering.
4. Scope: full P0+P1+P2 pass in one session.
5. Voice: case-by-case — the home page keeps its literary lines ("Quantifiable restoration.", "This isn't a dashboard." structure, "(ideally)" charm); task pages (/gardens /actions /impact /fund) go plain. Meaning failures get fixed everywhere regardless of page.
6. Hero lede stays untouched (comprehension fixed elsewhere: personas, loop, funding bridge).
7. Endow honesty: softer claims — "The principal stays in place and remains withdrawable." + "The yield supports the Garden's Work, not a personal return." (not the blunter "you can withdraw later" / "not back to you").
8. Community persona CTA: "Browse all Gardens".

## How the site is built (facts that shape the work)

- 8 public routes: `/` `/gardens`(+`/gardens/:id`) `/actions` `/impact` `/fund` `/vaults` `/cookies` `/glossary`; SiteHeader (Gardens, Impact, Fund, Actions, Install App) + footer (Glossary, Twitter, Admin, Docs, GitHub). Views: `packages/client/src/views/Public/`; sections: `packages/client/src/components/Public/`.
- All copy is i18n: `packages/shared/src/i18n/en.json` lines ~3000–3969 (`public.*` keys). Every change needs real es.json + pt.json mirrors (locale-coverage gate rejects missing keys, empties, and multi-word strings identical to English; ICU syntax must stay intact). Components duplicate values in `defaultMessage` props — en.json is what renders (`App.tsx` loads it), but defaultMessages must be kept byte-identical to avoid drift.
- `bun run lint:vocab` machine-enforces: streak, countdown, leaderboard, FOMO, urgent, limited time, re-engagement, retention hook.
- Home composition (verified): Hero → Featured Gardens → Proof Band → Record Loop (Assess/Work/Verify/Fund) → Who Tends a Garden (5 personas) → Funding Bridge → Get In Touch → Footer.
- Product ground truth snapshot (verified for the audit as of 2026-07-06; reverify during the implementation prep before editing copy): 13 live Gardens on Arbitrum. Lifecycle: Assessment (baseline, before work) → Work → Work Approval → Impact Certificate (first public issuance pending). Endow live (principal redeemable "when available", yield to Garden); Donate per-garden gated. Gardeners join open-membership Gardens via the app; operator/evaluator roles are invited. All five persona docs guides exist. Newsletter is single opt-in (verified in `packages/agent/src/services/subscriptions.ts`: contacts subscribed immediately, no confirmation email). `/gardens` search covers name+location+description. Docs glossary evaluator entry doesn't say "domain expert", so the inclusive rewrite creates no docs drift.

## Page-by-page audit

### `/` Home
**Works**: hero title; "Tended places, openly recorded."; funding bridge structure + disclaimer; "A letter, once a season."; footer.
**Findings**:
- **[P0-1]** `proof.assessmentsNote` = "Independent evaluator confirmations, anchored to a public reference." — the stat is the Assessment count (verified in `usePublicStats`), but Assessments are pre-work baselines; verification is Work Approval. The note describes the wrong lifecycle stage and contradicts the site's own glossary. "Assessments held" label reads like meetings.
- **[P0-2]** Funder persona promises non-live things: "sponsor an action" (no flow; `/fund` says "Public funding opens in a later update") and "hold an Impact Certificate" (`/impact` says "Not public yet"). A funder disproves the pitch in two clicks.
- **[P0-3]** Evaluators described two contradictory ways on one page: loop says "not only topical experts", persona + glossary say "domain experts". Decision: inclusive framing everywhere.
- **[Audited, kept]** `hero.lede` is one 36-word funder-angled sentence with no people in it — flagged, but Afo chose to keep it unchanged (decision 6); comprehension is fixed downstream (personas, loop, funding bridge).
- **[P1]** Endow copy reads as locked money: "The principal stays" (`funding.endowBody`) — the de-risking fact (withdrawable) only appears on `/vaults`, which normal funders never visit.
- **[P1]** Risk note names no actual risk: "values and access can vary" (`funding.note`) is alarm-vague.
- **[P1]** Community persona CTA "Find a garden near you" over-promises: `/gardens` search does cover location text, but with 13 global Gardens most readers find nothing "near" — the one neighbor-aimed CTA hits the hardest dead end.
- **[P1]** Assess loop step never says a baseline gets recorded ("Together they read where it is and where it's meant to go") — the causal chain that makes later proof credible never clicks.
- **[P1]** Newsletter: `success.inline` "Check your inbox to confirm." claims a confirmation step that never comes (verified none exists) — a small trust leak; `help` "Single opt-in subscription. Email stays server-side." is developer jargon; cadence mismatch (title "once a season" vs success "a few times a season").
- **[P2]** Personas kicker is "§ — Who tends a garden" (unnumbered) breaking the 01→05 sequence; "§ 05: Get In Touch" is title case.
- **[P2]** Proof band tone: "Quantifiable restoration." and "This isn't a dashboard." flagged as cold/insider — Afo keeps both as home-page voice (decision 5); only word swaps land ("Gardens attended" → "Gardens tended", "assessments held" → "assessments recorded").
- **[P2]** `install.description` claims "follow Gardens you support" (no follow feature).

### `/gardens`
- **[P1]** "The public record they build is meant to hold up under reading." — insider idiom; and the page never says a person can join a Garden (`public.gardens.join` exists but is unused; the connective sentence "install the app, then join an open Garden" is never spoken anywhere on the site).
- **[P2]** "Browse every Garden under documentation." — bureaucratic.

### `/actions`
**Works**: hero, four domain blurbs, filters, capitals bodies.
- **[P1]** Dialog assumes membership: "Install the Green Goods app to log Work for this Action with your Garden." — dead-ends the garden-less visitor.
- **[P2]** Capitals title overclaims ("What we measure when work happens." — the app documents, it doesn't meter eight capitals); lede's "felt fabric of healthy places" gives nothing to hold; em dash.
- **Note**: `public.actions.kicker` ("§ 02 — Field guide") looks like a stale duplicate of `fieldGuide.kicker` — verify usage before touching; if unused, leave it.

### `/impact`
**Works**: honest proof markers ("Not public yet. First issuance pending."), pipeline, ledger, cite affordances.
- **[P0-1 also here]** `impact.proof.assessmentsNote` = "Source-backed evaluator confirmations." — same factual error as home.
- **[P1]** `evidence.sourceLimitReached` = "capped slice for v1; deeper history will arrive as aggregation matures" — engineering diary in public copy.
- **[P2]** Hero lede ending "an Impact Certificate that sources every claim" — compressed.

### `/fund`
**Works**: "lands with the selected Garden vault, not a platform account"; "Donate now, or Endow for many seasons."; tax disclaimer; query fallbacks; endowments panel.
- **[P1]** Withdrawability cluster: `paths.endowGlossary`/`endowRoutes` say the principal "stays" (reads as locked); `paths.endowLede` is passive-engineered ("designed so the deposit can remain"); `paths.endowBestFor` "Long-term support that compounds." implies personal returns the depositor doesn't get; `/fund` never states what `/vaults` says plainly (yield goes to the Garden, not you); `dialog.endow.risk` repeats the vague "values and access can vary".
- **[P1]** `vaults.lede` is circular: "Endow adds long-term capital to Garden Vault endowments".
- **[P1]** "Ready to harvest" (`readyToHarvest`, `accruing`) — reads literally as crops on a gardening site; funders can't tell who harvests or where it goes.
- **[P1]** One pot, two names: garden dialog says "Donate directly to the Garden's Cookie Jar" while `/fund` says "shared fund" — and bare "shared fund" invites the misreading that donations pool across all Gardens (`gardenDetail.fund.description`, `paths.donateRoutes`).
- **[P2]** `paths.donateLede` trailing "funding the work right in front of them" ("them" ambiguous, em dash); "Endowment engine" kicker optional rename.

### `/vaults` (crypto-native by design)
**Works**: the best funder copy on the site ("You are not earning personal yield; the campaign is the beneficiary."). Leave alone except: **[P2 optional]** "routed toward the public good" → "toward public goods".

### `/cookies` (niche claim flows)
**Works**: "Connect a wallet to see what's been left for you."; privacy line; clear eligibility copy.
- **[P2]** Kickers: three sections labeled "§ 01", no colons. Renumber (connect/connected/forYou are exclusive states of section 1 → all "§ 01:"; active/grid "§ 02:"; past "§ 03:"). Verify render exclusivity in `Cookies.tsx` before finalizing. Optional: "Claim cookie" wording.

### `/glossary`
**Works**: warm, strong entries.
- **[P0-3 also here]** `term.evaluator.body` "A domain expert who..." → inclusive rewrite per decision.
- **[P1]** Plain-language promise broken by jargon: `term.cookieJar.body` "allowlist-gated"; `term.work.body` "specific instance... metadata... attested on-chain".
- **[P2]** Em dashes in action/assessment/gardener/operator bodies.

### Cross-page
- **[P2]** Em dashes in 31 public strings: prose dashes → periods/colons/commas; kicker dashes die in the normalization.
- **[P2]** Kicker normalization to colon style + renumbering (details in spec below).
- **Out of scope, flagged for separate cleanup**: unused keys (`public.gardens.join`, `public.{gardens,actions,impact,fund}.description`, `public.home.hero.{h1,tagline,title.line1,line2}`), orphaned `/landing` route, `usePublicStats.attestationCount` misnamed field (holds assessment count — optional stretch rename).

## What community members may still not understand (after reading the site)

1. **That they can join.** The connective sentence "install the app, then join an open-membership Garden from its page" is never spoken. Fixes: gardens lede addition (P1-6), actions dialog rewrite (P1-8).
2. **Which roles are open.** Five personas presented as equals, but operators/evaluators are invited while gardener/funder/community are open today. The CTA split (guides vs actions) partially signals it; kept as-is otherwise (structural fix would exceed scope).
3. **Where the work is.** With 13 global Gardens, "near you" framing over-promises; honest browse framing fixes it (P1-7).
4. **That it's free / what happens after install.** Not stated; left out of scope (needs Afo's confirmation to claim gasless, and a how-to section would exceed polish scope).

## What funders may still not understand (after reading the site)

1. **Can I get my deposit back?** Currently reads as locked ("the principal stays"); redeemability only stated on `/vaults`. Fixed by P1-4 cluster.
2. **Do I earn anything?** "Support that compounds" implies yes; truth is no personal yield. Fixed by P1-4 (with a truth-check on the yield-routing sentence).
3. **What risk am I taking?** "Values and access can vary" names nothing. Fixed: "Deposit value can move with the underlying token, and withdrawals can take time."
4. **What proof exists today?** Certificates honestly marked pending, but the assessment stat notes misstate the current evidence. Fixed by P0-1.
5. **Not fixable with copy (flagged, out of scope)**: per-garden tax configuration status, custody/audit posture, who governs claim allowlists, legal counterparty per Garden. These need product/legal answers before any copy claims.

## Prioritized improvements

**P0 — confusing or misleading (3 clusters, 9 keys)**
1. Assessment stat notes (home + impact) + label + body enumeration.
2. Funder persona → live capabilities only.
3. Evaluator framing → many backgrounds everywhere (loop, persona, glossary).

**P1 — participation + funder understanding (10 items, ~20 keys)**
4. Endow withdrawability + honesty cluster, softer phrasing per decision 7 (7 keys, home + fund).
5. Gardens lede + join sentence (task page, goes plain per decision 5).
6. Community persona CTA → "Browse all Gardens".
7. Actions dialog newcomer path.
8. Cookie Jar / shared fund naming.
9. Assess step baseline (home: keeps the gathering cadence and "(ideally)", adds the baseline sentence).
10. Fund section lede + "Ready to harvest".
11. Impact source-limit jargon.
12. Newsletter fixes (confirmed: no confirmation email exists).
13. Glossary plain-language (cookieJar, work).
(Hero lede: audited, kept unchanged per decision 6.)

**P2 — tone, labels, polish (~26 keys)**
14. Em-dash prose sweep (10 remaining strings after P0/P1 absorb theirs; punctuation only, words stay).
15. Kicker normalization + renumbering (~17 keys).
16. Home proof band: word swaps only, structure kept per decision 5 ("Gardens attended" → "Gardens tended" in label + body; "assessments held" → "assessments recorded" in body; "Quantifiable restoration." and "This isn't a dashboard." stay).
17. Task-page plainness: gardens archive title; capitals title + lede; impact hero lede ending; donate lede.
18. Install strings ("the real app" → "the full app"; "follow Gardens" → "keep up with Gardens").
19. Optional if time: vaults "the public good" → "public goods"; "Claim cookie" wording.

## The copy spec (final strings)

### P0
| Key | New value |
|---|---|
| `public.home.proof.assessments` | Assessments recorded |
| `public.home.proof.assessmentsNote` | Season baselines each Garden sets before the work begins, anchored to a public reference. |
| `public.impact.proof.assessmentsNote` | Baselines recorded before Work begins. |
| `public.home.proof.body` | This isn't a dashboard. These are confirmed counts: gardens tended, hands at work, entries logged, assessments recorded. Public, verifiable. |
| `public.home.personas.funder.role` | Resource the work. Endow a Garden Vault or give directly to its shared fund. |
| `public.home.personas.funder.body` | Funders make seasons possible. Some give directly to a Garden's shared fund for the work at hand. Others endow a vault whose yield supports the Garden season after season. Every path lands with a Garden, not a platform. |
| `public.home.loop.verifyBody` | Operators bundle the approved Work into an Impact Certificate. Evaluators from many backgrounds then verify what the certificate claims, signing off on method and confidence. |
| `public.home.personas.evaluator.role` | Verify the record. Review submitted Work, sign off on confidence and method. |
| `public.home.personas.evaluator.body` | Evaluators are the trust layer of the public record. They come from many backgrounds, review submitted Work, sign off with a confidence band, and name the verification method behind each approval. Their care is what turns a field log into evidence. |
| `public.glossary.term.evaluator.body` | A trusted reviewer, from any background, who checks submitted Work and signs off with a confidence band and verification method. Their care is what turns a field log into evidence. |

### P1
| Key | New value |
|---|---|
| `public.home.funding.endowBody` | Make a long-term deposit. The principal stays in place and remains withdrawable, and the yield supports the Garden's Work. |
| `public.home.funding.note` | Both paths support the Garden directly. They are not tax-deductible, charitable, or nonprofit-backed unless separately configured. Deposit value can move with the underlying token, and withdrawals can take time. |
| `public.fund.paths.endowLede` | A long-term deposit in the Garden's Vault. The principal stays in place and remains withdrawable. The yield supports the Garden's Work season after season, not a personal return. |
| `public.fund.paths.endowGlossary` | A long-term deposit in the Garden's Vault. The principal stays withdrawable while the yield supports the Garden over time. |
| `public.fund.paths.endowRoutes` | The Garden's Vault endowment. The principal remains withdrawable. |
| `public.fund.paths.endowBestFor` | Long-term support that keeps working. |
| `public.fund.dialog.endow.risk` | Heads up: deposit value can move with the underlying token, and withdrawals can take time. |
| `public.gardens.heroLede` | Each Garden is a real place where a community documents regenerative Work across solar, agroforestry, education, and waste. Anyone can read the record they build, and Gardens with open membership welcome new gardeners through the app. |
| `public.home.personas.community.cta` | Browse all Gardens |
| `public.actions.dialog.participate` | Install the Green Goods app, join a Garden, and log Work for this Action. |
| `public.gardenDetail.fund.description` | Donate to the Garden's shared fund (its Cookie Jar), or Endow the Vault, a long-term deposit that stays withdrawable while its yield supports the Garden. |
| `public.fund.paths.donateRoutes` | Goes to this Garden's shared fund. |
| `public.home.loop.assessBody` | A Garden gathers gardeners, operators, evaluators, and (ideally) funders around a real place. Before work starts they record a baseline: what the place needs, and what good looks like. |
| `public.fund.vaults.lede` | Endow places a long-term deposit in a Garden's Vault. Donate sends support straight to a Garden's shared fund. |
| `public.fund.vaults.readyToHarvest` | Yield ready for Gardens |
| `public.fund.vaults.accruing` | Yield ready {amount} |
| `public.impact.evidence.sourceLimitReached` | We show the most recent records for now. Deeper history will open up as the ledger grows. |
| `public.home.getInTouch.success.inline` | Thanks. You're on the list. |
| `public.home.getInTouch.help` | One signup, no hoops. Your email stays with us. |
| `public.home.getInTouch.success.subscribed` | Thanks for subscribing. A letter lands about once a season. |
| `public.glossary.term.cookieJar.body` | A shared fund where supporters give to a Garden's near-term Work. Only approved members can claim from a jar, so the funds reach the right hands. |
| `public.glossary.term.work.body` | One Action carried out by a gardener, captured with a photo and description, then recorded on the blockchain after operator approval. |

**Truth-check before committing P1**: the sentence "The yield supports the Garden's Work season after season, not a personal return." in `endowLede` — confirm garden-vault yield routing (yield-split config / Octant YDS model in repo docs) supports "not a personal return"; if routing is more nuanced, drop that clause and keep the rest. Also confirm the newsletter cadence ("about once a season") with Afo at implementation.

### P2
| Key | New value |
|---|---|
| `public.home.proof.gardens` | Gardens tended |
| `public.gardens.archiveTitle` | Browse every Garden keeping a public record. |
| `public.actions.capitals.title` | The kinds of value work creates. |
| `public.actions.capitals.lede` | Beneath each domain, work creates eight kinds of value: not just money or carbon, but soil, skill, trust, and story. |
| `public.impact.heroLede` | Green Goods turns documented regenerative Work into evidence the public can read. Assessments come first, then Work, and when ready, an Impact Certificate that ties every claim to its source. |
| `public.installDialog.braveInstallBody` | Brave saves Green Goods as a home-screen shortcut instead of installing the full app. Open this page in Chrome, then tap Install to add the full app. |
| `public.home.install.description` | Install the Green Goods app to log Work, capture evidence, and keep up with Gardens you support, even offline. |
| `public.fund.paths.donateLede` | Direct support that reaches a Garden's shared fund today and funds the season's most immediate work. |

**Em-dash prose sweep** (replace dash with colon/comma/period; meaning unchanged):
| Key | New value |
|---|---|
| `public.home.personas.gardener.role` | Document the work: soil turned, seedlings planted, hours given. |
| `public.home.personas.gardener.body` | A gardener walks a place every season, mapping soil, planting trees, capturing what was done. The Green Goods app turns those moments into a public record without taking the gardener out of the field. |
| `public.home.personas.operator.role` | Run the garden: assemble the season's plan, accept gardeners, confirm the work. |
| `public.home.personas.operator.body` | Operators are the steady hand of a garden: the one who calls the season's plan, who decides what counts, who approves a gardener's first work. They are the connective tissue between a place's intentions and its proof. |
| `public.home.personas.community.role` | Show up locally: visit, witness, mentor, share the season's story. |
| `public.home.personas.community.body` | A garden is held by the people around it: neighbors who visit on a Saturday, elders who mentor a first season, friends who share the season's story. Community shows up in the places where the work happens, and the public record is for them too. |
| `public.glossary.term.action.body` | A documented activity a gardener can perform: the reusable template for Work. Each Action names what to do, what to capture, and what proof comes next. |
| `public.glossary.term.assessment.body` | The diagnosis-and-plan stage of a Garden's season, written by operators and evaluators to name what the place needs and what counts as good. |
| `public.glossary.term.gardener.body` | A person who documents Work in the field with the Green Goods app, even offline: soil turned, seedlings planted, hours given. |
| `public.glossary.term.operator.body` | The person who runs a Garden: assembling the season's plan, accepting gardeners, and confirming the Work that gets recorded. |

**Kicker normalization** (colon style, sentence case after the number):
| Key | New value |
|---|---|
| `public.home.personas.kicker` | § 04: Who tends a Garden |
| `public.home.funding.kicker` | § 05: Support Gardens |
| `public.home.getInTouch.kicker` | § 06: Get in touch |
| `public.actions.domains.kicker` | § 01: Four domains |
| `public.actions.capitals.kicker` | § 02: Eight forms of value |
| `public.actions.fieldGuide.kicker` | § 03: Field guide |
| `public.glossary.kicker` | § 01: Terms |
| `public.fund.vaults.kicker` | § 01: Endowment engine |
| `public.fund.paths.kicker` | § 02: Ways to support |
| `public.fund.gardens.kicker` | § 03: Choose where to endow |
| `public.impact.proof.kicker` | § 01: Proof markers |
| `public.impact.pipeline.kicker` | § 02: The cycle |
| `public.impact.ledger.kicker` | § 03: Evidence ledger |
| `public.gardens.kicker` | § 01: Living archive |
| `public.cookies.connectKicker` | § 01: Sign in |
| `public.cookies.connectedKicker` | § 01: Connected |
| `public.cookies.forYouKicker` | § 01: Available to you |
| `public.cookies.activeKicker` + `gridKicker` | § 02: Cookie jars |
| `public.cookies.pastKicker` | § 03: Cookie jars |

Kicker rules: verify in `Cookies.tsx` that connect/connected/forYou never render together (they are exclusive states of section 1) before finalizing numbers. Leave state kickers without § untouched ("Reading the record", "Jar list", "Account view", etc.). Leave `public.actions.kicker` alone if unused (verify with grep first).

## Implementation plan (follow-up session)

**Scope**: strings only — `packages/shared/src/i18n/{en,es,pt}.json`, matching `defaultMessage` props, and test fixtures asserting old strings. No layout/route/component-structure changes. Criticality: routine.

1. Save this spec to `.plans/archive/public-site-editorial-polish/plan.todo.md` for repo execution truth.
2. Run the truth-check (yield-routing sentence) and confirm newsletter cadence.
3. **Wave 1 — P0** (10 keys): en.json → es/pt mirrors → defaultMessage sync in `PublicProofBand.tsx`, `PublicWhoTendsAGarden.tsx`, `PublicRecordLoop.tsx`, `Glossary.tsx`, and Impact proof markers component.
4. **Wave 2 — P1** (~20 keys): components: `PublicFundingBridge.tsx`, `PublicRecordLoop.tsx` (assessBody), `PublicWhoTendsAGarden.tsx` (community CTA), `Fund.tsx`, `Gardens.tsx`, `PublicSourceDialog.tsx`, `GardenDialog.tsx`/`GardenDetail.tsx`, `PublicGetInTouch.tsx`, `Impact.tsx`, `Glossary.tsx`. (`Home.tsx` untouched — hero kept per decision 6.)
5. **Wave 3 — P2** (~28 keys): sweep tables above; es/pt mirrors keep punctuation natural to the locale. Em dashes are not banned by default; remove them only where they make task-page copy less plain or obscure meaning.
6. **Validation (QA Speed Mode)**: shared locale-coverage test, `bun run lint:vocab`, targeted client tests (`PublicHome`, `PublicGardens`, `PublicActions`, `PublicImpact`, `PublicFundingDialogVocab`, `PublicFooter`, plus any Public component tests that assert changed strings — update fixtures). Rendered spot-check of `/` `/gardens` `/fund` via authenticated Brave when available; otherwise report browser QA blocked (never substitute isolated Playwright).
7. **Ship**: run the Ship Gate before the PR (`bun format && bun lint && bun run test && bun build` + `lint:vocab`); conventional commit `fix(client,shared): editorial clarity pass on public website copy`; branch + PR to develop (substantive multi-file change → PR per repo policy).

**Out of scope**: `/vaults` + `/cookies` deep rewrites, unused-key cleanup, `/landing` removal, `usePublicStats.attestationCount` rename (optional stretch), docs-site edits, es/pt native-speaker review (post-merge follow-up).

## Fable 5 implementation prompt

```
Editorial copy polish on the Green Goods public website. Copy-only change. The approved
spec is .plans/archive/public-site-editorial-polish/plan.todo.md (copy it there from
~/.claude/plans/i-want-to-plan-distributed-beacon.md if missing). Stay on the current
branch until the PR step.

WHAT: Apply the spec's three copy tables (P0, P1, P2 punctuation review + kicker table)
exactly. They are final approved strings — do not restyle them.

HARD BOUNDARIES
- Edit ONLY: packages/shared/src/i18n/en.json, es.json, pt.json; the matching
  defaultMessage props in packages/client/src/components/Public/*.tsx and
  packages/client/src/views/Public/*.tsx; and client test files that assert old strings.
- No component structure, layout, route, or style changes. No new i18n keys. No edits
  outside the listed paths. Do not touch /vaults or /cookies strings beyond the kicker
  table.
- Voice for es/pt: warm, direct, plain. Intentional em dashes are allowed when they preserve the approved meaning or read naturally in the locale; do not churn punctuation by rule alone. Never use: streak,
  countdown, leaderboard, FOMO, urgent, limited time, re-engagement, retention hook.
- Every changed en string gets a real es and pt translation (the shared locale-coverage
  gate rejects missing keys, empty values, and multi-word strings identical to English).
  Keep ICU syntax intact. Follow existing es/pt conventions for product terms (Endow,
  Vault, Cookie Jar, Garden, Work, Assessment).
- Keep defaultMessage props byte-identical to the new en.json values everywhere the same
  id appears.

BEFORE EDITING (10 min)
1. Truth-check the clause "not a personal return" in public.fund.paths.endowLede against
   the garden-vault yield routing (yield-split config / Octant YDS docs in repo). If
   routing is more nuanced, drop that clause and keep the rest of the approved sentence.
2. Verify in Cookies.tsx that connectKicker/connectedKicker/forYouKicker never render
   together before applying the cookies kicker numbers.
3. grep public.actions.kicker usage; if unused, leave that key untouched.

ORDER: Wave 1 (P0 table) → Wave 2 (P1 table) → Wave 3 (P2 + sweep + kickers). After each
wave: es/pt mirrors, defaultMessage sync, run the shared locale-coverage test.

VALIDATION (QA Speed Mode; evidence before claims)
- bun run --filter @green-goods/shared test (locale-coverage must pass)
- bun run lint:vocab
- Targeted client tests: PublicHome, PublicGardens, PublicActions, PublicImpact,
  PublicFundingDialogVocab, PublicFooter, and any Public component test asserting changed
  strings — update fixtures to the new copy, never weaken assertions.
- Rendered spot-check of / , /gardens , /fund through the authenticated Brave QA profile
  if available; otherwise report browser QA as blocked. Do not substitute isolated
  Playwright/Chromium profiles.

SHIP: Run the Ship Gate (bun format && bun lint && bun run test && bun build) before the
PR. Commit: fix(client,shared): editorial clarity pass on public website copy.
Open a PR to develop (gh --repo greenpill-dev-guild/green-goods). One PR, no drive-by
refactors. Report every key changed (en old → new), test output, and anything you could
not verify.
```

## Verification

- Locale gate green (parity, no empties, no identical-string violations, ICU intact).
- `bun run lint:vocab` green.
- Targeted client tests green after fixture updates; no weakened assertions.
- Rendered proof of `/`, `/gardens`, `/fund` via authenticated Brave, or browser QA explicitly reported blocked.
- Diff review confirms: strings only; defaultMessage ≡ en.json; intentional punctuation is preserved or simplified case by case; kicker sequences read 01→06 (home) and 01→03 (fund/impact/actions/cookies).
