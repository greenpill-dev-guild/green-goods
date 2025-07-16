# Railway Deployment Guide for Green Goods MCP Server

## Quick Start

1. **Install Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Navigate to MCP Server Directory**
```bash
cd packages/mcp-server
```

3. **Login to Railway**
```bash
railway login
```

4. **Initialize and Deploy**
```bash
railway init green-goods-mcp-server
railway up
```

## Environment Variables

Set these in Railway dashboard after deployment:

```bash
GITHUB_TOKEN=your_github_personal_access_token
NODE_ENV=production
```

Optional (when you get CharmVerse API access):
```bash
CHARMVERSE_API_KEY=your_charmverse_api_key
```

## Verify Deployment

Once deployed, test these endpoints:

1. **Health Check**
```bash
curl https://your-app.railway.app/health
```

2. **Available Methods**
```bash
curl https://your-app.railway.app/mcp/methods
```

3. **Test MCP Call**
```bash
curl -X POST https://your-app.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "get_issue",
    "params": {
      "repo": "green-goods",
      "number": 1
    }
  }'
```

## Auto-Deployment Setup

1. Go to Railway dashboard
2. Select your project
3. Go to Settings → GitHub
4. Connect your repository
5. Set root directory to `packages/mcp-server`
6. Enable auto-deploy on push

## Troubleshooting

- Check Railway logs if deployment fails
- Ensure all environment variables are set
- Verify GitHub token has correct permissions
- Health check endpoint should return 200 OK

## Cost Estimation

- **Hobby Plan**: $5/month after free tier
- **Free Tier**: 500 hours/month, $5 credit
- **Estimated Usage**: ~$2-8/month for typical usage 