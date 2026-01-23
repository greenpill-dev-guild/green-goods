# E2E Testing Guide

## Quick Reference

```bash
# One command - starts dev & runs tests
bun test:e2e:smoke

# All tests
bun test:e2e

# Debug UI (requires dev running separately)
bun test:e2e:ui
```

## How It Works

### `scripts/test-e2e.js`

1. ✅ Starts `bun dev` in background
2. ✅ Waits for services (client:3001, admin:3002)
3. ✅ Runs Playwright tests
4. ✅ Auto-cleanup on exit/interrupt

### Test Structure

| File | Tests | Coverage |
|------|-------|----------|
| `client.smoke.spec.ts` | 8 | Auth, gardens, health |
| `admin.smoke.spec.ts` | 9 | Auth, dashboard, pages |
| `client.auth.spec.ts` | 11 | Complete auth flows |
| `client.offline-sync.spec.ts` | 13 | Offline functionality |
| `client.work-approval.spec.ts` | 9 | Operator flows |
| `client.work-submission.spec.ts` | 11 | Work submission |

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

### Registration Flow

1. Click "Sign Up" → username input appears
2. Enter username → click "Create Account"
3. WebAuthn registration → virtual authenticator auto-approves
4. Garden join transaction → requires second passkey approval
5. Navigate to `/home` (total: ~45 seconds)

### Login Flow

1. Click "Login" button (or auto if stored username)
2. WebAuthn authentication → virtual authenticator auto-approves
3. Navigate to `/home` (total: ~30 seconds)

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
- Increase timeout if garden join is slow

### "No tests found" Error

```bash
# Run from project root
cd /Users/afo/Code/greenpill/green-goods
bun test:e2e:smoke
```

## References

- [Oursky Passkey Testing Guide](https://www.oursky.com/blogs/a-practical-guide-automating-passkey-testing-with-playwright-and-authgear)
- [Corbado WebAuthn Guide](https://www.corbado.com/blog/passkeys-e2e-playwright-testing-webauthn-virtual-authenticator)
- [Playwright WebAuthn Docs](https://playwright.dev/docs/api/class-cdpsession)
