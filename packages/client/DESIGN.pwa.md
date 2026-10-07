---
version: alpha
name: Green Goods Installed PWA Dialect
description: Mobile-first gardener field-tool overlay for the Warm Earth core DesignMD tokens.
extends: ../../DESIGN.md
surface: client-pwa
dialect: installed-pwa
---

# Green Goods Client PWA — Design Brief

> Installed PWA creative direction for the gardener-facing field tool. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

## Surface Identity

| Mode | Detection | Audience | Metaphor | Paradigm | Navigation |
|------|-----------|----------|----------|----------|------------|
| **Installed PWA** | `display-mode: standalone` | Gardeners | Working in the garden | Command Surface | Bottom `AppBar`: Home, Garden, Profile |

**Hard rule:** Installed PWA = app. Use bottom `AppBar`; never show the browser `SiteHeader` or hamburger chrome.

**Routing:** presentation-mode loaders gate browser vs PWA entry. Installed/authenticated PWA routes live under `/home` and render through `PwaRuntime` + `AppShell` with the bottom `AppBar`.

---

## The Field Tool

**Physical metaphor:** A gardener's well-worn journal. Practical, personal, tactile.

**Layout philosophy:**
- Mobile-first, thumb-zone optimized
- AppBar: 3 tabs — Home (with notification badge), Garden, Profile
- AppBar hides for immersive surfaces: Submit Work (`/home/garden/*`), a garden's own page and everything under it (`/home/:id/**`: the garden banner carries back, and work detail, promise detail, composer and proof routes carry their own fixed action bar exactly where the nav would sit), and whenever any sheet or dialog is open (DL-015). `isImmersiveAppRoute` in `config/pwaRouting.ts` owns the route rule. Sheet primitives register themselves while open, so there is no list of sheets to keep in sync
- Sheet heights (DL-014): every bottom sheet names one tier and never sets its own height. `compact` sizes to its content up to 50% (confirmations, resume prompts, gardener and badge details, a pool's agreement, Offer or Request); `half` holds 50% (short choices and a single preview: take a promise up, the profile photo, season and campaign details, the promise from Submit Work); `tall` holds 70% (lists and short forms: notifications, link work, request to join, withdraw an offer, conviction, the promise mid-proof); `full` holds 85% (tabbed workspaces, long reviews, and the garden filters: wallet, promises, your work, endowment, filter gardens, vault checkout, confirm a promise). Photo viewers and public records open full screen. The steward feedback drawer on a work page is not a sheet but caps at the half value and renders the shared header. No other height exists: the sheet surface sets no cap of its own and the centered dialogs share one 90vh cap
- Sheet header (DL-028): every sheet and dialog renders the one shared header (`SheetHeader`, through `PwaSheet`, `AppSheet`, the work dashboard, and the centered `DialogShell` and `ConfirmDialog`): a 40×6 grip that drags to dismiss on every bottom sheet, the title at 18px semibold on a 24px line, an optional description at 14px on a 20px line, both wrapping rather than clipping, no leading icon (a confirmation's tone lives in its filled action and its alertdialog role), a 44px borderless Close button labelled "Close" on the title's line, and no rule under the header; a hairline appears only while the body scrolls under it, and a tab rail sits directly under the header with its own rule. The title labels the dialog. Below the header, every heading in the body (section headings, group labels over lists, and empty, error, and success state titles) uses `SheetHeading`: 14px semibold on a 20px line in the strong text colour, in sentence case, never small capitals. The client stylesheet carries no element type rules (`h1`–`h6`, `p`), so the shared header renders as declared; the legacy client type utilities (`title-section`, `body-sm-regular`) are gone with it
- Sheet tab states (DL-035, DL-036): loading, error, and empty states live in the available content region after the tab's own status or filter row. Empty-state icons and titles use a shared upper-middle anchor; descriptions and actions grow below it without shifting that anchor. The Work dashboard, Wallet, Promises, and Endowment sheets share this vertical anatomy, so switching tabs never moves an equivalent state into a different zone
- List loading (DL-056): a list under a header row holds its loaded layout while it loads. The header row keeps its height with "Gathering…" where the count lands (screen readers hear what is gathering) and placeholders the width of the loaded filters, and skeleton rows take the loaded row's own frame, so nothing moves when the data arrives. A failed read keeps the header row's space and takes the empty state's anatomy and anchor: an error icon, a title, one line saying nothing was lost, and Try Again. The garden's Promises and Work tabs work this way; neither shows a centred spinner
- Sheet motion (DL-033): a bottom sheet moves like a native one. It slides up in one move on `--spring-spatial-slow` and never rises above its resting edge, so the page never shows under it: no overshoot, no surface fade, and an upward drag stops at rest. A drag from the grip or the header's title block under it moves the sheet one to one while the scrim lifts with it; the grip stays the visible affordance and Close stays outside the gesture. Letting go closes the sheet after a downward flick or past a quarter of its height, and otherwise settles it back on `--spring-spatial`; an upward flick always keeps it open. A tap on the dimmed backdrop closes it like Escape and Close, and `preventClose` holds every path during in-flight work. A close from rest accelerates out on `--spring-spatial-exit`; a flicked sheet already has speed and leaves on `--spring-spatial`. The gesture writes `translate` and the keyframes own `transform`, because a finished keyframe animation outranks inline styles; a sheet never sets its own motion
- Filter Gardens is a `full` sheet: membership scope and sort each use one full-width choice per row; domains use two equal-width choices per row, with an odd final choice spanning the full row. Sorting offers Name (A-Z) or Newest first; the sheet opens on and resets to Newest first (DL-040). The body scrolls above the pinned Reset Filters bar when more options or longer labels need room (DL-037); Profile Photo is a `half` sheet with four fixed regions (title-only header, an 80px preview of the current photo, the fallback, or the unpublished draft, a two-line status slot that shows the privacy notice by default, and at most two bar actions), the draft's discard control beside its pill, and removal confirmed through the shared confirmation stacked on top
- Sheet actions (DL-016): every sheet and dialog pins its actions in the shared action bar (`SheetActions`, through the `actions` prop of `PwaSheet`, `DialogShell`, `ConfirmDialog`, and `AppSheet`), under a body that scrolls above it; no sheet renders its own action buttons. Below 640px the actions stack full width with the primary on top: a filled primary (the error fill when destructive), then an outlined second action, Cancel included, and a text action only for a rare third choice. Step navigation (Back / Continue, as in wallet send) keeps one row. From 640px the same bar is one right-aligned row with the primary rightmost. Labels wrap rather than cut off, and a loading action stays focusable. Page-level bars (Submit Work, work approval, promise detail, the work page) are not sheets and keep their own layout
- Work page (DL-057): unsent, blocked, or checking work says why in a notice under its title, with the icon and title on one line and the reason in two lines at most from 320 to 390px in every language. The fixed bar holds only the acts: two equal 48px halves on one row, Discard (secondary, danger tone) left and the primary right, or one full-width act while the work may already be sent. The promise page's queued and failed notices share the anatomy, with a two-line minimum so every variant has one height and their actions full width below
- Step flows (DL-058): each step is named under its marker (Submit Work: Start, Media, Details, Review; adding proof: Media, Details, Review). Once a promise is chosen, every step opens with its FormInfo heading card and then the pinned promise card ("Work for" or "Proof for", the title on at most two lines), which sticks under the 80px top bar as the page scrolls. Tapping it opens the promise in a sheet (Submit Work's offers Not for This Promise), and closing the sheet returns to the same step
- Toasts (DL-060): the status icon sits on the title's line (on the message's first line when there is no title), and the message, description, and action run the toast's full width below it; the action's text takes `--primary-on-surface`. The toast is shared, so the admin cockpit renders the same anatomy
- Garden header (DL-020): page actions (notifications, endowment, share) are 32px icon buttons stacked in the banner's top right, with Share last so the others keep their places. The title row carries at most one text action, Join Garden or Request to Join, at the `compact` button size (32px tall, 14px label, no icon, 48px tap area), and its location and founded lines truncate instead of running under the button
- Logo screens (DL-084): every screen that draws the logo shares one geometry, so nothing moves between them: sign-in in all its states, the loading screen, and the screen shown when the app could not open. `SplashScaffold` owns it: the logo (96px, 112px from 640px), one line under it, two 44px control slots, the message zone and the text link, with the free space split 11:9 above and below and extra space reserved below to raise the block another 20px when space permits. The line is the app's name in the wordmark's voice (20px bold, green) or a sentence in the status voice (16px semibold, ink: "Signing you in...", "Green Goods is loading."), centred in the same slot and one line long from 320px in every language. A button on a logo screen is full width with the app's corner in sign-in's first slot; anything longer than the line becomes a quiet note under the button, never a second line above it. The loading screen is static HTML that paints before React (`.boot-pwa-shell` in `index.html`) and mirrors the scaffold slot for slot; `bootFallbackGeometry.test.ts` fails when either side changes alone
- Failure states (DL-085): a failure is drawn where it happened, and only as large as what failed. One screen failing keeps the shell: the empty state's anatomy (DL-056) in place of the screen, with the bottom bar where the route shows it. It has the error mark, a title, one line saying nothing was lost, a full-width Reload at sign-in's width, and an outlined Back on routes that hide the bar (`AppScreenError`). The app itself failing (it could not open, or its shell failed) is the logo screen above: one line, Reload in sign-in's first slot, and a quiet note (`AppLaunchError`), in the language the app would have chosen. Offline is a wait, not a fault: the calm mark, a line saying the screen loads when the connection returns, and it does, by itself. A screen whose code is from an older build reloads itself once and shows no error. The state belongs to the screen that failed: moving to another screen clears it, including inside a garden, whose page stays mounted across its child pages. No screen shows an error message, a stack, a copy-details action or a restart that clears data: the report is kept on the device and sent to PostHog as soon as it can be. `ErrorRecovery` owns the behaviour; `RouteErrorBoundary` and `AppErrorBoundary` only place it
- Scrolling: content scrolls inside `#app-scroll`, within a full-height `main` that clips and is positioned, so the document itself never scrolls. Android stretches every fixed element when the document overscrolls; with no document scroll, the AppBar and page headers hold still while native pull-to-refresh still reaches the document
- Persistent chrome (AppBar, offline banner) has its own view-transition name and never animates, so tab cross-fades pass beneath it
- Safe areas: `env(safe-area-inset-bottom)` for notched devices

**Typography:**
- Inter only — no serif. This is a tool, not a magazine.
- Type comes from the shared theme tokens and the shared components' own rules. The client's legacy type utilities (`.title-screen`, `.label-md`, `.body-md-regular`, and siblings) read tokens no stylesheet defines and are being retired; `.title-section` and `.body-sm-regular` are already gone (DL-028). The client stylesheet sets no element type sizes, so every heading names its own size and weight (`typographyLayer.guard.test.ts` fails a heading that does not)
- Compact type scale — body-sm and label-md are the workhorses

**Content hierarchy:**
1. Active garden context — always visible, always grounding
2. Work in progress — drafts, submissions, the thing you're doing now
3. Garden activity — what others are contributing
4. Your impact — personal contribution history

**Words:** the app calls commitments promises: the garden's Promises tab, Home's Promises launcher and sheet, and every string that names them ("Promesas", "Promessas"). Offers and requests are both promises; "pool" names only the container (its agreement, a paused or closed pool). Code identifiers, routes, the ontology, and the docs keep "commitment" (DL-059).

**Offline behavior:**
- Warm, reassuring offline indicators — not error-red
- Your Work has two tabs, Pending and Completed. Pending is one list sorted by what needs you: can't upload, work to review (stewards), to upload, drafts, checking, then sent work in review; unsent proof lists beside work. Home's Your Work badge counts what is still on this phone (drafts, work and reviews to upload or being checked, unsent proof), not sent work in review, and Upload all sends what is ready without a count (DL-061)
- Draft persistence is invisible — you never lose work — and a work draft keeps the promise it is for: resuming it brings the promise back into Submit Work, checked against the live promises (DL-062)

**Window Controls Overlay:** CSS is ready for desktop PWA titlebar integration (`.app-titlebar` with `app-region: drag`). Currently prepared but not active in components.

---

## Color Adaptation

The PWA inherits the Warm Earth core. Green accents follow one theme-aware rhythm (DL-086, DL-088; PRD-1150):
- Green labels, icons, active navigation marks, indicator bars, selection borders, switches, radio buttons and checkboxes use `--primary-on-surface`: deep green in light and pale mint `tertiary-dark` (`#C2F5DA`) in dark.
- Any green fill that carries text, a number, or a glyph (filled CTAs, count badges, step markers, selected chips, pills) uses the contrast-safe action pair: deep green with white content in light, mint with near-black `on-tertiary-dark` ink in dark. Dark hover uses `tertiary-dark-hover` (`#84EBB4`).
- Active tab and AppBar labels, their icons and indicators, links, selected titles, and media seek controls use the same role. Audio play/pause uses the theme's filled-action pair.
- Soft green highlights may retain the tertiary tint. Domain and status colors stay independent; success, warning, error and information marks are not brand accents.
- A red fill that carries white text (the filled danger button, error badges) uses `--error-action`, red-700 in both themes (DL-053).
- Shared runtime aliases scope the mint palette to PWA presentation and Storybook app surfaces; public and admin retain their own palettes. The static boot fallback mirrors the dark action pair before styles load.

**Dynamic garden theming** (future): Each garden can tint the experience with accent color derived from its banner image. Foundation palette remains — only the accent shifts.

---

## Forms and Lists

- Buttons and fields come only from the shared primitives: `Button`, `IconButton`, and `Chip` for actions, and `TextInput`, `Textarea`, `NativeSelect`, `Switch`, `FormattedAmountInput`, `DatePicker`, and `FileUploadField` for fields (DL-025, DL-031); the switch carries a 44 px hit box. Every button takes the app's 16px corner, the same corner as the field beside it, whatever its emphasis (DL-026, DL-029), tightening to 12px while pressed; a text action has no container until hover, an icon-only button is a circle, and a chip is a capsule. Fields are 16px (DL-022). Buttons and fields share one height scale (DL-023): 48 px for page-level primaries (Upload Work, work approval), 44 px by default and in sheets, 40 px in dense rows, and 32 px `compact` beside text or in a header, always with a 48 px tap area.
- Every form field reserves two lines (`min-block-size: 2lh`, 32 px at 12/16 px type) under its control for a hint or error, and fields in a form sit 8 px apart. A longer message grows the slot instead of scrolling inside it (DL-018).
- A list header that pairs a status line with filters stays one row at phone width. The status line and its compact Refresh keep their width; the filters give way first, as `NativeSelect density="condensed"` sized to the chosen option with a 64 px floor, ending in an ellipsis while the open picker still shows every option in full (DL-032). Header filters take `controlSize="compact"`: a 32 px face, the height of the compact buttons beside them, inside transparent borders that keep a 48 px tap area (DL-055). Your Work, the garden's Promises tab, and its Work tab use them.
- Work and draft cards in lists are 88 px high; their media fills that height and keeps a square aspect ratio, so the row owns the size and a future row-height change updates both together (DL-034). Every Your Work › Pending row, proof included, takes this frame with its pill top right, the guarded Discard bottom right, and a status edge; a blocked row's pill says what can't happen and its line why, in two or three words (DL-061).
- A status pill on a dense row or card (promise rows, season and campaign cards, Pending rows) is `StatusBadge size="xs"`: a 12 px label on a 22 px capsule. A page's own status block keeps `sm` (DL-054).

---

## Do's and Don'ts

**Do:**
- Test PWA layouts at 375px and on a real phone when layout or navigation changes
- Preserve the theme-aware green hierarchy in `/home`, `/home/garden`, and `/home/profile`
- Use container queries for components that can appear in both client modes
- Keep copy warm, personal, and community-facing

**Don't:**
- Show `SiteHeader` or hamburger navigation in installed PWA mode
- Use editorial serif in the PWA — it is an app, not a magazine
- Replace the PWA green roles with admin workspace colors
- Make the funding or submission flow feel transactional
