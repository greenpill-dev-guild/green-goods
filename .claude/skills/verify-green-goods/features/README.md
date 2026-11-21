# Green Goods verification map

The maintained source for verifying user-facing behavior of the Green Goods App (client PWA) and
the Green Goods Hub (admin). Read this index before driving the app, then follow the matching
feature file as the recipe.

## Baseline preconditions

- Dependencies and Playwright's Chromium (`bun x playwright install chromium`) are installed;
  nothing else is needed (no `.env`, indexer, chain or agent).
- `bun scripts/dev/verify-control.ts launch client --run <run-id>` (and `launch admin` for the Hub)
  reported ready, and `doctor --run <run-id>` prints `ok` at the current HEAD.
- The client signs in as `user` (`0x1234…7890`) unless a recipe names another `--role`; the Hub as
  `steward` (`0x04D6…2503`).
- Client data comes from `tests/helpers/mock-backend.ts`: one garden, `Test Community Garden`
  (`0x1234567890abcdef1234567890abcdef12345678`, Nairobi), and one action. Nothing else exists.
- Never drive a server this run did not launch.

## Driving conventions

- Start every recipe from a fresh `drive` call: each call is a new browser page with fresh fixtures.
- Find elements by ARIA role and accessible name as they appear in a `snapshot` step.
- Client paths carry `?presentation=pwa` for the installed-app shell.
- After a navigation, wait with `expect-hidden` or a new-page-only `expect` before capturing.
- Run each recipe at `--width 375` and `--width 1280`.

## Proof and skip reporting

- Proof is the transcript plus an ARIA snapshot and a screenshot of the state the action produced,
  at both widths, labeled `mock-auth localhost`.
- Record the feature ID and the entry point used; a recipe proved through one entry point does not
  prove the others it lists.
- Report an unreachable path with the failing step and the console error the transcript names.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph on the user-visible behavior, then four
H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with
verify-control`, and `Gotchas`.

## Features

- [Explore gardens](./client-explore-gardens.md): the signed-in Explore list and opening a garden.
  Proved end to end on 21 Nov 2026.
- [Sign-in gate](./client-sign-in-gate.md): a signed-out visitor sent to sign in. Proved.
- [Hub shell](./admin-hub-shell.md): the Hub's chrome for a steward. Renders; garden data blocked
  until the Hub fixture is shared.

Not mapped yet, with Playwright specs that already cover them under fixtures: work submission
(`tests/specs/client.work-submission.ci.spec.ts`), work approval
(`client.work-approval.ci.spec.ts`), session navigation (`client.session-navigation.ci.spec.ts`),
offline work and sync (`client.offline-*.ci.spec.ts`), and the Hub's production flows
(`admin.production-flows.ci.spec.ts`). Map each from its spec's fixture before relying on it.
