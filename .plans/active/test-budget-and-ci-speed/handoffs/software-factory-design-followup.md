# Software Factory: Design verification follow-up

Status: all scoped improvements applied and published in [PR #1044](https://github.com/greenpill-dev-guild/green-goods/pull/1044), targeting `develop`. PR head: `938543e0b40ea21d5073d887aa9541837e751153`. All six current-head CI workflows pass.

Stage-status follow-up: the new major comment is valid. A Node import failure or sed status 1
could be accepted as no matches. Commit `938543e` permits status 1 only in each collector's grep
stages and remaps non-grep status 1 to error 2. All seven callers were updated. Actual missing
module imports reproduced the defect; 13 token tests now pass, including sed/sort failures,
source-read failures and clean no-match scans. Full tokens, docs-generated (20), shell syntax,
Oxlint and test quality pass. All six current-head workflows pass, including Linux regression
tests and Storybook. The local process-list blocker remains;
no identical unavailable gate was retried or represented as passing. Publication retains the
existing disclosed exception. No GitHub replies or thread resolutions were performed by this agent.
The final live read records both scanner threads resolved; the unsupported digest thread remains
open with its explanation in the PR description.

Review follow-up: CodeRabbit's documentation digest concern is unsupported: both declared
values match the authoritative generator and all 20 projections pass. Its Python normalization
adds a second trailing newline. The source-scan error masking is valid and repaired in `0faae9d`:
all seven affected collectors preserve pipeline errors; unreadable-source and no-match fixtures
pass (11 token-usage tests total). Full token scan, syntax, Oxlint and test quality also pass.
All six current-head CI workflows passed, including Linux Design regressions. Both review threads
remain open; the unsupported digest finding is explained in the PR description.
The prepared-tree harness attempt passed 385/386; the process-list capability remains denied.
Publication follows the existing disclosed exception; no test or permission weakening. No review
replies, reactions or thread resolution were performed.

Publication continuation: a separate temporary checkout matched the current GitHub base commit
and tree exactly. All 16 task paths were committed, the pre-commit hook passed, and the
post-commit push gate passed all 10 checks. The focused Client reporting suite passed 30 tests.
The earlier reporting application blocker is resolved; the original investigation and temporary
browser-proof details below remain historical evidence.


CI follow-up: the original head passed Design (including Linux Storybook and installer setup),
Client, Admin and Docs. CI Gate found a missing Design workflow-selection entry; the supply-chain
scanner mistook an artifact-only `hashFiles` probe for cache usage. Both repairs are committed and
published in `8467f85d0d8065eb2fa04533af32594e9c0966fa`, following the renewed user instruction to
commit and push after the local capability limitation was disclosed. All 99 selector tests, five
installer/probe tests and the pinned supply-chain audit pass. All six current-head workflows pass: CI Gate, Supply Chain Guardrails, Client, Admin, Docs
and Design. Linux Storybook passed interaction tests, audit probe/upload and installer setup.

The local push gate remains blocked: this permission profile denies `/bin/ps`, even with escalation.
No tests or permission settings were weakened. A separate proxy-warning fixture passes when only
the experimental UNDICI-EHPA warning is suppressed. The new full CI Gate fixture command yielded
222 passes plus that single local warning-related failure, now passing in the focused rerun.

## Changes

1. **Token checks distinguish comments from code.** The source collector masks parsed TS/TSX
   comments and CSS comments, then reapplies the same grep expression. Comment-like strings,
   regular expressions and CSS URLs remain code. Original hit rows preserve exact debt receipts.
   Invalid source, input or expressions fail the guard; existing baselines were not expanded.
2. **Storybook generates its own PWA audit.** Design CI calls `md-generate.mjs --check` in the
   Storybook job and uploads its audit before subsequent token/browser checks. The upload also
   runs after a generator failure if the artifact exists, retaining contrast and stale-token
   diagnostics. Static Storybook output has its own artifact.
3. **Installer retries own the privileged dependency process.** The shared setup action runs
   the pinned Playwright CLI under a privileged timeout for system libraries. Chromium downloads
   stay unprivileged. Existing attempt, grace, retry and caller deadlines remain bounded. Setup
   exhaustion identifies an environment failure before browser tests have started.
4. **Reporting text-fit proof runs on every platform.** The source patch removes the Apple-only
   natural-wrap gate, exercises the shipped font and Arial fallback, and checks actual overflow
   in English, Spanish and Portuguese at 320px panel width. The heading reserves two title lines
   and can grow with enlarged copy. Clipping diagnostics are collected in one assertion per font
   to stay within the existing test timeout.

The sensitive surfaces changed are the shared Playwright setup action, Design CI and design
validation tooling. Dependencies, debt baselines and permission settings were preserved. The
script registry and generated GitHub Actions projection were updated from their authorities.

## Application boundary

The primary checkout is on `develop` at `c4a9487350c6739de54bcc2737dd2a972223243f` and has
concurrent edits. Those edits were preserved. It lacks the reporting pages.

The attached `ci/software-factory-verification` checkout is at
`ce5b455c1c8b213d3ac2ecd0c440d46ba92766ae`. The affected reporting sources matched published
`develop` at `690db2aaaf971caf5c08fdea06b0b06e64aeec36` during this investigation. Attempts to
write that attached checkout returned `EPERM`, including after refreshing its attachment.

The [reporting patch](software-factory-design-followup-reporting.patch) contains only three
reporting source files. It passes `git apply --check` against the attached checkout. A temporary
tracked-file snapshot was used for proof, with dependencies linked from the attached checkout.
Temporary browser-provider, port, filesystem-allowlist and Storybook-selection settings are
excluded from the patch. The reporting changes are not yet applied to repository source files.

## Verification

- `node --test scripts/design/check-guidance-examples.test.mjs scripts/design/token-usage.test.mjs scripts/design/md-generate.test.mjs scripts/dev/playwright-setup.test.mjs` — 53 passed.
- `bash scripts/design/check-tokens.sh` — passed, including existing exact baselines.
- Focused Oxlint on the four new script files — passed with `--deny-warnings`.
- `bash scripts/quality/check-test-quality.sh` — passed.
- `node scripts/docs/generate.mjs --check --scope workflow` — passed after generation.
- Guidance links, guidance consistency and routing scenarios — passed in this task segment.
- Scoped `git diff --check` and shell syntax check — passed.
- Temporary reporting snapshot: `bun run --cwd packages/client typecheck`, focused Oxlint and
  Biome formatting of the three reporting files — passed.
- Reporting browser proof: **Storybook / Codex in-app Chromium 154 / synthetic fixtures**.
  Three layout stories passed with real geometry, three locales and two font profiles. The final
  run took 16.37 seconds of tests; the existing 15-second per-test deadline was not increased.
  Before the heading fix, the ungated check reproduced the historical 112px versus 88px mismatch.

## Remaining proof and next action

Apply the reporting patch to a writable checkout with the matching current sources, then rerun
focused Storybook proof there. Run current-head Linux CI after publication to verify the real
privileged installer and native Linux font profile. Installer fixtures prove command ownership,
retry and budget behavior; they do not simulate actual root process termination.

The combined local validation executor cannot inspect the protected root `.env` under this
session's permission profile. Its selected concrete checks were run directly. A standard
headless Chromium launch was also blocked by macOS process permissions; the final rendered proof
used the in-app browser and a temporary manual Vitest provider. Some manual proof attempts timed
out during connection/instrumentation before the final passing run. No authenticated-session
proof is claimed.

The full generated-doc check still reports pre-existing drift in `commands.mdx`, `api-index.mdx`
and `test-cases.mdx`. No full-workspace or merge-readiness claim is made from this scoped proof.

Task record: Software Factory Design verification follow-up | Type: fix | Outcome: partial
Agent/model: Codex / unknown | Coverage: this implementation turn

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | unknown | Compared affected sources; confirmed current checkout and write constraints. |
| Implement | unknown | CI/tooling changes applied; reporting changes prepared in temporary snapshot. |
| Verify | unknown | Focused results above; reporting source patch passes application check. |
| Wait | unknown → ongoing | Awaiting a writable current checkout; isolation request has no recorded reply. |

Human corrections: 0 observed in this segment; attention: unknown.
