# Green Goods — May 2026 Month in Review

_Written 2026-05-30. Scope: code quality, tech debt, agentic development flow, software architecture. Lens: what May tells us about going from solo to team in June._

## Thesis

**Agentic velocity let one person ship roughly a quarter's worth of work in a month. Every structure that velocity outran is now the bottleneck to going from solo to team.** The code quality is genuinely good and the agentic foundation is a rare, durable asset. The gaps are not "broken code" — they are scaffolding the output outpaced: a review surface that exists but is bypassed, an E2E safety net that's switched off, env-thrash that lands in main history, plan sprawl, and an onboarding doc that already points at the wrong tracker. June's job is to **convert the agentic foundation into contributor leverage.**

---

## 1. The shape of May

| Metric | Value |
|---|---|
| Commits (May 1–30) | **330** |
| Net change | **+107,500 / −27,178** across **1,336 files** |
| Authors | `contact@afolabi.info` ×322, `afo@greenpill.builders` ×8 — **~98%+ solo** |
| PRs opened/merged | **~14** (#509–#528); most substantive work went **direct-to-branch** |

**Per-package code churn (vs. 30 Apr baseline):**

| Package | Files | +/− | Read |
|---|---|---|---|
| shared | 279 | +19,055 / −4,180 | The critical hook/logic layer — biggest churn, highest risk |
| client | 188 | +16,230 / −4,228 | PWA + public editorial site rebuild |
| admin | 180 | +11,981 / −3,426 | Design revamp Tier 1–6 |
| agent | 55 | +6,003 / −1,322 | Idempotency, rate-limit, Sentry, Telegram, PostHog |
| contracts | 56 | +3,435 / −1,343 | **Least churned — stable (good)** |
| indexer | 14 | +418 / −76 | Light, bounded |

**Headlines shipped:** v1.1.0 "Season One" launch (admin design revamp, PWA pre-release hardening, agent idempotency); conviction-voting + HypercertSignal pools + yield routing across contracts/shared/admin; public editorial website (SiteHeader, personas, glossary, eight-capitals, funding bridge); public endowment management; campaign cookie jars; Sentry observability across all surfaces; supply-chain guardrails + release-age gates; and a large investment in agentic dev infrastructure.

---

## 2. What we did genuinely well

1. **The agentic foundation is the asset that makes scaling feasible.** 25 project skills, a `plan-hub.mjs` harness (with tests), 6 cron'd routines (bug-intake, health-watch, growth-pulse, qa-triage-pulse, pr-review), `drift-check`, `/qa-triage`, and the `ai-native-dev-workflow` framework (agent-run ledger, workflow scorecard, adversarial review, closeout gate, rule-feedback loop, pre-agent-max checklist, data-contract map, route/access matrix). Claude+Codex worktree orchestration is real and working. **Most solo projects never build this** — it's what makes a contributor handoff even thinkable.

2. **Code quality is strong where it counts.** Honest, corrected numbers (raw greps were inflated by test/story files):
   - `any` in **app** code: client **0**, admin **1**, agent **1**. Concentrated debt is **39 in `shared/src`** — mostly low-level event/EAS payload boundaries, not laziness.
   - `console.*`: ~**10 real violations** in `shared/src` (the raw 26 includes READMEs and the `logger.ts` implementation itself). The "use `logger`, not console" rule is ~90% followed.
   - **15** TODO/FIXME/HACK/XXX markers in 12 files across the whole tree. **6** `@ts-ignore`/`@ts-expect-error`. This is a clean codebase.

3. **Test density in the critical layers is high.** contracts 507 test files, indexer 354, shared 259 unit + 79 stories, admin 117 stories. The contract and shared invariants are well-covered.

4. **Design-system maturity.** Strict M3 anatomy, token-drift lint, vocab lint, DesignMD gates, Storybook story-quality checks — design is governed, not vibes.

5. **Security/ops posture improved _within_ the month.** Sentry observability, supply-chain guardrails, release-age gates, CodeQL ReDoS/TLS cleanup, env via `op inject` (Varlock retired). The protocol is mostly deployed and stable on Arbitrum.

---

## 3. Where the velocity outran the scaffolding

Each of these is the _same story_: output moved faster than the structure around it.

1. **The review surface exists but is bypassed.** CI is comprehensive — 9 workflows on `push`/`pull_request` to `[main, develop]`, plus supply-chain guardrails — and Vercel is wired to all three browser surfaces (per-PR previews are its default). But **~14 PRs against 330 commits** means the dominant flow is direct-commit-to-`main`, so CI/preview validation runs **after** code is in the main line, reactively. The gate is built and largely unused. (`develop` has been dead since 05-13; the real flow is `main` + short-lived `claude/*`/`codex/*` worktrees that aren't in the push trigger at all.)

2. **The E2E safety net is switched off.** **61 skip/fixme markers** in the Playwright suite, with a single root cause: **headless-auth** (passkey / account-abstraction injection doesn't persist in CI). Several were deferred "until v1.1.1." This is the one net a newcomer would lean on to refactor safely — and it's off.

3. **Thrash lands in main history.** The Sentry sourcemap saga (~25 micro-commits on 05-27/28: "add temporary sentry proof script" → "remove temporary sentry proof script" → repeat), the service-worker cache saga (05-06), and the wallet-connect fix that was committed → reverted → re-landed as #527. These aren't preview-catchable: they're **env-parity** (Vercel/Sentry build vars) and **SW/cache** behavior that only manifests on the real production domain. The gap is **preview→production**, not the absence of preview.

4. **WIP sprawl.** **9 active plans / 5 archived.** Several "active" plans are actually done (Sentry shipped, dialog-liquid-audit resolved, admin-dashboard-qa merged as #525). The plan lifecycle isn't closing — which is fine solo, but it's noise a second contributor can't navigate.

5. **Monoliths are forming.** `CampaignCookieJarPanel.tsx` **2,115 lines**, `agent/src/api/server.ts` **1,497**, `agent/src/services/db.ts` **1,235**. The campaign cookie jar is also being **reframed as a Seasons primitive** — i.e. a large, recently-churned feature built on a concept that's still moving.

6. **The onboarding doc already drifts.** `CONTRIBUTING.md` step 1 says "pick a scoped **GitHub issue**" — but the repo runs **Linear-as-truth** (GitHub Issues are explicitly not used for backlog). A contributor's literal first step is wrong.

---

## 4. The contributor gap is structural, not documentary

The docs (CLAUDE.md, AGENTS.md, ONBOARDING, CONTRIBUTING, README — 1,136 lines) are decent. The blocker is the **operating model**, and a newcomer hits all four links of the chain at once:

1. **No pickup-able units** — work lives in `.plans/` hubs and Linear initiatives, not in scoped, self-contained "good-first-issue" tickets a stranger can grab.
2. **No review surface** — direct-commit means there's nothing to review, comment on, or learn the codebase's taste from.
3. **No safety net** — the E2E net they'd rely on to make a first change without fear is disabled.
4. **Wrong signpost** — the onboarding doc points at GitHub Issues; reality is Linear.

You can't fix this by writing more docs. The model is solo-shaped; June has to reshape it.

---

## 5. Protocol polish (the contracts ask)

Contracts were the least-churned package — that stability is a strength, not neglect. To "polish the protocol" in June:

- **Resolve the zero-address subsystems on Arbitrum (42161):** `gardenerRegistry`, `gardenerAccountLogic`, `ensReceiver` are all `0x000…`. Decide per subsystem — ship it, or formally render "not available on this network" via `isGreenWillDeployed`-style gating **and document the gap as intentional** so it stops reading as a bug.
- **Close the deferred security item:** GreenWill CEI (checks-effects-interactions) was deferred to v1.1.1; ADR-015 (self-call pattern) exists. Land it and close the release/1.1.0 audit loop.
- **Lock the campaign → Seasons reframe** _before_ more code accretes on the 2,115-line panel.

---

## 6. June plan

### Immediate (this week — genuinely actionable)

1. **Reconcile `CONTRIBUTING.md` ↔ Linear** (and the hosted `docs.greengoods.app/builders` guide). Fix the "GitHub issue" → Linear signpost.
2. **Turn on branch protection for `main`** — require a PR + passing checks. This makes the *already-built* CI/preview gate real with zero new infra.
3. **Fix the headless-auth E2E blocker** (or quarantine cleanly with a tracked re-enable ticket). Restore the net before inviting anyone to touch the code.
4. **Close stale plans** — archive Sentry, dialog-liquid-audit, admin-dashboard-qa; cut "active" to what's truly in-flight.
5. **File ~5 scoped Linear "good-first-issue"-equivalents** — e.g. the ~10 `console.*`→`logger` cleanups in shared utils, one monolith-decomposition slice, one skipped-test re-enable, one zero-address gating task. Real, bounded, reviewable.

### Structural themes (the month)

- **Convert the agentic foundation into contributor leverage.** Finish `ai-native-dev-workflow` Week 6 retro (the only incomplete week). Promote the steps that caught real drift into ONBOARDING/CONTRIBUTING; cut the ceremonial ones. The ledger/scorecard becomes the "how we work with agents here" doc a new contributor reads first — this is the differentiator, lead with it.
- **Close the preview→prod gap.** A pre-deploy env-contract parity check (production Vercel/Sentry vars validated against `.env.schema` before promotion) + a staging domain that exercises SW/cache. This is what actually kills the thrash class — previews never will.
- **Decompose the monoliths.** `CampaignCookieJarPanel` (after the Seasons lock), `agent/server.ts`, `agent/db.ts`. Smaller files are also more reviewable — it compounds with the PR-gate change.
- **Protocol closeout.** GreenWill CEI → v1.1.1; zero-address subsystem decisions; audit-follow-up loop closed.
- **Make solo→team measurable.** Track four numbers monthly: % of substantive changes that went through a reviewed PR, % of E2E suite enabled, active-plan count, distinct-contributor count. If these don't move, the reshaping didn't take.

---

## 7. The one bet

If only one thing happens in June: **turn on the PR gate + restore the E2E net.** Those two convert the existing — and genuinely excellent — CI/preview/agentic infrastructure from "solo-bypassed" into "contributor-ready." Everything else (monoliths, plan hygiene, protocol closeout) is downstream of having a real gate and a real net.

The codebase isn't the problem. The operating model is solo-shaped, and May proved how much one person plus good agents can carry. June is about building the seams a second person can plug into — and the foundation to do it is already mostly built.
