# Client PWA UX Audit — Pre-release Hardening

Captures the residual findings from the 2026-05-04 release-readiness audit of the client PWA (`packages/client`). Three highest-confidence fixes already shipped on `develop`:

- `AppSettings`: refresh-app gated behind `ConfirmDialog` with i18n parity (en/es/pt).
- `AccountInfo`: address card uses neutral `RiUserLine` instead of `RiWalletLine` (was misleading for passkey-mode users).
- `ENSSection`: three hardcoded English `aria-label`s on slug-status icons replaced with i18n keys (en/es/pt).

What remains is a punch list grouped by user flow, scope-locked, ready to be picked up after current release work clears or as part of a follow-up sprint. Each item carries enough context to act on without re-running the audit.
