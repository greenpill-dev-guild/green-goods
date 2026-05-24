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
- Record tested platform/provider combinations, including desktop Chrome, Android Chrome/PWA, iOS Safari/PWA if available, and unsupported/in-app browser negative coverage.

## Evidence

Write QA results to `reports/` and summarize blockers or proof limits here.

Treat `PRD-505` and `PRD-507` as acceptance cases.
