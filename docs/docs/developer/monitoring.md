# Monitoring & Error Tracking

This guide covers PostHog integration for analytics, error tracking, and source map configuration in Green Goods.

---

## Overview

Green Goods uses [PostHog](https://posthog.com) for:

1. **Product Analytics** - User behavior, funnel tracking, feature usage
2. **Error Tracking** - Exception capture with source map support
3. **Release Tracking** - Correlating errors to specific versions
4. **Performance Monitoring** - Sync timing, upload performance

---

## PostHog Source Maps Setup

Source maps allow PostHog to display readable stack traces instead of minified code. Without source maps, errors show as cryptic `app.abc123.js:1:12345`.

### How It Works

1. **Build** generates source maps alongside minified bundles
2. **Inject** adds metadata (release ID, chunk IDs) to the bundles
3. **Upload** sends source maps to PostHog (they are NOT served to users)
4. **Capture** matches errors to the correct source map via metadata

### GitHub Actions Workflow

Source maps are automatically uploaded on:
- Pushes to `main` or `release/*` branches
- Published releases

See `.github/workflows/upload-sourcemaps.yml` for the implementation.

### Required Secrets

Configure in **Settings > Secrets and variables > Actions**:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `POSTHOG_CLI_TOKEN` | API token with error tracking write permissions | PostHog Settings > Personal API Keys |
| `POSTHOG_ENV_ID` | Environment identifier | PostHog Settings > Error Tracking > Source Maps |

### Generating PostHog CLI Token

1. Go to [PostHog](https://app.posthog.com) > Settings > Personal API Keys
2. Create a new key with **Error Tracking Write** scope
3. Copy the token to `POSTHOG_CLI_TOKEN` secret

### Finding Your Environment ID

1. Go to PostHog > Settings > Error Tracking > Source Maps
2. Copy the **Environment ID** shown in the setup instructions
3. Add to `POSTHOG_ENV_ID` secret

### Manual Upload (Development)

For testing or debugging source map uploads:

```bash
# Install PostHog CLI
npm install -g posthog-cli

# Build with source maps
cd packages/client
bun run build

# Inject metadata
posthog-cli sourcemap inject dist \
  --project green-goods-client \
  --version $(git rev-parse HEAD)

# Upload source maps
posthog-cli sourcemap upload dist \
  --env-id YOUR_ENV_ID \
  --delete-after
```

### Vite Configuration

Source maps are already enabled in `packages/client/vite.config.ts`:

```typescript
build: {
  sourcemap: true,
  chunkSizeWarningLimit: 2000
}
```

---

## PostHog Alerts Configuration

Alerts notify you when error rates exceed thresholds. Configure these in PostHog to catch issues before users report them.

### Recommended Alerts

| Alert | Threshold | Description |
|-------|-----------|-------------|
| Fatal Errors | > 5/hour | App-crashing errors requiring immediate attention |
| Contract Errors | > 10% of submissions | Smart contract failures (reverts, gas issues) |
| Network Errors | > 20% | Connectivity issues (offline, timeout) |
| Sync Failures Spike | > 3x baseline | Job queue processing failures |
| Auth Failures | > 10/hour | Passkey or wallet connection issues |

### Setting Up Alerts in PostHog

1. **Navigate to Data Management > Actions**
2. **Create an Action** matching the error pattern
3. **Go to Alerts** and create a new alert
4. **Configure the threshold** and notification channel

#### Example: Fatal Error Alert

**Step 1: Create an Action**

```text
Action Name: Fatal Errors
Match events where:
  - Event name = "error_tracked"
  - Property "severity" = "fatal"
```

**Step 2: Create Alert**

```text
Alert Name: Fatal Errors > 5/hour
Trigger: When "Fatal Errors" count > 5 in 1 hour
Notify: Slack #alerts channel
```

#### Example: Contract Error Rate Alert

**Step 1: Create Actions**

```text
Action 1: Work Submissions (Total)
  - Event name contains "work_submission"

Action 2: Contract Errors
  - Event name = "error_tracked"
  - Property "category" = "contract"
```

**Step 2: Create Alert (using Insights)**

```text
Insight: Contract Error Rate
Formula: (Contract Errors / Work Submissions) * 100
Alert: When > 10% over 1 hour
```

#### Example: Sync Failures Spike

Use PostHog's anomaly detection:

```text
Event: error_tracked
Filter: category = "sync"
Alert: Anomaly detection (3x above baseline)
```

### Error Categories in Green Goods

The `error_tracked` event includes a `category` property:

| Category | Description |
|----------|-------------|
| `contract` | Smart contract reverts, gas estimation failures |
| `network` | Fetch failures, timeouts, offline errors |
| `auth` | Passkey/wallet authentication issues |
| `sync` | Job queue processing, IndexedDB errors |
| `storage` | IPFS upload failures, IndexedDB quota |
| `graphql` | Indexer API errors |
| `system` | Uncaught exceptions, React error boundaries |
| `validation` | Form validation errors |

### Slack Integration

1. Go to PostHog > Settings > Integrations > Slack
2. Connect your Slack workspace
3. Select the channel for alerts
4. Test with a manual alert

---

## Release Tracking

Track which version introduced bugs and verify fixes in production.

### Version Numbers

Green Goods uses semantic versioning from `package.json`:

```json
{
  "name": "@green-goods/client",
  "version": "0.4.0"
}
```

The version is embedded at build time via `VITE_APP_VERSION` and included in all analytics events.

### How Version is Set

1. **Build time**: Vite reads from `package.json` or `VITE_APP_VERSION` env
2. **Runtime**: `getAppVersion()` in `posthog.ts` retrieves it
3. **Events**: All events include `app_version` property automatically

### Correlating Errors to Releases

In PostHog Error Tracking:

1. **Filter by release**: Use `app_version` property
2. **Compare releases**: See error counts across versions
3. **Track regressions**: New errors after a release indicate regressions

### Source Map Release Mapping

The GitHub Actions workflow tags uploads with the git SHA:

```yaml
- name: Upload Source Maps
  uses: PostHog/upload-source-maps@v0.5.7.0
  with:
    version: ${{ github.sha }}
```

This means:
- Errors show the exact commit that caused them
- Stack traces are readable for any deployed version
- You can bisect which commit introduced a bug

### Tagging Conventions

| Tag Type | Format | Example |
|----------|--------|---------|
| Commit SHA | 40-char hex | `21bb5718...` |
| Semver | `vX.Y.Z` | `v0.4.0` |
| Release Branch | `release/X.Y.Z` | `release/0.4.0` |

For releases, use GitHub Releases to create proper version tags:

```bash
# Create a release tag
git tag -a v0.4.0 -m "Release 0.4.0"
git push origin v0.4.0
```

---

## Environment Configuration

Green Goods deploys to different environments based on chain ID.

### Environment Detection

```typescript
// From posthog.ts
const TESTNET_CHAIN_IDS = new Set([
  84532,    // Base Sepolia
  11155111, // Ethereum Sepolia
  421614,   // Arbitrum Sepolia
  80002,    // Polygon Amoy
  11155420, // Optimism Sepolia
  44787,    // Celo Alfajores
]);

export function getEnvironment(chainId?: number): "testnet" | "mainnet" {
  return TESTNET_CHAIN_IDS.has(chainId) ? "testnet" : "mainnet";
}
```

### Testnet vs Mainnet Distinction

| Environment | Chain ID | Domain | PostHog Behavior |
|-------------|----------|--------|------------------|
| Testnet | 84532 (Base Sepolia) | staging.greengoods.app | Full tracking (development data) |
| Mainnet | 42161 (Arbitrum) | greengoods.app | Full tracking (production data) |
| Local | Any | localhost:3001 | Tracking disabled |

### Separate PostHog Projects (Recommended)

Use different PostHog API keys for:

```env
# .env
VITE_POSTHOG_KEY="phc_xxx"      # Client PWA
VITE_POSTHOG_ADMIN_KEY="phc_yyy" # Admin dashboard
```

This separates:
- **Client analytics**: Gardener and operator behavior
- **Admin analytics**: Garden management and deployment

### Environment Properties in Events

All events automatically include:

```typescript
{
  app_version: "0.4.0",
  environment: "testnet" | "mainnet",
  chain_id: 84532
}
```

Use these for filtering in PostHog dashboards.

---

## Error Tracking Implementation

### Custom Events

Green Goods sends `error_tracked` events with rich context:

```typescript
trackError(error, {
  severity: "fatal" | "error" | "warning" | "info",
  category: "contract" | "network" | "auth" | "sync" | "storage",
  source: "useSubmitWork",
  gardenAddress: "0x...",
  txHash: "0x...",
  authMode: "passkey" | "wallet",
  recoverable: true,
});
```

### Breadcrumbs

User actions before an error are captured as breadcrumbs:

```typescript
import { addBreadcrumb } from "@green-goods/shared";

// Track user actions
addBreadcrumb("clicked_submit_work", { gardenId: "..." });
addBreadcrumb("selected_action", { actionUID: 1 });

// When error occurs, last 10 breadcrumbs are included
```

### Contract Error Parsing

Contract errors are automatically parsed for better grouping:

```typescript
import { trackContractError } from "@green-goods/shared";

try {
  await submitWork(data);
} catch (error) {
  trackContractError(error, {
    source: "useSubmitWork",
    gardenAddress,
  });
}
```

### Global Error Handlers

Initialize in `main.tsx` to catch uncaught errors:

```typescript
import { initGlobalErrorHandlers } from "@green-goods/shared";

// Catches unhandled exceptions and promise rejections
const cleanup = initGlobalErrorHandlers();
```

---

## Dashboards & Insights

### Recommended Dashboards

1. **Error Overview**
   - Fatal errors by category
   - Error rate over time
   - Top error messages

2. **User Funnel**
   - Auth > Garden Join > Work Submission > Approval
   - Drop-off rates at each step

3. **Performance**
   - Work submission timing distribution
   - Upload success rate
   - Network error rate

4. **Release Health**
   - Errors by app version
   - New errors after release
   - Regression detection

### Key Metrics

| Metric | Query | Target |
|--------|-------|--------|
| Error rate | `error_tracked / all events * 100` | < 1% |
| Fatal error rate | `error_tracked (fatal) / sessions` | < 0.1% |
| Work submission success | `work_submission_success / work_submission_started` | > 95% |
| Contract error rate | `error_tracked (contract) / work_submission_started` | < 5% |

---

## Troubleshooting

### Source Maps Not Working

**Symptoms**: Stack traces show minified code like `app.abc123.js:1:12345`

**Causes**:
1. Source maps not uploaded
2. Version mismatch between upload and error
3. Missing chunk ID metadata

**Solutions**:

```bash
# Verify source maps were uploaded
# Check GitHub Actions run for upload step

# Verify metadata was injected
# Look for //# chunkId= comment in built JS files

# Check version matches
# Compare git SHA in error event to uploaded release
```

### Alerts Not Firing

**Check**:
1. Action definition matches event name exactly
2. Alert threshold is set correctly (not too high)
3. Slack/email integration is working
4. Test with a manual event

### Missing Events

**In development**: Events are disabled. Check `IS_DEV` in `posthog.ts`.

**In production**: Check browser console for `[PostHog]` logs when `VITE_POSTHOG_DEBUG=true`.

---

## Related Resources

- [PostHog Source Maps Docs](https://posthog.com/docs/error-tracking/upload-source-maps)
- [PostHog Alerts Docs](https://posthog.com/docs/product-analytics/alerts)
- [PostHog GitHub](https://github.com/PostHog/posthog)
- [PostHog Upload Source Maps Action](https://github.com/PostHog/upload-source-maps)
- [Error Tracking Module](https://github.com/greenpill-dev-guild/green-goods/blob/main/packages/shared/src/modules/app/error-tracking.ts)
- [Analytics Events Module](https://github.com/greenpill-dev-guild/green-goods/blob/main/packages/shared/src/modules/app/analytics-events.ts)
