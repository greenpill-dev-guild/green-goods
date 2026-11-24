# v2 evidence

Two evidence classes, kept apart and labeled where they meet. Each names the engine and session
that produced it, as AGENTS.md asks.

**Static prototype: headless Chromium (Playwright's bundled build), a local Claude Code session,
no app session.** Every frame except the green-labeled ones in `shipped-vs-lab.png` and
`cockpit-dialog.png`. Rendered from [`../voucher-lab.html`](../voucher-lab.html), loaded as it is,
through the lab's own `window.__lab` hooks. The voucher services, issuers and prices are the
working pilot terms, which the issuers haven't accepted; the people, Riverside Commons, the
members' services, the G$ purchase, every address and every balance are fictional. These frames
show what the design proposes, not what the app does today.

**Shipped reference: Storybook, deployed build (`design.greengoods.app`), headless Chromium, a
local Claude Code session.** The green-labeled frames, recaptured on 25 October 2026 UTC, the
evening of 24 October Pacific, when the deployed build carried the DL-110 promise row and the
cockpit's DL-115 to DL-119 controls. The deployed Storybook can lag `develop`.

None of these images is product, mock-auth or authenticated-signing evidence.

All the static-prototype frames below were re-rendered on 25 October UTC after the fifth pass,
which redrew the cockpit on `develop`'s shared controls and gave the wallet a booking's row. Frames
whose screens didn't change came out identical.

| File | What it shows |
|---|---|
| `shipped-vs-lab.png` | Each shipped surface (Storybook, green labels) beside the lab screen built on it (static prototype, yellow labels): the promise page and Teo's lesson on it, the garden's Promises tab and Tech and Sun's, the wallet's jar row and the Vouchers tab with a booking's row, and the cockpit's Promises console beside Tech and Sun's, with bookings in Review Promises. |
| `cockpit-dialog.png` | A shipped cockpit dialog from Storybook (the commitment Mark Ready dialog) beside the lab's Accept for Tech and Sun, both on DL-117: the header with the target line and no rule, the white action bar with Cancel outlined. The Storybook frame shows Close with its focus ring, because a scripted open leaves focus there. |
| `member-journey.png` | Member app, 390 × 844, English, light: a Tech and Sun hub day on the promise page, depositing its one voucher, the booking's row in the wallet, a G$ purchase with access active, and approving the split when Claude access ended early. |
| `member-recovery.png` | Member app, 390 × 844, English, light: terms changed after a G$ payment, a payment with no result, an expired exchange quote, and a Claude access return that didn't go through. |
| `steward-desktop.png` | Steward cockpit, 1280 × 800, scaled: the G$ provider's console accepting a purchase after the payment check, with the protocol pool's warning in the dialog header (English, light), and Green Goods' console proposing a return on Claude access (Portuguese, dark). |
| `member-issuer-screens.png` | Member app, 390 × 844, English, light: Teo's Service Assets with a draft to review, the approval sheet, enabling the reserve, the service overview, approving a booking, and proposing a return. |
| `discovery-and-project.png` | Member app, 390 × 844, English, light: Tech and Sun's Promises tab naming who promises each service, Teo's lesson on the promise page, a member's voucher as a request reward, Maya's exchange for Teo's voucher, the 30-minute split, and the campaign with three promises. |
| `member-issuer-recovery.png` | Member app, 390 × 844, English, light: a paused issuer in the Promises tab, issuing beyond capacity, a pending transaction, a draft changed after approval, an earned agreement that needs an operator, and a holding limit reached. |
| `cockpit-issuers.png` | Steward cockpit, 1280 × 800, scaled to half: Community's Voucher Issuers card with Tech and Sun's and Green Goods' vouchers, preparing a member's draft with its seven-day acceptance deadline, the owner Safe drafts, and delisting with holdings and bookings kept. |
| `dial-variants.png` | Member app, English, light: every option of V1 sheet steps, V3 final split, V2 progress and V4 transfers, side by side. The V2 and V4 frames are 390 × 1500 so the whole section shows; the rest are 390 × 844. |
| `lab-desktop.png` | The lab at 1440 × 900 on "Claude access that ends early", step 4: Lina approves 4 to Green Goods and 6 back. |
| `lab-phone.png` | The lab at 390 × 844 on "Buy with your own G$", step 5: the purchase as a promise page, waiting for the payment check. |
| `lab-dials.png` | The lab at 1000 × 720 with the dials, on "Redeem a voucher you hold", step 12: the hub day's final split. The panel fits without scrolling. |
| `lab-cockpit-focus.png` | The lab at 1440 × 900 on the same journey, step 5, a cockpit step: Tech and Sun's approval dialog cropped to the phone frame's height, with the whole-screen thumbnail. |
| `lab-member-issuer.png` | The lab at 1440 × 900 on "Offer your own service", step 3: Teo signs his approval of the service. |
| `lab-cockpit-issuers.png` | The same journey, step 6: the owner Safe drafts dialog in the cockpit focus crop. |
| `lab-project.png` | The lab at 1440 × 900 on "A project with three promises", step 15: Maya approves the 0.5 and 0.5 split. |

The capture scripts ran from a session scratch folder and are not part of the lab. To reproduce
a frame, open `voucher-lab.html`, pick the journey or screen, then set the state, theme and
language in the right-hand panel. `lab/check.mjs` holds the checks themselves; the
[handoff](../handoff.md#evidence) records their results.
