# Release QA cohesion follow-up

Status: implementation complete; publication requested. Complete local critical validation, push gate and current-head CI are in progress. Existing aggregate hub state is preserved.
Initial base: origin/develop 18d60000a8c1098b967f19e9f12dcd36545eda47. Publication base: origin/develop aaacc1b14665dc97e1d9400fbcb70d930220ec6f, integrated on the isolated branch.
Owner: Codex; existing Commitment Pooling and Steward Cockpit hubs keep their aggregate execution state.
Issue context: PRD-1137; related PRD-1148, PRD-1149, PRD-1150, PRD-1151. Existing priority walkthroughs remain independent release evidence.

## Accepted scope

| Area | Required behavior | Owner / proof |
|---|---|---|
| Back navigation | Device/browser and on-screen Back restore origin dashboard, tab, filters and scroll; unrelated navigation and direct links do not reopen stale sheets | Lead integration through real shell/router |
| Draft entry | Resume compatible account/chain/garden/action work; linked drafts must match exact promise and requirement. Preserve incompatible work and start a separate draft. Respect draft limit and outgoing save ordering | Draft lane; cold/warm integration |
| Completion | Garden Work foregrounds required linked work and approvals; support/service foregrounds proof and eligible lead submission; role/permission/lifecycle rules stay authoritative | Promise lane; action/status cases |
| Work picker | Show readable promise/requirement progress; retain exact requirement identity and optional ordinary-work unlink. Submit new work remains offered when eligible existing work exists | Promise lane; picker tests |
| Queue recovery | Name unsent operation; distinguish manual wallet send, background send and chain confirmation; retain in-flight/discard guards | Promise lane; recovery cases |
| Identity | Identify the connected reader as You consistently in provider/requester/confirmer context and explain role in creation review | Promise lane; identity/role tests |
| Creation | Clarify first-step choices while retaining all three meaningful commitment types and independent grouped children | Promise lane; existing creation proof |
| PWA green | One theme-aware interactive foreground for active labels/icons/indicators; preserve action fills and independent status/domain colors | Visual lane; light/dark rendered proof |
| Assessments | Existing domain icon + label + restrained accent on record lists/cards; outcome definitions once per collection with row labels/errors and accessible associations | Visual lane; admin/client tests and rendered proof |

## Reuse and ownership

Navigation extends existing WorkDashboard return state and React Router history, closing the AppShell/controller conflict; no new routing framework. Draft entry remains owned by useDraftResume and the work controller. Promise presentation uses existing eligibility selectors, sheet primitives and queue notices. DomainBadge and DOMAIN_CONFIG own domain markers; StrategyKernelStep owns collection instructions. Public exports are added only for genuine client consumption, with no dependency changes.

## Sequencing and proof

1. Draft, promise and visual lanes implement independent files; locale merging stays with lead.
2. Navigation integration follows in the same isolated checkout, coordinated around GardenCommitment and Garden/index back handlers.
3. Run focused tests, then current selector for checkpoint/critical overrides. Route/build, locale parity, source structure and applicable story/token checks remain required.
4. Capture labeled rendered proof at narrow/desktop sizes and light/dark themes. Authenticated device proof remains pending if the real signed-in Brave session cannot be reached.
5. Inspect combined diff, record actual results and remaining limits. No commit, push, merge, deployment, or external issue mutation is included in this authorization.

## Start gate

2026-10-07: both owning hubs' linear-sync manifests ran. stateSyncMode is preserve_existing; every listed parent/lane action is preserve. No Linear writes were made.

## Evidence

All results below exercised the jointly dirty isolated checkout. HEAD remains the base SHA; it does not represent these edits. The original shared checkout was not edited. No commits, branch changes, external issue writes, or publication occurred.

| Proof | Observed result |
|---|---|
| Final focused client tests, 11 files | 203 passed |
| Final focused shared tests, 9 files | 119 passed |
| Final focused admin tests, 3 files | 34 passed |
| All 13 registered module-seam proof files | 274 passed; 6 existing governed skips |
| Checkpoint format, full lint, validation-system tests, test-quality | Passed; validation-system suite 386 passed |
| Source structure against base | Passed, 65 changed non-test sources; 7 existing baseline violations unchanged |
| DesignMD lint (all 5 owners), generated outputs, token and vocabulary guards | Passed |
| Story coverage and story quality | Passed, 305 required surfaces and 272 story files |
| Staged modules, agent guidance, guidance links, immutable reports, Plan Hub validation and tests | Passed |
| `git diff --check` | Passed |
| `node scripts/dev/ci-local.js --intent checkpoint` | Failed at shared-typecheck; dependent checks stopped as required |
| Rendered browser proof | none: Storybook started in this checkout but its module-mock loader failed before a component rendered |

Focused tests include a composed real AppShell/router/store regression for both on-screen and history Back, Forward, nested routes, explicit close, unrelated Home, and account reset. Draft integration covers warm/cold entry, compatible/incompatible promise work, retained media, limits, outgoing saves, and recovery. Query rewrites retain the history marker. Promise checks cover eligible primary linked work, readable choices, exact repeated requirements, all approved states, and operation-specific queue recovery. Tests remain DOM/unit evidence, not installed-PWA or authenticated browser proof.

The checkpoint's shared source typecheck reports missing already-declared `@zerodev/sdk` and `@zerodev/permissions` imports in unchanged agent-reporting modules, plus consequent type diagnostics. The reused installation also lacks `@zerodev/webauthn-key`. User approval for `bun install --frozen-lockfile` in this checkout remains pending under AGENTS.md's dependency-install rule. No package was installed or upgraded and the lockfile is unchanged.

Checkpoint-dependent shared/client/admin test typechecks and package-wide suites, Agent typecheck/tests, and browser-work-exploration remain unrun. The remaining independent static/design/guidance checks were run separately and passed; they do not make the checkpoint pass. Root build remains unverified. After dependency approval, recover an isolated installation without writing through library links into the original checkout, rerun the same complete critical checkpoint, build, and capture light/dark and narrow/desktop rendered proof. The Storybook loader error may require additional bounded diagnosis; dependency recovery has not yet demonstrated its cause. Authenticated installed-PWA Back proof remains pending if the real signed-in Brave session cannot be reached.

## Sensitive surface record

- `packages/shared/package.json`: one public export for the shared dashboard-navigation hook; no dependency changes.
- `scripts/data/module-seam-registry.json`: only four fingerprints and review dates refreshed after bounded seam review and all registered proof files passed. No proof paths, lifecycle criteria, or debt baselines changed.
- Root/PWA design guidance and design skill language/decision log: accepted interactive-green and once-per-collection instruction decisions recorded; token values and permissions unchanged.
- Existing hub aggregate state and Linear records are preserved. This follow-up does not certify historical or release lanes.

## Task record

Task: final release QA cohesion | Type: fix | Outcome: partial (implementation complete, verification pending).
Agent/model: Codex/GPT-6 | Coverage: isolated implementation segment beginning 2026-10-07 06:52:22 UTC.

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| investigate | 2026-10-07 06:52:22 → unknown | Approved worktree, accepted scope and integration boundaries established |
| implement | unknown → 2026-10-07 07:26:57 | All source lanes completed; endpoint from final navigation handoff |
| verify | 2026-10-07 07:20:15 → 2026-10-07 07:36:08 | Registered and combined focused proofs plus checkpoint/static guards above |
| review | unknown → ongoing | Combined diff and sensitive surface inspection; no domain eligibility or queue guard changes |
| wait | unknown → ongoing | Explicit locked-dependency install approval pending; rendered proof and complete critical checkpoint remain open |

Human corrections: 0 in this segment; attention unknown. Overlapping agent phases are not summed as task duration.

## Publication continuation

The user requested a pull request and ready-for-review transition, then explicitly approved `bun install --frozen-lockfile`. The frozen installation completed without a lockfile or dependency declaration change. Reused library links were detached first so installation did not write through them into the original checkout. No credential-bearing root environment was copied; Storybook uses non-secret test configuration and synthetic fixtures.

Branch: `fix/release-qa-cohesion`, as required by the executable branch policy. Design standards were committed separately from the admin implementation. Latest develop recovery behavior was integrated, retaining the authoritative address comparison helper and shared dependent-link payload. Presentation tests cover both garden sources, casing, and unavailable-selection identity.

Fresh merged evidence: 16 Shared files passed, 310 tests with 6 existing governed skips, including every certified seam's registered proof and the integrated wizard/presentation/intent boundaries. The four seam fingerprints and review dates were refreshed after this review and proof. Shared source and test/story typechecks and Client test/story typechecks pass; the corrected draft integration fixture retains 17 passing cases. The complete local gate is still in progress; no full-gate or CI-readiness claim is made here.

Rendered proof: **Storybook in Brave, synthetic fixtures, 2026-10-07**, serving this isolated checkout. The promise picker was inspected at 375×812 and 1280×800 in light/dark themes; keyboard radio movement kept the sheet open and Done retained the exact requirement. The client Solar assessment card and the admin list's four distinct domain icons/labels rendered. The admin outcome story rendered four field rows with one shared definition collection and preserved row labels. Initial mock-loader failure disappeared after isolated installation. A newly observed BigInt controls-panel failure was corrected by disabling the generic control for the structured fixture; the picker itself retains typed BigInt requirement identities. Authenticated installed-PWA proof remains pending and is not represented by this Storybook evidence.

Task record: final release QA cohesion publication | Type: fix | Outcome: ongoing.
Agent/model: Codex/GPT-6 | Coverage: publication continuation after user authorization, UTC start unknown.
Phases entered: investigate (latest base and publishing rules); implement (integration and bounded story/test fixture corrections); verify (fresh merged proofs, typechecks and rendered Storybook); review (staged source and sensitive surfaces); publish (local commits, PR not yet created); wait (dependency approval resolved).
Human corrections: 0; attention unknown. Final publication SHA, Push Gate and CI results belong in the PR and chat closeout, without recertifying the existing hubs' historical lanes.
