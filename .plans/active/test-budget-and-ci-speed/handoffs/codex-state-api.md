# Test budget and CI feedback — implementation handoff

## Current state — 2026-10-04

SF03 is locally qualified after the fourth batch: the full Admin browser project passes 12
cases with one declared fork-only skip and zero retries. The repair aligns the smoke fixture's
RPC garden with its indexer garden. The earlier hydration-loader timeout did not reproduce and
is not claimed fixed. See the [fourth-batch handoff](software-factory-batch-4.md) for exact evidence.
SF10's actual Codex session/edit-hook observations are recorded in the architecture hub;
Claude Desktop Code remains pending. SF09 reporting and SF11 Address repair remain locally
accepted per the [third-batch handoff](software-factory-batch-3.md). The hub stays active.
No commit, push, PR, deployment or Linear write occurred. September records below are historical.

## Historical state — 2026-09-27

The remaining local consolidation is implemented on the existing `develop` checkout, based on `87938a7308d3933f61eebd9e02d27e921df60f5b`. The user authorized a local commit on September 27; the evidence below was collected before commit. Client whole-suite verification is blocked by DetailsGate timeouts; Shared full coverage, focused Admin/Agent proof, type checks, Agent build and quality checks passed. See [Snapshot 06](../reports/2026-09-26-snapshot-06.md) for exact results and limits and [the plan](../plan.todo.md) for the live checklist.

- Helper adoption: 29 Shared files and two Admin providers; retained batch-approval cache, Client persistence and custom-provider/network exceptions.
- Settlement pruning: six caller-free exports and five exclusive test cases removed; live recognition/delivery/authority code and staged Card Endow work preserved.
- Store conformance: eight common cases run on memory and real SQLite; adapter encryption and restart proof retained.
- Consolidation: five stale WithdrawModal mocks removed and the PostHog throttle case moved into its existing subject. Layout/CSS guards remain because equivalent rendered fault detection is absent.
- Historical September 20 locale/Git blockers are not current findings. Current AGENTS.md owns browser-evidence policy. No visible runtime behavior changes; rendered proof is `none`.

## Proof and remaining obligations

The local slice preserves runtime behavior; the new conformance cases expose existing behavior. A deliberate scratch revision bypass was caught, then restored. The historical tooling RED/GREEN proof remains in [eval.md](../eval.md) and `status.json`; do not invent a new pre-implementation RED for mechanical refactors.

The first overlapping broad runs were aborted after timeouts. Shared passed when rerun alone with two workers. Client's 23-template test hit its unchanged timeout in the full two-worker run and one focused run, then passed with both the original runtime source and the restored cleanup. The final full one-worker Client run also hit timeouts in that case and Infrastructure Milestone (1,410 passed / two failed). The proposed table refactor awaits scope approval; no Client file has been edited. Do not call the earlier failed run green.

No commit-attributed validation receipt is claimed: these are working-copy checks. Keep the hub active for Client validation, a published implementation identity, current-SHA CI and independent QA. Recent published shard timings belong to other SHAs and are observational; the original twelve-fault definition is unavailable. Only a local commit is authorized; no branch change, push, PR, deployment, Linear write or external scorecard publication is authorized for this slice.

## Historical evidence

The September 19–20 implementation is committed in `9a0a5ac18960730f00d4dff0125286c41f23cb98`. [eval.md](../eval.md) preserves its detailed commands, failures, fixes and coverage measurements. Follow the current checklist rather than the superseded historical instructions.

### Software Factory remaining local implementation — 2026-10-05

SF05–SF08 and SF12 are locally accepted. Seven selected QA checks passed; final selector/runner
115/115, fixture 333/333 and style checks cover the closeout. The source identity, exact commands,
RED/GREEN evidence and pending observations are in
[the fifth-batch handoff](software-factory-batch-5.md). The lane remains in progress because actual
Claude Desktop, five ordinary-task categories and routine-dispatch outcomes are not yet available.
