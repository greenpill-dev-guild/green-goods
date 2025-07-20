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

### Development Setup

**Framework & Technologies:**
- **Fastify**: High-performance web framework for Node.js
- **TypeScript**: Full type safety with strict configuration
- **Railway**: Cloud deployment with auto-deployment
- **Privy**: Authentication and user management

**Code Quality Tools:**
- **Biome**: Fast formatting and linting
- **TypeScript**: Strict type checking
- **Husky**: Automated git hooks for quality checks

### Development Workflow

**Hot Reload Development:**
```bash
# Start with automatic restart on file changes
pnpm dev
```
Uses `tsx watch` for fast TypeScript compilation and automatic server restart.

**Code Quality Commands:**
```bash
# Format code
pnpm run format

# Run linting
pnpm run lint

# Type checking without compilation
pnpm run type-check
```

**Build Process:**
```bash
# Compile TypeScript and resolve path aliases
pnpm build

# Output goes to dist/ directory
# Uses tsc + tsc-alias for path resolution
```

### Configuration

**TypeScript Configuration:**
- Strict mode enabled
- Path aliases supported via `tsc-alias`
- Node.js target with ES modules

**Environment Variables:**
```bash
# Required for development
PRIVY_APP_ID=               # Privy application ID
PRIVY_APP_SECRET_ID=        # Privy secret key

# Optional
PORT=3000                   # Server port (Railway sets this automatically)
NODE_ENV=development        # Environment mode
```

**Fastify Configuration:**
- CORS enabled for frontend integration
- JSON body parsing
- Error handling middleware
- Health check endpoints

### API Development

**Adding New Endpoints:**
1. Create route handler in `src/routes/`
2. Register route in main server file
3. Add TypeScript types for request/response
4. Test with development server

**Authentication Integration:**
- Uses Privy server SDK for user verification
- JWT token validation
- User session management

**Error Handling:**
- Comprehensive error responses
- Structured error objects
- Appropriate HTTP status codes

### Railway Deployment

**Automatic Deployment:**
- Pushes to main branch trigger deployment
- `railway.toml` configuration included
- Environment variables managed in Railway dashboard

**Health Monitoring:**
- `/api/health` endpoint for health checks
- Automatic restart on failure
- Resource monitoring via Railway dashboard

**Custom Domain Setup:**
1. Configure custom domain in Railway dashboard
2. Update DNS records as instructed
3. SSL/TLS handled automatically

### Troubleshooting

**Development Server Issues:**
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
pkill -f "api dev"

# Clear TypeScript cache
rm -rf dist/
```

**Build Issues:**
```bash
# Clean build
rm -rf dist/
pnpm build

# Check for TypeScript errors
pnpm run type-check

# Verify path aliases resolution
cat dist/server.js | grep "import"
```

**Authentication Issues:**
- Verify Privy app ID and secret are correct
- Check token format and expiration
- Test with Privy's server SDK directly

**Railway Deployment Issues:**
- Check Railway logs via dashboard
- Verify environment variables are set
- Ensure build command succeeds locally
- Check Railway service health status

### Performance Optimization

**Fastify Features:**
- Built-in request/response validation
- Efficient JSON serialization
- Connection pooling support
- Lightweight compared to Express

**Monitoring:**
- Railway provides built-in metrics
- Custom health checks at `/api/health`
- Error tracking and logging

### Testing

**Manual Testing:**
```bash
# Start development server
pnpm dev

# Test health endpoint
curl http://localhost:3000/api/health

# Test with frontend
# Start client on port 3001, API on port 3000
```

**Integration Testing:**
- Test with client application
- Verify CORS configuration
- Test Privy authentication flow
- Validate all API endpoints 