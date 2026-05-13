# Client PWA i18n Audit — Lane 01: Translations

**Scope**: PWA routes `/home/login`, `/home`, `/home/:id`, `/home/:id/work/:workId`, `/home/:id/assessments/:assessmentId`, `/home/garden`, `/home/profile`. Source dirs: `packages/client/src/views/{Login,Home,Garden,Profile,Landing}/**`, `packages/client/src/routes/**`, `packages/client/src/components/**` (excluding `Public/**`), and shared chain via `packages/shared/src/{components,hooks,providers}/**`. Out of scope: `packages/client/src/views/Public/**`, `packages/admin/**`.

**i18n stack**: `react-intl` (FormatJS), wired by `packages/shared/src/providers/App.tsx` (lines 5-7, 19-23, 224). `IntlProvider` is mounted in `App.tsx:224`. Locale switch via `gg-language` in `localStorage` and browser-language fallback (`App.tsx:96-98`). Locale files at `packages/shared/src/i18n/{en,es,pt}.json` re-exported from `packages/shared/src/i18n/index.ts:2-4`.

## Summary

The locale files all parse to the same 2979 unique keys, so the "2981 vs 2982 lines" discrepancy is real but cosmetic — caused by a duplicate JSON key in es/pt (see A1). Interpolation variables match across all three locales (zero real placeholder mismatches). Locale **values** are heavily under-translated: 700 keys hold byte-identical strings across en/es/pt and another ~750 keys are identical for one language pair (P1, see A2). 25 message IDs referenced in PWA-scope code do not exist in en.json (P0 for es/pt users — they fall back to the inline `defaultMessage` English string, see B1). The largest user-impact gap is in the toast preset layer: `packages/shared/src/components/Toast/presets/{wallet,work,queue,validation,update,approval}.ts` ship hardcoded English `*Defaults` records, the i18n factory wrappers (`createWorkToasts`, `createQueueToasts`, etc., and the umbrella `createLocalizedToasts`) are exported but never imported, and the work-submit / job-queue / PWA-update flows in PWA scope call the non-i18n version directly (P0 for es/pt UX, see C2).

Counts:
- en.json keys: **2979** (file lines: 2981)
- es.json keys: **2979** (file lines: 2982 — has 1 duplicate row)
- pt.json keys: **2979** (file lines: 2982 — has 1 duplicate row)
- Identical en==es==pt values: **700**
- Interpolation-variable mismatches (real, not ICU plural sub-messages): **0**
- Empty-string values: **0** in any locale
- Repo-wide message IDs referenced: **2109 unique** (excluding dynamic `${var}`)
- Repo-wide message IDs referenced but missing in en.json: **130** (25 in PWA scope, 105 admin-only)
- Truly orphan keys (in en.json, never referenced anywhere in repo, accounting for 17 dynamic prefix patterns): **870**

---

## Sub-check A: Key parity en/es/pt

### A1. P0 — Duplicate `app.home.work.offlineNotice` key in es.json and pt.json
- File: `packages/shared/src/i18n/es.json:1445` and `:1447`
- File: `packages/shared/src/i18n/pt.json:1445` and `:1447`
- The first occurrence (line 1445) is a stale, terser translation; the second (line 1447) is the current one. JSON.parse silently keeps the last, so runtime behaviour is correct, but the file is malformed by JSON convention and the dead row is misleading. This is the source of the "2981 vs 2982" line-count discrepancy. en.json:1446 has only one occurrence.
  - es.json:1445 — `"Estás desconectado. Conéctate para subir."`
  - es.json:1447 — `"Estás sin conexión. Lo enviaremos cuando vuelvas a conectarte."`
  - pt.json:1445 — `"Você está offline. Conecte-se para enviar."`
  - pt.json:1447 — `"Você está offline. Vamos enviar quando você se reconectar."`

### A2. P1 — 700 keys hold byte-identical values across en/es/pt
- These are flagged because identical-across-three-languages is the strongest signal of an untranslated key. Some are intentional (proper nouns, brand terms, single-word tokens like "ENS"/"NFT"), but the volume is large enough that it is likely a real translation gap.
- Distribution by top-level namespace (counts):
  - `app.*`: 588 (of which `app.admin.*`: 348, `app.garden.*`: 43, `app.contracts.*`: 31, `app.work.*`: 31, `app.actions.*`: 28, `app.deployment.*`: 25, `app.hypercerts.*`: 16, `app.listing.*`: 16, `app.error.*`: 12, `app.sidebar.*`: 7, `app.common.*`: 6, `app.status.*`: 6, `app.assessment.*`: 5, `app.conviction.*`: 3, `app.form.*`: 2, `app.profile.*`: 2, `app.toast.*`: 2, `app.treasury.*`: 2, `app.cookieJar.*`: 1, `app.domain.*`: 1, `app.yield.*`: 1)
  - `admin.*`: 76
  - `public.*`: 22
  - `cockpit.*`: 14
- PWA-scope examples (visible to gardeners):
  - `app.actions.detail.capitals` → `"Capitals"` (all three)
  - `app.actions.detail.media` → `"Media"`
  - `app.actions.detail.startTime` / `.endTime` → `"Start time"` / `"End time"`
  - `app.actions.notFound` → `"Action not found"`
  - `app.work.detail.feedback` → `"Feedback"`
  - `app.assessment.continue` → `"Continue"`
  - `app.profile.gardens` → `"Gardens"`
  - `app.error.boundary.action.tryAgain` → `"Try again"` (all three)
  - `app.toast.default.errorMessage` → `"Please try again."` (all three)

### A3. P1 — En==Es identical (any locale, asymmetric): 710; En==Pt identical: 707
- Closely tracks A2 — most overlap with the 700 trigram-identical keys.
- Asymmetric cases (10 pairs) suggest one locale was translated and the other was forgotten.

### A4. P2 — Interpolation variable parity: 0 real mismatches
- All 8 raw matches from the regex were false positives caused by ICU plural sub-message bodies (`{count, plural, one {action} other {actions}}` — `{action}` looks like a top-level variable but is a literal-substitution body). All real interpolation variables (`{count}`, `{address}`, `{id}`, `{campaign}`, `{amount}`, `{progress}`, etc.) match across the three locales. ICU `plural`/`select` clauses are correctly localised (e.g., `# jardín` / `# jardines` for es, `# jardim` / `# jardins` for pt).

### A5. P2 — Empty-string values: 0 across all three locales
- No empty translations.

### A6. P2 — Orphans in es/pt absent from en.json: 0
- After collapsing the duplicate row in A1, every es and pt key has a matching en key. No orphan-only translations.

---

## Sub-check B: Locale key usage

### B1. P0 — 25 message IDs referenced in PWA scope but missing from en.json
These render the inline `defaultMessage` (English) for **all** locales, since neither en.json nor es.json/pt.json contain them. Spanish/Portuguese users see English literals.

PWA scope (client + shared chain):
1. `app.hero.qr.ariaLabel` — `packages/client/src/components/Layout/Hero.tsx:163`
2. `app.home.notifications.drawerTitle` — `packages/client/src/components/Navigation/TopNav.tsx:102`
3. `app.home.notifications.pendingCount` — `packages/client/src/components/Navigation/TopNav.tsx:108` (with `{count}` plural)
4. `app.home.work.audioNotes` — `packages/client/src/components/Features/Work/WorkView.tsx:125`
5. `app.home.workApproval.actionExpired` — `packages/client/src/views/Home/Garden/Work.tsx:468`
6. `app.status.syncFailed` — `packages/client/src/components/Cards/Work/WorkCard.tsx:67`
7. `app.workDashboard.closeModal` — `packages/client/src/views/Home/WorkDashboard/index.tsx:393`
8. `admin.fileUpload.remove` — `packages/shared/src/components/FileUploadField.tsx:263` (used by Garden submit flow)
9. `app.deployment.openMinting.success` — `packages/shared/src/hooks/garden/useOpenMinting.ts:64`
10. `app.deployment.openMinting.updating` — `packages/shared/src/hooks/garden/useOpenMinting.ts:53`
11. `app.garden.update.maxGardeners.loading` — `packages/shared/src/hooks/garden/useUpdateGarden.ts:215`
12. `app.garden.update.maxGardeners.success` — `packages/shared/src/hooks/garden/useUpdateGarden.ts:225`
13. `app.garden.update.openJoining.loading` — `packages/shared/src/hooks/garden/useUpdateGarden.ts:167`
14. `app.garden.update.openJoining.success` — `packages/shared/src/hooks/garden/useUpdateGarden.ts:177`
15. `cockpit.notifications.unread` — `packages/shared/src/components/Canvas/NotificationPanel.tsx:104`
16. `cockpit.topBar.refresh` — `packages/shared/src/components/Canvas/AppBar.tsx:162`
17. `ens.status.active` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:110`
18. `ens.status.registering` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:98`
19. `ens.status.timedOut` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:121`
20. `ens.timeline.active` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:164`
21. `ens.timeline.copyMessageId` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:198`
22. `ens.timeline.messageId` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:186`
23. `ens.timeline.pending` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:159`
24. `ens.timeline.timedOut` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:169`
25. `ens.timeline.trackExplorer` — `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:214`

(Note: 105 additional missing-in-en.json IDs are referenced only in admin-scope code — out of scope for this lane. They include the entire `admin.greenWill.*` panel plus `app.admin.assessment.*` form-validation strings.)

### B2. P1 — 17 dynamic prefix patterns (parity-fragile)
These compose message IDs at runtime (`id: ` followed by a backtick template). They cannot be statically enumerated; if a new branch value is added, en.json must be updated in lockstep or the user sees the raw key. Prefixes resolved (only those that map into en.json):
- `app.admin.work.filter.` — `packages/admin/src/...`
- `app.community.weightScheme.`
- `app.domain.tab.`
- `app.garden.detail.activity.filter.`
- `app.garden.detail.range.`
- `app.garden.detail.section.`
- `app.garden.tags.`
- `app.hero.install.step.`
- `app.hypercerts.action.`
- `app.hypercerts.capital.`
- `app.hypercerts.domain.`
- `app.hypercerts.sdg.`
- `app.profile.help.faq.` (`packages/client/src/views/Profile/Help.tsx`)
- `app.submission.stage.`
- `cockpit.actions.status.`
- `public.fund.receipt.intent.` (out of scope)
- `public.fund.receipt.status.` (out of scope)

(Other dynamic patterns like `'work-'`, `'garden-'`, `'optimistic-'`, `'job-failed-'`, `'page-'`, `'alert-'`, `'action-'`, `'allocation-'`, `'assessment-'`, `'certificate:'`, `'work:'`, `'assessment:'`, `'hypercert-'` are toast IDs / element keys — they don't index into en.json.)

### B3. P2 — 870 truly orphan keys in en.json
After accounting for direct references and the 17 valid dynamic prefixes, 870 keys remain that are never referenced anywhere in `packages/{client,shared,admin}/src/`. Distribution:
- `app.*`: 612
- `public.*`: 142
- `cockpit.*`: 62
- `admin.*`: 52
- `legacy.*`: 2 (`legacy.redirect.compatibilityRoute`, `legacy.redirect.useSettings`)

Examples of likely-stale keys:
- `admin.assessments.*` (24 keys: `.title`, `.description`, `.empty.*`, `.table.*`, `.filterGarden`, `.searchPlaceholder`, etc.) — admin Assessments view appears to have been re-namespaced under `app.admin.assessment.*` without removing the old `admin.assessments.*` block.
- `admin.gardens.*` (multiple: `.title`, `.description`, `.empty.*`, `.indexerError.*`, `.gardenerCount`, `.operatorCount`) — same pattern, current admin code uses `app.admin.nav.gardens` etc.
- `app.actions.*` row (`.empty`, `.noDescription`, `.noResults`, `.resetFilters`, `.searchPlaceholder`, `.sort.default`, `.sort.recent`, `.sort.title`, `.title`, `.create`, `.count`) — looks like an old standalone Actions page that was decomposed.
- `legacy.redirect.compatibilityRoute`, `legacy.redirect.useSettings` — flagged by namespace as legacy already.

(The full orphan list lives at `/tmp/orphans.json` from the audit run; rerun with the helper script in this lane's working notes if needed.)

### B4. P2 — Duplicate-semantic keys: 221 distinct values are shared across multiple keys
Some are intentional (per-context translations of "Cancel", "Save", etc.) but several clusters look consolidatable. Most concentrated:
- `"Assessments"` — 12 keys (`admin.assessments.title`, `app.admin.nav.assessments`, `app.admin.nav.searchAssessments`, `app.garden.admin.assessmentsTable`, `app.garden.admin.assessmentsTitle`, `app.garden.admin.statAssessments`, `app.garden.assessments`, `app.garden.assessments.listTitle`, `app.garden.assessments.title`, `app.garden.detail.metric.assessments`, `app.sidebar.assessments`, `public.impact.totalAssessments`)
- `"Description"` — 10 keys
- `"Garden"` — 9 keys (mostly singular noun across contexts)
- `"Actions"`, `"Gardens"`, `"Impact"`, `"Reset filters"`, `"Cancel"`, `"Continue"`, `"Profile"`, `"Capitals"`, `"Community"`, `"Pending"`, `"Approved"`, `"Active"`, `"Status"`, `"Domain"`, `"Feedback"`, `"Cookie Jar"`, `"Contracts"`, `"Deployment"`, `"Expired"` — all 4–8 keys each
- `"Please try again."` — 5 keys (`app.account.logoutRetry`, `app.gardener.profile.update.error.message`, `app.home.work.retryFailedMessage`, `app.hypercerts.mint.error.generic.message`, `app.toast.default.errorMessage`)
- `"Garden not found"` / `"Garden not found."` — 5+ keys (mix of with/without trailing period — also a punctuation inconsistency)

---

## Sub-check C: Hardcoded user-facing strings

The PWA views themselves (`Login/`, `Home/`, `Garden/`, `Profile/`) are well i18n-covered: every `formatMessage` site supplies a `defaultMessage`, and views consistently route titles/messages through `intl`. The hardcoded strings cluster in three places: (a) accessibility attributes on shared and a few client components, (b) shared toast preset modules with English-only `*Defaults` records, and (c) thrown `Error` messages in shared hooks.

Total: **230 distinct findings** across PWA scope (raw scan in `/tmp/hardcoded3.json`). Representative sample below.

### C1. P1 — `aria-label` strings hardcoded in English (14 findings)
Screen-reader users on es/pt locales hear English.

- `packages/client/src/components/Communication/Offline/OfflineIndicator.tsx:68` — `"App is in offline mode"`
- `packages/client/src/components/Communication/Offline/OfflineIndicator.tsx:81` — `"App is back online"`
- `packages/client/src/components/Dialogs/DraftDialog.tsx:63` — `"Close"`
- `packages/client/src/components/Features/Garden/Gardeners.tsx:223` — `"Close modal"`
- `packages/client/src/components/Navigation/SiteHeader.tsx:155` — `"Main navigation"`
- `packages/client/src/components/Navigation/SiteHeader.tsx:227` — `"Mobile navigation"`
- `packages/client/src/components/Navigation/TopNav.tsx:92` — `"View notifications"`
- `packages/client/src/components/Navigation/TopNav.tsx:227` — `"Go back"`
- `packages/shared/src/components/Audio/AudioPlayer.tsx:140` — `"Audio progress"`
- `packages/shared/src/components/Audio/AudioPlayer.tsx:165` — `"Delete audio"`
- `packages/shared/src/components/Audio/AudioRecorder.tsx:225` — `"Start recording audio note"`
- `packages/shared/src/components/Audio/AudioRecorder.tsx:276` — `"Stop recording"`
- `packages/shared/src/components/Audio/AudioRecorder.tsx:297` — `"Confirm recording"`
- `packages/shared/src/components/Audio/AudioRecorder.tsx:311` — `"Discard recording"`

### C2. P0 — Toast preset modules ship English-only fallbacks; PWA flows use the non-i18n version
The toast presets at `packages/shared/src/components/Toast/presets/*.ts` each export two parallel APIs:
- `xxxToasts` — non-i18n, uses hardcoded English strings from a local `*Defaults: Record<string,string>` (the title/message fields flagged by the regex below).
- `createXxxToasts(formatMessage)` — i18n-aware factory wrapping the same calls with `formatMessage({...})`.

`createLocalizedToasts` (`packages/shared/src/components/Toast/presets.ts:38-47`) bundles all factories. Only the i18n-aware version localises. Repo grep shows `createLocalizedToasts` is **exported but never imported**. The non-i18n callers are inside the PWA chain:

- `packages/shared/src/providers/JobQueue.tsx:172,183,216,223,312,370,372,380,382` — sync/job-completion toasts via `queueToasts.*`
- `packages/shared/src/providers/Work.tsx:288` — `validationToasts.formError(errors[0])`
- `packages/shared/src/hooks/work/useWorkMutation.ts:196,198,404,407,438,446,573` — `workToasts.*`, `walletProgressToasts.*`, `showWalletProgress(stage, msg)`
- `packages/shared/src/hooks/work/useBatchWorkSync.ts:170,172,210` — `queueToasts.*`
- `packages/client/src/main.tsx:44,47` — `updateToasts.available(applyUpdate)`, `updateToasts.updating()`
- `packages/shared/src/utils/errors/mutation-error-handler.ts:141` — `walletProgressToasts.error(...)`

Hardcoded strings in those preset modules (sample):
- `packages/shared/src/components/Toast/presets/wallet.ts:6-15` (the `walletDefaults` record): `"Checking membership"`, `"Verifying garden access..."`, `"Uploading media"`, `"Saving images to IPFS..."`, `"Confirm in wallet"`, `"Waiting for your signature..."`, `"Almost there"`, `"Syncing with blockchain..."`, `"Work submitted!"`, `"Your contribution is now on-chain"`, `"Submission failed"`, `"You can try again with the same data."`, `"Taking longer than usual"`, `"Your transaction is still processing. Check your wallet for status."`
- `packages/shared/src/components/Toast/presets/work.ts:6-9` (the `workDefaults` record): `"Submitting work"`, `"Processing your submission..."`, `"Work submitted"`, `"Your work is now on-chain"`, `"Saved offline"`, `"Work added to upload queue"`, `"Work submission failed"`
- `packages/shared/src/components/Toast/presets/queue.ts:6-19`: `"Work uploaded"`, `"Submission confirmed."`, `"Approval sent"`, `"Status updated."`, `"Offline jobs synced"`, `"Some jobs failed to sync"`, `"We'll retry automatically in the background."`, `"Sync failed"`, `"Still queued"`, `"No pending jobs to sync."`
- `packages/shared/src/components/Toast/presets/approval.ts:6-21`: `"Submitting approval"`, `"Approving work..."`, `"Submitting decision"`, `"Recording decision..."`, `"Confirm in your wallet"`, `"Waiting for wallet confirmation..."`, `"Approval submitted"`, `"Decision recorded."`, `"Decision submitted"`, `"Feedback recorded."`, `"Approval saved offline"`, `"Decision saved offline"`, `"Approval failed"`, `"Decision failed"`, `"Transaction failed. Check your wallet and try again."`, `"We couldn't send the approval. We'll retry shortly."`, `"We couldn't send the decision. We'll retry shortly."`
- `packages/shared/src/components/Toast/presets/update.ts:7-12`: `"Update available"`, `"A new version of Green Goods is ready."`, `"Updating..."`, `"Refreshing to the latest version."`
- `packages/shared/src/components/Toast/presets/validation.ts:6` — `"Check your submission"`

User impact: every work submission, approval, queue sync, and PWA-update lifecycle event in es/pt presents English copy. The infrastructure to localise it already exists; the wiring is missing.

### C3. P1 — Hardcoded JSX text in shared components reachable from PWA
- `packages/shared/src/components/ErrorBoundary/ErrorBoundary.tsx:111` — `"Something went wrong"` (PWA crashes show English regardless of locale)
- `packages/shared/src/components/DatePicker/DatePicker.tsx:133` and `DateRangePicker.tsx:176` — `"Required"` (used in Garden submit form)
- `packages/shared/src/components/DatePicker/DatePicker.tsx:81` — `placeholder="Select date"`
- `packages/shared/src/components/Conviction/WeightAllocator.tsx:81` — `"My voting weight"`
- `packages/shared/src/components/TranslationBadge.tsx:16` — `"Auto-translated"`
- `packages/shared/src/components/Dialog/ImagePreviewDialog.tsx:38` — `title: "Image preview"`

### C4. P1 — Hardcoded JSX text in client components
- `packages/client/src/components/Errors/AppErrorBoundary.tsx:188` — `"Component Stack:"` (dev-mode only — the surrounding error boundary copy IS i18n'd, lines 136-222; this single label is the dev-debug stack header, marginal user impact)
- `packages/client/src/components/Layout/Hero.tsx:171` — `"Scan to test on device"` (dev-only tunnel preview; tunnelUrl-gated, P2)
- `packages/client/src/components/Layout/Hero.tsx:388` — `alt="Green Goods App Mockup"` (likely intentional brand string but should still be localised for screen-readers)
- `packages/client/src/components/Features/Garden/Gardeners.tsx:105` — `alt="Profile"`

### C5. P1 — Toast strings constructed in shared hooks bypass formatMessage
- `packages/shared/src/providers/JobQueue.tsx:355-356` — `title: "Cannot sync", message: "Please sign in to sync your queue."`
- `packages/shared/src/providers/JobQueue.tsx:376-379` — `reason` text composed from `"Reconnect to the internet to finish syncing."` / `"Sign in to continue syncing."` / `"We'll retry shortly."`
- `packages/shared/src/providers/JobQueue.tsx:387-388` — `title: "Queue sync failed", message: "Please try again."`
- `packages/shared/src/hooks/garden/createGardenOperation.ts:205` — `"Please connect your wallet to continue"`
- `packages/shared/src/hooks/garden/createGardenOperation.ts:224` — `"Hats module is not configured for this garden"`
- `packages/shared/src/hooks/garden/useGardenOperations.ts:190` — `"Please connect your wallet to continue"`
- `packages/shared/src/hooks/garden/useAutoJoinRootGarden.ts:227,252,279,316` — `"You're now part of the community garden."`, `"Please try again from your profile."`, `"You can join the community garden anytime from your profile."`, `"Please confirm with your passkey..."`

### C6. P2 — Thrown `Error` messages with English literals (100 findings)
These typically surface only via `toast.error({ error })` where the toast component formats only the title/message (not the underlying `error.message`), so they reach the user only in raw error dumps or debug mode. Sample:
- `packages/client/src/views/Login/index.tsx:192` — `throw new Error("Authentication failed")`
- `packages/client/src/views/Profile/AccountInfo.tsx:47` — `throw new Error("Logout failed")`
- `packages/client/src/views/Landing/index.tsx:24` — `throw new Error("Network response was not ok.")`
- `packages/shared/src/components/Audio/AudioRecorder.tsx:171` — `"Microphone access denied. Please allow microphone permissions."` (this surfaces in mic-blocked toast — likely visible to user, P1)
- `packages/shared/src/components/Display/ImageWithFallback.tsx:59,67,93` — `"No URLs to race"`, `"Gateway race timed out"`, `"All gateways failed"` (debug-only, P2)
- `packages/shared/src/hooks/ens/useENSReleaseName.ts:82,92,166` — `"ENS module not configured for this network"`, `"Passkey smart account not ready"`, `"No connected account"` (Profile ENS flow — these can reach the user via toast, P1)
- `packages/shared/src/hooks/ens/useENSClaim.ts:73,91,96,148` — same family
- `packages/shared/src/hooks/gardener/useGardenerProfile.ts:142,161,214,224` — `"Not authenticated"`, `"Smart account not initialized"`
- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:175,188,381,388` — `"Garden form is incomplete"`, `"Connect a wallet to deploy the garden"`, `"Connect a wallet to estimate deployment cost"` (admin-only, out of scope but flagged for completeness)
- `packages/shared/src/hooks/garden/useGardenInvites.ts:52,106` — `"Wallet not connected"`
- `packages/shared/providers/Auth.tsx:357` — `"Display name must be at least 3 characters"` (visible in profile rename — P1)

(The full 100 are in `/tmp/hardcoded3.json` for follow-up.)

### C7. P2 — Hero uses `formatMessage` but `tunnelUrl` text is dev-only English
`packages/client/src/components/Layout/Hero.tsx:171` — `<span>Scan to test on device</span>` is gated on `tunnelUrl` truthy (tunnel mode only), which is a dev-stack-only path. Marginal user impact in production.

---

## Notes for implementation

1. The 25 missing keys (B1) are the cheapest P0 wins: each one already has a `defaultMessage` that can be lifted into en.json, then translated into es/pt.
2. The 700 trigram-identical values (A2) would benefit from a triage list — many in `app.admin.*` are admin-internal strings that may justifiably stay English, but `app.actions.*`, `app.garden.*`, `app.work.*` and `app.error.*` reach gardeners directly.
3. The toast preset i18n gap (C2) is the single highest-leverage fix: `createLocalizedToasts(formatMessage)` is a one-line wiring in the providers (or a hook that does the binding once), and the message IDs are already declared in `presets/types.ts`. The non-i18n exports could remain for SSR/early-boot paths but should not be the default in PWA flows.
4. The duplicate `app.home.work.offlineNotice` row (A1) should be deleted from es.json:1445 and pt.json:1445 (keeping the longer, more accurate translation at line 1447 in each). en.json:1446 is fine as-is.
5. The orphan namespace blocks (B3) — `admin.assessments.*`, `admin.gardens.*`, `app.actions.*` standalone — look like leftovers from the v0.192 admin restructure. A dedicated cleanup pass after confirming with admin code archaeology would shrink the locale files by ~30%.
