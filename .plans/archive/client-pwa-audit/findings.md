# Client PWA Deep Audit — Synthesis

**Posture**: Read-only. Findings only. No fixes proposed.
**Scope**: PWA app routes — `/home/login`, `/home`, `/home/:id`, `/home/:id/work/:workId`, `/home/:id/assessments/:assessmentId`, `/home/garden`, `/home/profile`. **Not** the editorial `Public/*` website, **not** admin.
**Method**: 5 parallel lanes (translations, typography/overflow, color palette, motion/touch, component structure) — each lane is durable on disk:

- [01-translations.md](lanes/01-translations.md)
- [02-typography.md](lanes/02-typography.md)
- [03-color-palette.md](lanes/03-color-palette.md)
- [04-motion-touch.md](lanes/04-motion-touch.md)
- [05-component-structure.md](lanes/05-component-structure.md)

---

## Headline verdict

**The PWA is structurally healthier than it feels.** Hook boundary is clean (3 file-local exceptions, all defensible). No raw Tailwind `text-gray-*` / `bg-neutral-*` color literals in source. Zero `console.log`. Toast service consistent. `formatAddress` / `ImageWithFallback` single-source. Six `--spring-*` motion tokens consumed almost everywhere. `prefers-reduced-motion` covered globally. Logger discipline holds.

**The drift is concentrated in three patterns** that show up in 4 of 5 lanes:

1. **Drift in shared components that ship into PWA unchanged** — `ActionBannerFallback` (12 hex literals), `AudioPlayer` (rgb fallbacks), toast preset modules (English-only), `WorkCard` / `GardenCard` (truncate without title). Authors of PWA views are doing their job; the leakage is upstream.
2. **Two valid token dialects coexist in the same components** — `bg-bg-white` vs `bg-bg-white-0`, `border-stroke-sub` vs `border-stroke-sub-300`, raw `text-sm font-medium` vs the `label-md` token. The TreasuryDrawer / WalletDrawer / ConvictionDrawer family uses one dialect, the rest of the PWA uses the other. Pixels are identical; review noise is high; future migrations are guaranteed to miss callsites.
3. **Three competing dialog/drawer systems** — `DialogShell` (canonical), client-local `ModalDrawer`, raw `@radix-ui/react-dialog`. Each has its own focus trap, scroll lock, motion timing, and the work-approval / member-detail drawers are on the most reachable PWA paths.

---

## Cross-lane themes

### Theme 1 — Color inconsistency (your stated concern)

The literal-hex problem is **already solved** at the PWA-source level: zero authored hex/rgb literals in `views/`, `components/`, `routes/` outside one `var()` fallback. The "color inconsistency" you're sensing comes from elsewhere:

- **`ActionBannerFallback` (lane 03 A5, P0)** — 12 hex pairs in `packages/shared/src/components/Display/ActionBannerFallback.tsx:13-30` form domain-keyed gradients (SOLAR, AGRO, EDU, WASTE) that **don't match the existing `--domain-*-rgb` tokens** in `theme.css:404-411`. The fallback uses Tailwind `amber-500/emerald-900/blue-950/orange-950` family; the tokens are Warm Earth (deep moss / harbour blue / terracotta). Every action card whose image fails to load reaches for these. Single highest-leverage fix.
- **Token dialect split (lane 03 C1, P0)** — `bg-bg-white` vs `bg-bg-white-0` (and `stroke-sub` vs `stroke-sub-300`, `bg-weak` vs `bg-weak-50`, `text-text-strong` vs `text-text-strong-950`). Both forms are valid (`theme.css:1410-1415`). Mixed in the same file at TreasuryTabContent.tsx (`:107` suffixed, `:119` unsuffixed). Pick one dialect, ban the other. Mechanical sweep.
- **No per-garden tint token (lane 03 D1, P0)** — `--domain-*-rgb` exists for action domains, no equivalent for garden workspaces. Workspace color identity is a documented design intent (memory note `feedback_hub_ui_direction.md`); the tokens to anchor it don't exist. Token gap, not a code fix.
- **Shadow tokens have no dark-mode pair (lane 03 E2, P1)** — every `--shadow-*` is single-set. On `--neutral-950` dark surface, ink-tinted black shadows render as black-on-black, effectively invisible. Likely contributes to the "subtle wrong" feeling on dark mode.
- **`--color-primary` naming overload (lane 03 D3, P2)** — admin's primary is warm neutral; client's resolves to green (tertiary accent). Documented in theme.css; trips anyone reading both side-by-side.

### Theme 2 — Translation coverage and the toast i18n hole

- **25 message IDs referenced in PWA code don't exist in en.json (lane 01 B1, P0)** — they fall back to inline `defaultMessage` English literals for **all** locales, so es/pt users see English. Heaviest concentrations: ENS progress timeline (9 keys), garden update toasts (4 keys), notification drawer titles. Cheap win — every key already has a `defaultMessage` to lift.
- **Toast preset wiring gap (lane 01 C2, P0)** — `packages/shared/src/components/Toast/presets/{wallet,work,queue,validation,update,approval}.ts` each ship two parallel APIs: a hardcoded-English `xxxToasts` and an i18n-aware `createXxxToasts(formatMessage)`. The umbrella `createLocalizedToasts` is **exported but never imported.** Every PWA flow (work submit, queue sync, approval, PWA update, validation) uses the non-i18n version. Result: every transactional toast in the PWA renders English regardless of locale.
- **700 keys hold byte-identical values across en/es/pt (lane 01 A2, P1)** — strongest signal of untranslated content. Reachable PWA examples: `app.work.detail.feedback`, `app.assessment.continue`, `app.profile.gardens`, `app.error.boundary.action.tryAgain`. Many in `app.admin.*` are admin-internal and may be intentional.
- **Duplicate JSON row in es/pt (lane 01 A1, P0 file integrity)** — `app.home.work.offlineNotice` appears twice at lines 1445 and 1447 in both es.json and pt.json. JSON.parse silently keeps the last; the file is malformed but runtime is correct.
- **870 truly orphan keys (lane 01 B3, P2)** — `admin.assessments.*` (24 keys), `admin.gardens.*`, standalone `app.actions.*` blocks. Look like leftovers from the v0.192 admin restructure.
- **14 hardcoded English aria-labels (lane 01 C1, P1)** — Audio recorder/player, Offline indicator, SiteHeader, TopNav. Screen-reader users on es/pt hear English.

### Theme 3 — Typography overflow on PT/ES

PT/ES strings run 20–40% longer than EN. The PWA has a systemic Rule 4 gap: every `truncate` / `line-clamp-*` site that renders user-generated text is **missing a `title=` attribute** for hover/long-press tooltip. Plus 16 sites where user-generated text isn't truncated at all in constrained-width containers.

**P0 overflow sites on reachable PWA paths** (lane 02 sub-check A):
- `Features/Profile/Profile.tsx:51` — header `displayName`, no truncate, no title (full-width, ENS slugs up to ~38c overflow on 375px)
- `Home/Garden/Assessment.tsx:89-91` — three stacked unconstrained user-text rows (garden eyebrow + assessment title + description)
- `Home/WalletDrawer/CookieJarTab.tsx:248-250` — uppercase `<h4>` group header, no truncate
- `Home/WalletDrawer/CookieJarTab.tsx:69-77` — jar amount + gardenName (gardenName has no truncate)
- `Home/Garden/index.tsx:402-407` — garden name `line-clamp-2` no title; location `<span>` unconstrained
- `Profile/ENSSection.tsx:272-273` — ENS slug `font-mono` no truncate
- `Features/Garden/Gardeners.tsx:111-117, 238, 283, 302` — gardener display name + email + phone, all unconstrained
- Shared `WorkCard.tsx:226-253` — work title + gardener/garden subline truncate without title (used by every PWA list)

**Rule 9 token drift (lane 02 sub-check C)** — PWA-package code overwhelmingly uses raw `text-sm font-medium`, `text-xs text-text-sub-600`, `text-2xl font-semibold` instead of the `label-md` / `body-md-medium` / `title-screen` tokens defined in `client/styles/typography.css`. Very high count; mechanical sweep candidate.

### Theme 4 — Touch targets and motion drift

- **One P0 broken touch target (lane 04 C.1)** — `views/Garden/Media.tsx:530-574`: remove button is `w-8 h-8 p-1` (24×24 content box) containing a `RiCloseLine className="w-8 h-8"` (32px icon). The icon overflows the button, and the button is well under the 44×44 minimum on the primary submission path. Two compounding defects in one render site.
- **20+ bare Tailwind `transition-*` utilities (lane 04 A.1)** — `transition-colors`, `transition-transform`, `transition-all` without explicit duration/easing fall back to Tailwind's 150ms `cubic-bezier(0.4,0,0.2,1)`, which matches **none** of the six `--spring-*` tokens. Reduced-motion still covered by the global `*` override; this is token drift, not accessibility risk.
- **Drawer close buttons all 36px (lane 04 C.5, P1)** — `pwaDrawerStyles.closeButtonBase` + `p-2` + `RiCloseLine w-5 h-5` = 36px. Below 44px on every drawer in the PWA.
- **No drag-to-dismiss in any PWA drawer (lane 04 D.1, P1)** — `ModalDrawer` and the hand-rolled `WorkDashboard` clone both use backdrop-click + Escape only. Shared `BottomSheet` *does* implement react-spring drag dismissal but is admin-only.
- **Drafts refresh button 32px (lane 04 C.2, P1)** — `p-2` + `w-4 h-4` icon, no `tap-target-lg` outset. Drift from the established Home / TopNav pattern.
- **Two stagger animation systems with different cadences (lane 04 A.3)** — `stagger-item` with hardcoded 30ms step in `WorkListTab` vs `animate-stagger-in` with 50ms step in `utilities.css`.

### Theme 5 — Structural risks

- **Three competing dialog systems on PWA surfaces (lane 05 B1, P0)** — `DialogShell` (canonical) + `ModalDrawer` (client-local) + raw `@radix-ui/react-dialog` (`Gardeners.tsx`, `DraftDialog.tsx`, `Hero.tsx`). No shared focus-trap / scroll-lock / motion contract. Bug in one silently lives in two others.
- **Missing top-level error UI on `/home/:id/work/:workId` (lane 05 C1, P0)** — `Work.tsx:281-290` covers loading and not-found, but failed `gardensError` / `worksError` queries fall through to "work not found" instead of an error UI. The view itself is 664 LOC and growing into Hub-monolith territory.
- **`isGreenWillDeployed()` used exactly once in PWA scope (lane 05 C3, P1)** — `Profile/Badges.tsx:298`. Other gates use `vaults.length > 0` / `strategies.length > 0`, masking deployment gaps as data gaps — exactly the failure mode CLAUDE.md flags.
- **`bg-primary-action` button styling hand-rolled in 11 sites (lane 05 B4, P1)** — each with slightly different padding (`px-4 py-2` / `py-2.5` / `py-3` / `py-4`), radius (`rounded-md` / `rounded-lg` / `rounded-full`), and motion. Meanwhile the typed `<Button>` exists. Every variant is a future-migration miss.
- **Form rule (Rule 8) leaks (lane 05 E3, P1)** — `views/Garden/Details.tsx:4` imports `Control`, `UseFormRegister`, `UseFormSetValue` directly from `react-hook-form`. Only form in the PWA, only place the rule could be tested, and it leaks RHF as a public client dependency.
- **`/home/profile` lacks per-tab loading and error states (lane 05 C2, P1)** — top-level boundary catches runtime errors only; data-fetch errors for ENS/profile/badges have no UI.
- **Provider tree deviates from Rule 13 (lane 05 D2a, P1)** — `AppProvider > [router] > AppKitProvider > AuthGate` instead of `AppKitProvider > AuthProvider > AppProvider`. Sensible (lazy `WalletRuntimeProviders`) but undocumented exception.

---

## Master severity matrix (P0 only)

| # | Lane | Where | What |
|---|---|---|---|
| 1 | 04 | `views/Garden/Media.tsx:530-574` | Remove button is 24×24 with overflowing 32px icon on primary submission path |
| 2 | 05 | `Features/Garden/Gardeners.tsx`, `Dialogs/DraftDialog.tsx`, `Layout/Hero.tsx` | Raw `@radix-ui/react-dialog` bypasses both `DialogShell` and `ModalDrawer` |
| 3 | 05 | `views/Home/Garden/Work.tsx:281-290` | No top-level error UI for failed gardens/works queries; falls through to not-found |
| 4 | 03 | `shared/src/components/Display/ActionBannerFallback.tsx:13-30, 46` | 12 hex pairs ignore the existing `--domain-*-rgb` Warm Earth tokens |
| 5 | 03 | TreasuryDrawer / WalletDrawer / ConvictionDrawer family | `bg-bg-white` vs `bg-bg-white-0` dialect mixed inside same files |
| 6 | 03 | (token absent) | No per-garden / per-workspace tint token; documented design intent unrealized |
| 7 | 01 | 25 sites, e.g., `TopNav.tsx:102/108`, `WorkCard.tsx:67`, `ENSProgressTimeline.tsx:×9` | Message IDs missing from en.json — fall back to inline English for all locales |
| 8 | 01 | `shared/src/components/Toast/presets/*.ts` + 6 callsites | Toast presets ship English-only; every work-submit / queue-sync / PWA-update toast is English in es/pt |
| 9 | 01 | `i18n/{es,pt}.json:1445,1447` | Duplicate `app.home.work.offlineNotice` key; malformed JSON, runtime correct |
| 10 | 02 | `Features/Profile/Profile.tsx:51` | Header `displayName` fully unconstrained; ENS slugs overflow on 375px |
| 11 | 02 | `views/Home/Garden/Assessment.tsx:89-91` | Three stacked unconstrained user-text rows |
| 12 | 02 | `views/Home/WalletDrawer/CookieJarTab.tsx:248-250` | Uppercase group header `<h4>`, no truncate |
| 13 | 02 | `views/Home/WalletDrawer/CookieJarTab.tsx:69-77` | gardenName unconstrained inside drawer |
| 14 | 02 | `views/Home/Garden/index.tsx:402-407` | Garden name `line-clamp-2` no title; location unconstrained |
| 15 | 02 | `views/Profile/GardensList.tsx:174-180` | Garden card name + location truncated without title |
| 16 | 02 | `views/Profile/ENSSection.tsx:272-273` | ENS slug `font-mono` no truncate |
| 17 | 02 | `Features/Garden/Gardeners.tsx:111-117, 238, 283, 302` | Display name + ENS + email + phone all unconstrained |
| 18 | 02 | `shared/src/components/Cards/WorkCard/WorkCard.tsx:226-253` | Work title + subline truncate without title (used by every PWA list) |

**Counts**: 18 P0, ~32 P1, ~25 P2 (cross-lane).

---

## What's healthy (worth saying out loud)

- **Color authoring discipline at the PWA-source level** — zero raw `bg-gray-*` / `text-neutral-*`, zero authored hex/rgb in views/components. Rule 13 is being upheld.
- **Hook boundary** — three file-local hooks in client (`useMediaPreview`, `useTunnelUrl`, `useReceiptTokenFragmentScrub`); all justifiable. No deep imports from `@green-goods/shared/*`.
- **Toast service is single-source** — every callsite uses `toastService` from shared. (The i18n wiring is the issue, not the toast API.)
- **`formatAddress` / `ImageWithFallback` are single-source** — no hand-rolled truncation, no raw `<img>` for user content (two raw `<img>` for static `/icon.png` are defensible).
- **Six `--spring-*` motion tokens** consumed across 95%+ of explicit transitions. View Transitions API for SPA route transitions.
- **Global `prefers-reduced-motion: reduce` override** at `animation.css:409-417` neutralizes every CSS transition + keyframe — including bare Tailwind utilities. Token drift is token drift, not accessibility risk.
- **`PullToRefresh`** — single canonical implementation with non-passive listeners, resistance, reduced-motion, and `role="status" aria-live="polite"`.
- **`tap-target-lg::after` outset** is a clean idiom (32px visual, 48px effective) — works correctly where applied (Home toolbar, TopNav, WalletDrawerIcon, WorkDashboardIcon, DraftCard delete).
- **Zero `console.log/warn/error`** in client `src/`. Logger consistent.

---

## What this audit did not cover

- **Live DOM verification** — no Chrome MCP tab attached during the audit. All findings are source-truth from code.
- **Runtime validation** — `bun lint`, `bun run test`, `bun run lint:vocab`, `bun run check:design-tokens` not executed in this pass.
- **`/home/:id/assessments/:assessmentId`** — Lane 05 flagged this as a coverage gap; the 237-LOC view was not read end-to-end for state coverage (loading/empty/error/offline/unauthorized).
- **Editorial Public/* views** — explicitly excluded per scope.
- **Admin** — explicitly excluded.
- **Performance / bundle / a11y** beyond the touch-target and prefers-reduced-motion subsets covered in lane 04.

---

## Scope-lock prompt (for the next conversation)

The audit is read-only. Before any edit phase, pick which findings to lock in:

- **A. Highest-leverage single fixes** (touch every PWA surface) — `ActionBannerFallback` (P0, theme 1), toast preset i18n wiring (P0, theme 2), Rule 4 truncate-without-title sweep (P0, theme 3), Garden Media remove button (P0, theme 4).
- **B. Mechanical sweeps** (one-PR-each) — token dialect consolidation (theme 1 C1), bare Tailwind transition → spring tokens (theme 4 A.1), raw text-* → typography tokens (theme 3 sub-check C).
- **C. Structural debt** — three dialog systems consolidation (theme 5), `Work.tsx` decomposition (theme 5), `isGreenWillDeployed()` rollout (theme 5).
- **D. Token gaps** (design conversation, not code) — per-garden tint token (theme 1 D1), shadow dark-mode tokens (theme 1 E2), `--color-primary` naming (theme 1 D3).
- **E. Translation hygiene** (separate effort) — 25 missing keys lift, 700 trigram-identical triage, orphan namespace cleanup (theme 2).

Pick a slice. Each lane file has the full citations; this synthesis is the index.
