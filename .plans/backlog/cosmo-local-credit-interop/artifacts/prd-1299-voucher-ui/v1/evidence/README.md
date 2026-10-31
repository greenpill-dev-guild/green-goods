# Evidence for PRD-1299 design v1

**Evidence class: prototype render.** Every image here is the hand-built prototype
(`../prototype.html`) rendered by headless Chromium through Playwright 1.56 in a Claude Code cloud
session on 22 October 2026, at device scale 1, with mock data. It is not the product.

- **Product rendered proof: none.** None of these screens is implemented, so there is no
  authenticated Brave, mock-auth localhost, Storybook or CI Playwright proof to give.
- **Simulated, not executed:** sign-in, passkeys, wallets, transaction prompts, sponsorship,
  Celo and Gnosis reads, indexer freshness, cross-chain messages and acknowledgments, multisig
  signatures, and acceptance and cancellation races.
- **Fictional:** people, amounts, fees, prices, addresses, dates, terms versions, Sunroot Skills
  Hub and its voucher, Mara's Seed Library, Riverside Commons Garden, Hilltop Orchard and Vida
  Nova Collective. Green Goods Community Garden is real; its AI membership offer is illustrative.
- **Fonts:** Plus Jakarta Sans from Google Fonts when reachable, else the system face.

Re-render with `node ../render-evidence.mjs` (uses the repository's `@playwright/test` or any
Playwright on the module path; installs nothing).

## Checks that ran

| Check | Command | Result |
|---|---|---|
| Every screen renders every state in EN, ES and PT at phone, wide and cockpit sizes without errors or missing strings; every in-frame link, walk step, map cell and owner row resolves; no em dash in the source or strings; no dollar figure in any render | `node build.mjs` | Passed: 28 screens, 165 states, 849 strings × 3 languages, 10 walks |
| No clipped content outside designed truncation (one-line titles, pills, chips) in any state and language at 390, 360, 1024, cockpit 1280 and cockpit phone | `node render-evidence.mjs` | Passed: 0 findings, 0 page errors |
| Contrast of the state pairs | Prototype › Accessibility (computed) | AA for every listed pair in both themes |

## Images

| File | Screen and state | Language | Frame | Shows |
|---|---|---|---|---|
| `architecture.png` | Architecture view | English | Page | Chain ownership, contract inventory, both routes and state strips |
| `m04-review-en-390.png` | M04@review | English | Phone 390 | Consent with every fact, gross, fee and net, custody in plain words |
| `m05-unknown-es-390.png` | M05@unknown | Spanish | Phone 390 | Uncertain send: Check Transfer replaces Send |
| `m06-accepted-en-390.png` | M06@accepted | English | Phone 390 | Accepted is not paid; separate ladder steps |
| `m06-refundfail-pt-360.png` | M06@refundfail | Portuguese | Phone 360 | Refund delay with owner and no double payment |
| `m06-checked-en-wide.png` | M06@checked | English | 1024 wide | The app's tablet and desktop column |
| `m08-accounts-en-390.png` | M08@accounts | English | Phone 390 | Which account acts: Green Goods account and Gnosis wallet |
| `m09-cancelpending-es-390.png` | M09@cancelpending | Spanish | Phone 390 | Cancellation race explained before the outcome |
| `m10-review-en-390.png` | M10@review | English | Phone 390 | The irreversible split before confirmation |
| `m10-frozen-pt-360.png` | M10@frozen | Portuguese | Phone 360 | Frozen, read-only split |
| `m14-unknown-en-390-dark.png` | M14@unknown | English, dark | Phone 390 | Rehearsal banner; receipt lookup before buying again |
| `m15-kept-pt-390.png` | M15@kept | Portuguese | Phone 390 | G$ received, vouchers on the way, never summed |
| `s02-unverified-en-desktop.png` | S02@unverified | English | Cockpit 1280 | Approve off without a recorded deposit (D1) |
| `s03-check-es-phone.png` | S03@check | Spanish | Cockpit phone | Member Deposits card on a phone |
| `s04-short-en-desktop.png` | S04@short | English | Cockpit 1280 | Underpaid deposit can't be recorded |
| `s09-split-en-desktop.png` | S09@split | English | Cockpit 1280 | Split within the remedy, nothing per lesson |
| `s10-legfail-pt-desktop.png` | S10@legfail | Portuguese | Cockpit 1280 | One leg done, one failed, retry the same leg |
| `s12-pause-en-desktop.png` | S12@pause | English | Cockpit 1280 | A recorded pause that says it isn't enforced |
