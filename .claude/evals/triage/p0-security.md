# Triage Eval: P0 Security Vulnerability

## Issue Report

**Title**: Private key material logged in plaintext during smart account initialization

**Reporter**: Security audit (internal)

**Body**:

During the smart account setup flow in `packages/shared/src/modules/auth/smart-account.ts`, the `initializeSmartAccount()` function logs the passkey credential response at `debug` level before extracting the public key. The log payload includes the raw `authenticatorData` and `clientDataJSON` fields, which contain sensitive cryptographic material.

While this is at `debug` level and not shown in production builds by default, the logger's `persist` mode (enabled for beta testers via the debug panel) writes all log levels to IndexedDB for export. This means beta testers' passkey attestation data is being stored in plaintext in IndexedDB and could be included in exported debug logs shared with the team.

The `authenticatorData` field contains the credential private key handle and the `clientDataJSON` contains the challenge nonce. While not directly the private key itself, this data combined with a compromised authenticator could enable key extraction.

Additionally, the PostHog analytics integration in `packages/shared/src/modules/app/posthog.ts` captures all `logger.error` calls as events. If the smart account initialization fails and the error handler logs the full context (which it does), the passkey attestation data could be sent to PostHog's servers.

**Labels**: security, shared, auth, passkey

**Reproduction**:

1. Enable debug mode in the client app
2. Create a new passkey account
3. Export debug logs from the debug panel
4. Search for `authenticatorData` in the exported JSON — it's present in plaintext

## Expected Classification

### Classification
- **Severity**: `P0`
- **Type**: `security`
- **Complexity**: `medium`

### Affected Packages
- `shared` (auth module, logger, PostHog integration)
- `client` (debug panel that enables log persistence)

### Rationale

This is P0 because:
1. **Cryptographic material exposure**: Passkey attestation data is being stored and potentially transmitted to third-party services (PostHog)
2. **Active in production**: Beta testers with debug mode have this data persisted right now
3. **Data exfiltration vector**: Debug log export creates a shareable artifact containing sensitive material
4. **Requires immediate action**: The logger call should be removed or sanitized, and existing persisted logs should be purged

### Expected Route
- Entry point: `/debug --mode incident_hotfix`
- Skills: `error-handling-patterns`, `monitoring`
- Escalation: Immediate — notify security team, consider purging existing debug logs in IndexedDB for beta users

### Context for Next Agent
The logger.debug call in `packages/shared/src/modules/auth/smart-account.ts` inside `initializeSmartAccount()` logs the full WebAuthn credential response including `authenticatorData`. Remove or sanitize this log call, audit other auth module log calls for similar leaks, and add a lint rule or code review checklist item to prevent logging credential data.

## Passing Criteria

- Severity MUST be `P0` (not P1 — this is active cryptographic material exposure, not just a bug)
- Type MUST be `security`
- Must identify `shared` as the primary affected package
- Must recommend incident/hotfix routing, not standard bug fix
- Must note the PostHog exfiltration vector (not just local storage)
- Should recommend purging existing persisted logs

## Common Failure Modes

- Classifying as P1 (treating it as a regular auth bug rather than a security vulnerability)
- Classifying as P2 (reasoning that "debug level logs are not shown in production" — missing the persist/export path)
- Missing the PostHog exfiltration vector (only flagging the IndexedDB storage)
- Routing to standard bug fix workflow instead of incident hotfix
- Classifying type as "bug" instead of "security"
