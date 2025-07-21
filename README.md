# Green Goods

Green Goods is a decentralized platform for biodiversity conservation, enabling Garden Operators and Gardeners to document and get approval for conservation work through blockchain-based attestations.

## 🏗️ Repository Architecture

The project is organized as a monorepo using pnpm workspaces:

```
green-goods/
├── packages/
│   ├── client/           # Frontend React application (PWA)
│   ├── contracts/        # Smart contracts and deployment scripts
│   ├── api/              # Backend API services
│   ├── indexer/          # Envio GraphQL indexer for blockchain data
│   └── mcp/              # MCP (Model Context Protocol) server
├── docs/                 # Documentation
└── tests/                # End-to-end testing suite
```

### Key Components

#### Client (`packages/client`)

- React-based Progressive Web App (PWA)
- Built with Vite, TypeScript, and Tailwind CSS v4
- Uses Radix UI components and modern design system
- Handles user authentication, garden management, and blockchain interactions
- Optimized bundle with dynamic imports and code splitting

#### Contracts (`packages/contracts`)

- Solidity smart contracts for garden management
- Foundry-based deployment system with multi-network support
- EAS (Ethereum Attestation Service) integration
- Comprehensive deployment CLI with profiles and automation

#### API (`packages/api`)

- FastAPI TypeScript server for backend services
- Railway-ready deployment configuration
- Privy authentication integration
- Health monitoring and CORS support

#### Indexer (`packages/indexer`)

- Envio-powered GraphQL indexer
- Real-time blockchain data indexing
- Optimized for garden and attestation data queries

#### MCP Server (`packages/mcp`)

- Model Context Protocol server for AI assistant integration
- Document search and project health monitoring
- GitHub integration and blockchain analysis tools

## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or higher)
- pnpm (v9.x)
- Foundry (for smart contract development)
- Git

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/green-goods.git
   cd green-goods
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   # Copy example env files
   cp packages/client/.env.example packages/client/.env
   cp packages/contracts/.env.example packages/contracts/.env
   cp packages/api/.env.example packages/api/.env
   ```

4. Configure environment variables:
   - `VITE_PRIVY_APP_ID`: Your Privy application ID
   - `PRIVY_APP_SECRET_ID`: Privy app secret  
   - `VITE_PINATA_API_KEY`: Pinata API key for IPFS
   - `DEPLOYER_PRIVATE_KEY`: Ethereum private key for deployments

## 💻 Development

### Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/green-goods.git
cd green-goods
pnpm install

# Set up environment variables
cp packages/client/.env.example packages/client/.env
cp packages/contracts/.env.example packages/contracts/.env
cp packages/api/.env.example packages/api/.env
```

### Running the Development Environment

**Option 1: Start All Services (Recommended)**
```bash
# Start all services using PM2
pnpm dev

# Check service status
pnpm dev:status

# View logs for specific services
pnpm dev:logs:client
pnpm dev:logs:api
pnpm dev:logs:indexer

# Stop all services
pnpm dev:stop
```

**Option 2: Start Services Individually**
```bash
# Terminal 1: Start the client
pnpm --filter client dev

# Terminal 2: Start the API
pnpm --filter api dev

# Terminal 3: Start the indexer
pnpm --filter indexer dev

# Terminal 4: Deploy contracts (if needed)
pnpm --filter contracts deploy:local
```

### IDE Setup

**VS Code Extensions (Recommended):**
1. **Biome** (`biomejs.biome`) - Formatting and linting
2. **Solidity** (`JuanBlanco.solidity`) - Solidity language support
3. **Even Better TOML** (`tamasfe.even-better-toml`) - TOML file support
4. **GitLens** (`eamodio.gitlens`) - Git integration
5. **Error Lens** (`usernamehw.errorlens`) - Inline error display

The project includes pre-configured VS Code settings for automatic formatting and linting.

### Code Quality Tools

**High-Performance Tooling:**
- **Biome**: Fast formatting (35x faster than Prettier)
- **0xlint**: Ultra-fast linting (30ms on 84 files, 10-100x faster than ESLint)
- **Husky**: Automated git hooks for quality checks
- **TypeScript**: Strict type checking across all packages

**Commands:**
```bash
# Format code across all packages
pnpm format

# Check formatting without applying changes
pnpm format:check

# Lint and check code quality
pnpm lint

# Run 0xlint specifically
pnpm lint:oxlint
```

### Environment Variables

**Client (`packages/client/.env`):**
```bash
VITE_PRIVY_APP_ID=          # Privy application ID
VITE_WALLETCONNECT_PROJECT_ID=  # WalletConnect project ID
VITE_PINATA_API_KEY=        # Pinata API key
VITE_PINATA_GATEWAY_URL=    # Pinata IPFS gateway
VITE_DESKTOP_DEV=           # Bypass PWA checks (development)
```

**API (`packages/api/.env`):**
```bash
PRIVY_APP_ID=               # Privy application ID
PRIVY_APP_SECRET_ID=        # Privy secret key
PORT=3000                   # Server port
NODE_ENV=development        # Environment
```

**Contracts (`packages/contracts/.env`):**
```bash
DEPLOYER_PRIVATE_KEY=       # Deployment private key
SEPOLIA_RPC_URL=           # Sepolia RPC endpoint
ARBITRUM_RPC_URL=          # Arbitrum RPC endpoint
CELO_RPC_URL=              # Celo RPC endpoint
ETHERSCAN_API_KEY=         # Etherscan API key (verification)
```

### Development Workflows

**Smart Contract Development:**
```bash
# Compile and test
pnpm --filter contracts compile
pnpm --filter contracts test

# Deploy to networks
pnpm --filter contracts deploy:local
pnpm --filter contracts deploy:sepolia
pnpm --filter contracts deploy:celo --verify
```

**Frontend Development:**
```bash
# Development with hot reload
pnpm --filter client dev

# Build for production
pnpm --filter client build

# Preview production build
pnpm --filter client preview
```

**API Development:**
```bash
# Start development server
pnpm --filter api dev

# Build and start production
pnpm --filter api build
pnpm --filter api start
```

**Indexer Development:**
```bash
# Generate code from schema
pnpm --filter indexer codegen

# Start development server
pnpm --filter indexer dev

# Integration with contracts
pnpm --filter contracts envio:enable-local
```

### Testing

Run tests across all packages:

```bash
pnpm test
```

Run specific test suites:

```bash
# Unit tests
pnpm --filter client test
pnpm --filter api test
pnpm --filter contracts test
pnpm --filter indexer test

# E2E tests (requires services running)
pnpm test:e2e

# Quick smoke tests
pnpm test:e2e:smoke

# Mobile PWA tests
pnpm test:e2e:mobile

# All tests (unit + e2e)
pnpm test:all
```

**Test Debugging:**
```bash
# Run tests in debug mode
pnpm test:e2e:debug

# Open Playwright UI
pnpm test:e2e:ui

# Check if services are running
node tests/run-tests.js check
```

### Git Hooks & Quality Assurance

The project uses Husky for automated quality checks:

**Pre-commit Hook:**
- Format and lint staged files
- Run relevant tests for changed files

**Pre-push Hook:**
- Full format check across codebase
- Linting with error-on-warnings
- Type checking

**Manual Commands:**
```bash
# These run automatically via git hooks, but can be run manually:
pnpm format:check
pnpm lint
pnpm test
```

### Troubleshooting

**Service Issues:**
```bash
# Check what's using the ports
lsof -i :3001  # Client port (HTTPS)
lsof -i :3000  # API port
lsof -i :8080  # Indexer port

# Kill processes if needed
pkill -f "dev:client"
pkill -f "dev:api"
pkill -f "dev:indexer"
```

**Performance:**
Our tooling is optimized for speed:
- **Biome**: ~35x faster than Prettier
- **0xlint**: 10-100x faster than ESLint
- **Vite**: Fast HMR and builds
- **Foundry**: Fast contract compilation and testing

## ⚡ Development Tools & Performance

### Linting & Code Quality

We use a **high-performance linting setup**:

- **0xlint**: Ultra-fast Rust-based linter (30ms on 84 files)
- **Biome**: Fast formatting and basic checks  
- **Combined**: Complete code quality coverage with 99 comprehensive rules

### Build System

The project supports **dual build systems**:

#### Production Builds (Recommended)
```bash
pnpm run build              # Optimized Vite build with chunking
```
- **Bundle Size**: 4.4MB main bundle with optimal code splitting
- **Build Time**: ~33 seconds with full optimization
- **Features**: Dynamic imports, PWA support, optimal chunking

#### Experimental Builds (Development/Testing)
```bash
pnpm run build:rolldown     # Experimental rolldown-vite build
```
- **Purpose**: Testing next-generation bundling technology
- **Performance**: Similar output with experimental Rust-based bundling
- **Status**: Based on [Vite's Rolldown integration](https://vite.dev/guide/rolldown)

### Bundle Optimization

**Dynamic Imports Implemented:**
- Landing & Login components: Lazy-loaded for better initial load
- Feature components: Assessment, Garden, WorkApproval split into separate chunks
- **Result**: Optimized bundle size with better loading performance

**Chunk Analysis:**
- `Assessment-*.js` (0.36 kB) - Assessment component
- `Garden-*.js` (10.81 kB) - Garden component  
- `WorkApproval-*.js` (66.11 kB) - Work approval component
- Main bundle: Optimally chunked vendor libraries

## 🛠️ Core Technologies

### Frontend

- **React**: UI library with lazy loading
- **Vite**: Build tool and dev server (with experimental Rolldown support)
- **TypeScript**: Type safety
- **Tailwind CSS v4**: Modern utility-first styling
- **TanStack Query**: Data fetching and caching
- **Privy**: Authentication and wallet management
- **Radix UI**: Accessible UI components
- **React Hook Form**: Form management
- **Biome**: Fast formatting and linting
- **0xlint**: Ultra-fast Rust-based linting (replaces ESLint)

### Smart Contracts

- **Solidity**: Smart contract language
- **Foundry**: Development framework with comprehensive CLI
- **EAS**: Ethereum Attestation Service integration

### Backend

- **Node.js**: Runtime
- **Fastify**: Web framework
- **TypeScript**: Type safety
- **Envio**: GraphQL indexer for blockchain data

## 📦 Package Management

### Adding Dependencies

```bash
# Add to specific package
pnpm --filter <package-name> add <dependency>

# Add dev dependency
pnpm --filter <package-name> add -D <dependency>
```

### Workspace Scripts

```bash
# Run script in specific package
pnpm --filter <package-name> <script-name>

# Run script in all packages
pnpm -r <script-name>
```

## 🚀 Deployment

### Smart Contracts

```bash
# Deploy to Celo (production)
pnpm --filter contracts deploy:celo

# Deploy to Sepolia (testing) 
pnpm --filter contracts deploy:sepolia

# Deploy with verification
pnpm --filter contracts deploy:arbitrum --verify
```

### Frontend & API

```bash
# Build for production
pnpm --filter client build
pnpm --filter api build

# The API is configured for Railway deployment
# The client can be deployed to any static hosting provider
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. **Git hooks will automatically**:
   - Format and lint staged files on commit (pre-commit hook)
   - Run comprehensive quality checks on push (pre-push hook)
5. Manual quality checks (optional):
   ```bash
   pnpm format
   pnpm test
   pnpm lint
   ```
6. Commit your changes:
   ```bash
   git commit -m "feat: your feature description"
   ```
7. Push to your fork
8. Create a pull request

### Commit Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

### Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update the changelog
5. Get code review approval
6. Merge after approval

## 📚 Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [AI Agents & Automation](./AGENTS.md)
- [Contract Deployment Guide](./packages/contracts/DEPLOYMENT.md)  
- [E2E Testing Guide](./tests/README.md)
- [Client Package Documentation](./packages/client/README.md)
- [API Package Documentation](./packages/api/README.md)
- [Indexer Package Documentation](./packages/indexer/README.md)
- [Contracts Package Documentation](./packages/contracts/README.md)

## 🔐 Security

- Report security vulnerabilities to security@greengoods.app
- Do not disclose security-related issues publicly

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Privy](https://www.privy.io/) for authentication and wallet management
- [Pinata](https://pinata.cloud/) for IPFS services
- [Foundry](https://getfoundry.sh/) for smart contract development
- [Envio](https://envio.dev/) for blockchain indexing
- All contributors and supporters of the project
