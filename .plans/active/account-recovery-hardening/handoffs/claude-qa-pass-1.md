# Claude QA Pass 1 Handoff

## Lane

- Branch signal: `claude/qa-pass-1/account-recovery-hardening`
- Linear issue: `PRD-540`
- Starts after: `ui` and `state_api` lanes are complete

## Matrix

- Create passkey, logout, log back in with same username.
- Clear local storage or reinstall PWA, then log back in with synced passkey.
- Create passkey in browser, test installed PWA sign-in where the platform/provider supports passkey sync.
- Verify server has no credential but local credential exists.
- Verify passkey server unavailable does not wipe session data or force account creation.
- Verify `VITE_PASSKEY_SERVER_ENABLED=false` keeps legacy/local behavior available.
- Verify missing local credential cache shows username/ENS-handle recovery before server lookup.
- Verify failed recovery followed by guarded new-account confirmation copy.
- Verify production RP/origin posture and staging/prod passkey-server isolation evidence are attached.
- Verify unsupported/in-app browser contexts do not start a passkey ceremony.
- Verify address mismatch fails closed if it can be simulated.
- Shared-device expectation (intended for this release, not a defect): on a device
  whose local cache holds account A, a second user recovering account B by
  username fails closed with the address-mismatch copy. There is deliberately no
  in-Login way to clear A's cached metadata (`clearPasskey` is only reachable
  while authenticated); B's paths on that device are wallet sign-in or guarded
  separate-account creation. Record it as PASS when the mismatch copy shows and
  nothing is cleared. A guarded "use a different account on this device" reset
  is a follow-up product decision, out of scope for this pass.
- Username-mismatch fallback surfacing (added 2026-06-10): when the server has
  no credential for the typed name (or is unreachable) and the device falls back
  to its cached credential under a different name, the client now shows an
  informational toast naming the account that was actually signed in
  (`app.login.toast.fallbackAccount*`). Verify the toast appears in that path
  and does not appear when the typed name matches the cached account.
- Record tested platform/provider combinations, including desktop Chrome, Android Chrome/PWA, iOS Safari/PWA if available, and unsupported/in-app browser negative coverage.

## Evidence

Write QA results to `reports/` and summarize blockers or proof limits here.

Treat `PRD-505` and `PRD-507` as acceptance cases.
