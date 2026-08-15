# Docs Remediation Plan (2026-08-14 audit, rev 2)

**Status**: PARKED (2026-08-15) — plan committed, execution deferred pending credit budget.
Baseline: develop @ 9d335811a. Audit evidence: https://claude.ai/code/artifact/302fc9ac-8b6e-4de6-9957-3e218dbd6fa8

Partial first-attempt work exists in LOCAL worktrees on the audit machine (uncommitted; salvage or discard when resuming):
`.claude/worktrees/agent-a776ed17522e312a9` (P1 — verification complete, badge-page edits started) and
`.claude/worktrees/agent-aead4e66531068483` (P0 — missing search-index reproduced; bunx picks Node 18, use `scripts/dev/node-cli.js`).

## Ground rules (all phases)

- Four phases, **one PR each**, base `develop`.
- **Never a `docs/...` branch** — a remote branch named exactly `docs` blocks the prefix. Use `fix/docs-*` or `chore/docs-*`.
- Re-verify every audit line at HEAD before editing (line anchors below are 2026-08-14 leads, not truth).
- `feature_status` literals must come from `allowedFeatureStatus` in `docs/scripts/docs-audit.mjs`.
- Never bump `last_verified` without re-verifying the whole page; never bump over a known-stale claim.
- Glossary Domain Entities / Personas rows are char-locked to the ontology sidecar — run `bun run check:ontology` after glossary edits; pair sidecar edits when it flags.
- Per-phase validation: `bun run build:docs` green + `bun run docs:audit` no new warnings (+ `lint:vocab` / `check:ontology` when touched). Script/workflow edits are security-sensitive — call out in PR bodies.
- **Already fixed by the ontology lane (#714/#715) — skip**: glossary evaluator/hat definitions and Work / Work Approval / Work Submission sections (incl. Karma-GAP-is-manual note); how-it-works record-timing; FAQ record-timing answers ×3 locales; "Awaiting evaluator" string; where-were-headed rework. New generated reference pages exist (`ontology.generated`, `ontology-human.generated`, `green-goods-claims.generated`) — link them, never duplicate.

## Phase 0 — Restore site search (P0)

Production builds emit no `search-index*.json` → live `/search-index.json` 404s and every query spins. Suspect the `future.v4`/faster flags vs `@easyops-cn/docusaurus-search-local@0.55.2` postBuild.
1. Reproduce: `bun run build:docs`; confirm no `docs/build/search-index*.json`.
2. Minimal fix: the specific offending flag or a lockfile-managed bump of the existing plugin only.
3. Prove: build output shows the index files; `docusaurus serve` + curl `/search-index.json` → 200.
4. Guard: a `.github/workflows/docs.yml` step that fails the build when no index is emitted.

## Phase 1 — Factual corrections

1. Badges live, not Planned: `community/gardener-guide/earning-badges.mdx` (~85), `community/evaluator-guide/earning-badges.mdx` (~73), `community/operator-guide/earning-recognition.mdx` (~70), `builders/integrations/greenwill.mdx` (~8/20). Evidence: `42161-latest.json` greenWill + unlock.locks, client `Badges.tsx` claim flow. The badge validates the Work attestation — say first **submitted** work.
2. Agent = Telegram only: glossary ~94, `builders/journeys/onboarding.mdx` ~25, `builders/journeys/work-submission.mdx` ~51 (only `packages/agent/src/platforms/telegram.ts` exists).
3. Cookie-jar guide step 1: jars are auto-provisioned at garden mint, not operator-created (`useCookieJarAdmin` has no create mutation).
4. Vocab-lint scope truth: glossary ~121 + `banned-vocabulary.json` globs + `scripts/design/check-vocab.sh` → shared-only i18n reality.
5. Chain defaults: `builders/glossary.mdx` ~79 (dev stack forks Arbitrum One, FALLBACK_CHAIN_ID 42161); `modular-approach.mdx` ~131 example → `42161-latest.json`.
6. `builders/getting-started.mdx` ~418: dead `bun deploy:*` → root `contracts:*` family.
7. Route inventories → ten public client routes incl. `/vaults` `/cookies` `/glossary` (persona-surfaces ~37/~87, packages/client ~66, client-deploy ~105 vs `router.config.tsx`).
8. `reviewing-work.mdx` ~103: document required Confidence + Verification Method (workApproval schema fields).
9. `query-indexer.mdx` ~57: drop Celo (`config.yaml` = 42161 + 11155111).
10. FAQ: add the third surface (editorial website vs installed PWA vs admin dashboard) + note Owner hats also approve **in the app** (client permission layer only — the on-chain resolver checks the operator hat).

## Phase 2 — Commitment pooling, Stage A (docs for what is live)

State ceiling (verify against `42161-latest.json`, `packages/indexer/config.yaml`, `.plans/active/commitment-pooling/status.json`): pooling module + registry deployed AND unpaused with 18 pools; settlement + credit registry deployed but PAUSED (no value authority); client tab is a coming-soon stub; only the settlement half is indexed. Docs say "contracts live on Arbitrum; in-app experience rolling out" — nothing more.
1. Community concept page `docs/docs/community/commitment-pools.mdx` (communitySidebar after "Where We're Headed"): offers/requests; confirmation by someone other than the doer (contributing stewards blocked); one pool per garden, holding promises never funds; curation + per-person cap; cycles as Seasons/campaigns (a pool's Season cycle IS the garden's Season); offer-once vs offer-over-time; a commitment is a record, never a coin; lifecycle mermaid (Offered → Accepted → Evidence → Ready → Confirmed → Fulfilled + dispute branch; no semicolons inside mermaid notes); honest status panel. Citations: Ruddick's two IJCCR papers, "What Makes a Pool a Pool?", Grassroots Economics docs; Sarafu RCT = Mqamelo 2022; clean-room note (no AGPL source).
2. Vocabulary guardrails on every page: "commitment pool" vs "signal pool", never bare "pool"; credit never implies a personal score; work approved by operators vs commitments confirmed by counterparties; no "Practice"/"member"; no debt/countdown/leaderboard framing; steward = the garden's existing operator/owner.
3. Glossary planned-entities block lists all six pooling entities (verify — pool/cycle/series were added by the ontology lane).
4. Deployment Status page rows: pooling module/registry live-unpaused; settlement deployed-paused; credit registry deployed records-only; indexer column = settlement half only.
5. `builders/integrations/commitment-pooling.mdx` (+ Integrations sidebar): module + non-transferable register architecture, why not ERC-1155/EAS, the two registered schemas (assessmentV3, communityTestimony) via artifact import, state machines by linking the generated ontology page, indexer boundary, `contract-spec.md` pointer, v1-0 disambiguation.
6. FAQ: "What is a commitment pool?" with honest status.
No how-to guides (UI unshipped); never hand-edit `*.generated.*` files.

## Phase 3 — Structure and gates

1. docs-audit teeth: `--ci` exits non-zero on errors; orphan check (non-`unlisted` pages must be in a sidebar); `last_verified` >120d warning for community guides; delete dead constants; wire `docs:audit:ci` into docs.yml; leave the repo passing the strengthened script.
2. The ~12 unreachable pages: re-list after verification (funder trio; gardener voting-governance + garden-payouts; operator managing-payouts + managing-certificates + earning-recognition) or set `unlisted: true` when unverifiable; greenwill joins the Integrations sidebar; silvi/unlock + drs-2026-paper-outline get `unlisted: true`.
3. Protocol-status pipeline: wire `status.mdx` tables to the generated JSON (extend generator with pooling/settlement/credit) + freshness check, OR delete generator + JSON. No third state.
4. Redirect re-aims: /specs/cookie-jar → integrations/cookie-jar; /specs/octant; /specs/gardens; /developer/contracts; /developer/hypercerts; /developer/testing; /developer/docs-contributing; /community/making-assessments → operator-guide/making-an-assessment; add a redirect for builders/quality/artifact-freshness (live on main, deleted on develop).
5. Three-surfaces section in how-it-works, cross-linked from the Phase 1 FAQ answer.
6. Coverage stubs: Telegram agent gardener page (verify handlers first); ENS usernames incl. operator-assisted constraint; avatars mention; `/vaults` mention in the funder guide.
7. Move the Ontology sidebar link community → builders (URL unchanged).
8. Deploy-branch policy: leave as-is (develop + main both deploy, last push wins); comment it in docs.yml and flag for a human decision.

## Out of scope

Operator→Steward sweep (gated on PRD-749) · pooling Stage B/C docs · docs i18n · guide screenshots · Linear writes from execution sessions.

## Definition of done (each PR body)

Commands run with results; every changed claim listed with re-verified code evidence; anything unverifiable stated plainly, never shipped as fact.
