# Triage scope lock — Product Sync 2026-05-13

User reply: **All of them** (Phase 4 gate), with subsequent assignment overrides:

- Gui (gferreira525) takes PWA standard bug fixes that aren't blocked by the passkey-removal architectural decision
- Afo takes admin dashboard, editorial website, and architectural items
- Item #25 (ENS regression) flagged `agent:codex` for delegation

## Approved scope

### Issue + Customer Need (21 items)

| # | Title | Assignee | Extra labels |
|---|---|---|---|
| 1 | Cached old landing page redirects users away from /fund | Afo | — |
| 2 | Connect Wallet button persists after wallet connected (P0) | Afo | — |
| 6 | Cookie Jar balance requires manual page refresh | Afo | — |
| 7 | Brave install creates browser shortcut, not real PWA install | gferreira525 | — |
| 8 | "Updating" state hangs 3+ minutes after Update App click | gferreira525 | — |
| 9 | "Update App" button shows even when on latest version | gferreira525 | — |
| 10 | After uninstall, Chrome refuses to re-install | gferreira525 | — |
| 11 | Browser version stuck on "Open the app" page after install | gferreira525 | — |
| 13 | Profile page columns break on long garden names | gferreira525 | — |
| 14 | Passkey created in browser doesn't transfer to PWA | Afo | (architectural) |
| 16 | "Log in with Google" errors on first attempt | Afo | (auth flow) |
| 17 | Cannot log back in after passkey logout | Afo | (auth flow) |
| 18 | Admin garden switch hangs the entire UI (P0) | Afo | — |
| 19 | Joining a garden redirects to Green Goods Garden | Afo | — |
| 20 | URL updates when switching gardens but UI doesn't | Afo | — |
| 21 | No visible scrollbar on Admin tabs | Afo | — |
| 22 | Admin Dashboard layout doesn't use full screen | Afo | — |
| 23 | Media uploads show as link only | Afo | — |
| 24 | Domains button doesn't open pop-up | Afo | — |
| 25 | ENS names not resolving on Admin (regression) | Afo | `agent:codex` |
| M1 | PostHog $exception captured with null type/message | Afo | `agent:claude` |

### Customer Need only (6 items)

| # | Title | Reason |
|---|---|---|
| 3 | Positions UI missing on public site | feedback / missing-feature |
| 4 | Donate vs Endow copy unclear | feedback / copy |
| 5 | Endow flow forces dollar input | feedback / UX trade-off |
| 12 | PWA install needs confirmation message | idea |
| 15 | No cross-device account recovery | feedback / strategic architectural |
| 26 | Members tab UI scope confusing | bug — needs clarification, not file |

### Deferred / out of scope

None — the user accepted all.
