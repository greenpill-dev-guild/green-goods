# v2 evidence

**Evidence class: static prototype.** Rendered on 23 October 2026 from [`../voucher-lab.html`](../voucher-lab.html)
in headless Chromium (Playwright's bundled build), through the lab's own `window.__lab` hooks.
Every person, service, amount, date and address is fictional.

These images are not Storybook, product or authenticated-signing evidence. They show what the
design proposes, not what the app does today.

| File | What it shows |
|---|---|
| `member-journey.png` | Member app, 390 × 844, English, light: an offer's five questions before you start, the voucher deposit step, a G$ purchase with access active, and approving the final split after a partial delivery. |
| `member-recovery.png` | Member app, 390 × 844, English, light: terms changed after payment, a payment with no result, an expired exchange quote, and a return transfer that didn't go through. |
| `steward-desktop.png` | Steward cockpit, 1280 × 800, scaled: a provider garden accepting a G$ purchase after the payment check (English, light) and an issuer proposing a return within its terms (Portuguese, dark). |
| `lab-desktop.png` | The lab at 1440 × 900 on "A course that ends early", step 4. |
| `lab-phone.png` | The lab at 390 × 844: the G$ purchase journey and the screen and state crosswalk. |

The capture scripts ran from a session scratch folder and are not part of the lab. To reproduce
a frame, open `voucher-lab.html`, pick the journey or screen, then set the state, theme and
language in the right-hand panel. `lab/check.mjs` holds the checks themselves; the
[handoff](../handoff.md#evidence) records their results.
