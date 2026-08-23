# Module Seams and Velocity Spec

## Summary

This program improves agentic delivery speed by fixing module boundaries before optimizing the test
runner. It begins with the validation harness, then introduces direct seams around mutations and
controllers, narrows shared public imports, splits oversized composition surfaces, completes the
remaining shared and UI module inventory, strengthens indexer tests, and finally routes DOM-free
tests through Node projects. One execution sub-lane owns one worktree and one pull request.

## Research Evidence

- Baseline: `develop@2cd115a1d`, the post-Commitment Pooling merge audited by the supplied Module
  Health and Velocity Scorecard artifacts.
- Live reconciliation: `develop@ca9704ce6` on 2026-08-23 is clean, contains no
  `module-seams-and-velocity` hub, and still has the named Wave 0 gaps: strict intents set
  `fullRepository`, compatibility re-exec remains local to `node-cli.js`, pre-push omits source and
  generated-design guards, the three Vitest configs retain nested `thresholds.global`, and no
  coverage-nightly workflow exists.
- Reference seams: `packages/shared/src/modules/commitment-pooling/job-types.ts`,
  `packages/shared/src/modules/transactions/wallet-sender.ts`, and
  `packages/shared/src/hooks/commitment-pooling/useCommitmentPoolSetupSequence.ts`.
- Existing execution contract: `.plans/active/validation-system-optimization` remains blocked on
  eight temporary Validation Receipt waivers, five of which belong to that hub.

## Human Judgment Points

- Afo approves merges that touch Job Queue, Work mutation hooks/providers, auth, vault mutation
  hooks, contract tooling, or other critical surfaces.
- Claude owns CI workflow, package-script, repository-guidance, design, accessibility, and receipt
  burn-down lanes, and reviews every Codex lane before merge.
- `fallback` and `disputed` confirmation rows defaulting off in the client is a product decision and
  must remain visible in review.
- Card Endow activation and contract changes that require redeployment remain deferred.
- A lane that cannot produce fresh, commit-attributable proof becomes blocked. Receipt deadlines are
  not extended to preserve a passing status.

## Program Invariants

- One execution sub-lane equals one worktree and one pull request against `develop`.
- Branches use `<type>/<work-description>` and never contain an agent name, Linear identifier, or
  bare orchestration lane name.
- New source files stay at or below 350 lines. Modified source files stay at or below 500 lines.
  Frozen ceilings may not grow and must be lowered in the commit that shrinks them.
- Use `bun run test`, never `bun test`, and Bun wrappers for every Foundry operation.
- React hooks live in `packages/shared/src/hooks`; consumers use only declared
  `packages/shared/package.json#exports` paths.
- Preserve user-visible error strings byte-for-byte unless a lane explicitly owns copy.
- New user-facing strings ship in English, Spanish, and Portuguese.
- Validation follows `bun run validation:plan -- --intent qa --changed <paths>` per lane, plus the
  lane's direct proof, source-structure gate, Ship Gate, conditional gates, review, CI, and a fresh
  Validation Receipt.

## Wave Registry

### Wave 0: validation harness

| Lane | Owner | Depends on | Outcome |
|---|---|---|---|
| `w0_prepush_static_checks` | Claude | none | Pre-push runs source-structure and generated-design checks. |
| `w0_toolchain_reexec` | Codex | none | `ci-local` re-enters through a compatible Node and toolchain without looping. |
| `w0_path_scoped_strict_intents` | Codex | none | Push, ship, and local merge become path-scoped while readiness and release remain full. |
| `w0_vitest_worker_cap` | Codex | `w0_toolchain_reexec` | Local Vitest workers respect CPU, memory, and concurrent batch share. |
| `w0_load_sensitive_tests` | Codex | none | The five measured load-sensitive tests pass repeatedly without retries or broad timeout inflation. |
| `w0_coverage_floors_nightly` | Claude | none | Real flat floors run nightly and on `main`; PR jobs run plain tests. |
| `w0_turbo_test_routing` | Codex | `w0_path_scoped_strict_intents` | Eligible local package tests route through Turbo with safe consumer inputs. |
| `w0_turbo_guidance` | Claude | `w0_turbo_test_routing` | Iterative guidance points to cache-aware tests and accurately describes scoped Ship intent. |
| `w0_receipt_debt_burndown` | Claude | toolchain, scoping, Turbo | Eight waivers are replaced by fresh receipts, and Validation System Optimization is archived. |

### Wave 1: mutation seams and pooling controllers

| Lane | Owner | Depends on | Outcome |
|---|---|---|---|
| `jobqueue_create_deps` | Codex | Wave 0 | Constructable Job Queue, explicit ports, test fakes, stable singleton wiring. |
| `sender_conformance` | Codex | none | Shared sender conformance laws and reusable transaction fakes. |
| `work_submit_command` | Codex | Job Queue, sender | Directly tested 15-branch work submission command. |
| `work_simulate_passkey_executor_deps` | Codex | Job Queue, sender | Injectable simulation, passkey, and executor boundaries with direct coverage. |
| `pool_controller_contracts_and_fixtures` | Codex | Wave 0 | Explicit pooling controller contracts and typed fixtures. |
| `pool_console_controller_suite` | Codex | controller contracts | Direct suite for pool-console behavior and timers. |
| `hub_confirm_queue_controller_suite` | Codex | controller contracts | Direct suite for confirmation ordering, authority, search, and actions. |
| `admin_pool_view_tests_typed` | Codex | controller contracts | Admin pooling view tests use typed shared fixtures without unsafe bags. |

### Waves 2 and 3: shared module seams and composition

| Lane | Owner | Depends on | Outcome |
|---|---|---|---|
| `app_telemetry_port` | Codex | none | Telemetry sink registration behind the existing tracking policy. |
| `pooling_job_shape` | Codex | Job Queue | Canonical pooling job identity and payload conversion. |
| `indexer_reader_port` | Codex | none | `GraphQLReader` port, EAS parser split, canonical data fixtures. |
| `pool_read_repository` | Codex | reader port | Commitment-pooling read repository with default-bound compatibility exports. |
| `ipfs_conformance` | Codex | telemetry | Gateway and pinner ports with conformance rows. |
| `pool_documents_adapter` | Codex | IPFS | Commitment document store injected into pin/read hooks. |
| `hypercert_repository` | Codex | reader, IPFS | Hypercert repository across SDK, indexer, EAS, and documents. |
| `vault_yield_repository` | Codex | reader | Repository result model for vault and yield reads. |
| `translation_port` | Codex | telemetry | Browser translator and cache ports with API-shape detection. |
| `auth_session_adapters` | Codex | telemetry | Session storage and passkey adapters with `authServices.ts` below ceiling. |
| `composer_proof_drafts` | Codex | Job Queue | Proof draft repository over IndexedDB and media resources. |
| `vault_crowdfunding_commands` | Codex | none | Split the 1,646-line vault crowdfunding module behind a curated index. |
| `stores_domain_transitions` | Codex | none | Pure transitions for four domain stores. |
| `work_approval_command` | Codex | work submit, sender | Direct approval and batch-approval commands. |
| `garden_assessment_action_commands` | Codex | approval command | Garden, assessment, and action mutations move behind commands across three PRs. |
| `domain_hooks_thin` | Codex | repositories and Job Queue | Stable hooks accept fakes through optional dependency boundaries. |
| `providers_thin` | Codex | Job Queue, auth | Work, Auth, and App providers become composition-only. |
| `ui_shell_contracts` | Claude | none | Direct toast/navigation contracts and Storybook coverage. |
| `commitment_pooling_subpath` | Codex | client hook barrel | Declared pooling subpath, consumer migration, and lower root-barrel ceiling. |
| `client_ui_barrel_and_garden_commitment_controller` | Codex | controller fixtures | Shared client hook barrel and direct Garden Commitment controller. |
| `client_garden_commitment_view_adoption` | Codex | client controller | Garden Commitment view becomes controller-driven and smaller. |
| `client_proof_composer_controller` | Codex | client barrel | Proof composer controller and pure readiness model. |
| `client_commitment_composer_controller` | Codex | client barrel | Commitment composer controller and pure beat validity model. |
| `admin_community_tab_split` | Codex | controller fixtures | Delete `CommunityTab.tsx` and split mode-specific surfaces below ceiling. |
| `admin_community_cockpit_polish` | Claude | Community split | M3 design and accessibility pass with no behavior change. |

### Wave 4: remaining client and admin modules

| Lane | Owner | Depends on | Outcome |
|---|---|---|---|
| `client_garden_pool_controller` | Codex | client barrel | Garden Pool controller over queue and pooling hooks. |
| `client_claim_components_tests` | Codex | commitment view | Direct high-coverage claim component tests. |
| `client_commitments_drawer_projection` | Codex | confirm controller | Shared confirmation projection consumed by the client drawer. |
| `client_work_submission_flow_controller` | Codex | client barrel | Work wizard flow model/controller; frozen view below 500 lines. |
| `client_work_detail_view_model` | Codex | client barrel | One Work detail view model; frozen view below 500 lines. |
| `client_wallet_send_machine_and_scanner_port` | Codex + Claude | none | Send reducer, scanner port, controller, and fake-driven scanner test. |
| `client_login_controller` | Claude | none | Login effects move behind a shared controller; view below ceiling. |
| `client_public_surface_state_selector` | Codex | none | Pure loading/error/empty/ready selector adopted by non-frozen views. |
| `client_public_surface_state_adoption` | Claude | selector | Shared component, stories, and frozen public-view adoption. |
| `card_endow_staging_check` | Codex | none | Staged Card Endow modules remain marked and unwired. |
| `card_endow_state_machine` | Claude | staging, sender | Deferred until activation is scheduled. |
| `client_interactive_components_tests` | Codex | none | Direct interaction contracts for six general components. |
| `admin_canvas_shell_controller` | Claude | client barrel | Canvas shell effects move behind an admin controller. |
| `admin_hub_workbench_policy` | Codex | none | Hub stage and selection routing becomes pure policy. |
| `admin_pool_setup_flow_composition` | Codex | typed pool views | Setup flow composition directly covers every intent. |
| `admin_seed_howmuch_and_dialog_tests` | Codex | typed pool views | Seed and pooling dialogs receive direct validation tests. |
| `admin_submit_work_controller` | Codex | controller fixtures | Submit Work moves behind a shared controller and below ceiling. |
| `admin_action_editor_controller` | Codex | none | Action editor/view derivations move behind controller and model seams. |
| `admin_cookie_jar_hook_outcomes` | Codex | sender | Cookie Jar mutation outcomes use the common sender fake. |
| `admin_assessment_hypercert_transitions` | Codex | none | Explicit dirty-state transition tables cover every close path. |
| `admin_account_profile_controller` | Codex | client barrel | Account Profile becomes props-only over a shared controller. |
| `admin_route_registry_redirect_policy` | Codex | none | One redirect policy replaces route-string concatenation. |

### Wave 5: indexer

| Lane | Owner | Depends on | Outcome |
|---|---|---|---|
| `ix_event_builders_and_projection_assertions` | Codex | none | Shared event builders and fact-oriented projection assertions. |
| `ix_settlement_message_fixtures` | Codex | event builders | Cross-chain settlement message fixtures replace raw IDs. |
| `ix_celo_executor_redelivery` | Codex | settlement fixtures | Executor redelivery and mismatch behavior specified at the public seam. |
| `ix_credit_registry_delivery_contracts` | Codex | event builders | Reusable reorder, replay, and relationship delivery laws. |
| `ix_yield_cluster_separation` | Codex | event builders | Yield cluster uses shared events and enforces handler separation. |
| `ix_helpers_types_split` | Codex | yield separation | Handler helpers split by concept; dead generated types removed. |
| `ix_contract_events_auto_select` | Codex | strict scoping | Real mined-log integration selected under strict impacted intents. |
| `ix_hasura_permission_planner` | Codex | none | Pure permission planner; shell reduced to transport and retry. |

### Wave 6: test architecture

| Lane | Owner | Depends on | Outcome |
|---|---|---|---|
| `ta_node_projects_shared` | Codex | worker cap, load fixes | Shared DOM-free tests run under a Node Vitest project. |
| `ta_node_projects_admin_client` | Codex | shared projects | Uniform Node/jsdom project split for admin and client. |
| `ta_direct_tested_seam_rule` | Codex + Claude | none | Baseline-backed direct-tested-seam guard and canonical testing guidance. |
| `ta_coverage_ratchet` | Claude | coverage nightly | Raise measured floors by two points starting 2026-09-22. |

## Risks and Mitigations

- Import-graph changes can silently break consumer mocks. Migrate public exports additively, run
  consumer tests and Storybook, then remove old root exports.
- Job Queue extraction can bifurcate singleton state. Require a wiring test against the exact event
  bus and IndexedDB store before merge.
- Local performance results are load-sensitive. Record machine state, compare quiet baselines, and
  require repeated runs before adopting worker or project changes.
- Coverage floors can appear enforced while nested under `global`. Keep flat-shape parity fixtures
  and enforce on nightly and `main`.
- Hasura permission automation can widen policy. The pure planner preserves any restricted or
  malformed policy and never rewrites it automatically.
- The work spans protected files. One-lane path globs, Claude review, conditional gates, and Afo's
  critical-surface approval bound each pull request.
