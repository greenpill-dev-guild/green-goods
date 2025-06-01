# Troubleshooting Guide

This guide covers common issues and their solutions when working with Green Goods.

## 🚨 Common Issues

### Installation Issues

#### Node.js Version Mismatch

**Problem**: Error about incompatible Node.js version

```
Error: The engine "node" is incompatible with this module. Expected version "20.x". Got "23.2.0"
```

**Solution**:

1. Install nvm (Node Version Manager)
2. Switch to Node.js 20:
   ```bash
   nvm install 20
   nvm use 20
   ```

#### pnpm Version Mismatch

**Problem**: Error about incompatible pnpm version

```
Error: The engine "pnpm" is incompatible with this module. Expected version "^9.x". Got "10.11.0"
```

**Solution**:

1. Install correct pnpm version:
   ```bash
   npm install -g pnpm@9
   ```

### Development Environment Issues

#### Module Not Found Errors

**Problem**: Missing dependencies

```
Error: Cannot find module '@privy-io/server-auth'
```

**Solution**:

1. Clear node_modules and reinstall:

   ```bash
   rm -rf node_modules
   pnpm install
   ```

2. If issue persists, try installing the specific package:
   ```bash
   pnpm add @privy-io/server-auth
   ```

#### Port Conflicts

**Problem**: Port already in use

```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution**:

1. Find and kill the process:

   ```bash
   # On macOS/Linux
   lsof -i :3001
   kill -9 <PID>

   # On Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

2. Or use a different port:
   ```bash
   PORT=3002 pnpm --filter client dev
   ```

### Smart Contract Issues

#### Contract Deployment Failures

**Problem**: Contract deployment fails with gas errors

```
Error: insufficient funds for gas * price + value
```

**Solution**:

1. Check wallet balance
2. Ensure correct network
3. Adjust gas settings in `.env`:
   ```
   GAS_LIMIT=5000000
   GAS_PRICE=20000000000
   ```

#### Contract Verification Failures

**Problem**: Contract verification fails

```
Error: Contract source code not verified
```

**Solution**:

1. Check compiler settings match deployment
2. Verify constructor arguments
3. Ensure network is supported

### Frontend Issues

#### Build Failures

**Problem**: Build fails with TypeScript errors

```
Error: Type 'X' is not assignable to type 'Y'
```

**Solution**:

1. Run type checking:
   ```bash
   pnpm --filter client typecheck
   ```
2. Fix type errors
3. Rebuild:
   ```bash
   pnpm --filter client build
   ```

#### Hot Reload Not Working

**Problem**: Changes not reflecting in development

```
No changes detected
```

**Solution**:

1. Clear cache:
   ```bash
   pnpm --filter client clean
   ```
2. Restart dev server:
   ```bash
   pnpm --filter client dev
   ```

### Backend Issues

#### Database Connection Issues

**Problem**: Cannot connect to database

```
Error: connect ECONNREFUSED
```

**Solution**:

1. Check database service is running
2. Verify connection string in `.env`
3. Check network/firewall settings

#### API Rate Limiting

**Problem**: API requests failing with 429

```
Error: Too Many Requests
```

**Solution**:

1. Implement rate limiting
2. Add retry logic
3. Cache responses

## 🔧 Environment Setup Issues

### Missing Environment Variables

**Problem**: Required environment variables not set

```
Error: Missing required environment variable: PRIVY_CLIENT_ID
```

**Solution**:

1. Copy example env files:
   ```bash
   cp packages/client/.env.example packages/client/.env
   cp packages/contracts/.env.example packages/contracts/.env
   cp packages/server/.env.example packages/server/.env
   ```
2. Fill in required values

### Invalid API Keys

**Problem**: API calls failing with 401/403

```
Error: Invalid API key
```

**Solution**:

1. Verify API keys in `.env`
2. Check key permissions
3. Generate new keys if needed

## 🐛 Debugging Tips

### Client Debugging

1. **Browser DevTools**

   - Use React DevTools
   - Check Network tab
   - Monitor Console for errors

2. **Logging**

   ```typescript
   console.log("Debug:", { variable });
   ```

3. **Error Boundaries**
   ```typescript
   <ErrorBoundary fallback={<ErrorComponent />}>
     <YourComponent />
   </ErrorBoundary>
   ```

### Server Debugging

1. **Logging**

   ```typescript
   console.log("Debug:", { variable });
   ```

2. **Debug Mode**

   ```bash
   DEBUG=* pnpm --filter server dev
   ```

3. **API Testing**
   ```bash
   curl -X GET http://localhost:3000/api/endpoint
   ```

### Contract Debugging

1. **Foundry Debug**

   ```bash
   pnpm --filter contracts test -vvv
   ```

2. **Gas Profiling**

   ```bash
   pnpm --filter contracts test:gas
   ```

3. **Event Logging**
   ```solidity
   event DebugLog(string message, uint256 value);
   emit DebugLog("Debug", value);
   ```

## 🔄 Performance Issues

### Slow Build Times

**Solution**:

1. Use build cache:
   ```bash
   pnpm --filter client build --cache
   ```
2. Optimize dependencies
3. Use production mode:
   ```bash
   NODE_ENV=production pnpm --filter client build
   ```

### High Memory Usage

**Solution**:

1. Increase Node.js memory limit:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pnpm --filter client dev
   ```
2. Optimize bundle size
3. Use code splitting

### Slow API Responses

**Solution**:

1. Implement caching
2. Optimize database queries
3. Use pagination
4. Add indexes

## 📚 Additional Resources

- [GitHub Issues](https://github.com/your-org/green-goods/issues)
- [Discord Community](https://discord.gg/your-server)
- [Documentation](https://docs.greengoods.app)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/greengoods)
