# Environment Variables Setup for Green Goods Monorepo

## 🎯 Overview

The Green Goods monorepo now supports **both root and local environment files** with proper precedence handling. This allows for:

- **Shared configuration** in the root `.env` file
- **Local overrides** in package-specific `.env` files 
- **Personal settings** in `.env.local` files (gitignored)

## 🚀 Quick Setup

### Option 1: Automatic Setup (Recommended)
```bash
# From monorepo root
node setup-env.js
```

### Option 2: Manual Setup
```bash
# From monorepo root
cp .env.example .env
# Edit .env with your actual values
```

## 📁 File Structure & Precedence

Environment files are loaded in this priority order (highest to lowest):

```
1. packages/client/.env.local        # 🔒 Local overrides (gitignored)
2. packages/client/.env.development  # 🎯 Mode-specific 
3. packages/client/.env              # 📱 Package-specific
4. .env.local                        # 🔒 Root local overrides (gitignored)
5. .env                              # 🌍 Root defaults
```

## ✅ Verification

After setup, start the development server:

```bash
# From root (recommended)
pnpm dev

# OR from client directory
cd packages/client && pnpm dev
```

Check the browser console for environment variable debug info:
```
🌍 Root environment: 8 VITE_ variables loaded
📱 Local overrides: 2 VITE_ variables loaded
🔍 Environment Variables Status: {
  VITE_PRIVY_APP_ID: "✅ Loaded",
  VITE_CHAIN_ID: "✅ Loaded",
  VITE_PINATA_JWT: "✅ Loaded"
}
```

## 🔧 Common Use Cases

### Shared Team Configuration
```bash
# .env (root) - committed to git
VITE_CHAIN_ID=42161
VITE_API_URL=https://api.staging.com
```

### Personal Development Overrides
```bash
# packages/client/.env.local - gitignored
VITE_API_URL=http://localhost:3000
VITE_DEBUG_MODE=true
```

### Package-Specific Settings
```bash
# packages/client/.env - committed to git
VITE_CLIENT_SPECIFIC_FEATURE=true
```

## 🐛 Troubleshooting

### Variables Not Loading?
1. Check file names are correct (no typos)
2. Ensure variables start with `VITE_` prefix
3. Restart the dev server after changes
4. Check console debug output

### Running from Wrong Directory?
The configuration automatically detects and loads from the monorepo root regardless of where you run the dev server.

### Need to Reset?
```bash
# Delete and recreate
rm .env
node setup-env.js
```

## 🔐 Security Notes

- **Never commit** `.env.local` files (they're gitignored)
- **Only use `VITE_` prefix** for client-side variables
- **Keep sensitive data** in local files or environment-specific configs
- **Don't put secrets** in `VITE_` variables (they're exposed to the browser)

## ⚙️ Technical Details

The Vite configuration now:
- Loads from monorepo root first (`envDir: rootDir`)
- Supports package-specific overrides
- Includes non-`VITE_` prefixes for testing (`PRIVY_`, `SKIP_`)
- Uses `dotenv-expand` for variable interpolation
- Provides debug logging in development mode

## 📞 Support

If you encounter issues:
1. Check the console debug output
2. Verify file paths and names
3. Ensure you're using the correct variable prefixes
4. Try the setup script: `node setup-env.js` 


Can you explore the @storage-manager.ts @/job-queue @deduplication.ts @retry-policy.ts @useOffline.ts @useStorageManager.ts @useWorks.ts @query-keys.ts  are they all being utilized, do they have adequate test coverage, do you see any issues with the code?

How are the @jobQueue.tsx and @work.tsx providers/functionality interacting can they be integrated in a more oprimal manner and how do you suggest to query/cache work and work approval data from EAS


can you move all the hooks  to the hooks folder like @useChainConfig.tsx  and export via the index

Also can you move @work-submission.ts to the @/job-queue module

Can you move any orphan css animations to the @animation.css file ignore if none

Can you update the client @README.md with details on the @/styles files what they represent and how they're being utilized?


Where can integrating Zustand be optimal and increase peformance of the app?