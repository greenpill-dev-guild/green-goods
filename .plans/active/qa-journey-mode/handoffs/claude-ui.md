# UI Handoff

Journey Mode is implemented in the static QA application and authored from the canonical catalog.
Walk remains the default, Priority remains available, and Journey supports whole-flow and
participant-part filtering. Known gates keep all verdict controls visible and unselected, so the
tester can record `Blocked` after encountering the gate.

Focused regression proof passed on 2026-09-03: 12 test files and 289 tests. Authenticated Brave
rehearsal also passed at desktop and 375 × 812 mobile dimensions, with no horizontal overflow and
with native accessible names and state exposed for the view, journey, part, and verdict controls.

The lane remains in progress until the current changes are committed, the QA application is
redeployed, and two authenticated wallets complete the service-relay smoke.
