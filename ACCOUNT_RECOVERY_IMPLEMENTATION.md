# Account Recovery Implementation Summary

## Overview

Implemented a nested account recovery flow under the login route, allowing users to recover their Green Goods accounts using their ENS username and synced passkeys.

## Implementation Details

### 1. **Recovery View** - `/packages/client/src/views/Login/Recovery.tsx`

Created a new recovery component with:
- Username input field (ENS name without .greengoods.eth)
- Recovery button that triggers the passkey authentication flow
- Back to Login navigation
- Helpful instructions about how recovery works
- Error handling and loading states

**Key Features:**
- Validates ENS name input
- Calls `recoverPasskeyAccount()` from passkey module
- Sets recovered session in AuthProvider
- Automatically navigates to `/home` on successful recovery

### 2. **Passkey Recovery Function** - `/packages/client/src/modules/auth/passkey.ts`

Added `recoverPasskeyAccount()` function that:
- Takes an ENS username as input
- Prompts user for WebAuthn authentication (passkey)
- Recreates smart account clients for both mainnet and L2
- Returns a `PasskeySession` with full account access

**Technical Details:**
- Uses WebAuthn `navigator.credentials.get()` to authenticate
- Creates sessions for both chains (mainnet for ENS, L2 for operations)
- Persists recovered credential to localStorage
- Handles various error cases (cancelled auth, missing passkey, etc.)

**TODO for Production:**
- Add ENSRegistrar query to verify account exists on mainnet before prompting
- Implement proper credential extraction from WebAuthn response
- Add retry logic for failed recoveries

### 3. **Router Updates** - `/packages/client/src/router.tsx`

Modified login route to support nested routes:
```tsx
{
  path: "login",
  lazy: async () => ({ Component: (await import("@/views/Login")).default }),
  children: [
    {
      path: "recover",
      lazy: async () => ({ Component: (await import("@/views/Login/Recovery")).default }),
    },
  ],
}
```

### 4. **Login Component Updates** - `/packages/client/src/views/Login/index.tsx`

Enhanced login component to:
- Check if on nested route (recovery) using `useLocation()`
- Render `<Outlet />` for nested routes
- Add "Recover account" tertiary action link
- Maintain existing login functionality

### 5. **Splash Component Updates** - `/packages/client/src/components/Layout/Splash.tsx`

Extended Splash component to support tertiary actions:
- Added `TertiaryActionConfig` interface with `label` and `href`
- Renders tertiary action as a React Router `Link` component
- Styled as smaller text below secondary action for visual hierarchy

### 6. **AuthProvider Updates** - `/packages/client/src/providers/auth.tsx`

Added `setPasskeySession()` method to AuthProvider:
- Allows setting a passkey session from outside the provider
- Updates auth mode to "passkey"
- Persists auth mode to localStorage
- Exposed via `useAuth()` hook

## User Flow

### Recovery Flow:
1. User visits `/login`
2. Clicks "Recover account" link
3. Navigates to `/login/recover`
4. Enters their username (e.g., "alice")
5. Clicks "Recover Account"
6. Browser prompts for passkey authentication (biometric/security key)
7. On success, account is recovered and user is logged in
8. Automatically redirected to `/home`

### Technical Flow:
```
User Input (ENS name)
    ↓
recoverPasskeyAccount()
    ↓
WebAuthn Authentication
    ↓
Create Smart Account Clients (Mainnet + L2)
    ↓
Set Session in AuthProvider
    ↓
Navigate to /home
```

## Security Considerations

### Passkey Sync
- **iOS/macOS**: Passkeys sync via iCloud Keychain (default)
- **Android/Chrome**: Passkeys sync via Google Password Manager (default)
- **Windows**: Windows Hello syncs passkeys with Microsoft account

### Recovery Requirements
For recovery to work:
1. User must have created a passkey during initial registration
2. Passkey must be synced to the recovery device (via cloud provider)
3. User must remember their ENS username
4. User must have access to their biometric/security key for authentication

### What Recovery Does NOT Require
- ❌ Seed phrases
- ❌ Private keys
- ❌ Email verification
- ❌ Phone numbers
- ❌ Backup codes

## Testing Checklist

- [ ] Navigate to `/login/recover` shows recovery form
- [ ] Enter username and click "Recover Account" prompts for passkey
- [ ] Successful passkey authentication recovers account
- [ ] Cancelled passkey authentication shows error message
- [ ] Invalid username shows validation error
- [ ] "Back to Login" navigates to `/login`
- [ ] Recovered session works for transactions
- [ ] ENS name is correctly associated with recovered account

## Future Enhancements

### Phase 1 (Current):
- ✅ Basic recovery flow with passkey authentication
- ✅ Nested routing under login
- ✅ Error handling and user feedback

### Phase 2:
- [ ] Query mainnet ENSRegistrar to verify account exists
- [ ] Show account address before prompting for passkey
- [ ] Add account preview (balance, last activity)
- [ ] Implement proper credential data extraction

### Phase 3:
- [ ] Add recovery via QR code (for mobile → desktop recovery)
- [ ] Implement account migration between devices
- [ ] Add recovery analytics/telemetry
- [ ] Support for multiple recovery methods

## Files Modified

### New Files:
- `packages/client/src/views/Login/Recovery.tsx` - Recovery UI component

### Modified Files:
- `packages/client/src/router.tsx` - Added nested recover route
- `packages/client/src/views/Login/index.tsx` - Added Outlet and recovery link
- `packages/client/src/components/Layout/Splash.tsx` - Added tertiaryAction support
- `packages/client/src/modules/auth/passkey.ts` - Added recoverPasskeyAccount()
- `packages/client/src/providers/auth.tsx` - Added setPasskeySession()

## Related Documentation

- [ENS Implementation Summary](./packages/contracts/ENS_IMPLEMENTATION_SUMMARY.md)
- [Custom Gardener Smart Accounts Plan](./custom-gardener-smart-accounts.plan.md)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [Passkey Best Practices](https://web.dev/articles/passkey-form-autofill)

## Notes

- Recovery is graceful: if mainnet session creation fails, L2-only session is still returned
- Passkey sync is automatic for most platforms (iCloud, Google, Microsoft)
- Users can test recovery by signing in on a different device (as long as passkey is synced)
- The recovery flow is optimized for UX: minimal steps, clear instructions, instant feedback

