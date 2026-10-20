# E2E Testing Guide

## Quick Reference

```bash
# One command - starts dev & runs tests
bun run browser e2e --preset smoke

# All tests
bun run browser e2e --preset all

# Debug UI (requires dev running separately)
bun run browser e2e --preset ui
```

## How It Works

### `scripts/dev/test-e2e.js`

1. Starts the PM2 web fallback with `bun run dev -- web` in background
2. ✅ Waits for services (client:3001, admin:3002)
3. ✅ Runs Playwright tests
4. ✅ Auto-cleanup on exit/interrupt

### Test Structure

| File | Coverage |
|------|----------|
| `client.smoke.spec.ts` | Deterministic mock-auth content and rejection of fabricated wallet storage |
| `admin.smoke.spec.ts` | Cockpit mock-auth smoke |
| `client.session-navigation.ci.spec.ts` | Mock-auth reload/logout, mobile navigation, garden return and browser history |
| `client.offline-work-submission.ci.spec.ts` | Offline submission and recovery |
| `client.work-approval.ci.spec.ts` | Work approval CI journey |
| `client.work-submission.ci.spec.ts` | Required work details validation |

Runner counts depend on the selected project. The retired always-skipped manual
work/offline specs supplied no active proof; use the maintained CI journeys.

## Passkey Testing (Android/Chromium)

### Virtual Authenticator Setup

Uses Chrome DevTools Protocol (CDP) with key settings:

```javascript
{
  protocol: "ctap2",
  transport: "internal",
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  automaticPresenceSimulation: true  // ⭐ Critical - auto-approves touch
}
```

### Qualified ceremonies

The passkey preset owns virtual authenticators in `client.passkey.spec.ts` and
`client.reporting-account.passkey.spec.ts`. It exercises strict rejection/reload
and reporting account recovery against local substitutes. It does not prove a
successful chain transaction, real-device biometrics or the hosted provider.
See [the runner contract](README.md#projects-and-focused-runs) for current cases
and evidence limits.

## Troubleshooting

### Services Not Starting

```bash
# Check what's running
lsof -i :3001 -i :3002

# View dev logs
tail -f /tmp/green-goods-dev.log

# Kill stuck processes
npx pm2 delete all
```

### Passkey Tests Timing Out

- Ensure `automaticPresenceSimulation: true` is set
- Check console logs for authenticator creation
- Keep the qualified preset’s fixed time budget; inspect its failed step and fixture requests

### "No tests found" Error

```bash
# Run from project root
bun run browser e2e --preset smoke
```

## References

- [Oursky Passkey Testing Guide](https://www.oursky.com/blogs/a-practical-guide-automating-passkey-testing-with-playwright-and-authgear)
- [Corbado WebAuthn Guide](https://www.corbado.com/blog/passkeys-e2e-playwright-testing-webauthn-virtual-authenticator)
- [Playwright WebAuthn Docs](https://playwright.dev/docs/api/class-cdpsession)
