# Claude UI Handoff

## Lane

- Branch signal: `claude/ui/account-recovery-hardening`
- Linear issue: `PRD-538`
- Source plan: `.plans/active/account-recovery-hardening/`

## Scope

Add recovery and fallback UX for passkey-server-first account continuity.

- Keep one-tap passkey login when a local credential exists.
- When local credential cache is missing, show a username/ENS-handle recovery prompt before server-backed lookup.
- Replace broad device-loss warning copy with precise synced-passkey recovery language.
- Explain that provider-synced passkeys can recover across supported devices/apps.
- Explain that legacy local-only passkeys may need re-enrollment while preserving same-device login.
- Avoid promising same-address recovery after total passkey-provider loss.
- If recovery fails, show retry/fallback guidance and require explicit confirmation before creating a separate new account/address.
- If the app detects in-app browser, unsupported webview, or wrong-browser context, show browser guidance before starting any passkey ceremony.
- Surface address-mismatch and server-unavailable states as recoverable failures, not as automatic new-account prompts.
- Add i18n for all new user-facing strings.

## Proof

- Capture UI evidence for login/recovery/fallback states.
- Capture the no-local-credential recovery prompt and guarded new-account confirmation.
- Capture unsupported browser/context guidance and server-unavailable messaging.
- Treat `PRD-505` and `PRD-507` as acceptance cases under `PRD-521`.
- Record evidence or proof limits here before marking the lane complete.

## Boundaries

- Do not reposition the product toward passkey removal.
- Do not overclaim cross-provider passkey sync support.
