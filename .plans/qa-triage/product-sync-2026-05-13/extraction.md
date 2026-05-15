# Extracted from Product Sync — 2026-05-13 10:03 PDT

**Source**: [Product Sync - 2026/05/13 10:03 PDT - Notes by Gemini](https://docs.google.com/document/d/1gAytbl1rsgCyZ6BVwMW6uGiSkehHMcjY3NxU_h4DDdw/edit) (file id `1gAytbl1rsgCyZ6BVwMW6uGiSkehHMcjY3NxU_h4DDdw`)

**Attendees**: Afolabi Aiyeloja (host), Guilherme Ferreira (Gui), Matt Strachman, Caue Tomaz, Nansel Rimsah

**Decisions captured**: Remove passkey auth, prioritize sign-in-with-wallet + social login. Temporary disablement of new garden creation. (These are decisions, not bugs — captured in routine output but not filed.)

---

## Public Website / Client editorial surface

1. [bug] **Cached old landing page redirects users away from `/fund`** — when users hit `greengoods.app/fund`, browser cache serves the old landing page and the new fund route never loads.
   Surface: Public Website
   Verbatim: > "When I click that link, the slashf fun, it just redirects me back to landing"
   Speaker: Matt Strachman

2. [bug] **"Connect Wallet" button persists after wallet is connected — blocks transactions** (likely P0). Reproduces on `/fund` (donate + endow) and `/cookies` deposit. User clicks Connect Wallet, modal opens showing wallet IS connected, but button never transitions to "Submit transaction". Affects all wallet-based interactions on public website.
   Surface: Public Website (`/fund`, `/cookies`)
   Verbatim: > "It gives me the connect wallet button at the bottom not like a submit transaction if I click connect wallet um it pops pops up and it shows my wallet that's already connected... instead of a submit button, it still just shows connect wallet even though my wallet's connected."
   Speaker: Matt Strachman

3. [feedback] **User positions UI missing on public website** — no way to see donated/endowed amounts; only Donate and Endow buttons shown. UI for positions was not ported over from old version.
   Surface: Public Website
   Verbatim: > "I'm having a hard time figuring out how to check my positions and and how to add more to them. All I see is the donate and bow buttons."
   Speaker: Matt Strachman

4. [feedback] **Donate vs Endow copy is unclear** — users can't tell which action puts funds where. Action item assigned to Afo: improve copy to distinguish donating (cookie jar) from endowing (yield vault).
   Surface: Public Website (`/fund`)
   Verbatim: > "what's the difference between donating as giving the funds to hand?"
   Speaker: Matt Strachman

5. [feedback] **Endow flow forces dollar input instead of wrapped-ether amount** — user wants to specify amount in wrapped ETH, not USD equivalent. Acknowledged as a trade-off (less crypto-fluent users don't know what wrapped ETH is).
   Surface: Public Website (`/fund` endow)
   Verbatim: > "It is kind of confusing not being able to like being forced to type in the dollar amount for the wrapped ether"
   Speaker: Matt Strachman

6. [bug] **Cookie Jar deposit balance requires manual page refresh** — after swap completes, balance doesn't auto-update; user has to refresh to see updated balance and proceed with deposit.
   Surface: Public Website (`/cookies`)
   Verbatim: > "Now the page book saying okay let me make sure I'm not going crazy... I had to refresh the page... it's not really a bug, but more of a better functionality. Should be uh automatic balance update."
   Speaker: Afolabi Aiyeloja

---

## PWA (Android) / Install + Update flow

7. [bug] **Brave install creates a browser shortcut, not a real PWA install** — when user installs from Brave, the app launches as a browser tab rather than a proper PWA, and Brave keeps re-prompting to install. Chrome works correctly. App should make this clearer or detect Brave and warn.
   Surface: PWA Android
   Verbatim: > "I installed it then I open it again on the browser and the message of to install appeared again. So I click on that and install it twice."
   Speaker: Guilherme Ferreira

8. [bug] **"Updating" state hangs for 3+ minutes after Update App click** — Gui hit Update, app stuck on "Updating refreshing to the latest version" for the entire meeting span. Update process is too slow OR doesn't reliably complete.
   Surface: PWA Android
   Verbatim: > "I am frozing at updating refreshing to the latest version" / "I am almost three minutes waiting and uh it's still loading"
   Speaker: Guilherme Ferreira

9. [bug] **"Update App" button shows even when already on latest version** — UI doesn't gate the Update button on actual update availability. Users see it persistently and assume something is wrong.
   Surface: PWA (cross-platform)
   Verbatim: > "I keep seeing uh available update app button and like it should only be available if I don't have the most recent version"
   Speaker: Guilherme Ferreira

10. [bug] **After uninstall, Chrome refuses to re-install — only shows "Open the app"** — Gui uninstalled, cleared cache, and Chrome still wouldn't show install prompt. Workaround required manual install via three-dot menu.
    Surface: PWA Android (Chrome)
    Verbatim: > "now I open the Chrome and I cannot install it again. I I I keep seeing open the app instead of installing... I already cleaned the cash."
    Speaker: Guilherme Ferreira

11. [bug] **Browser-version of app stuck on "Open the app" page — can't login in browser after install** — after installing the PWA, the browser version of the same URL gets stuck on a redirect-to-app screen rather than allowing browser-based login.
    Surface: PWA Android / Cross Surface
    Verbatim: > "after I install the app, I'm not able to login in the browser anymore because it only shows like open the app page"
    Speaker: Guilherme Ferreira

12. [idea] **PWA install confirmation message missing** — after successful install, no toast/message confirms install completed; user is unsure whether to keep tapping Install or whether the app is ready.
    Surface: PWA
    Verbatim: > "it's not clear that the app is installed... I don't receive any confirmation message or anything"
    Speaker: Guilherme Ferreira

13. [bug] **Profile page columns break / text overflow on long garden names** — gardener names that are long cause profile-page columns to misalign, hiding content.
    Surface: PWA (client)
    Verbatim: > "on profile page uh with long guardian's name the um the columns uh got broken and we can't read everything"
    Speaker: Guilherme Ferreira

---

## Auth (passkey + login flow)

14. [bug] **Passkey created in browser is not accessible in installed PWA** — same Google account, same device, but passkey created via browser doesn't transfer to PWA keystore. User has to create a new account. Underlying smart-account architecture limitation; partial driver of the strategic decision to deprioritize passkeys.
    Surface: Cross Surface (Auth)
    Verbatim: > "I had created an account uh on the browser but uh like uh I need to create a new one. It doesn't read my pass key uh in the app."
    Speaker: Guilherme Ferreira

15. [feedback] **No cross-device account recovery** — user who switches/loses phone cannot recover their account, loses all records. Action item created (`Implement Account Recovery`).
    Surface: Cross Surface (Auth)
    Verbatim: > "if I change my phone or if I lose it like I I should be able to recover my account because uh even if I create a new one I I will lose all my records"
    Speaker: Guilherme Ferreira

16. [bug] **"Log in with Google" errors on first attempt, succeeds on retry** — flaky social login: first click shows error, second click works. Should succeed first time.
    Surface: PWA / Auth
    Verbatim: > "I click it on login with email with Google and then I receive an error message and then I click it again and it logged in"
    Speaker: Guilherme Ferreira

17. [bug] **Cannot log back in after passkey logout** — user creates account with passkey, logs out, then can't sign back in with the same account. Re-entry is broken.
    Surface: PWA / Auth
    Verbatim: > "if I create an account uh with a pass key then I log out then I I cannot enter with the same account"
    Speaker: Guilherme Ferreira

---

## Admin Dashboard

18. [bug] **Garden switch hangs the UI** — switching from Green Goods Community Garden to Grow Ecosystem causes the entire dashboard to freeze; buttons stop responding, cursor doesn't change on hover, page is effectively dead. URL updates but UI does not.
    Surface: Admin Dashboard
    Verbatim: > "when I try to change the garden on the admin dashboard uh the buttons and the the whole page to be honest uh stop stopped to work. It's like it's loading. The the mouse doesn't change anymore like on buttons and things like that or links"
    Speaker: Caue Tomaz

19. [bug] **Joining a garden redirects to Green Goods Garden incorrectly** — when Caue joins Grow Ecosystem, clicking into the vault dumps them back into Green Goods Garden rather than staying in the joined garden.
    Surface: Admin Dashboard
    Verbatim: > "I join grow ecosystem but when I click to the vault I automatically change to green goods garden"
    Speaker: Caue Tomaz

20. [bug] **URL updates when switching gardens, UI does not** — visible by side-by-side comparison: address bar changes to the new garden's URL, but rendered content stays on the old garden.
    Surface: Admin Dashboard
    Verbatim: > "I'm looking at the browser URL and I think it's changing, but it's the UI isn't changing"
    Speaker: Afolabi Aiyeloja (observing Caue's screen)

21. [bug] **No visible scrollbar on Admin Dashboard tabs / content** — Caue can't scroll down through tabs/data; has to use trackpad gestures rather than the page providing a scrollbar.
    Surface: Admin Dashboard
    Verbatim: > "I cannot uh scroll down here. There there is no bar for me to scroll down. I need to to kind of uh do this."
    Speaker: Caue Tomaz

22. [bug] **Admin Dashboard layout doesn't use full screen — responsive sizing broken** — content is constrained to a small area while the viewport is much larger. Layout doesn't adapt to screen size.
    Surface: Admin Dashboard
    Verbatim: > "Why isn't it taking advantage of all the... The fact you have to do that is crazy."
    Speaker: Afolabi Aiyeloja (observing Caue's screen)

23. [bug] **Media uploads not displaying correctly — show as link only** — Caue uploaded a garden image, but the result shows as a text link rather than a rendered image. Image isn't surfaced anywhere visible to the operator.
    Surface: Admin Dashboard
    Verbatim: > "it's only showing up on me uh the link for me." (about garden image upload)
    Speaker: Caue Tomaz
    Action item: implement new media uploader component.

24. [bug] **Domains button doesn't open pop-up** — clicking the "Domains" CTA in admin settings produces no response; expected pop-up window never appears.
    Surface: Admin Dashboard
    Verbatim: > "The domains button is not working uh for some reason. should have a a pop window."
    Speaker: Caue Tomaz

25. [bug] **ENS names not resolving — showing raw addresses (regression)** — addresses should resolve to ENS names where available; instead, raw 0x... strings are shown across admin lists.
    Surface: Admin Dashboard
    Verbatim: > "next it should be resol It should be resolving ENS. It's still regret. There's still some regressions because we have some of those are ENS names like and it should be showing the the ENS."
    Speaker: Afolabi Aiyeloja

26. [bug] **Members tab UI is confusing — unclear all-gardens vs single-garden membership scope** — Caue interpreted the members panel as showing all 28 gardeners across the platform with only 1 owner; Afo had to clarify it's a single garden's membership. UI labeling does not communicate scope clearly.
    Surface: Admin Dashboard
    Verbatim: > "There is one only one owner. Did you saw that?... No, no. But this is all the gardeners. This is all the people who are in the the app."
    Speaker: Caue Tomaz

---

## Summary

- 26 items: **22 bugs**, **3 feedback**, **1 idea**, plus the passkey-removal decision (not filed).
- Surface breakdown: Public Website 6, PWA 7, Auth 4 (cross-surface), Admin Dashboard 9.
- Notable: item 2 (Connect Wallet persistence) is likely P0 — blocks all wallet-based transactions on public website.
