# v2 evidence

**Evidence class: static prototype.** Rendered on 23 and 24 October 2026 from
[`../voucher-lab.html`](../voucher-lab.html) in headless Chromium (Playwright's bundled build),
through the lab's own `window.__lab` hooks. Every person, service, amount, date and address is
fictional.

These images are not Storybook, product or authenticated-signing evidence. They show what the
design proposes, not what the app does today.

| File | What it shows |
|---|---|
| `member-journey.png` | Member app, 390 × 844, English, light: an offer's five questions before you start, the voucher deposit step, a G$ purchase with access active, and approving the final split after a partial delivery. |
| `member-recovery.png` | Member app, 390 × 844, English, light: terms changed after payment, a payment with no result, an expired exchange quote, and a return transfer that didn't go through. |
| `steward-desktop.png` | Steward cockpit, 1280 × 800, scaled: a provider garden accepting a G$ purchase after the payment check (English, light) and an issuer proposing a return within its terms (Portuguese, dark). |
| `lab-desktop.png` | The lab at 1440 × 900 on "A course that ends early", step 4, before the dials. |
| `lab-phone.png` | The lab at 390 × 844: the G$ purchase journey and the screen and state crosswalk, before the dials. |
| `lab-dials.png` | The lab at 1000 × 720 with the dials, on "Redeem a voucher you hold", step 11. The panel fits without scrolling. |
| `lab-cockpit-focus.png` | The same lab on step 5, a cockpit step: the issuer's dialog cropped to the phone frame's height, with the whole-screen thumbnail. |
| `dial-variants.png` | Member app, 390 × 844, English, light: every option of V1 sheet steps, V2 progress, V3 final split and V4 transfers, side by side. |
| `member-issuer-screens.png` | 24 October. Member app, 390 × 844, English, light: the onboarding draft, the approval sheet, the member's setup step, the member's service page, approving a booking and proposing a return. |
| `discovery-and-project.png` | 24 October. Member app, 390 × 844, English, light: the services list naming who promises delivery, a member's offer, a member's voucher as a request reward, Maya's exchange for Teo's voucher, the 30-minute split, and the project brief with one promise kept. |
| `member-issuer-recovery.png` | 24 October. Member app, 390 × 844, English, light: a paused issuer, issuing beyond capacity, a pending transaction, a draft changed after approval, an earned agreement that needs an operator, and a holding limit reached. |
| `cockpit-issuers.png` | 24 October. Steward cockpit, 1280 × 800, scaled to half: the Community issuers page, preparing a member's draft (Sunroot steward), the owner Safe drafts (Green Goods steward), and delisting with holdings and bookings kept. |
| `lab-member-issuer.png` | 24 October. The lab at 1440 × 900 on "Offer your own service", step 3: Teo approves his service. |
| `lab-cockpit-issuers.png` | 24 October. The same journey, step 6: the owner Safe drafts dialog in the cockpit focus crop. |
| `lab-project.png` | 24 October. The lab at 1440 × 900 on "A project with three promises", step 15: Maya approves the 0.5 and 0.5 split. |

The capture scripts ran from a session scratch folder and are not part of the lab. To reproduce
a frame, open `voucher-lab.html`, pick the journey or screen, then set the state, theme and
language in the right-hand panel. `lab/check.mjs` holds the checks themselves; the
[handoff](../handoff.md#evidence) records their results.
