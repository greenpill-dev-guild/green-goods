# Software Factory: reconciled audit and improvement strategy

**Date:** 2026-10-04 (America/Los_Angeles)
**Source checkout:** `develop`, `c4a9487350c6739de54bcc2737dd2a972223243f`, with unrelated join-request work in progress
**Disposition:** Planning evidence; implementation candidates are unselected
**Execution owner:** [test-budget-and-ci-speed](../plan.todo.md#agentic-development-follow-up-proposed-2026-10-04)

## Decision summary

Green Goods already has the main elements of a verification-first development environment. The
next investment should improve the fidelity and reproducibility of its evidence, then reduce the
work agents spend assembling and interpreting that evidence. More agents or a replacement
orchestrator would amplify the current weaknesses before resolving them.

The recommended order is:

1. Make browser verification trustworthy: align local and CI profiles, reject unsupported fake
   requests, require named user outcomes, and protect required browser jobs against removal.
2. Add bounded active verification: qualify passkey and production-PWA proof, then explore
   meaningful action and failure sequences with deterministic replay.
3. Turn recurring interventions into a small number of enforced controls: diagnose gate outcomes,
   generate evidence summaries, repair hook installation gaps, and restore address-type protection.

The existing post-release decision D14 remains in force. This report does not activate a lane,
authorize dependency installation, change browser-evidence policy, or permit publication.

## Inputs and evidence standard

This comparison reconciles the initial Codex report, its independent Astra verification pass,
and the user-supplied Claude Fable 5.1 audit dated October 4. The supplied Lauren Tan transcript
provides the benchmark: let agents observe outcomes, encode mechanical work in tools, constrain
recurring failure patterns, and connect incoming signals to implementation.

Fable adds useful memory, worktree, typing, and throughput observations. Astra adds concrete
browser-assertion, fake-backend, production-preview, and CI job-presence findings. Neither audit
is treated as authority over current code. Disagreements below were checked against the checkout.

Evidence labels:

- **Observed:** current source inspection or a bounded local probe supports the statement.
- **Reported:** an input audit supplies it, but this comparison did not reproduce the measurement.
- **Proposed:** a recommended change, not existing capability or accepted implementation scope.

No live GitHub history, branch-protection settings, cloud routine configuration, personal memory
corpus, or authenticated browser session was inspected during this comparison. Private memory
recipes and incident accounts are not copied into this public repository. There is no rendered
proof from this task. Unrelated application changes were left untouched.

## What the audits agree on

The strongest foundation is the existing validation selector and runner: risk-aware plans,
focused proof, critical overrides, deadlines, and exact-input receipt reuse. The repository
already encodes significant engineering judgment in deterministic tools. See the
[validation pipeline](../../../../.claude/context/validation-pipeline.md),
[runner](../../../../scripts/dev/ci-local.js), and
[policy](../../../../scripts/data/validation-policy.json).

Contract verification also already separates the fast and deep loops. The test profile has
1,000 fuzz runs and invariant campaigns of 16 runs by 96 calls; the nightly profile has 10,000
fuzz runs and 256 by 500. A checked-in invariant regression preserves a shrunk failure sequence.
Fuzzing and mutation testing prove different things, however: existing fuzzing is not evidence
of a mutation score. See [profiles](../../../../packages/contracts/foundry.toml) and
[accounting regressions](../../../../packages/contracts/test/invariant/CommitmentPoolingAccounting.t.sol).

Both audits support investing in interaction and failure recovery, promoting repeated mechanical
work into existing tools, and retaining human decisions for high-impact operations. Neither the
number of skills nor the number of generated PRs is a sufficient quality measure.

## Comparison and adjudication

| Topic | Audit positions | Reconciled finding and disposition |
|---|---|---|
| Browser outcomes | Astra identifies weak approval/admin assertions; Fable proposes a route walker. | **Observed.** Strengthen outcome assertions before adding broader exploration. A walker that accepts an empty shell repeats the weakness at scale. |
| Browser fake boundaries | Astra identifies permissive RPC and GraphQL defaults; Fable describes schema-correct fixtures. | **Observed.** Existing fixtures support useful journeys but do not reject all unsupported requests. Schema-shaped output alone is insufficient conformance proof. |
| Local/CI parity | Initial Codex synthesis identifies a chain/profile mismatch; Fable does not discuss it. | **Observed by pure resolution probe.** Local smoke starts the web stack, which overrides the test profile to Arbitrum/development. CI deliberately avoids that route and uses Sepolia. Fix this first. |
| Route crash checks | Fable says route proof does not assert console or page errors. | **Corrected.** The current route-proof runner rejects unexpected console errors, page errors, overflow, bad HTTP responses, and a missing shell. Extend it rather than rebuild those checks. |
| Accessibility | Fable says no accessibility engine runs and proposes axe. | **Qualified.** There is no dedicated axe interaction gate in the inspected manifests, but Lighthouse is configured and its installed package includes axe-based audits; route proof also records the accessibility tree. A dedicated interaction-level check is a candidate, not a claim that all accessibility automation is absent. |
| Authenticated evidence | Fable describes the critical tier as unable to close automatically and proposes narrowing manual proof. | **Qualified.** Critical paths already have automated unit, integration, contract, and some browser proof. The authenticated browser class overlaps but is not identical to criticality. Additional headless proof complements authenticated/device evidence; it does not become that evidence. |
| Optional passkey/fork projects | Fable proposes putting existing projects into the critical override. | **Observed gap, revised order.** Projects exist, but some tests tolerate incomplete authentication or merely log progress. Qualify their outcomes and capability requirements before selector adoption. |
| Production offline reload | Astra identifies a skipped production-preview test. | **Observed, known debt.** The existing test requires a production-preview flag; no serving lane was found. Preserve its distinction from development-worker and installed-device proof. |
| Contract forks | Fable describes fork E2E as manual-only and suggests a weekly lane. | **Corrected.** Contract fork-readiness jobs run on matching pushes to main/develop as well as callable workflows. Optional browser fork tests are a separate facility. A weekly run would add time-driven coverage, not create the first automatic fork coverage. |
| Outer-loop dispatch | Fable says nothing delegates accepted issues; initial Codex report points to delegation rules. | **Configured, operation unverified.** Routine instructions explicitly support automatic Codex delegation for bounded noncritical issues. Measure whether that handoff works before creating another dispatcher. |
| Worktree hooks | Fable says most worktrees bypass hooks. | **Partially confirmed.** Current inventory: 55 registrations, 3 absent checkouts, 39 existing checkouts with an executable configured pre-push file, and 13 without it. File presence does not prove execution; missing files do not prove historical unverified pushes. |
| Address typing | Fable relies on a historical memory entry. | **Independently reproduced.** Both Client and Admin accept a non-hex string assigned to viem Address in a temporary full-project compiler probe. Trace the declaration/augmentation cause before fixing it; no broad cast-based workaround. |
| Completion hooks | Fable recommends making Stop/TaskCompleted block on receipts. | **Defer policy reversal.** Advisory completion was an explicit accepted decision. Keep validation and publication gates authoritative; complete live hook-conformance proof first. |
| Throughput and harness cost | Fable reports 67% fix-labelled PRs and 24% of commits touching harness paths. | **Reported, causal interpretation rejected.** PR labels are not escaped-regression counts. Commits touching a path are not time, effort, or token share. Use sampled incident provenance and measured check costs. |
| Memory reduction | Fable proposes converting every trap and imposing word-count targets. | **Accept selective mining, reject quotas.** Reproduce recurring faults; automate only stable, useful contracts; archive superseded knowledge with traceability after authorization. Some entries are context or judgment, not lint rules. |

### 1. Verification fidelity: confirmed gaps

The [client approval spec](../../../../tests/specs/client.work-approval.ci.spec.ts), lines 69–100,
allows the dashboard-control branch to be absent and then checks only for a named error string.
Its title therefore overstates approval-flow proof. The stronger
[offline submission spec](../../../../tests/specs/client.offline-work-submission.ci.spec.ts)
already requires that control and exercises queue preservation. Preserve that useful coverage;
do not claim the entire suite would accept a deleted dashboard.

The [admin flow spec](../../../../tests/specs/admin.production-flows.ci.spec.ts), lines 148–185,
checks route preservation and nonempty root content for several named flows. Those are route
smoke checks, not evidence that their intended operations complete or recover from rejection.

The [backend fake](../../../../tests/helpers/mock-backend.ts), lines 63–85 and 150–204, defaults
unsupported RPC operations to success-shaped values and unknown GraphQL operations to empty
data. Prefer explicit scenario operations, argument validation, request accounting, and test
failure for unexpected requests. Legitimate empty states must remain expressible. This extends
the existing strict-fetch convention in
[unit setup](../../../../packages/shared/src/__tests__/setupTests.core.ts).

The optional [passkey spec](../../../../tests/specs/client.passkey.spec.ts), lines 88–165,
can log success because `/home/login` contains `/home`; it also permits absent username UI and
unfinished mocked registration. The [browser fork spec](../../../../tests/specs/client.fork.spec.ts),
lines 178–209, returns without failure when auth remains on login. Selecting these projects
unchanged would produce more green checks without dependable authentication proof.

The [CI aggregator](../../../../scripts/quality/ci-gate.mjs) rejects failed or missing workflows,
but its required-job map names only Shared's two shards. Client/Admin browser failures currently
propagate through their workflows; the remaining gap is detecting future missing or skipped
browser jobs in an otherwise successful workflow. Extend the existing job-presence mechanism.

### 2. Deterministic environments and evidence

The [local E2E wrapper](../../../../scripts/dev/test-e2e.js) starts `bun run dev -- web` for its
smoke preset and sets `SKIP_WEBSERVER=true`. The
[stack profile](../../../../scripts/dev/stack.js), lines 507–560, applies development mode and
chain `42161` by default. The
[Playwright configuration](../../../../playwright.config.ts), lines 52–68, explicitly avoids that
path in CI because its fixtures target `11155111`. A pure-function probe confirmed the mismatch;
no browser failure or transaction was observed.

The [offline-reload spec](../../../../tests/specs/client.offline-sync.ci.spec.ts), lines 199–205,
documents why the Vite development worker cannot prove production navigation precaching. Its
October 16 expiry is a reminder to resolve the debt, not permission to remove the test or mark
it passed. Build-preview authentication needs its own design: do not ship a production auth
bypass to make a test convenient.

Extend [the browser CLI](../../../../scripts/dev/browser.js), its existing lifecycle runner,
and the existing validation receipt owner. Avoid a second top-level verification framework or
an independent receipt database. A new observation artifact should identify source fingerprint,
fixture version, profile, browser/session class, commands, attempted/completed scenarios,
failures, skips, and trace paths. A SHA alone cannot identify a dirty checkout.

Existing [route proof](../../../../scripts/agentic-browser-proof.mjs), lines 475–484, already
checks console/page errors and overflow. Its useful gap is controlled data-rich interaction and
recovery. A full Cartesian product of routes, roles, locales, and widths should not become the
default inner loop. Select representative cases from changed behavior; use broader campaigns
only when measurements justify them. Derive supported roles from
[DevAuthProvider](../../../../packages/shared/src/providers/DevAuthProvider.tsx): `user` is the
current role identifier where Fable's proposed command used `gardener`.

### 3. Constraints, memory, and operator effort

The current shared Git configuration already has `core.hooksPath=.husky/_`. Reapplying that
relative setting alone would not create missing hook executables in linked checkouts. A
read-only doctor should resolve each worktree's effective configuration and the complete
dispatcher chain, then explain the smallest setup repair. Do not silently install dependencies
or retarget every checkout to the newest main-checkout hook; older branches may have different
tooling contracts. Do not expand [dev:clean](../../../../scripts/dev/clean.js) into a branch or
worktree deletion tool: its current contract explicitly excludes sibling worktrees.

The address probe makes Fable's typing concern actionable. The underlying augmentation was
not traced in this planning task. `Address` typing is also not runtime address validation; retain
validation at external boundaries. The lack of `noUncheckedIndexedAccess` outside Indexer is
an opportunity to measure, not evidence that all indexed reads are defective. Start with a
bounded leaf and real failure examples; avoid silencing new diagnostics through assertions.

Runner improvements should classify observed outcomes and show the exact next action. Machine
load is context, not proof that a timeout is harmless. Never turn a failed first attempt into an
unqualified pass through automatic retries. Deterministic failure, budget exhaustion, missing
capability, cancellation, and suspected contention require distinct reporting. Existing test
leases, fingerprint freshness, and critical overrides remain authoritative.

Generate PR validation text from fresh observed evidence, retaining pending/manual evidence and
limits. It must not tick a full-test or lint checkbox merely because a narrower check passed.
Offer explicit regeneration commands for known derived outputs before considering a broad
`check --fix`; automatic post-edit generation can overwrite another session's work or create
expensive loops. Story and locale scaffolds remain conditional opportunities: do not emit
false `storybook-ci` coverage or ship untranslated markers.

## Three candidate cards

These are ranked proposals, not SELECTED architecture entries. No machine seam registry changes
are requested.

| Field | A — Trustworthy browser evidence | B — Bounded interaction and replay | C — Lower-cost environment operation |
|---|---|---|---|
| Friction | Divergent boot profiles, permissive fakes, weak outcomes | Auth/PWA gaps and repetitive manual scenario setup | Missing hook files, address widening, repeated gate interpretation |
| Current interface/callers | browser CLI, Playwright fixtures, local runner, PR jobs | Route proof, existing journey specs, browser presets | ci-local, doctor/setup, hook tests, TypeScript projects, skills |
| Dependency category | Local processes plus substitutes for external services | Browser/storage substitutes; real device and wallet boundaries remain external | Local Git/process/compiler state; cloud dispatch is external |
| Before/after | Implicit environment and shell-only pass → explicit profile and required outcomes | Authored paths plus manual exploration → bounded cases and replayable failures | Human reconstruction → structured diagnostics and verified contracts |
| Deletion test | Fix existing owners; deleting a new umbrella layer should lose no capability | Keep a reusable runner only if multiple real scenarios need reset/replay | Add behavior to existing owners; no new orchestration layer |
| Locality/leverage | One scenario behaves the same locally and in CI | One discovered sequence becomes stable regression proof | One proven failure class stops recurring across sessions |
| Test migration | Replace weak assertions; retain distinct smoke/queue checks | Add only independent recovery/state proof, not duplicate every layer | Keep negative fixtures for real failures; avoid source-text tests for runtime behavior |
| Risk/confidence | Sensitive tooling; high confidence in observed defects | Sensitive/critical proof; medium confidence in cost until pilot | Sensitive tooling/types; high confidence in probes, workload savings unmeasured |
| Rejected excess | New verification registry or success-shaped fallback mocks | Blind click-all, production wallets, full matrix on each edit | Blocking Stop, retry-until-green, cleanup quotas, second dispatcher |

## Recommended implementation shape

The [canonical plan](../plan.todo.md#agentic-development-follow-up-proposed-2026-10-04) divides
the work into thirteen bounded slices. Its first selection should be SF01–SF04: environment
parity, strict browser boundaries, outcome assertions, and required CI job presence. SF10–SF11
are independent high-value constraint repairs after the same scope gate. Broader exploration
follows a trustworthy baseline, not the reverse.

The active architecture hub retains ownership of its live hook-loading and five-task pilot.
This hub links to that work rather than opening a competing pilot or declaring it complete.
The existing routines retain outer-loop ownership. First verify a configured accepted issue can
reach the intended coding session and return evidence; creating another dispatcher is conditional
on an observed operational gap and separate authorization.

## Measurement and adoption

Use a fixed measurement window, exact source/profile identity, and separate inner-loop check,
CI job, workflow, and queue-wait durations. Suggested scorecard:

| Measure | Definition and use |
|---|---|
| Verification sensitivity | Named injected regression is detected; record the specific failure, not just test count |
| Replay success | Saved failing sequences reproduced / sequences attempted, with fixture and profile identity |
| Relevant behavior coverage | Selected journeys with outcome and rejection/recovery proof / explicitly selected journeys |
| Escaped regressions | Confirmed incidents linked to introducing change and a missed check; sample provenance before aggregating |
| Verification cost | p50/p90 for the same scoped command, with lease wait and retries separated |
| Human intervention | Corrections per completed pilot task, categorized by intent, missing context, tooling, or proof |
| Guardrail reach | Existing worktrees with usable hook chain; live harness observations recorded separately |
| Dispatch operation | Qualified issue reaches session and returns linked evidence; do not infer operation from prompt text |

Fable's reported 205 merged PRs, 137 fix-labelled PRs, and 376 harness-touching commits are useful
leads for sampling. The raw records, exact cutoff, exclusions, and classification were not
reproduced here. They do not establish escaped-defect rate or engineering-effort allocation.
Private memory volume is likewise not a quality metric or a deletion target.

A calendar-only promotion after two weeks is insufficient. Promote a selected check when it
catches its named negative cases, replays reliably, has acceptable observed cost, exposes all
skips/blocked capabilities, and passes review of scope and evidence labels. Preserve existing
policy until that explicit decision.

## Decisions still needed before dependent implementation

- Select the implementation slices and confirm the existing post-release gate has been met or
  explicitly changed. This planning request does not change it.
- Approve any new dependency separately: a dedicated accessibility package or a property-testing
  library is optional. Existing tools can support the first bounded proof without installation.
- Approve any change to authenticated-browser policy, blocking hooks, automatic retry semantics,
  or scheduled automation separately. None is a prerequisite for SF01–SF04.
- Worktree/branch deletion, private-memory edits, external records, dispatch, publication, and
  merge remain separate actions. A doctor or plan does not authorize them.

## Evidence ledger and limits

| Check | Observation | Limit |
|---|---|---|
| Current checkout | `develop` at the source SHA above; unrelated application changes present | This is not a clean-tree product-validation receipt |
| Earlier audit: diagnosis plan | Selected Shared, Client and Agent tests for then-current dirty paths | Rendered only; those suites were not executed by that audit |
| Earlier audit: web doctor | Ready, zero failures, four stale service leases | Readiness only; no rendered or authenticated proof |
| Earlier audit: hook fixtures | 44/44 passed through `node scripts/dev/node-cli.js node --test scripts/harness/agent-hooks.test.mjs` | Synthetic registration/script proof; not live Desktop loading |
| Earlier audit: local profile probe | Smoke requires stack and suppresses webServer; web profile resolves development/development/42161 from test/test/11155111 input | Pure resolution, no servers started |
| This comparison: worktree inventory | 55 registrations; 3 absent, 39 configured executable pre-push files, 13 configured files missing | Read-only configuration/file inspection; no hook execution or setup repair |
| This comparison: Address compiler probes | Client and Admin report unused `@ts-expect-error` for a non-hex Address assignment; both reject the control string-to-number assignment | Temporary no-emit configs extended each full app project. Both compiler invocations exited 1; other diagnostics were present. No package-wide typecheck pass is claimed |
| Source checks | Route errors/overflow enforced; optional auth assertions weak; contract push fork jobs configured; delegation contract present | Configuration is not fresh CI, cloud-operation, or browser proof |

The initial compiler-API probe could not run because the installed TypeScript package does not
expose the older API at its root. The successful diagnostic probes used its installed compiler
CLI instead. Temporary sources, configs, and build-info files were removed with their temporary
directory; no app source or compiler setting was changed. Document-validation results belong in
the live [evaluation record](../eval.md), keeping this dated report immutable.
