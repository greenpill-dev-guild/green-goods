# Software Fundamentals Audit Snapshot

**Date**: 2026-05-01
**Baseline**: `develop` / `origin/develop` at `f1ce64a0 fix(client,admin,shared): clear CI false positives`
**Mode**: read-only audit, stable committed tree focus, dirty WIP ignored except where called out as proof limit

## Audit Thesis

Green Goods has strong foundations for AI-assisted development: `.plans`, domain glossaries, shared domain types, module maps, Storybook, tests, and explicit agent workflows. The main risk is enforcement drift. Agents can still follow stale command paths, miss red guidance checks, or add code behind shallow boundaries while existing tests give a false sense of structural health.

## Evidence Summary

- `node scripts/harness/plan-hub.mjs validate` passed with `Validated 18 feature hubs.`
- `bash .claude/scripts/validate-hook-location.sh` passed.
- `node .claude/scripts/check-skill-frontmatter.js` failed on `doc-feedback`, `audit-then-ship`, and `doc-feedback` registry/canonical-command drift.
- `.plans/README.md` documents `node scripts/plan-hub.mjs`, while the real helper path is `scripts/harness/plan-hub.mjs`.
- `packages/contracts/AGENTS.md` still references `GreenGoodsResolver`, `src/resolvers/GreenGoods.sol`, and `GreenGoodsResolver.t.sol`, while the current tree contains separate resolver files/tests such as `Work.sol`, `Assessment.sol`, and `WorkApproval.sol`.
- ADR-008 already accepts the explicit fat shared barrel, but the current root barrel is 1126 lines and the hook surface includes 195 shared `use*.ts(x)` files; the issue is policy freshness, not replacing the import strategy.
- `bunx knip --include files --reporter compact` failed before producing dead-code output because Knip imported client/admin Vite config and triggered Varlock/1Password resolution for `PINATA_JWT`.
- `scripts/quality/check-source-structure.js` exists, but stable `HEAD` still has several large files and stale allowlist paths.
- Campaign Cookie Jar code spans large admin and shared surfaces in the current tree (`useCampaignCookieJar.ts` 723 lines; admin `CampaignCookieJarPanel.tsx` 872 lines), with pure helpers tested but deeper read/mutation boundary tests still needing explicit coverage.
- `packages/agent/src/api/server.ts` keeps a good `createServer` public interface but concentrates many route/security/upload/funding/webhook concerns internally.

## Confirmed Strengths

- Shared language: community glossary, builder glossary, domain types, i18n vocabulary lint.
- Shared design concept: `.plans`, audit-then-ship, prompt contracts, plan hub.
- Feedback loops: tests, stories, design checks, hook-location guard, plan validation.
- Module intent: `packages/shared/src/MODULES.md` and shared barrels give agents a navigable map.

## Primary Gaps

1. Guidance validation is red and not currently a trusted always-green signal.
2. Plan-hub command docs are stale in the canonical plan README.
3. Contracts package guidance has current-architecture drift even though Contracts behavior itself is not in scope.
4. Shared API guidance needs a refreshed public-interface policy around ADR-008, root barrel growth, and documented subpath exports.
5. Dead-code audit tooling is installed but not yet a reliable cleanup feedback loop in this local context.
6. Source-structure checks are differential and do not fully reflect stable baseline complexity.
7. Campaign Cookie Jar has tests around helpers and UI, but needs a deeper behavior boundary.
8. Agent API server internals need narrower modules behind `createServer`.
9. Stale admin surfaces still cost agent search and review time.

## Proof Limits

- Full repo tests and builds were not run because the working tree had substantial unrelated WIP.
- Some validation commands necessarily read the current worktree; stable claims in this report are limited to committed files inspected directly or commands whose output was stable-tree-independent.
- Campaign Cookie Jar line counts reflect the current WIP tree, not necessarily committed `HEAD`; they are included because the active plan now needs to account for that already-moved Cookies surface.
- This report is planning evidence only. Implementation requires a human scope lock for each slice.
