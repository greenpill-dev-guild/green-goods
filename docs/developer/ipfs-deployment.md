# IPFS Deployment Guide

Green Goods client and admin apps are deployed to IPFS for decentralized, censorship-resistant hosting.

---

## Overview

The deployment workflow uses the [IPFS Deploy Action](https://github.com/ipshipyard/ipfs-deploy-action) to:

1. **Build** the static app with hash router enabled
2. **Upload** to Storacha (primary, free permanent storage)
3. **Pin** to Pinata (secondary, fast gateway redundancy)
4. **Post** PR comments with preview links
5. **Update** commit status with CID

---

## Workflow Triggers

The workflow (`.github/workflows/deploy-ipfs.yml`) triggers on:

| Trigger | Behavior |
|---------|----------|
| Push to `main` | Deploy production (Arbitrum chain 42161) |
| Push to `develop` | Deploy staging (Base Sepolia chain 84532) |
| Pull Request | Deploy preview with PR comment |
| Manual dispatch | Choose client, admin, or both |

---

## GitHub Secrets Required

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `STORACHA_KEY` | Signing key for uploads | `w3 key create --json` |
| `STORACHA_PROOF` | UCAN delegation proof | `w3 delegation create ...` |
| `PINATA_JWT` | Pinata API token | [app.pinata.cloud](https://app.pinata.cloud) |

### Generate Storacha Credentials

```bash
# Install w3cli
npm install -g @web3-storage/w3cli

# Login and create space (first time only)
w3 login
w3 space create green-goods-deployments

# Generate signing key
w3 key create --json
# Output: { "did": "did:key:...", "key": "MgCY..." }
# → Copy "key" value to STORACHA_KEY secret

# Create delegation proof (use DID from above)
w3 delegation create did:key:YOUR_KEY_DID \
  -c space/blob/add \
  -c space/index/add \
  -c filecoin/offer \
  -c upload/add \
  --base64
# → Copy output to STORACHA_PROOF secret
```

---

## How It Works

### Build Configuration

The apps use **hash router** for IPFS compatibility:

```typescript
// router.tsx
const createRouter =
  import.meta.env.VITE_USE_HASH_ROUTER === "true"
    ? createHashRouter  // IPFS: /#/path
    : createBrowserRouter;  // Vercel: /path
```

```typescript
// vite.config.ts
base: isIPFSBuild ? "./" : "/",  // Relative paths for IPFS
```

### Environment Detection

| Branch | Environment | Chain ID | Domain |
|--------|-------------|----------|--------|
| `main` | production | 42161 (Arbitrum) | greengoods.app |
| `develop` | staging | 84532 (Base Sepolia) | staging.greengoods.app |

---

## Accessing Deployments

After deployment, access via CID through any gateway:

| Gateway | URL Pattern |
|---------|-------------|
| Storacha | `https://<CID>.ipfs.w3s.link` |
| dweb.link | `https://<CID>.ipfs.dweb.link` |
| Service Worker | `https://<CID>.ipfs.inbrowser.link` |
| Cloudflare | `https://<CID>.ipfs.cf-ipfs.com` |

### Find the CID

1. **GitHub Actions** → Run → Deployment Summary
2. **PR comment** (for pull requests)
3. **Commit status** → Click for details

---

## DNSLink Setup

To serve via custom domain (e.g., `greengoods.app`):

1. Add TXT record to DNS:
   ```
   Name: _dnslink
   Value: dnslink=/ipfs/<CID>
   ```

2. Add CNAME pointing to gateway:
   ```
   Name: @
   Value: gateway.ipfs.io (or your preferred gateway)
   ```

3. Access at: `https://greengoods.app`

---

## Testing & Validation

### Manual Trigger

1. Go to **Actions** → **Deploy to IPFS**
2. Click **Run workflow**
3. Select app (client, admin, or both)
4. Click **Run workflow**

### Verify Deployment

1. **Check GitHub Actions** for success
2. **Open gateway link** from deployment summary
3. **Test PWA functionality** (navigation, offline)
4. **Verify chain connection** (should match environment)

### Local IPFS Testing

```bash
# Build with IPFS settings
VITE_USE_HASH_ROUTER=true bun --filter client build

# Test locally with any static server
cd packages/client/dist
npx serve .
# Navigate to http://localhost:3000/#/
```

---

## Troubleshooting

### Build Fails

**Check**:
- All VITE_* secrets are set
- `bun install` succeeds
- No TypeScript errors

### Upload Fails

**Storacha issues**:
- Verify STORACHA_KEY format (starts with `MgC`)
- Verify STORACHA_PROOF is valid base64
- Check space has upload capability

**Pinata issues**:
- Verify JWT is valid (not expired)
- Check Pinata account limits

### App Not Loading

**Hash router**:
- URL should have `/#/` (e.g., `https://.../#/home`)
- Check `VITE_USE_HASH_ROUTER` was `true` during build

**Asset paths**:
- All assets should use relative paths (`./`)
- Check browser console for 404s

---

## Future: Dappnode IPFS Cluster

Phase 2 will add self-hosted pinning via Dappnode IPFS Cluster:

```yaml
# Additional workflow inputs (Phase 2)
cluster-url: ${{ secrets.DAPPNODE_CLUSTER_URL }}
cluster-user: ${{ secrets.DAPPNODE_CLUSTER_USER }}
cluster-password: ${{ secrets.DAPPNODE_CLUSTER_PASSWORD }}
```

**Setup requirements**:
- Dappnode with IPFS Cluster package
- Secure API access (VPN or Cloudflare Tunnel)
- GitHub secrets for cluster credentials

---

## Related Resources

- [IPFS Deploy Action](https://github.com/ipshipyard/ipfs-deploy-action)
- [Storacha Docs](https://docs.storacha.network/)
- [IPFS Gateway Best Practices](https://docs.ipfs.tech/how-to/gateway-best-practices/)
- [Installation Guide](installation.md)








