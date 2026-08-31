# Client PWA Platform Hardening Evaluation Plan

## Release Gates

1. Correctness: native navigation, update lifecycle, offline shell, share import, and badges match the locked states.
2. Performance: all startup, preload, route, and shell budgets pass from a production manifest.
3. Regression safety: public content, Brave fallback, admin AppProvider consumers, and offline queue behavior remain intact.
4. Evidence quality: behavior changes have RED/GREEN proof; generated artifacts are inspected after build.
5. Device proof: WebAPK-only claims remain blocked until observed in physical Android Chrome.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Install/launch | Open App is an unprevented `/home` anchor when verified installed | `ui` | Component test + Android |
| AC-2 | Bootstrap graph | Public closure excludes PWA-only modules and meets 450 KiB | `ui` | Build checker |
| AC-3 | Update/registration | No unconditional activation; registration works without SyncManager | `state_api` | Unit + generated SW |
| AC-4 | Offline/storage | Signed-in/out `/home` cold-load; drafts/jobs survive eviction | `state_api` | Unit + browser |
| AC-5 | Share/badge | Valid share imports once; invalid/expired input is safe; badge precedence holds | `ui`, `state_api` | Unit + Android |
| AC-6 | Regression | Public, PWA, Brave, admin provider, and job queue checks remain green | `qa_pass_1` | Selected gates |
| AC-7 | Final review | No remaining PWA lifecycle or graph regression | `qa_pass_2` | Review + fresh validation |

## Test Strategy

- Unit: install evidence, capability predicates, update state, quota eviction, share validation, badge mapping, build budgets.
- Integration: bootstraps/routes/providers, draft import/auth redirect, SW registration/update messages, generated shell manifest.
- Browser: authenticated Brave public/PWA flows and offline reload.
- Device: physical Android Chrome install/open/share/badge and two-deployment update flow.
