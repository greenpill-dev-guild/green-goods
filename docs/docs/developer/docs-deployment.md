---
sidebar_position: 20
title: Documentation Deployment
---

# Documentation Deployment

This guide covers deploying the Green Goods documentation site to GitHub Pages with a custom domain.

## GitHub Pages Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` or `release/**` branches.

### Initial Setup (One-Time)

#### 1. Enable GitHub Pages

1. Go to your repository settings: `https://github.com/greenpill-dev-guild/green-goods/settings/pages`
2. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
   - **Branch**: Not applicable (using Actions)
3. Save settings

#### 2. Configure Custom Domain

**DNS Configuration (at your domain provider):**

Add a `CNAME` record pointing to GitHub Pages:

```
Type: CNAME
Name: docs (or your subdomain)
Value: greenpill-dev-guild.github.io
TTL: 3600 (or default)
```

**Alternative: Apex Domain (docs.greengoods.app)**

If using an apex domain, add `A` records instead:

```
Type: A
Name: @ (or docs)
Value: 185.199.108.153
       185.199.109.153
       185.199.110.153
       185.199.111.153
```

**GitHub Configuration:**

1. Go to repository Pages settings
2. Under "Custom domain", enter: `docs.greengoods.app`
3. Wait for DNS check to pass (can take a few minutes)
4. ✅ **Enable "Enforce HTTPS"** (required for security)

#### 3. Add CNAME File

Create `docs/static/CNAME` with your custom domain:

```
docs.greengoods.app
```

This ensures the CNAME persists after builds.

### Automatic Deployment

The workflow (`.github/workflows/deploy-docs.yml`) automatically:

1. **Triggers** on push to `main` or `release/**` branches (if `docs/**` changed)
2. **Builds** the site with `bun docs:build`
3. **Deploys** to GitHub Pages
4. **Available** at your custom domain in 2-3 minutes

### Manual Deployment

You can also trigger deployment manually:

1. Go to Actions tab: `https://github.com/greenpill-dev-guild/green-goods/actions`
2. Select "Deploy Docs to GitHub Pages"
3. Click "Run workflow"
4. Select branch and run

### Monitoring Deployments

**Check deployment status:**
1. Actions tab shows build/deploy progress
2. Green checkmark = successful deployment
3. Red X = failed (click for logs)

**View live site:**
- Custom domain: `https://docs.greengoods.app`
- GitHub Pages URL: `https://greenpill-dev-guild.github.io/green-goods`

## Local Testing

Always test locally before pushing:

```bash
# Build production version
bun docs:build

# Preview locally
bun docs:serve
```

Visit `http://localhost:3000` to verify everything works.

## Troubleshooting

### DNS Not Resolving

**Symptom**: `docs.greengoods.app` shows 404 or doesn't load

**Solutions**:
1. Verify DNS records with: `dig docs.greengoods.app`
2. Check CNAME points to: `greenpill-dev-guild.github.io`
3. Wait 24-48 hours for full DNS propagation
4. Clear browser cache

**Verify DNS setup:**
```bash
# Check CNAME record
dig docs.greengoods.app CNAME

# Should show:
# docs.greengoods.app. 3600 IN CNAME greenpill-dev-guild.github.io.

# Check A records (if using apex domain)
dig docs.greengoods.app A
```

### HTTPS Not Working

**Symptom**: Browser shows "Not Secure" warning

**Solutions**:
1. Ensure DNS is properly configured (see above)
2. Wait for GitHub to provision certificate (can take 24 hours)
3. Check "Enforce HTTPS" is enabled in repo settings
4. Verify `CNAME` file exists in `docs/static/CNAME`

### Build Fails on GitHub Actions

**Check the logs:**
1. Go to Actions tab
2. Click failed workflow run
3. Expand "Build docs" step

**Common issues:**
- Broken links (fix locally first)
- Missing dependencies (check `package.json`)
- Build timeout (optimize build)

### Custom Domain Lost After Deploy

**Symptom**: Domain resets to `*.github.io` after deployment

**Solution**: Ensure `docs/static/CNAME` file exists with your domain

```bash
# Check file exists
cat docs/static/CNAME

# Should output:
# docs.greengoods.app
```

If missing, create it:

```bash
echo "docs.greengoods.app" > docs/static/CNAME
git add docs/static/CNAME
git commit -m "docs: add CNAME for custom domain"
git push
```

### 404 Errors on Subdomain

**Symptom**: Main site works, but `/concepts/roles` shows 404

**Solution**: This is usually a DNS or base URL issue

1. Verify `baseUrl: '/'` in `docusaurus.config.ts`
2. Check `url` matches your custom domain
3. Ensure trailing slash settings match

## DNS Provider-Specific Guides

### Cloudflare

1. Go to DNS settings
2. Add CNAME record:
   - **Type**: CNAME
   - **Name**: docs
   - **Target**: greenpill-dev-guild.github.io
   - **Proxy status**: DNS only (gray cloud, not orange)
   - **TTL**: Auto
3. Save and wait for propagation

### Namecheap

1. Go to Advanced DNS
2. Add record:
   - **Type**: CNAME Record
   - **Host**: docs
   - **Value**: greenpill-dev-guild.github.io
   - **TTL**: Automatic
3. Save changes

### Google Domains

1. Go to DNS settings
2. Add custom record:
   - **Type**: CNAME
   - **Name**: docs
   - **Data**: greenpill-dev-guild.github.io
   - **TTL**: 1 hour
3. Save

## Advanced Configuration

### Branch-Based Previews

To deploy preview sites from feature branches:

1. Modify workflow to trigger on pull requests
2. Use a different subdomain per branch (e.g., `pr-123.docs.greengoods.app`)
3. Configure DNS wildcards

### Custom 404 Page

Create `docs/src/pages/404.tsx`:

```tsx
import React from 'react';
import Layout from '@theme/Layout';

export default function NotFound() {
  return (
    <Layout title="Page Not Found">
      <main className="container margin-vert--xl">
        <div className="row">
          <div className="col col--6 col--offset-3">
            <h1 className="hero__title">Page Not Found</h1>
            <p>The page you're looking for doesn't exist.</p>
            <a href="/">Return to homepage</a>
          </div>
        </div>
      </main>
    </Layout>
  );
}
```

### Analytics

Add Google Analytics or Plausible to `docusaurus.config.ts`:

```typescript
export default {
  // ... other config
  themeConfig: {
    // Google Analytics
    gtag: {
      trackingID: 'G-XXXXXXXXXX',
      anonymizeIP: true,
    },
    // Or use plugins for other providers
  },
};
```

## Deployment Checklist

Before deploying to production:

- [ ] DNS records configured and propagated
- [ ] `CNAME` file created in `docs/static/`
- [ ] Custom domain configured in GitHub settings
- [ ] Build passes locally: `bun docs:build`
- [ ] No broken links
- [ ] HTTPS enforced in GitHub settings
- [ ] Workflow tested with manual trigger
- [ ] All images loading correctly
- [ ] Search working properly

## Monitoring

### Build Status Badge

Add to your README:

```markdown
[![Docs](https://github.com/greenpill-dev-guild/green-goods/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/greenpill-dev-guild/green-goods/actions/workflows/deploy-docs.yml)
```

### Uptime Monitoring

Consider using:
- [UptimeRobot](https://uptimerobot.com/) (free)
- [Pingdom](https://www.pingdom.com/)
- [StatusCake](https://www.statuscake.com/)

Monitor `https://docs.greengoods.app` for availability.

## Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Custom Domain Setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [Docusaurus Deployment Guide](https://docusaurus.io/docs/deployment#deploying-to-github-pages)
- [DNS Configuration Guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

## Support

- 💬 [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- 🐙 [GitHub Issues](https://github.com/greenpill-dev-guild/green-goods/issues)
- 📖 [Docusaurus Deployment Docs](https://docusaurus.io/docs/deployment)
