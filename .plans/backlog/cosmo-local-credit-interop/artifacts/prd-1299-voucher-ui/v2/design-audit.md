# Design-system audit of the v2 lab

A read-only review of the lab's screens against the interface they build on, done on
22 Oct 2026 before publishing v2. It compared source, not a running app: the installed app's
primitives, the steward cockpit's primitives, the shared tokens and the surface guides. Most
findings are fixed in this version; the rest are listed under [Remaining](#remaining).

The pilot revision on 23 Oct 2026 kept these corrections, changed the rows marked "pilot
revision" below, and added the patterns under [Pilot revision](#pilot-revision-23-oct-2026).

Sources compared:

- Guides: `packages/client/DESIGN.md`, `packages/admin/DESIGN.md`,
  `.claude/skills/design/system-alignment-review.md`.
- Tokens: `packages/shared/src/styles/theme.css`.
- Member app: `packages/client/src/components/Layout/AppBar.tsx`,
  `packages/client/src/components/Navigation/TopNav.tsx`, `packages/shared/src/components/Alert.tsx`,
  `packages/shared/src/components/StatusBadge.tsx`.
- Cockpit: `packages/admin/src/components/AdminDialog.tsx`,
  `packages/admin/src/components/Layout/FlowStatusRow.tsx`,
  `packages/admin/src/components/Layout/FlowSendFooter.tsx`,
  `packages/admin/src/components/AdminSettingRow.tsx`,
  `packages/admin/src/views/Garden/Pool/PoolTarget.tsx`.

## Applied

Corrections live in `lab/gg.css` after the "Design-system alignment (v2 audit)" comment, and in
the screen templates.

### Foundations

| Area | Before | Now |
|---|---|---|
| Icons | Hand-drawn stroke icons | Remix Icon 4.9.0 glyphs from a sprite, Line for inactive and Fill for active, at the app's sizes. |
| Status palette | Tailwind-like greens, ambers, reds and blues | Shared status tones: fill, text and a 1px border per tone (success, warning, error, information, neutral), in light and dark. |
| Edge colors | Approximate | `#1FC16B`, `#FA7319`, `#FB3748`, `#335CFF`; dark success, warning and error variants. |
| Cockpit tone | Darker greens | Action `#1A7544` on white ink, container `#D0FBE9`, on-container `#16643B`; dark mode inverts to `#C2F5DA` with `#16643B` ink. |
| Neutrals | One muted grey | Sub text `#57534E`, soft `#78716C`, weak surface `#FAFAF9`, soft stroke `#F5F5F4`, danger `#D02533`. |
| Type | Amounts at 28 to 34px bold; titles bold | Amounts cap at 24/32 semibold; titles semibold; row titles medium; detail lines regular. |

### Member app

| Area | Before | Now |
|---|---|---|
| App bar | 22px icons, a profile dot, Seedling for Garden | 24px Home, Plant and User glyphs, Line or Fill by state, grey when inactive, no dot. |
| Top nav | A centered title beside the back button | No title; a 32px outlined back button with the green filled arrow. |
| Sheets | 24px corners, grey grip, 52/70/88% tiers, bordered action bar | 16px corners, green grip, 50/70/85% tiers, lighter scrim, borderless action bar with 44px buttons. |
| Sheet tabs | Plain labels | Rail on the weak surface, 12px medium labels, 16px icons, 10% active fill, count badge. |
| Notices | Neutral fill, title-only tone | Alert style: tone fill, tone border, tone text, 20px icon. There's no neutral variant, so plain notices read as information. |
| Page action bar | Stacked buttons | Two equal halves, primary on the right, 48px, hairline top border. |
| Buttons | Bold labels; transparent secondary | Medium labels; white secondary face; grey text action; disabled at 60%; approving keeps its label with a spinner. |
| Fact rows | 48px rows, 14px labels | 12px grey label, 14px value, 10px vertical padding. |
| Held-funds card | Sun-tinted hero | A neutral status band: weak surface, 16px corners, hairline. |
| Garden header | 140px banner, 40px solid buttons, one meta line | 144px banner with 24px bottom corners, 32px outlined buttons, location and founding lines with icons, tabs Work · Promises · Insights · Gardeners. |
| Promise rows | No edge | 3px edge: green Seedling for offers, blue Hand-heart for requests. |
| Garden chip | Initials | Seedling avatar. |
| Copy | Sentence-case titles, "in escrow", chain names, "Under way", "Done", "Open" | Title Case titles; "held"; no chain names on simplified screens; "In progress", "Kept", "Waiting to be confirmed", "Offered", "Asked for"; "Offline Mode"; "stewards" for "garden admin". Pilot revision: "Kept" appears only after the member confirms, and chain names only under Transaction details. |

### Steward cockpit

| Area | Before | Now |
|---|---|---|
| Route | A "Promises" page with Requests tabs | Garden route: tabs Health · Impact · Activity · Promises, with a Review Promises card and an Offers and Requests card scoped Open · Confirmed · Past. |
| App bar | Notifications and avatar | Search, Notifications, Settings, Profile. |
| Dock | Home, Work, Promises, Funds, Members | Hub, Garden, Community, Actions; 56px pill on an 85% blurred surface, 94px items, active icon in a 44×28 tone pill. |
| Protocol pool marker | Amber "Protocol pool" pill in the page header | Neutral status badge in the card header. |
| Pool target in dialogs | One grey line | Garden pool: a "Writing to" label above the pool. Protocol pool: the warning alert "Writing to the Green Goods protocol pool" with its standard note. |
| Flow status | One line of text | Flow status row: icon column, a title that says what the write does, a line that says the consequence. |
| Dialogs | 560px, white | 448px, warm dialog surface, header and footer hairlines, 40px close circle, Cancel as a text button. Pilot revision: the footer says "Your wallet will ask you to approve." instead of promising one prompt. |
| Buttons | Bordered in the line color | Outlined in stone with tone-colored labels; filled adds elevation. |
| Tabs and cards | 40px tabs; no card header rule | 36px tabs with a count badge; a hairline under each card header. |
| Settings | Checkbox row | Setting row with a switch. Pilot revision: the "Accept Automatically" switch is gone, because automatic acceptance isn't part of this pilot; the offer card says a steward accepts each request. |
| Filter chips and fields | Tinted selected chip; outlined fields | Solid action capsule when selected; filled 40px fields. |
| Copy | "Members, with their own G$" | "Gardeners, with their own G$". |

## Pilot revision, 23 Oct 2026

The ten pilot screens reuse the corrected kit. New patterns live in `lab/gg.css` after the
"Pilot design additions" comment:

| Pattern | Where | What it does |
|---|---|---|
| Question card | `SOffer`, `SReward` | On an offer, rows for what you get, what you give, who holds it, who acts next and what comes back if it falls short. A reward's card asks what you give, who confirms, how rewards arrive and whether anything is set aside. |
| Journey strip | `SPay` | Shows done, current and waiting steps in one stepped sheet, and whose step comes next. |
| Reason beside the action | `SOffer`, `SRequests`, `SIssuer` | A blocking reason sits directly above, or is described by, the action it blocks, instead of a separate notice. |
| Changed fact | `SPay` | Highlights each changed term with a "Changed" pill before the member agrees again. |
| Holdings rows | `SWallet` | Issuer name and amount on one row; the amount never truncates. |
| Transfers card | `SRedeem` | One row per transfer, each with its own pending, arrived or failed state and retry. |
| Dock clearance | Cockpit screens | Page content stops 80px above the bottom so the dock never covers a row. |

The lab's copy function keeps numbers on the same line as their units. `check.mjs` now also sweeps every
pilot state in English, Spanish and Portuguese, and in dark, for clipped text, control names,
focus behind dialogs, missing icons and AA contrast.

**Dials, later on 23 Oct 2026.** The lab gained dials for pattern variants (V1 to V5), copy density
and chain words (D1, D2) and the five design-system forks locked on 18 October (S1 to S5), each
defaulting to the pilot's pick. Every variant reuses the corrected kit; the rules sit in `lab/gg.css`
after the "Lab dials" comment as data-attribute overrides, so the pilot's defaults render exactly as
before. The check sweeps every dial option on each screen it applies to, and a new rule fails the
check when the side panel needs scrolling at desktop sizes.

## Member issuers, 24 Oct 2026

Five screens were added (`SServices`, `SOnboard`, `SMyService`, `SBrief` for members; `SIssuers`
for the cockpit) and six gained member variants. They reuse the corrected kit and the pilot patterns
above; the few additions sit in `lab/gg.css` after the "Member issuers" comment:

| Pattern | Where | What it does |
|---|---|---|
| Person tile | `SServices`, `SWallet`, `SMyService`, `SBrief` | A seed-toned 40px tile with the user glyph marks a service promised by a person; a garden keeps its sun or seedling tile. |
| Capacity figures and strip | `SMyService` | Four figures (promised, booked, delivered, left) over the lessons strip, with delivered in green and booked in blue, kept apart from the voucher locations below. |
| Member field | `SMyService` | A 48px, 16px-cornered field for an amount in a member sheet, with its unit inside and a hint under it; the cockpit keeps its 40px filled field. |
| Filter chips | `SServices` | The app's capsule chips with a selected state in the accent tint. |
| Loading rows | `SServices` | Skeleton rows on the weak surface, hidden from assistive technology, with a status line. |
| Status pill in the title | `SMyService` | Listed, Paused or Delisted beside the service's unit line, so the page's state reads before the notice. |
| Cockpit page badge | `SIssuers` | The "Fictional rehearsal" policy badge in the page header, mirroring the Admin component's own note. |

Admin and Client copy the lab mirrors where it exists: the Admin issuer labels (token owner and
reserve, source approval authority, finite adapter allowance, pool holding cap, price index, upgrade
administrator, the pause note and "copying sends nothing") and the Client's issuer notes (reserve and
holdings overlap, services owed unknown, returned vouchers don't confirm capacity, one pending
action at a time). The lab's wording is warmer, as the member surface asks, but keeps the same facts.

## Kept on purpose

## Kept on purpose

- **The v1 reference screens keep chain and wallet names** (Celo, Gnosis, the Gnosis wallet,
  escrow). They show what members face in v1, which the pilot screens remove. They received the
  foundation, icon, app bar and dock fixes, not the copy rules.
- **Older cockpit desks keep their one-line flow rows and layouts.** Only their icons, dock and
  app bar changed. The pilot cockpit screens (`SFunds`, `SRequests`, `SIssuer`) carry the full
  structure.
- **Redeem.** The audit recommended going back to "Use" for vouchers, as line 47 of
  [`spec.md`](../../../spec.md) proposes. Afo overrode it: vouchers use Redeem, matching CLC, and
  vaults get a new verb.

## Remaining

These need a local checkout, a running app, or a decision.

1. **Card corners.** Cards use 24px, the locked F7 direction, which hadn't shipped when this was
   checked. Confirm against the current build.
2. **Approximated values.** Elevation shadows, the dark weak surface, dark soft text, the dark
   neutral border and the cockpit wash were estimated from the guides, not read from computed
   styles. Compare with a running app in light and dark.
3. **Spanish and Portuguese.** The pilot revision drafts every pilot string in both. Portuguese
   awaits Gui's review (PRD-1312), and Spanish awaits a native speaker.
4. **Vault verb.** Pick Withdraw or Take Out, then update the 23 English strings in
   `packages/shared/src/i18n/en.json` and their translations. That's implementation work for
   PRD-1297, not this branch.
5. **Garden route drift.** `develop` moved after the audit. Re-check the cockpit Garden route tabs
   and the Promises tab cards against the current admin source.
6. **Fonts.** The lab loads Plus Jakarta Sans from Google Fonts; the installed app bundles its
   own copy. Compare text rendering side by side.
7. **Running-app comparison.** Neither the pilot revision nor the member-issuer revision compared
   against a running app or Storybook, so items 1, 2, 5 and 6 are still open. A mock-auth localhost
   walk would cover them, and the Admin `VoucherIssuerOnboarding` story is the closest shipped
   reference for `SIssuers`.
8. **Screen reader.** Not tested. `check.mjs` covers control names, focus behind dialogs and
   contrast, and keyboard walks covered focus order on the lab panel and the new sheets, but no
   assistive technology was run.
9. **Community route.** `SIssuers` places voucher issuers on the cockpit's Community page with the
   dock's Community item active, as the Admin component's location suggests. The page's own tabs
   and header on `develop` weren't checked.
