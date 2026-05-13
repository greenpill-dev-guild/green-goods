# Lane 02 — Typography & Text-Overflow Audit (Client PWA)

**Scope**: `/home/login`, `/home`, `/home/:id`, `/home/:id/work/:workId`, `/home/:id/assessments/:assessmentId`, `/home/garden`, `/home/profile`. PWA chrome (`@green-goods/shared` Canvas/Cards/Display) and consuming `packages/client/src/{views,components}` (excluding `Public/**`).

**Read-only.** Findings only — no fixes proposed.

---

## Executive Summary

The PWA has a systemic Rule 4 gap: every `truncate` / `line-clamp-*` site that renders user-generated text (garden names, assessment titles, gardener handles, ENS slugs, work titles, descriptions, locations) is **missing a `title=` HTML attribute** for the hover/long-press tooltip. Only `ActionCard` (line 67) gets it right. The repeating pattern (`<h-something className="truncate ...">{userField}</h-something>`) appears in at least 12 distinct render sites across `GardenCard`, `WorkCard`, `Garden/index`, `Garden/Assessment`, `Garden/Notifications`, `Profile/index`, `Profile/GardensList`, `Profile/ENSSection`, `Features/Garden/Gardeners`, `Features/Garden/Assessments`, `Cards/Work/DraftCard`, and `Home/WalletDrawer/CookieJarTab`.

A second systemic gap is Rule 9: PWA-package-level views overwhelmingly use raw Tailwind text-size + weight pairs (`text-sm font-medium`, `text-lg font-semibold`, `text-xs text-text-sub-600`, `text-2xl font-semibold`) where the `label-md`, `body-md`, `label-sm`, `text-title-lg` etc. tokens already exist in `packages/shared/src/styles/theme.css` (lines 1–48 of the typography variables). The `client/src/styles/typography.css` defines `title-screen/section/subsection/body`, `label-{lg,md,sm,xs}`, `body-{lg,md,sm}-{regular,medium}` utilities, but the PWA bypasses them.

The third (and highest-impact) finding: several reachable PWA surfaces render user-generated text into **fixed-width or single-line containers without truncation**. With PT/ES typically 20–40% longer than EN, garden names, locations, ENS slugs, assessment titles, gardener handles, and work descriptions will overflow visually on standard mobile widths (375 px). Particularly damaging are the Profile header `displayName`, the Assessment header garden eyebrow + title, the WalletDrawer cookie-jar group header (h4 + uppercase, no truncate), and the JarCard balance row.

There are also a handful of arbitrary literals (`text-[11px]`, `text-[10px]`, `text-[0.72rem]`) and one `font-mono` mix in `ENSSection` that drift from the typography system.

PT length analysis (from `packages/shared/src/i18n/pt.json`): the longest *PWA-scope* in-flow strings are 150–190 characters (FAQ answers, treasury hints, error helpers); these appear in `<p>` elements with no width constraint and wrap fine. The risk is concentrated at button labels, badge labels, status pills, AppBar/sheet titles, and column headers where the container width is constrained.

---

## Sub-check A — Multi-language overflow risk (P0–P1)

Long PT strings traced to constrained-container render sites.

### A1. P0 — `Profile/index.tsx:91` → `Features/Profile/Profile.tsx:51` — Profile header `displayName`
- **File:line**: `packages/client/src/components/Features/Profile/Profile.tsx:51`
- **Pattern**: `<h5 className="font-semibold text-lg">{displayName}</h5>`
- **Source**: `displayName` may be `profile.name` (operator-set), `displayEnsName` (ENS like `tatiana-luiza-do-amaral.greengoods.eth`, up to ~30 chars), `userSetName` (passkey username), or i18n fallback `"Seu perfil"` (10c, +25%).
- **Constraint**: container is `px-2`, no max-width; PT/ES `displayName` may include long Greengoods ENS slugs (e.g. `gabriel-de-souza-pereira.greengoods.eth` ≈ 38c). No truncate, no title=.
- **Severity**: P0 — overflows on 375 px viewport with realistic ENS slugs; user-generated text wholly unconstrained.

### A2. P0 — `Home/Garden/Assessment.tsx:89-91` — Assessment header garden eyebrow + title + description
- **File:line**: `packages/client/src/views/Home/Garden/Assessment.tsx:89-91`
- **Pattern**:
  ```
  <p className="text-xs uppercase tracking-wide ...">{garden.name}</p>      // user-generated
  <h1 className="text-2xl font-semibold ...">{assessment.title}</h1>         // user-generated
  <p className="text-sm text-text-sub-600">{assessment.description}</p>      // user-generated
  ```
- **Constraint**: No truncate / line-clamp anywhere. Container `padded` (~16 px inset). With `uppercase` and PT garden names averaging 18–25c, the eyebrow extends beyond the viewport on phones.
- **Severity**: P0 — three stacked unconstrained user-text sites on a reachable detail route.

### A3. P0 — `Home/WalletDrawer/CookieJarTab.tsx:248-250` — Garden-name group header
- **File:line**: `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:248-250`
- **Pattern**: `<h4 className="mb-2 text-xs font-medium text-text-soft uppercase tracking-wide">{group.gardenName}</h4>`
- **Constraint**: `uppercase tracking-wide`, no truncate, full-width inside drawer (~min(95vw, ~520px)). Long PT/ES garden names with `uppercase` overflow inside the modal drawer on narrow phones. Long EN like "Aiyeloja Family Garden" ≈ 22c — already wide; PT ~28–35c overflows.
- **Severity**: P0 — user-generated text wholly unconstrained inside a drawer.

### A4. P0 — `Home/WalletDrawer/CookieJarTab.tsx:69-77` — Jar amount line + cooldown line
- **File:line**: `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:69-77`
- **Pattern**:
  ```
  <p className="text-sm font-medium ...">{assetSymbol} - {formatTokenAmount(jar.balance, decimals)}</p>
  <p className="text-xs text-text-soft">{gardenName}</p>
  <p className="text-xs text-text-sub">{formatMessage({ id: "app.cookieJar.maxWithdrawal" })}: {formatTokenAmount(jar.maxWithdrawal, decimals)}</p>
  ```
- **Source**:
  - `app.cookieJar.maxWithdrawal` (PT: "Retirada máxima") + amount on the right side of the same flex row (`justify-between`).
  - `gardenName` is user-generated, no truncate.
- **Constraint**: 1-row flex `justify-between`, no `min-w-0` / `truncate` on either side. Long token amounts + long PT label squeeze the layout, but the **gardenName** below has no truncate at all.
- **Severity**: P0 (gardenName) + P1 (label/amount squeeze).

### A5. P0 — `Home/Garden/index.tsx:402-407` — Garden detail header (name + location)
- **File:line**: `packages/client/src/views/Home/Garden/index.tsx:402, 407`
- **Pattern**:
  ```
  <h1 className="text-lg md:text-xl font-semibold line-clamp-2">{name}</h1>     // line-clamp-2, NO title=
  <span>{location}</span>                                                         // user-generated, no truncate, no title=
  ```
- **Constraint**: Header is fixed-positioned with `headerHeight` measurement (so wrapped names are tolerated for layout) — but `line-clamp-2` truncates 3+ line names invisibly, and Rule 4's `title=` is missing. The `location` span (line 407) has no constraint at all and may push the join button (sm:flex-row) out of the row on narrow viewports.
- **Severity**: P0 (location unconstrained on small viewport) + P1 (Rule 4: line-clamp without title).

### A6. P0 — `Profile/GardensList.tsx:174-180` — Garden card name + location
- **File:line**: `packages/client/src/views/Profile/GardensList.tsx:174, 180`
- **Pattern**:
  ```
  <div className="line-clamp-2 text-sm font-medium leading-snug">{garden.name}</div>   // line-clamp-2 NO title=
  <span className="truncate">{garden.location}</span>                                    // truncate NO title=
  ```
- **Severity**: P1 (Rule 4 missing-title; clamp/truncate prevents overflow).

### A7. P0 — `Profile/ENSSection.tsx:272-273` — Existing ENS slug rendering
- **File:line**: `packages/client/src/views/Profile/ENSSection.tsx:272-273`
- **Pattern**: `<div className="font-mono text-sm font-medium text-text-strong-950">{existingSlug}</div>`
- **Constraint**: Inside `flex flex-col gap-0.5 min-w-0 flex-1`. No truncate. Long slugs (e.g. `tatiana-luiza-do-amaral`) overflow the avatar+content row on 375 px viewports.
- **Severity**: P0 — user-generated text wholly unconstrained.

### A8. P1 — `Features/Garden/Gardeners.tsx:111-117` — Gardener row display name + subline
- **File:line**: `packages/client/src/components/Features/Garden/Gardeners.tsx:111-113`
- **Pattern**:
  ```
  <span className="font-semibold">{displayName}</span>            // no truncate, no title=
  {subline ? <span className="text-xs ...">{subline}</span> : null}
  ```
- **Constraint**: Container `flex flex-col pr-14` (right-padding for badge); no `min-w-0`/`truncate` on the label spans. ENS / username / email falls back via `formatAddress`; ENS like `do-amaral.greengoods.eth` (24c) at ~14 px text-base exceeds the residual width on small phones.
- **Severity**: P0 — user-generated text wholly unconstrained.

### A9. P1 — `Features/Garden/Gardeners.tsx:219` — Member-detail dialog title
- **File:line**: `packages/client/src/components/Features/Garden/Gardeners.tsx:219`
- **Pattern**: `<Dialog.Title className="text-base font-semibold truncate">{title}</Dialog.Title>`
- **Source**: `title` is `selected.username || selected.email || selected.phone || formatAddress(...)` — all user-generated.
- **Severity**: P1 — Rule 4: truncate without title= attribute.

### A10. P1 — `Features/Garden/Gardeners.tsx:238, 283, 302` — Member dialog detail rows
- **File:line**: `packages/client/src/components/Features/Garden/Gardeners.tsx:238, 283, 302`
- **Pattern**:
  ```
  <span className="font-semibold">{selectedPreferredEnsName}</span>   // line 238
  <span>{selected.email}</span>                                        // line 283
  <span>{selected.phone}</span>                                        // line 302
  ```
- **Constraint**: Inside `flex items-center gap-2 text-sm` row in a 520 px max dialog; no truncate, no title. Long emails (`some-long-name@some-domain.example.com` ≈ 40c) overflow.
- **Severity**: P0 — user-generated text wholly unconstrained.

### A11. P1 — `Features/Garden/Assessments.tsx:59-66` — Assessment list-card title + description
- **File:line**: `packages/client/src/components/Features/Garden/Assessments.tsx:59, 66`
- **Pattern**:
  ```
  <h6 className="truncate text-base font-semibold ...">{assessment.title}</h6>        // truncate NO title=
  <p className="mt-2 line-clamp-3 text-sm text-text-sub-600">{assessment.description}</p>  // line-clamp-3 NO title=
  ```
- **Severity**: P1 — Rule 4 missing-title.

### A12. P1 — `Features/Garden/Assessments.tsx:215` — Report file name
- **File:line**: `packages/client/src/components/Features/Garden/Assessments.tsx:215`
- **Pattern**: `<p className="text-sm text-text-sub-600 line-clamp-2 break-all">{fileName}</p>`
- **Severity**: P1 — line-clamp without title=. `break-all` already mitigates overflow.

### A13. P1 — `Cards/Work/DraftCard.tsx:77-95` — Draft action title + garden subline
- **File:line**: `packages/client/src/components/Cards/Work/DraftCard.tsx:77-95`
- **Pattern**:
  ```
  <h4 className="font-medium text-sm ... truncate pr-2">{actionTitle ?? "Untitled Draft"}</h4>  // truncate NO title=
  <div className="mt-0.5 text-xs ... truncate">{gardenName} • {timeAgo}</div>                   // truncate NO title=
  ```
- **Source**: `gardenName` user-generated. PT action titles like "Plantar mudas em viveiro flutuante" (37c) inside narrow card with `pr-14` for delete-button overflow truncates without title.
- **Severity**: P1 — Rule 4.

### A14. P1 — Shared `Cards/GardenCard/GardenCard.tsx:171-216` — GardenCard name + description
- **File:line**: `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:171, 184, 233, 249`
- **Pattern**:
  ```
  <h5 className="... truncate text-label-md font-semibold ..." />               // line 174 (selection mode)
  <h5 className="... text-lg font-semibold ... line-clamp-1" />                 // line 175 (default mode)
  <Badge className="..." leadingIcon={...}>{operatorAddress}</Badge>            // line 233 — operator name in nested fragment
  <p className="text-sm text-text-sub-600 line-clamp-3">{garden.description}</p> // line 249
  ```
- **Severity**: P1 — Rule 4. Garden name truncate/line-clamp without title; description line-clamp without title; operator-name badge has no truncate at all.

### A15. P0 — Shared `Cards/WorkCard/WorkCard.tsx:226-253` — Work title + gardener/garden subline
- **File:line**: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:226, 239`
- **Pattern**:
  ```
  <h4 className="truncate pr-2 text-sm font-medium ...">{work.title || labels.untitledWork}</h4>     // truncate NO title=
  <div className="mt-0.5 truncate text-xs ...">{showGardener && gardenerDisplayName • {timeAgo} • {gardenName}}</div>  // truncate NO title=
  ```
- **Source**: `work.title` (user-generated action label or fallback), `gardenerDisplayName`, `gardenName` (all user-generated).
- **Severity**: P0 — user-generated text trio with truncate but no title. Used by every PWA list (Garden/Work tab, WorkDashboard pending/completed, Drafts).

### A16. P1 — Status badge inside WorkCard squeezing the title
- **File:line**: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:225-237`
- **Pattern**: `<div className="flex items-start justify-between gap-2"> <h4 className="truncate ..."/> <span className="flex-shrink-0 ... text-xs font-medium">{displayStatus}</span> </div>`
- **Source**: `displayStatus` mapped from PT-translatable status labels. The longest in EN is "Sync Failed" (11c) — but if PT ever localizes (currently `app.status.syncing` etc. are NOT translated to PT in `pt.json`, see `app.status.syncing: "Syncing"`), the status will reach 18–22c (e.g. PT "Sincronizando" = 13c, "Falha de sincronização" = 22c). The badge is `flex-shrink-0`, so it pushes the title's truncate further left on small viewports.
- **Severity**: P1 — pre-emptive risk; once PT status keys are translated, the title visible region shrinks below ~50% of the row on 375 px screens. Today's PT lacks translations (this is itself a separate concern out of this lane's scope).

### A17. P2 — `Profile/Badges.tsx:372-374` — Badge status pill in 50%-width grid card
- **File:line**: `packages/client/src/views/Profile/Badges.tsx:372`
- **Pattern**: `<span className="mt-2 inline-flex rounded-full bg-bg-weak-50 px-2 py-1 text-[11px] font-medium ...">{statusLabel}</span>`
- **Source**: `statusLabel` is "Conquistada" (11c, +83% PT) or "Pronta para reivindicar" (23c, +64% PT).
- **Constraint**: 2-column grid, ~160 px wide cell. PT 23c at text-[11px] (≈ 7px char width) ≈ 160 px — borderline overflow with the rounded-full padding.
- **Severity**: P2 — edge-case overflow on very narrow phones.

---

## Sub-check B — Rule 4 violations (truncate/line-clamp without title=)

Every site below has truncate/line-clamp on user-generated text but **no** `title=` HTML attribute.

| # | File:line | Element | User-generated content | Severity |
|---|---|---|---|---|
| B1 | `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:226-228` | `<h4>` | `work.title` | P1 |
| B2 | `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:239-253` | `<div>` | `gardenerDisplayName`, `gardenName` | P1 |
| B3 | `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:171-180` | `<h5>` | `garden.name` | P1 |
| B4 | `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:249-256` | `<p>` | `garden.description` | P1 |
| B5 | `packages/client/src/components/Cards/Action/ActionCard.tsx:71-73` | `<div>` | `action.mediaInfo.description` | P1 |
| B6 | `packages/client/src/components/Cards/Work/DraftCard.tsx:77-80` | `<h4>` | `actionTitle` (i18n action label, treat as user-content for tooltip) | P1 |
| B7 | `packages/client/src/components/Cards/Work/DraftCard.tsx:87-95` | `<div>` | `gardenName` | P1 |
| B8 | `packages/client/src/components/Features/Garden/Assessments.tsx:59-61` | `<h6>` | `assessment.title` | P1 |
| B9 | `packages/client/src/components/Features/Garden/Assessments.tsx:66` | `<p>` | `assessment.description` | P1 |
| B10 | `packages/client/src/components/Features/Garden/Assessments.tsx:215` | `<p>` | `fileName` (URL-derived) | P1 |
| B11 | `packages/client/src/components/Features/Garden/Gardeners.tsx:219` | `<Dialog.Title>` | `title` = username/email/phone/address/ENS | P1 |
| B12 | `packages/client/src/views/Home/Garden/index.tsx:402` | `<h1>` | `garden.name` | P1 |
| B13 | `packages/client/src/views/Profile/GardensList.tsx:174-176` | `<div>` | `garden.name` | P1 |
| B14 | `packages/client/src/views/Profile/GardensList.tsx:180` | `<span>` | `garden.location` | P1 |
| B15 | `packages/client/src/views/Profile/AccountInfo.tsx:84, 122` | `<div>` | i18n labels (Passkey/Wallet/Address) — not user-content; truncate present is *defensive*, no title needed | P2 |
| B16 | `packages/client/src/views/Profile/AppSettings.tsx:208` | `<div>` | i18n title (settings labels) — not user-content | P2 |

### B17. P0 — User-generated text rendered in a constrained-width container WITHOUT truncate/line-clamp
| # | File:line | Element | User-generated content |
|---|---|---|---|
| B17a | `packages/client/src/components/Features/Profile/Profile.tsx:51` | `<h5 class="font-semibold text-lg">` | `displayName` (profile/ENS/passkey) |
| B17b | `packages/client/src/views/Home/Garden/Assessment.tsx:89` | `<p>` | `garden.name` |
| B17c | `packages/client/src/views/Home/Garden/Assessment.tsx:90` | `<h1>` | `assessment.title` |
| B17d | `packages/client/src/views/Home/Garden/Assessment.tsx:91` | `<p>` | `assessment.description` |
| B17e | `packages/client/src/views/Home/Garden/Assessment.tsx:111` | inline | `assessment.location` |
| B17f | `packages/client/src/views/Home/Garden/index.tsx:407` | `<span>` | `garden.location` |
| B17g | `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:72` | `<p class="text-xs">` | `gardenName` |
| B17h | `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:248-250` | `<h4 class="text-xs uppercase">` | `group.gardenName` |
| B17i | `packages/client/src/views/Profile/ENSSection.tsx:272` | `<div class="font-mono text-sm">` | `existingSlug` |
| B17j | `packages/client/src/components/Features/Garden/Gardeners.tsx:111` | `<span class="font-semibold">` | `displayName` |
| B17k | `packages/client/src/components/Features/Garden/Gardeners.tsx:238` | `<span class="font-semibold">` | `selectedPreferredEnsName` |
| B17l | `packages/client/src/components/Features/Garden/Gardeners.tsx:283` | `<span>` | `selected.email` |
| B17m | `packages/client/src/components/Features/Garden/Gardeners.tsx:302` | `<span>` | `selected.phone` |
| B17n | `packages/client/src/views/Home/Garden/Notifications.tsx:52, 58` | `<span class="font-medium">` | gardener formatAddress + `garden.name` |
| B17o | `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:212-213` | `<Badge>` | `garden.location` (rendered as Badge child) |
| B17p | `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:233-236` | `<Badge>` | operator address/ENS via `renderOperatorName` |

All B17 entries are P0 — overflow risk on PT/ES + reachable PWA paths, user-generated content unconstrained.

---

## Sub-check C — Typography utility consistency (Rule 9)

Raw `text-*` + `font-*` Tailwind utilities used where typography tokens defined in `packages/client/src/styles/typography.css` (`label-md`, `label-sm`, `label-xs`, `body-{lg,md,sm}-{regular,medium}`, `title-{screen,section,subsection,body}`) and theme variables in `packages/shared/src/styles/theme.css` already cover the case.

### C1. Raw `text-sm font-medium` (and friends) on labels & form-card titles — high frequency
Tokenized equivalent: `label-md` (12 px / 16 lh / weight 500) or `body-md-medium` (14 px / 20 lh / weight 500) depending on intent.

| File:line | Pattern |
|---|---|
| `packages/client/src/components/Cards/Form/FormCard.tsx:23` | `<div className="px-2 font-medium ...">{label}</div>` |
| `packages/client/src/components/Cards/Work/DraftCard.tsx:77` | `<h4 className="font-medium text-sm ...">` |
| `packages/client/src/views/Profile/AccountInfo.tsx:84, 122` | `<div className="text-sm font-medium truncate">` |
| `packages/client/src/views/Profile/AppSettings.tsx:208, 226` | `<div className="text-sm font-medium ...">` |
| `packages/client/src/views/Profile/GardensList.tsx:174, 218` | `<div className="line-clamp-2 text-sm font-medium ...">`, `<p className="text-sm font-medium ...">` |
| `packages/client/src/views/Home/Garden/Work.tsx:390, 583` | `<h2 className="text-sm font-medium ...">`, `"text-sm font-medium"` |
| `packages/client/src/views/Garden/Details.tsx:229, 242, 306` | label/badge |
| `packages/client/src/views/Garden/Media.tsx:431, 447, 476` | similar |
| `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:69, 91, 119, 134` | balance line, inputs, button |
| `packages/client/src/components/Dialogs/ModalDrawer.tsx:116` | `<h2 className="text-lg font-semibold truncate">` |
| `packages/client/src/views/Home/WorkDashboard/index.tsx:374` | `<h2 className="text-lg font-semibold truncate">` |
| `packages/client/src/components/Features/Profile/Profile.tsx:51` | `<h5 className="font-semibold text-lg">` |
| `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:175` | `<h5 ... text-lg font-semibold ...">` |
| `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:226` | `<h4 ... text-sm font-medium ...">` |
| `packages/client/src/components/Communication/EmptyState.tsx:46-48` | `<h3 className="text-sm font-medium ...">`, `<p className="mt-1 text-sm leading-relaxed ...">` |

**Severity**: P1 — Rule 9 violation across most PWA chrome. Visible result: drift in line-height/letter-spacing whenever the design system tokens change, plus inconsistent rendering in dark mode where `text-text-strong-950` doesn't always pair with the semantic text-color the typography utility expects.

### C2. Raw `text-xs` body text — high frequency
Tokenized equivalent: `label-sm` (11 px / 16 lh / 500) or `body-sm-regular` (12 px / 16 lh / 400).

| File:line | Pattern |
|---|---|
| `packages/client/src/views/Home/Garden/Assessment.tsx:89, 103, 147, 218` | uppercase eyebrows + small body |
| `packages/client/src/views/Home/Garden/index.tsx:405, 410` | location + date row |
| `packages/client/src/views/Home/Garden/Work.tsx:345, 424, 466, 475, 646, 651` | hints, errors |
| `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:72, 74, 103, 109, 248` | jar metadata, garden header |
| `packages/client/src/views/Home/WorkDashboard/Drafts.tsx:151` | draft count badge |
| `packages/client/src/views/Profile/AccountInfo.tsx:95, 140` | sub-label, warning |
| `packages/client/src/views/Profile/AppSettings.tsx:209, 232` | description |
| `packages/client/src/views/Profile/Badges.tsx:167, 194, 221, 335, 404` | descriptions, badges |
| `packages/client/src/views/Profile/ENSSection.tsx:275, 331, 340, 359, 378, 393, 404, 409, 413, 439, 557, 566, 571` | helper text, errors, prepared-request output |
| `packages/client/src/views/Profile/Help.tsx:99, 124` | description |
| `packages/client/src/views/Profile/InstallCta.tsx:88, 156` | description |
| `packages/client/src/views/Garden/index.tsx:647` | queue status |
| `packages/client/src/components/Cards/Form/FormInfo.tsx:43` | sub-info text |
| `packages/client/src/components/Cards/Work/DraftCard.tsx:81, 87, 98` | status pill, subline, badges |
| `packages/client/src/components/Features/Garden/Assessments.tsx:62, 71, 83, 118` | metadata rows |
| `packages/client/src/components/Features/Garden/Gardeners.tsx:88, 112, 113, 255` | row sublines + badges |
| `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:239, 255-275` | subline + badge row |
| `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:184, 188, 198, 209, 221, 225, 231, 239` | stats badges, operator list |
| `packages/shared/src/components/SyncStatusBar.tsx:76, 92` | status + button |

**Severity**: P1 — Rule 9 violation, very high count.

### C3. Raw `text-base` body / hero text
| File:line | Pattern |
|---|---|
| `packages/client/src/views/Home/Garden/Assessment.tsx:129, 156, 185, 215, 272, 278` | `<h2 className="text-base font-semibold ...">` |
| `packages/client/src/components/Features/Garden/Assessments.tsx:59, 208, 272, 278` | `<h6 className="truncate text-base font-semibold ...">`, `<h2>` |
| `packages/client/src/components/Features/Garden/Gardeners.tsx:219` | `<Dialog.Title className="text-base font-semibold truncate">` |
| `packages/client/src/views/Profile/Help.tsx:98, 118` | `<div className="text-base">` |
| `packages/client/src/components/Navigation/SiteHeader.tsx:164, 261` | nav links |

Tokenized equivalent: `text-title-md` (16 px / 24 lh / 0.15px ls — present in shared theme) or `body-lg-medium` (16 px / 24 lh / 500 — in `client/styles/typography.css`).

**Severity**: P1.

### C4. Raw `text-2xl font-semibold` and `text-lg font-semibold` headings
| File:line | Pattern |
|---|---|
| `packages/client/src/views/Home/Garden/Assessment.tsx:90` | `<h1 className="text-2xl font-semibold ...">` user-generated `assessment.title` |
| `packages/client/src/views/Home/Garden/index.tsx:402` | `<h1 className="text-lg md:text-xl font-semibold line-clamp-2">{name}</h1>` |
| `packages/client/src/views/Home/WorkDashboard/index.tsx:374` | `<h2 className="text-lg font-semibold truncate">` |
| `packages/client/src/components/Dialogs/ModalDrawer.tsx:116` | `<h2 className="text-lg font-semibold truncate">` |
| `packages/client/src/components/Features/Profile/Profile.tsx:51` | `<h5 className="font-semibold text-lg">` |
| `packages/client/src/views/Home/Garden/Work.tsx:583` | tab item label sized via `cn("text-sm font-medium", ...)` |

Tokenized equivalent: `title-screen` / `title-section` / `title-subsection` (defined in `client/src/styles/typography.css` lines 27-46) or `text-headline-sm/md/lg` (defined in shared theme.css lines 14-22).

**Severity**: P1.

### C5. Arbitrary numeric values (font-size literals)
| File:line | Pattern | Why it drifts |
|---|---|---|
| `packages/shared/src/components/StatusBadge.tsx:371, 394, 419` | `text-[11px] font-semibold leading-none` | label-xs is 11 px / 16 lh in shared theme — should use `label-xs`. |
| `packages/client/src/views/Profile/Badges.tsx:372` | `text-[11px] font-medium` | Same — `label-xs` exists. |
| `packages/client/src/components/Dialogs/TreasuryDrawer/CookieJarCard.tsx:76` | `text-[10px] font-medium` | Below the smallest token; flag for design review whether 10 px is intentional. |
| `packages/shared/src/components/AddressDisplay.tsx:63` | `text-[10px] text-text-disabled` | Same. |
| `packages/shared/src/components/Canvas/WorkbenchRow.tsx:69` | `text-[0.72rem] font-bold tracking-[0.01em]` | Arbitrary rem + tracking literal (admin-only — out of scope but flagged for consistency). |
| `packages/client/src/views/Home/AppBar.tsx:95` | `text-[10px] font-bold` | Tab badge — could be `label-xs`. |
| `packages/client/src/views/Home/index.tsx:214` | `text-[10px] font-semibold leading-none` | Filter active count — could be `label-xs`. |

**Severity**: P2 (drift, not breakage).

### C6. `font-mono` used for non-code body text
| File:line | Pattern |
|---|---|
| `packages/client/src/views/Profile/ENSSection.tsx:272` | `<div className="font-mono text-sm font-medium ...">{existingSlug}</div>` |
| `packages/client/src/views/Profile/ENSSection.tsx:356` | input field for desired slug uses `font-mono text-sm` |
| `packages/client/src/views/Profile/ENSSection.tsx:439` | `font-mono text-[11px]` for prepared-request textarea |
| `packages/client/src/components/Features/Garden/Gardeners.tsx:255` | `<span className="text-text-sub-600 font-mono text-xs">{formatAddress(...)}</span>` |
| `packages/shared/src/components/AddressDisplay.tsx:45, 80` | `<button className="text-sm font-mono ...">{display}</button>`, `<span className="font-mono text-xs sm:text-sm">{displayValue}</span>` |

PWA is meant to be Inter (warm-earth client surface). `font-mono` is acceptable for raw addresses (intentional system-monospace for hex), but the ENS slug at line 272 is human text — `font-mono` is a stylistic choice that breaks the Inter rhythm in profile chrome.

**Severity**: P2 — design-language drift; consider whether ENS slug should be Inter.

### C7. Untokenized `leading-*` / `tracking-*` literals
| File:line | Pattern |
|---|---|
| `packages/client/src/views/Home/Garden/Assessment.tsx:89, 147, 156, 185, 215, 218` | `tracking-wide` literal pairing |
| `packages/client/src/components/Features/Garden/Assessments.tsx:62` | `tracking-wide` |
| `packages/client/src/components/Features/Garden/Gardeners.tsx:88` | `tracking-wide` (badge) |
| `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:248` | `tracking-wide` (uppercase header) |
| `packages/client/src/views/Garden/Review.tsx:153, 171` | `tracking-tight mb-1 uppercase` |
| `packages/client/src/views/Garden/Media.tsx:369, 385` | `tracking-tight mb-1 uppercase` |
| `packages/client/src/views/Home/Garden/Work.tsx:424` | `text-xs font-medium ... uppercase tracking-wide` |
| `packages/client/src/views/Profile/Badges.tsx:336` | `text-xs uppercase tracking-wide` (eyebrow) |
| `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:221` | `text-xs font-semibold uppercase tracking-wide` |
| `packages/shared/src/components/Canvas/WorkbenchRow.tsx:69` | `tracking-[0.01em]` |

The shared theme defines per-role letter-spacing (e.g. `--type-label-md-ls: 0.5px`, `--type-display-md-ls: 0px`) but PWA components fall back to `tracking-wide` (`0.025em`) and `tracking-tight` (`-0.025em`) without alignment to the design system.

**Severity**: P2 — minor letter-spacing drift; visible at uppercase eyebrow rows.

---

## Out-of-scope reminders
- `packages/client/src/views/Public/**` excluded.
- `packages/admin/**` excluded.
- `WorkbenchRow` / `WorkbenchList` (`packages/shared/src/components/Canvas/WorkbenchRow.tsx`) is admin-only; one finding (C7) about `tracking-[0.01em]` is informational, not actionable for this lane.
- PT translation completeness for `app.status.*` keys (currently English-stubbed in `pt.json`) is its own concern — flagged in Sub-check A16 as a downstream amplifier of the Rule 4 + truncation gap, but not a typography defect per se.
