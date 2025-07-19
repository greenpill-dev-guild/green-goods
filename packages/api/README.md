# Green Goods API

TypeScript Express API server for Green Goods platform.

## 🚀 Features

- **TypeScript**: Fully typed Express server
- **Railway Ready**: Configured for Railway deployment
- **Health Checks**: Built-in health monitoring
- **CORS**: Configured for frontend integration
- **Environment Variables**: Secure configuration management

## 📁 Structure

```
packages/api/
├── src/
│   ├── server.ts          # Main server entry point
│   └── routes/
│       ├── users.ts       # Users API (Privy integration)
│       └── subscribe.ts   # Email subscription
├── railway.toml           # Railway deployment config
├── tsconfig.json          # TypeScript configuration
└── package.json
```

## 🛠 Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## 🌐 API Endpoints

- `GET /` - API information
- `GET /api/health` - Health check
- `GET /api/users` - Get all users (Privy)
- `POST /api/subscribe` - Email subscription

## 🚀 Railway Deployment

1. **Connect Repository**: Link your GitHub repo to Railway
2. **Environment Variables**: Set in Railway dashboard:
   ```
   VITE_PRIVY_APP_ID=your_privy_app_id
   PRIVY_APP_SECRET_ID=your_privy_secret
   NODE_ENV=production
   ```
3. **Deploy**: Railway auto-deploys on push to main branch

### Custom Domain Setup

To use `api.greengoods.app`:

1. Go to Railway dashboard
2. Click on your API service
3. Go to "Settings" → "Domains"
4. Add custom domain: `api.greengoods.app`
5. Update your DNS records as instructed

## 🔧 Environment Variables

```bash
# Required
VITE_PRIVY_APP_ID=          # Privy application ID
PRIVY_APP_SECRET_ID=        # Privy secret key

# Optional
PORT=3000                   # Server port (Railway sets this)
NODE_ENV=development        # Environment
```

## 🏥 Health Monitoring

Railway automatically monitors the `/api/health` endpoint:

- **Timeout**: 300 seconds
- **Restart Policy**: On failure
- **Max Retries**: 10

## 📦 Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **@privy-io/server-auth**: Authentication
- **dotenv**: Environment variable loading
- **typescript**: Type safety
- **tsx**: TypeScript execution 