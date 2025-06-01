# Development Workflow Guide

This guide outlines the recommended development workflows and best practices for contributing to Green Goods.

## 🏗️ Development Setup

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/green-goods.git
cd green-goods

# Install dependencies
pnpm install

# Set up environment variables
cp packages/client/.env.example packages/client/.env
cp packages/contracts/.env.example packages/contracts/.env
cp packages/server/.env.example packages/server/.env
```

### 2. Development Environment

Start all services in development mode:

```bash
# Terminal 1: Start the client
pnpm --filter client dev

# Terminal 2: Start the server
pnpm --filter server dev

# Terminal 3: Start local blockchain (if needed)
pnpm --filter contracts anvil
```

## 🔄 Common Workflows

### Adding a New Feature

1. **Create a Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Install New Dependencies**

   ```bash
   # Add to client
   pnpm --filter client add package-name

   # Add to server
   pnpm --filter server add package-name

   # Add to contracts
   pnpm --filter contracts add package-name
   ```

3. **Run Tests During Development**

   ```bash
   # Run tests in watch mode
   pnpm --filter client test:watch
   pnpm --filter server test:watch
   pnpm --filter contracts test:watch
   ```

4. **Commit Changes**

   ```bash
   # Stage changes
   git add .

   # Commit with conventional commit message
   git commit -m "feat: add new feature description"
   ```

### Smart Contract Development

1. **Compile Contracts**

   ```bash
   pnpm --filter contracts compile
   ```

2. **Run Tests**

   ```bash
   pnpm --filter contracts test
   ```

3. **Deploy to Local Network**

   ```bash
   pnpm --filter contracts deploy:local
   ```

4. **Deploy to Testnet**
   ```bash
   pnpm --filter contracts deploy:testnet
   ```

### Frontend Development

1. **Component Development**

   ```bash
   # Create new component
   mkdir -p packages/client/src/components/YourComponent
   touch packages/client/src/components/YourComponent/index.tsx
   touch packages/client/src/components/YourComponent/__tests__/index.test.tsx
   ```

2. **Run Storybook**

   ```bash
   pnpm --filter client storybook
   ```

3. **Build for Production**
   ```bash
   pnpm --filter client build
   ```

### Backend Development

1. **Database Migrations**

   ```bash
   # Generate migration
   pnpm --filter server prisma migrate dev --name migration-name

   # Apply migrations
   pnpm --filter server prisma migrate deploy
   ```

2. **API Development**

   ```bash
   # Start server with hot reload
   pnpm --filter server dev

   # Run API tests
   pnpm --filter server test:api
   ```

## 🧪 Testing Workflows

### Unit Testing

```bash
# Run all unit tests
pnpm test:unit

# Run specific package tests
pnpm --filter client test:unit
pnpm --filter server test:unit
pnpm --filter contracts test:unit
```

### Integration Testing

```bash
# Run all integration tests
pnpm test:integration

# Run specific integration tests
pnpm --filter client test:integration
pnpm --filter server test:integration
```

### End-to-End Testing

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific E2E tests
pnpm --filter client test:e2e
```

## 📦 Deployment Workflows

### Client Deployment

1. **Build the Application**

   ```bash
   pnpm --filter client build
   ```

2. **Preview the Build**

   ```bash
   pnpm --filter client preview
   ```

3. **Deploy to Production**
   ```bash
   pnpm --filter client deploy
   ```

### Server Deployment

1. **Build the Server**

   ```bash
   pnpm --filter server build
   ```

2. **Deploy to Production**
   ```bash
   pnpm --filter server deploy
   ```

### Smart Contract Deployment

1. **Deploy to Testnet**

   ```bash
   pnpm --filter contracts deploy:testnet
   ```

2. **Deploy to Mainnet**
   ```bash
   pnpm --filter contracts deploy:mainnet
   ```

## 🔍 Code Review Process

1. **Pre-Review Checklist**

   - [ ] All tests pass
   - [ ] Code is linted
   - [ ] Documentation is updated
   - [ ] Changelog is updated
   - [ ] No sensitive data in commits

2. **Review Guidelines**

   - Check for security vulnerabilities
   - Verify test coverage
   - Review documentation changes
   - Check for performance impacts
   - Verify error handling

3. **Post-Review Actions**
   - Address review comments
   - Update PR if needed
   - Get final approval
   - Merge changes

## 📝 Documentation Workflow

1. **Update API Documentation**

   ```bash
   pnpm --filter server docs:api
   ```

2. **Update Contract Documentation**

   ```bash
   pnpm --filter contracts docs:contracts
   ```

3. **Generate Type Documentation**
   ```bash
   pnpm docs:types
   ```

## 🔄 Continuous Integration

The project uses GitHub Actions for CI/CD. Workflows are defined in `.github/workflows/`:

- `ci.yml`: Runs tests and linting
- `deploy.yml`: Handles deployments
- `security.yml`: Security scanning

## 🎯 Performance Optimization

1. **Client Performance**

   ```bash
   # Run performance audit
   pnpm --filter client audit:performance
   ```

2. **Server Performance**

   ```bash
   # Run load tests
   pnpm --filter server test:load
   ```

3. **Contract Gas Optimization**
   ```bash
   # Run gas report
   pnpm --filter contracts test:gas
   ```
