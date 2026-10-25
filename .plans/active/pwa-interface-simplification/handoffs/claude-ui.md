# PWA Interface Simplification - UI Handoff

## Lane

- Owner: Claude (sessions the orchestrator starts; questions go to the orchestrator)
- Branch: set when work begins using `<type>/<work-description>`
- Status: in progress. Merged: step 3 (#1289, `feature/pwa-home-shell`), step 6 (#1280), step 11 (#1290), step 16 (#1279), step 19 (#1296 when merged); in review: steps 7 and 9 (#1292), step 8 (#1295). Each PR body holds that step's RED/GREEN record, validation receipt and labeled rendered proof; the lane's machine-readable TDD record below is the shell's.

## Scope (first slice)

- Step 3, the Home shell: the shared `GardenChip` with the banner avatar on both surfaces and the
  app's 32px height with a 48px hit area (decision 33), the half-sheet switcher opened through an
  additive callback with one garden too, Explore under Home with one tag per card, the one-time
  chooser, the no-garden Home, the sticky header with a hairline once scrolled.
- The interface parts of step 4: no garden pin; one line under the steps when the submission
  garden differs from the active one (decision 28).
- Step 6: Profile's list on the membership owner, strings in three languages, stories for the five
  Home states. The decision-log rows and the PWA design guide's text for the first slice land in
  the guides PR before the code.

## Facts for the build (2026-10-24)

- Home's header today: the title, then Filters, Wallet, Promises and Your Work as
  `IconButton size="compact"` (`packages/client/src/views/Home/index.tsx`). The design drops
  Filters (Explore carries discovery) and adds the bell at the far right in step 15.
- Rendered at the start gate in the real header (mock-auth localhost, `deployer` mock on Arbitrum,
  light): at 32px the chip shares the icons' line and the label of Green Goods Community Garden
  gets 119px at 390px and 89px at 360px; Home's list starts at 80px.
- `GardenChip` (`packages/shared/src/components/Canvas/GardenChip.tsx`) draws a seedling avatar, a
  static label for one garden and a Radix popover for two or more. Its size reads
  `--gg-garden-chip-*`; the app's scope in `packages/shared/src/styles/theme.css` sets 44px with a
  28px avatar today, which decision 33 amends. The cockpit renders the fallbacks and must change
  only by the banner avatar, proved with before-and-after Storybook pairs at the same page offset
  as in #1251.
- Build with the shipped shared pieces (item, person and fact rows, the action picker, the one
  state block, the one count badge, capsule filter chips, `MediaCard`, solid surfaces per DL-108,
  the type roles) rather than the lab's drawings.

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none recorded

## Validation

- Pending lane implementation.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Record blockers here before changing `status.json`.
