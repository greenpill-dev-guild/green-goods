# Client happy-dom (2026-09-29)

Afo approved happy-dom for Client on September 29 (D12), after Admin's switch (D11, evidence in the
[snapshot 08 follow-up](2026-09-28-snapshot-08-follow-up.md)). Client was the last package on jsdom.
Commit on `develop`: `46be0573a`.

## Change

happy-dom 20.14.5 is already a root dev dependency, so the change is Client's Vitest config and its
test files; no manifest or lockfile changes. The root and DOM-project environment is happy-dom, and
68 of the 71 `@vitest-environment jsdom` docblocks say happy-dom. The other three are pins, each with
a comment naming the behaviour:

| File | Why it stays on jsdom |
|---|---|
| `src/__tests__/components/BootErrorHandoff.test.tsx` | Spies on `Storage.prototype.setItem`; happy-dom's `sessionStorage` does not call the spied method, as with Shared's `useWorkApproval` pin |
| `src/__tests__/components/AppSheet.test.tsx` | Asserts the tab name "Open4"; happy-dom yields "Open 4" |
| `src/__tests__/views/DetailsGate.test.tsx` | Asserts group names such as "Species Planted*"; happy-dom yields "Species Planted *" |

The two naming failures have one cause. A probe of both DOMs through Testing Library's own
`dom-accessibility-api` (0.5.16) showed that happy-dom's `getComputedStyle(span).display` is empty
where jsdom returns `inline`. The name computation treats a child whose display is not `inline` as a
block and puts a space around it, so a label and its count or required marker are joined with a
space. `testing.md`'s jsdom pin rule now names this case.

No certified seam uses a Client test file as proof, so the seam registry is unchanged.

## Measurement

The same method as Admin's switch: A was `HEAD` exactly and B the patch of my 72 files, toggled with
`git apply` between runs, because Vitest reads environment docblocks from disk. Each run took the
machine test lease, waited for a one-minute load under 12 and no other Vitest process, and ran the
package's command (`APP_ENV=test vitest run`) under `/usr/bin/time -l`. Another session's
uncommitted `packages/client/src/index.css` was in the tree for every run and is not part of the
patch.

| Run | Arm | Instructions | Vitest time | Environment, summed | Tests, summed | Results |
|---|---|---|---|---|---|---|
| A0 | jsdom | 1.536T | 28.0 s | 67.0 s | 64.4 s | 1,488 passed |
| B0b | happy-dom | 1.061T | 22.2 s | 32.6 s | 41.2 s | identical |
| A1 | jsdom | 1.544T | 30.7 s | 76.2 s | 70.5 s | identical |
| B1 | happy-dom | 1.065T | 23.1 s | 30.3 s | 43.9 s | identical |
| B2 | happy-dom | 1.059T | 24.8 s | 33.4 s | 47.3 s | identical |
| A2 | jsdom | 1.538T | 35.9 s | 92.7 s | 79.0 s | identical |

A1 B1 B2 A2: instructions −31.1%, CPU −32%, Vitest time −28%. Import and transform time did not move
(−0.1% and +0.3%); the saving is DOM setup and DOM work inside tests. All six runs hold the same
1,488 test names and results in 144 files, and the three happy-dom runs had no failures. Other
sessions raised the load to 29 during A2; instructions agreed within 0.4% per arm.

Coverage, run as the nightly does (`CI=true bun run test --coverage`): 72.56 / 67.13 / 70.21 / 74.43
(statements, branches, functions, lines) against 72.61 / 67.16 / 70.13 / 74.48 in the jsdom nightly at
`3fc9f132f`; every floor passes.

Every package's DOM tests now run in happy-dom: Shared (D2), Admin (D11) and Client (D12). jsdom stays
a root dev dependency for the pinned files (four in Shared, two in Admin, three in Client) and the QA
app client test in `scripts/agents/`.
