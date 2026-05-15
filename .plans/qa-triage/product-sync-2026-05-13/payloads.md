# Linear payloads — Product Sync 2026-05-13

**Customer Need labels (all 27 records)**: `protocol:green-goods`, `source:drive`, `agent:claude`

**Issue labels (21 Issues)**: `protocol:green-goods`, `package:<inferred>`, `activity:qa`, `source:drive`, `agent:claude`

Status: `Todo` (well-scoped). Reporter context (attendees from notes): Afo, Gui, Matt, Caue, Nansel.

---

## Issue + Customer Need (21)

### [1] Cached old landing page redirects users away from /fund
- Assignee: Afo · Package: `client` · Severity: P1 · Test: PUB-001
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Matt Strachman. Verbatim: *"When I click that link, the slashf fun, it just redirects me back to landing"*
- **Issue body**:
  - Summary: Browser cache holds the old landing page; hitting `greengoods.app/fund` redirects users back to the old landing rather than serving the new /fund route.
  - Surface: Public Website (`/fund`)
  - Repro: Open a Brave/Chrome profile that has cached an earlier version of greengoods.app, then navigate to greengoods.app/fund.
  - Expected: /fund route loads.
  - Actual: Redirects to outdated landing page; fresh profile + inspector + cache-bypass workaround needed.
  - PostHog: weak signal on `greengoods.app/` (2 sessions 14d). Exception payload null.
  - Suggested fix: Audit service worker cache strategy + add cache-busting headers on /fund route shipping; investigate why old SW is serving redirect.

### [2] Connect Wallet button persists after wallet connected — blocks all wallet transactions
- Assignee: Afo · Package: `client` · Severity: **P0** · Test: PUB-004
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Matt Strachman. Verbatim: *"It gives me the connect wallet button at the bottom not like a submit transaction if I click connect wallet um it pops pops up and it shows my wallet that's already connected... instead of a submit button, it still just shows connect wallet even though my wallet's connected."*
- **Issue body**:
  - Summary: After a user connects their wallet on `/fund` (donate + endow) or `/cookies` deposit, the CTA never transitions from "Connect Wallet" to "Submit transaction". Clicking it just re-opens the wallet modal showing the connected wallet. Blocks every wallet-based transaction on the public website.
  - Surface: Public Website (`/fund` donate, `/fund` endow, `/cookies`)
  - Repro: 1) Visit greengoods.app/fund. 2) Click Endow → Pay with Wrapped Ether. 3) Type dollar amount. 4) Click "Connect Wallet" button. 5) Wallet modal opens showing connected wallet. 6) Close modal. CTA still says "Connect Wallet" — never becomes "Submit". Same on greengoods.app/cookies deposit flow.
  - Expected: Once wallet is connected, CTA transitions to "Submit transaction" so the user can sign.
  - Actual: CTA stuck on "Connect Wallet" indefinitely; no path to submit.
  - PostHog: 2 sessions on `/cookies?campaign=earth-week-fund` and 2 on `/` (14d). Exception payload null.
  - Suggested fix: Review wagmi/RainbowKit isConnected → button-state logic in the fund and cookies flows. Likely a stale React state dep or memo not picking up wallet-connect events.

### [6] Cookie Jar balance requires manual page refresh
- Assignee: Afo · Package: `client` · Severity: P2 · Test: PUB-008
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Afolabi Aiyeloja. Verbatim: *"Now the page book saying okay let me make sure I'm not going crazy... I had to refresh the page... it's not really a bug, but more of a better functionality. Should be uh automatic balance update."*
- **Issue body**:
  - Summary: After completing a swap on Arbitrum to acquire deposit token, the Cookie Jar balance UI doesn't auto-update — user must manually refresh page before deposit becomes possible.
  - Surface: Public Website (`/cookies`)
  - Repro: 1) Open greengoods.app/cookies. 2) Try to deposit but lack the token. 3) Use external swap on Arbitrum to acquire token. 4) Return to /cookies tab. 5) Balance still shows zero / "can't deposit" until manual reload.
  - Expected: Balance auto-refreshes (TanStack Query polling, on-focus, or web3 event subscription).
  - Actual: Stale balance until reload.
  - PostHog: 2 sessions on `/cookies?campaign=earth-week-fund` (14d).
  - Suggested fix: Add TanStack Query `refetchOnWindowFocus` for balance queries, or subscribe to Arbitrum balance events via viem.

### [7] Brave install creates browser shortcut, not real PWA install
- Assignee: gferreira525 · Package: `client` · Severity: P1 · Test: PWA-AND-001
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"I installed it then I open it again on the browser and the message of to install appeared again. So I click on that and install it twice."*
- **Issue body**:
  - Summary: When user installs the PWA from Brave (Android), Brave creates a browser-tab shortcut rather than a real PWA install. The install prompt keeps appearing each time the user opens the site, so they end up "installing" multiple times. Chrome installs correctly.
  - Surface: PWA Android (Brave)
  - Repro: 1) Open greengoods.app in Brave on Android. 2) Tap "Install app" prompt. 3) Open app from home screen. 4) Open greengoods.app in Brave again — install prompt re-appears.
  - Expected: Either Brave installs the PWA properly, or the app detects Brave and surfaces a "Please use Chrome to install" warning before letting the user tap Install.
  - Actual: Brave installs a shortcut only; user is confused and installs multiple times.
  - Suggested fix: Browser detection (`navigator.userAgentData.brands`) → warn-and-redirect-to-Chrome banner when Brave is detected at the install prompt. Cheap first task.

### [8] "Updating" state hangs 3+ minutes after Update App click
- Assignee: gferreira525 · Package: `shared` · Severity: P1 · Test: PWA-AND-002
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"I am frozing at updating refreshing to the latest version" / "I am almost three minutes waiting and uh it's still loading"*
- **Issue body**:
  - Summary: After clicking "Update App" in the installed PWA, the app gets stuck on "Updating refreshing to the latest version…" indefinitely (>3 minutes observed in QA, never completed during the session).
  - Surface: PWA Android (Chrome)
  - Repro: 1) Install greengoods.app PWA via Chrome on Android. 2) Wait for the in-app "Update available" prompt to appear. 3) Tap Update. 4) App shows "Updating…" indefinitely.
  - Expected: Service worker updates → reload → app on new version within ~30s.
  - Actual: Stuck on Updating screen for 3+ minutes.
  - Suggested fix: Check service worker `skipWaiting` + `clientsClaim` logic. Add a 60s timeout that falls back to "Please close and reopen the app" message. Investigate whether the new SW is actually downloading (DevTools → Application → Service Workers).

### [9] "Update App" button shows even when on latest version
- Assignee: gferreira525 · Package: `client` · Severity: P2 · Test: PWA-AND-002
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"I keep seeing uh available update app button and like it should only be available if I don't have the most recent version"*
- **Issue body**:
  - Summary: The "Update App" button is always visible regardless of whether an actual update is available. Users see it persistently and start to think the app is broken.
  - Surface: PWA (cross-platform — symptom observed on Android, very likely affects iOS)
  - Repro: Install PWA, finish update if any, observe UI — "Update App" button still shown despite being on latest version.
  - Expected: Button gated on `registration.waiting` being non-null (new SW waiting to activate).
  - Actual: Button always rendered.
  - Suggested fix: In the component that renders the Update CTA, check `serviceWorkerRegistration.waiting !== null` before rendering. Likely sibling to the Update logic from item #8.

### [10] After uninstall, Chrome refuses to re-install — only shows "Open the app"
- Assignee: gferreira525 · Package: `client` · Severity: P1 · Test: PWA-AND-001
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"now I open the Chrome and I cannot install it again. I I I keep seeing open the app instead of installing... I already cleaned the cash."*
- **Issue body**:
  - Summary: After uninstalling the PWA from Android, Chrome stops offering the install prompt — it only shows "Open the app" link. Workaround requires manual install via the three-dot menu.
  - Surface: PWA Android (Chrome)
  - Repro: 1) Install greengoods.app via Chrome on Android. 2) Uninstall (Apps → uninstall). 3) Clear browser cache for greengoods.app. 4) Open greengoods.app in Chrome — still shows "Open the app".
  - Expected: Install prompt re-appears since the PWA is no longer installed.
  - Actual: Chrome treats the manifest as already-installed even after uninstall.
  - Suggested fix: Look at the manifest's `scope` + `start_url` combination — Chrome may be matching by scope. May need to add `display_override` or adjust `scope` strategy. Could also be an Android-side cache issue Chrome won't release without a system restart.

### [11] Browser version stuck on "Open the app" page after install
- Assignee: gferreira525 · Package: `client` · Severity: P1 · Test: PWA-AND-001
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"after I install the app, I'm not able to login in the browser anymore because it only shows like open the app page"*
- **Issue body**:
  - Summary: After installing the PWA, the same URL in browser (Chrome) becomes unusable — instead of the app, it just shows a "Open the app" intercept page. Users can't login via browser even when they want to.
  - Surface: PWA Android (Chrome) / Cross Surface
  - Repro: 1) Install PWA. 2) In Chrome browser, go to greengoods.app. 3) Site renders only "Open the app" CTA — no login form, no website content.
  - Expected: Browser version functions independently of installed-PWA presence (same code, different display mode).
  - Actual: Detection logic dumps installed-PWA users into a redirect-to-app intercept page.
  - Suggested fix: Check the PWA presentation-mode detection (per `getClientPresentationMode` in `packages/shared/src/utils/app/pwa.ts`). Likely an over-eager "if PWA is installed, redirect from browser to app" rule. May be related to caching from a service worker version mismatch.

### [13] Profile page columns break on long garden names
- Assignee: gferreira525 · Package: `client` · Severity: P2 · Test: XPLAT-001
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"on profile page uh with long guardian's name the um the columns uh got broken and we can't read everything"*
- **Issue body**:
  - Summary: Profile page columns misalign / overflow when a garden name is long, hiding content.
  - Surface: PWA / Cross Surface (client)
  - Repro: Open a profile page for a user who's in a garden with a long name (e.g., 30+ chars).
  - Expected: Garden name truncates with ellipsis or wraps, preserving column alignment.
  - Actual: Column breaks; can't read everything.
  - Suggested fix: Add `truncate` / `text-ellipsis` Tailwind utility on the garden name span. Or set `min-width: 0` on the flex item containing the name to allow shrinking. CSS-only fix.

### [14] Passkey created in browser doesn't transfer to PWA
- Assignee: Afo · Package: `shared` · Severity: P1 (architectural) · Test: PWA-IOS-003 (auth)
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"I had created an account uh on the browser but uh like uh I need to create a new one. It doesn't read my pass key uh in the app."*
- **Issue body**:
  - Summary: A passkey created via browser cannot be used to log into the installed PWA on the same device — PWA treats the keystore as a separate environment, forcing the user to re-register. Underlying smart-account architecture limitation; partial driver of the strategic passkey-removal decision aligned in this sync.
  - Surface: Cross Surface (Auth)
  - Repro: 1) Create account on greengoods.app in browser using passkey. 2) Install PWA. 3) Open PWA, attempt to sign in with passkey. 4) PWA prompts to create a new passkey, doesn't recognize the browser one.
  - Expected: Same Google-Password-Manager-stored passkey works across browser and PWA on same device.
  - Actual: Separate keystore per environment.
  - Suggested fix: Architectural — tied to passkey-removal decision. Either implement cross-device recovery for the smart-account wallet, or (per aligned decision) prioritize sign-in-with-wallet + social login and deprioritize passkeys. Coordinate with item #15.

### [16] "Log in with Google" errors on first attempt, succeeds on retry
- Assignee: Afo · Package: `shared` · Severity: P1 · Test: XPLAT-003
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"I click it on login with email with Google and then I receive an error message and then I click it again and it logged in"*
- **Issue body**:
  - Summary: Social login via Google errors on first click, succeeds on retry. Flaky auth flow; users may give up before second click.
  - Surface: PWA / Auth
  - Repro: 1) On PWA login screen, click "Log in with Google". 2) Google OAuth modal opens, errors. 3) Click again — login succeeds.
  - Expected: First click works reliably.
  - Actual: First click fails ~50% of the time.
  - Suggested fix: Likely a race condition in the OAuth callback handler or AppKit initialization. Inspect network tab on first attempt to capture the actual error response. May be related to the passkey-removal architectural change in flight.

### [17] Cannot log back in after passkey logout
- Assignee: Afo · Package: `shared` · Severity: P1 · Test: XPLAT-003
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Guilherme Ferreira. Verbatim: *"if I create an account uh with a pass key then I log out then I I cannot enter with the same account"*
- **Issue body**:
  - Summary: User creates account with passkey → logs out → cannot sign back in with the same account using the same passkey. Re-entry broken.
  - Surface: PWA / Auth
  - Repro: 1) Create new account with passkey. 2) Logout. 3) Attempt to sign in with same passkey — fails.
  - Expected: Same passkey re-authenticates the user.
  - Actual: Auth flow rejects re-entry.
  - Suggested fix: Architectural — tied to passkey-removal decision. May resolve itself once social login is the default auth path. Investigate whether the smart-account address is properly persisted post-logout.

### [18] Admin garden switch hangs the entire UI
- Assignee: Afo · Package: `admin` · Severity: **P0** · Test: ADM-002
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Caue Tomaz. Verbatim: *"when I try to change the garden on the admin dashboard uh the buttons and the the whole page to be honest uh stop stopped to work. It's like it's loading. The the mouse doesn't change anymore like on buttons and things like that or links"*
- **Issue body**:
  - Summary: Switching gardens in Admin Dashboard (specifically from Green Goods Community Garden to Grow Ecosystem) freezes the entire UI — buttons stop responding, cursor doesn't change on hover, all interaction dies. Blocks operator workflows.
  - Surface: Admin Dashboard
  - Repro: 1) Open admin.greengoods.app/hub. 2) Switch garden from "Green Goods Community Garden" to "Grow Ecosystem". 3) UI freezes — every button/link unresponsive.
  - Expected: Garden context switches; new garden's data loads.
  - Actual: UI hangs; URL updates but rendered content does not (see item #20).
  - PostHog: errors clustered on `admin.greengoods.app/` and `admin.greengoods.app/garden` during the sync window (2026-05-13 10:55-10:57 PDT, 3-4 affected sessions). Exception payload null.
  - Suggested fix: Likely a stale React state / Zustand store not resetting on garden change. Check the garden-selection effect chain in admin shell. May need to invalidate TanStack Query cache + reset relevant Zustand slices on garden change.

### [19] Joining a garden redirects to Green Goods Garden incorrectly
- Assignee: Afo · Package: `admin` · Severity: P1 · Test: ADM-002
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Caue Tomaz. Verbatim: *"I join grow ecosystem but when I click to the vault I automatically change to green goods garden"*
- **Issue body**:
  - Summary: User joins a non-default garden (Grow Ecosystem); subsequent navigation to vault dumps them back into Green Goods Garden instead.
  - Surface: Admin Dashboard
  - Repro: 1) Join Grow Ecosystem garden. 2) Click into vault. 3) Vault loads under Green Goods Garden context.
  - Expected: Vault loads under the user's currently-selected garden.
  - Actual: Default-garden override on subroute navigation.
  - Suggested fix: Probably the same root cause as #18 — garden context not propagating to vault route. Check whether vault route reads garden from URL/store vs falling back to a default.

### [20] URL updates when switching gardens but UI doesn't refresh
- Assignee: Afo · Package: `admin` · Severity: P1 · Test: ADM-002
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Afolabi Aiyeloja (observing). Verbatim: *"I'm looking at the browser URL and I think it's changing, but it's the UI isn't changing"*
- **Issue body**:
  - Summary: When switching gardens, the address-bar URL reflects the new garden but rendered content stays on the old garden's view. Visible from screen-share comparison.
  - Surface: Admin Dashboard
  - Repro: Same as #18 — switch garden, observe URL + UI diverge.
  - Expected: URL change ↔ UI render in sync.
  - Actual: URL updates; UI lags or freezes.
  - Suggested fix: Likely the same root as #18. The garden change is triggering a navigation but the layout component isn't re-mounting / re-querying.

### [21] No visible scrollbar on Admin tabs
- Assignee: Afo · Package: `admin` · Severity: P2 · Test: ADM-001
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Caue Tomaz. Verbatim: *"I cannot uh scroll down here. There there is no bar for me to scroll down. I need to to kind of uh do this."*
- **Issue body**:
  - Summary: Admin Dashboard tabs/content lack a visible scrollbar — Caue had to use trackpad gestures to scroll instead of a normal scrollbar UI.
  - Surface: Admin Dashboard
  - Repro: Open admin dashboard, navigate to a content tab with > viewport-height of content, attempt to scroll using the mouse on the right edge.
  - Expected: Standard scrollbar appears, user can drag.
  - Actual: No visible scrollbar; only gesture-scroll works.
  - Suggested fix: Check `overflow: auto` vs `overflow: scroll` and remove any `scrollbar-width: none` / `::-webkit-scrollbar { display: none }` overrides. CSS-only.

### [22] Admin Dashboard layout doesn't use full screen
- Assignee: Afo · Package: `admin` · Severity: P2 · Test: ADM-001
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Afolabi Aiyeloja (observing). Verbatim: *"Why isn't it taking advantage of all the... The fact you have to do that is crazy."*
- **Issue body**:
  - Summary: Admin Dashboard content is constrained to a small area while viewport is much larger. Layout doesn't adapt to screen size.
  - Surface: Admin Dashboard
  - Repro: Open admin dashboard on a typical desktop viewport (1440x900+). Content area fills only a fraction of the available space.
  - Expected: Layout fills the viewport, respecting max-width tokens for content lines but using available space.
  - Actual: Content boxed into a small inner region.
  - Suggested fix: Inspect the admin shell's max-width / container constraints. May be a leftover from mobile-first refactor where desktop breakpoint wasn't expanded.

### [23] Media uploads show as link only — not displaying correctly
- Assignee: Afo · Package: `admin` · Severity: P1 · Test: ADM-011
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Caue Tomaz. Verbatim: *"it's only showing up on me uh the link for me." (about garden image upload)*
- **Issue body**:
  - Summary: Garden image uploads from admin settings show as a text link only — uploaded image is not rendered preview / not visible to the operator. Action item from this sync: implement a new media uploader.
  - Surface: Admin Dashboard
  - Repro: 1) Open admin garden settings. 2) Upload image for garden. 3) Observe — only link to file appears, no preview thumbnail; image isn't shown anywhere visible.
  - Expected: Preview thumbnail appears after upload; image is visible in garden detail view.
  - Actual: Just a link; no preview, no display.
  - Suggested fix: Implement the planned new media uploader component (in scope of the upcoming polish wave). Render preview after upload via blob URL or fetched final URL.

### [24] Domains button doesn't open pop-up
- Assignee: Afo · Package: `admin` · Severity: P1 · Test: ADM-011
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Caue Tomaz. Verbatim: *"The domains button is not working uh for some reason. should have a a pop window."*
- **Issue body**:
  - Summary: The "Domains" CTA in admin settings does nothing when clicked — expected pop-up window never appears.
  - Surface: Admin Dashboard
  - Repro: Open admin garden settings, click Domains button. No response.
  - Expected: Pop-up / modal opens for managing domains.
  - Actual: Click does nothing.
  - Suggested fix: Check the button's onClick handler — might be unbound, throwing silently, or the modal component is misconfigured.

### [25] ENS names not resolving on Admin — showing raw addresses (regression)
- Assignee: Afo · Extra label: **`agent:codex`** · Package: `admin` + `indexer` · Severity: P1 · Test: ADM-011
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Speaker: Afolabi Aiyeloja. Verbatim: *"next it should be resol It should be resolving ENS. It's still regret. There's still some regressions because we have some of those are ENS names like and it should be showing the the ENS."*
- **Issue body**:
  - Summary: Admin Dashboard member/contributor lists show raw `0x…` addresses where ENS names exist. ENS resolution has regressed.
  - Surface: Admin Dashboard
  - Repro: Open admin members tab for a garden with at least one ENS-mapped wallet — observe raw addresses instead of ENS names.
  - Expected: ENS-resolved name shown where available, raw address fallback only when no ENS.
  - Actual: Raw addresses shown across the board.
  - Suggested fix: Walk the ENS-resolution path (likely a viem call or indexer-side enrichment). Check whether wagmi ENS hook is wired, whether reverse-lookup batch is firing, and whether indexer schema strips ENS field somewhere. Codex-friendly investigation.

### [M1] PostHog $exception captured with null type/message — telemetry triage gap
- Assignee: Afo · Extra label: **`agent:claude`** · Package: `shared` · Severity: P1 · Test: (no QA-workbook row)
- **Need body**:
  > Source: QA Sync — Product Sync on 2026-05-13. Discovered as meta-finding by qa-triage cross-reference. Across both App (`163591`) and Admin (`262122`) PostHog projects, all `$exception` events over 14d have `exception_type=None` and `message=None`. Events are captured (29 distinct URLs) but the payload is empty — kills every downstream telemetry triage that depends on error messages.
- **Issue body**:
  - Summary: PostHog `$exception` events are firing on both App and Admin projects, but the `exception_type` and `message` properties are empty across the board. Affects `bug-intake` routine, `qa-triage-pulse` routine, and `/debug` skill — every flow that joins PostHog telemetry to user reports.
  - Surface: Cross Surface (instrumentation)
  - Repro: PostHog → either project → Events → filter event = `$exception` → see all rows with null `properties.$exception_message`.
  - Expected: Each exception carries the JS error type + message per `posthog-js.captureException` payload.
  - Actual: All exceptions have null type + message.
  - Suggested fix: Check the `posthog.captureException()` call sites in `packages/shared/src/modules/app/analytics-events.ts` (or equivalent) — likely missing the Error object or passing it wrong (e.g., `{ exception: err.message }` instead of `posthog.captureException(err)`). Code-only, well-scoped — ideal for a Claude session.

---

## Customer Need only (6)

### [3] Positions UI missing on public site
- **Need only** (feedback / missing-feature). Speaker: Matt Strachman.
- Body: > "I'm having a hard time figuring out how to check my positions and and how to add more to them. All I see is the donate and bow buttons."
- Surface: Public Website
- Disposition: Need only — awaiting human triage to decide whether to revive the ported-over positions UI.

### [4] Donate vs Endow copy unclear
- **Need only** (feedback / copy). Speaker: Matt Strachman.
- Body: > "what's the difference between donating as giving the funds to hand?"
- Surface: Public Website (`/fund`)
- Disposition: Need only — Afo's action item "Improve Copy" already aligned in the sync's Next Steps.

### [5] Endow flow forces dollar input instead of wrapped-ether amount
- **Need only** (feedback / UX trade-off). Speaker: Matt Strachman.
- Body: > "It is kind of confusing not being able to like being forced to type in the dollar amount for the wrapped ether"
- Surface: Public Website (`/fund` endow)
- Disposition: Need only — trade-off (less crypto-fluent users don't know wrapped ETH); needs product call before filing.

### [12] PWA install needs confirmation message
- **Need only** (idea). Speaker: Guilherme Ferreira.
- Body: > "it's not clear that the app is installed... I don't receive any confirmation message or anything"
- Surface: PWA
- Disposition: Need only — idea for UX polish, not blocking.

### [15] No cross-device account recovery
- **Need only** (feedback / strategic). Speaker: Guilherme Ferreira.
- Body: > "if I change my phone or if I lose it like I I should be able to recover my account because uh even if I create a new one I I will lose all my records"
- Surface: Cross Surface (Auth)
- Disposition: Need only — strategic architectural. Action item "Implement Account Recovery" already aligned in sync.

### [26] Members tab UI scope confusing
- **Need only** (clarification, may be docs). Speaker: Caue Tomaz.
- Body: > "There is one only one owner. Did you saw that?... No, no. But this is all the gardeners. This is all the people who are in the the app."
- Surface: Admin Dashboard
- Disposition: Need only — Caue misread the scope of the members panel. Could be a copy/labeling improvement or just a docs clarification.
