# Software Fundamentals Hardening Spec

## Summary

This plan converts the 2026-05-01 software-fundamentals audit into a scoped hardening program. The goal is not to add product surface area. The goal is to make Green Goods easier for humans and agents to change by tightening the shared design concept, keeping the ubiquitous language current, strengthening feedback loops, and moving high-churn workflows behind deeper module interfaces.

## Users

- Primary: Green Goods maintainers and agent operators working on `develop`
- Secondary: Codex and Claude automation lanes that need stable repo truth and narrow implementation surfaces
- Tertiary: reviewers who need less time spent separating real product risk from stale guidance or dead paths

## Functional Requirements

1. Repair agent guidance drift so `check:claude-guidance` and `check:codex-guidance` can be trusted as current repo signals.
2. Repair `.plans` command drift so canonical docs and automation prompts point at `node scripts/harness/plan-hub.mjs`, or introduce durable package scripts that hide the raw path.
3. Repair package-level contracts guidance drift where docs still describe the removed `GreenGoodsResolver` fan-out architecture.
4. Refresh ADR-008 and shared package guidance so the accepted fat-barrel strategy has current import rules, public API review expectations, and explicit subpath exceptions.
5. Compare Knip and Fallow on the same Green Goods baseline before selecting the recurring static-analysis surface.
6. Add an env-safe dead-code audit path that does not import client/admin Vite config and does not require local 1Password/Varlock resolution for file-level checks.
7. Reconcile source-structure guardrails against stable `HEAD` without simply normalizing large files as healthy.
8. Add a plan/handoff convention that requires RED evidence or explicit test-first proof for large behavior changes.
9. Decompose Campaign Cookie Jar around a deeper campaign-cookie-jar controller/service boundary, then keep admin and public UI surfaces thinner.
10. Split the agent API server internals behind the existing `createServer` public interface.
11. Retire or explicitly classify stale admin surfaces so agents stop rediscovering dead routes, deprecated shims, and story-only primitives as live options.

## Research Evidence

- Stable audit baseline: `develop` / `origin/develop` at `f1ce64a0 fix(client,admin,shared): clear CI false positives`
- Plan hub validation passed: `node scripts/harness/plan-hub.mjs validate` reported `Validated 18 feature hubs.`
- Hook location validation passed: `bash .claude/scripts/validate-hook-location.sh`
- Guidance validation failed: `node .claude/scripts/check-skill-frontmatter.js`
- `.plans/README.md` still documents `node scripts/plan-hub.mjs`, while the real helper is `scripts/harness/plan-hub.mjs`
- `packages/contracts/AGENTS.md` still references `GreenGoodsResolver`, `src/resolvers/GreenGoods.sol`, and `GreenGoodsResolver.t.sol`; those files are not present in the current resolver/test tree.
- ADR-008 already accepts the fat explicit shared barrel, but `packages/shared/src/index.ts` is now 1126 lines and the shared hook surface includes 195 `use*.ts(x)` files; the plan should refresh the policy rather than invent a new import architecture.
- `bunx knip --include files --reporter compact` currently fails before analysis because Knip imports client/admin Vite config, which imports Varlock and attempts 1Password resolution for `PINATA_JWT`.
- Prior `.plans/clean/agent-3-dead-code.md` evidence showed Knip found real dead files, but also produced noisy findings around Solidity deps, Storybook, service workers, Docusaurus CSS, Vite string plugins, runtime barrels, and exported public types.
- Fallow's current docs describe `dead-code`, `dupes`, `health`, changed-file `audit`, `fix --dry-run`, baseline/regression modes, CI output, boundary violations, circular dependencies, and duplication modes. Source: https://docs.rs/crate/fallow-core/2.34.0
- Source-structure script exists, but stable `HEAD` still contains several large committed files and stale allowlist entries
- Current Campaign Cookie Jar WIP surfaces are large across admin and shared (`useCampaignCookieJar.ts` 723 lines; admin `CampaignCookieJarPanel.tsx` 872 lines), while pure model/helper tests exist but deeper read/mutation boundary tests need to be explicit
- Agent API server keeps a good public `createServer` interface but concentrates many internal concerns in one file

## Transcript / Tool Pattern Mapping

| Pattern | Existing Green Goods Strength | Gap To Close |
|---|---|---|
| Shared design concept | `.plans`, audit-then-ship, prompting docs, plan hub | stale command paths and guidance-check drift weaken trust |
| Ubiquitous language | community glossary, builder glossary, domain types, i18n vocab lint | glossary/domain drift is mostly manually policed |
| Feedback loops | tests, stories, design gates, hook-location guard, plan validation | some important checks are not consistently part of stable PR/local gates |
| Deep modules | shared module map, root barrels, domain utilities, typed hooks | several recent flows still land as large orchestration files |
| Interface-first delegation | `createServer`, shared hooks, model utilities | tests often cover helpers or UI seams before the main behavior boundary |
| Seams and adapters | agent `createServer` deps, indexer boundary script, Storybook state catalog, contract resolvers/modules | dead-code audit and package guides are not yet reliable seams for cleanup decisions |
| Dead code | Knip is installed and prior `.plans/clean` work removed high-confidence orphans | no env-safe recurring command or baseline-backed gate exists yet |
| Duplication | the clean skill has a DRY agent and source-structure ratchet catches some large-file drift | no token/semantic clone report is part of local or PR evidence |
| Health targets | `check:source-structure` ratchets changed file size | no complexity / churn / refactoring-target report is captured for agents |
| Boundary violations | hook-location guard, indexer boundary, package AGENTS, ADR-003/ADR-008 | no single static-analysis boundary profile for app-to-shared imports or public API rules |

## Knip vs Fallow Evaluation Criteria

| Criterion | Why It Matters For Green Goods |
|---|---|
| Runnable without secrets | The audit must not import Varlock-backed Vite config or require 1Password just to classify files. |
| Signal quality | Findings must separate true dead code from Storybook, generated code, Foundry remappings, service workers, Docusaurus CSS, public barrels, and exported public types. |
| Scope control | The first gate should support changed-file or baseline/regression mode before any full-repo blocking gate. |
| Duplication coverage | The tool should surface real copy-paste drift without pushing premature abstractions for only vaguely similar UI surfaces. |
| Boundary enforcement | The tool should express Green Goods rules such as shared hook ownership, no internal `src` deep imports, allowed subpath exports, and package boundaries. |
| Agent ergonomics | Output should be structured enough for Codex/Claude to triage into keep/revert/bail decisions and record evidence in `.plans`. |
| Autofix safety | Any fix mode must start as dry-run-only and only graduate for narrow, high-confidence export/dependency cleanups after review. |
| CI fit | Advisory first, then baseline/regression gate, then blocking only after false positives and owner rules are captured. |

## Human Judgment Points

- Whether this hub should run as one hardening wave or split into smaller child hubs after scope lock.
- Whether Contracts guidance repair should be completed inside Slice 1 as repo-truth work, or split into a tiny docs-only child branch to avoid reopening the contracts lane.
- Whether ADR-008 should remain a pure accepted-decision update or gain a follow-up enforcement script for app-package import surfaces.
- Whether Knip remains the canonical dead-code tool, Fallow replaces it, or Fallow augments Knip for duplication/health/boundary reporting.
- Whether the chosen dead-code audit should land as a local-only script first or become a required recurring cleanup gate after false positives are triaged.
- Whether `check:source-structure` should become a required PR gate immediately or first run as drift-watch evidence.
- Whether to introduce package scripts such as `bun run plans:validate` before rewriting every stale raw path.
- Whether the Campaign Cookie Jar flow should preserve all current product behavior while only changing internals, or also revisit UX copy and layout.
- Whether stale admin primitives should be deleted, marked as intentionally story-only, or adopted into runtime surfaces.

## Non-Functional Constraints

- Package boundaries: hooks remain in `packages/shared`; admin/client consume shared boundaries rather than duplicating workflow logic.
- Performance: new checks must stay cheap enough for local and PR use.
- Security: no deployment, key, or contract changes in this hub.
- Dependency posture: prefer `bunx` evaluation and report capture before adding a new package dependency.
- Offline / sync: no runtime sync contract changes unless a child plan explicitly scopes them.
- Localization: any user-facing UI changes in later implementation must update `en`, `es`, and `pt`.
- Design language: no UI redesign; any admin/client touch must respect Warm Earth and package AGENTS guidance.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Targeted admin/client decomposition and stale UI surface classification only after scope lock |
| State / API | `state_api` | Primary lane for guidance checks, plan-hub command drift, contracts docs drift, shared API policy, Knip-vs-Fallow evaluation, dead-code audit, source-structure ratchet, shared hook/controller boundaries, and agent API split |
| Contracts | `contracts` | `n/a` for Solidity/deployments; contracts guide repair is repo-truth work in `state_api` unless a child hub explicitly scopes contract behavior |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential proof that checks, docs, and module boundaries now match the plan |

## Risks

- Risk: the hub becomes broad cleanup theater.
- Mitigation: activate one lane at a time and require each lane to name the concrete entropy source it reduces.
- Risk: source-structure work turns into cap inflation.
- Mitigation: preserve large-file findings as cleanup targets and only adjust baselines with explicit rationale.
- Risk: refactors break user-facing Campaign Cookie Jar behavior.
- Mitigation: add boundary tests first, preserve existing UI tests, and avoid product behavior changes unless separately approved.
- Risk: guidance fixes duplicate existing Claude/Codex truth.
- Mitigation: update the canonical surfaces and avoid creating a parallel protocol.
- Risk: contracts guidance repair gets misread as authorization for Solidity changes.
- Mitigation: keep the contracts lane `n/a` and phrase Slice 1 as docs/vocabulary repair only.
- Risk: shared API policy work fights ADR-008.
- Mitigation: keep the fat explicit barrel as the accepted baseline; tighten when symbols become public and when subpath imports are allowed.
- Risk: dead-code audit creates noisy false positives or blocks on secret-manager state.
- Mitigation: first compare Knip and Fallow in report-only mode, then make the chosen file-level audit runnable without Vite/Varlock config before any gate.
- Risk: Fallow adoption becomes tool churn before it proves better signal than existing Knip evidence.
- Mitigation: require same-baseline output comparison, explicit false-positive inventory, and a decision record before changing package scripts or CI.
