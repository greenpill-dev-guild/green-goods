# Green Goods Admin Dashboard

Administrative dashboard for managing the Green Goods platform, including gardens, operators, gardeners, and smart contract deployments.

## 🚀 Quick Start

```bash
# Install dependencies (from project root)
bun install

# Configure environment variables in root .env file
# See "Environment Variables" section below

# Start the admin dashboard
bun --filter admin dev
```

The admin dashboard will be available at `http://localhost:3002`

## 🎯 Features

### Admin Features (Allow List)
- **Garden Management**: Create, view, and remove gardens
- **Contract Management**: Deploy and upgrade smart contracts
- **Global Operations**: View all gardens, operators, and gardeners across the platform
- **Deployment Registry**: Manage contract deployments across networks

### Operator Features (Indexer Query)
- **Garden Access**: View and manage assigned gardens only
- **Member Management**: Add/remove gardeners and operators within assigned gardens
- **Impact Reports**: View Karma GAP attestations for assigned gardens
- **Limited Scope**: Cannot create new gardens or manage contracts

### Impact Reporting (Planned Feature)
- **Karma GAP Integration**: Query impact attestations via Karma GAP SDK
- **Three-Level Tracking**: Projects (gardens), impacts (approved work)
- **Export Functionality**: Download impact data as CSV/JSON for reporting
- **EAS Explorer Links**: Direct links to verify attestations on-chain
- **Filter by Garden**: View impact data for specific gardens

**Note:** Impact data is queried via Karma GAP SDK, not Green Goods indexer. See [docs/KARMA_GAP.md](../../docs/KARMA_GAP.md) for details.

## 🔐 Access Control

### Admin Access
Users in the admin allow list (configured in `src/config.ts`):
- `0x2aa64E6d80390F5C017F0313cB908051BE2FD35e`
- `0x04D60647836bcA09c37B379550038BdaaFD82503`

### Operator Access
Users returned by the indexer query for gardens where they are listed as operators.

### Role Detection
The `useRole` hook automatically detects user permissions:
1. Checks admin allow list first
2. Queries indexer for operator gardens
3. Returns `unauthorized` if neither condition is met

## 🏗️ Architecture

### Technology Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Radix UI
- **State Management**: Zustand + XState workflows
- **Data Fetching**: TanStack Query + graphql-request
- **Blockchain**: Viem + Privy authentication
- **Routing**: React Router v7
- **Notifications**: React Hot Toast

### Project Structure
```
packages/admin/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Garden/         # Garden-specific components
│   │   ├── Layout/         # Navigation and layout
│   │   └── UI/             # Generic UI components
│   ├── hooks/              # Custom React hooks
│   ├── providers/          # React context providers
│   ├── stores/             # Zustand state stores
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── views/              # Main application views
│   ├── workflows/          # XState state machines
│   └── config.ts           # Configuration constants
├── public/                 # Static assets
└── README.md               # This file
```

## 🔧 Key Components

### Hooks

#### `useRole`
Detects user role (admin/operator/unauthorized) based on:
- Admin allow list check
- Indexer query for operator gardens

```typescript
const { role, isAdmin, isOperator, operatorGardens, loading } = useRole();
```

#### `useChainSync`
Manages chain switching with toast feedback:

```typescript
const { currentChain, switchChain, isSwitching } = useChainSync();
```

#### `useToastAction`
Wraps blockchain transactions with standardized toast notifications:

```typescript
const { executeWithToast } = useToastAction();

await executeWithToast(
  () => contractWrite(),
  {
    loadingMessage: "Processing...",
    successMessage: "Success!",
    errorMessage: "Failed"
  }
);
```

### State Management

#### Zustand Store (`useAdminStore`)
- Selected chain ID
- Selected garden
- Pending transactions tracking
- UI state (sidebar open/closed)

#### XState Workflows
- Garden creation workflow with validation and retry logic
- Contract deployment workflows (future)

### GraphQL Integration

#### Queries
- `GetDashboardStats`: Dashboard overview data
- `GetGardens`: All gardens or operator-specific gardens
- `GetGardenDetail`: Individual garden details

**Note:** GAP attestations (projects, impacts) are queried via Karma GAP SDK, not Green Goods indexer.

#### Subscriptions
- `GardenCreated`: Real-time garden creation events
- `OperatorAdded`: Real-time operator addition events
- `GardenerAdded`: Real-time gardener addition events

## 🌐 Blockchain Integration

### Supported Networks
- **Arbitrum One** (42161) - Production
- **Celo** (42220) - Production
- **Base Sepolia** (84532) - Testnet

### Contract Interactions

#### Garden Management (Admin Only)
```typescript
// Create garden
const { createGarden } = useCreateGarden();
await createGarden({
  communityToken: "0x...",
  name: "Garden Name",
  description: "Description",
  location: "Location",
  bannerImage: "https://...",
  gardeners: ["0x..."],
  gardenOperators: ["0x..."]
});
```

#### Member Management (Admin + Operators)
```typescript
// Add/remove gardeners and operators
const { addGardener, removeGardener, addOperator, removeOperator } = useGardenOperations(gardenId);

await addGardener("0x...");
await removeOperator("0x...");
```

## 🔄 Development Workflow

### Local Development
```bash
# Start admin dashboard only
bun --filter admin dev

# Start all services (includes indexer)
bun dev

# Run tests
bun --filter admin test

# Build for production
bun --filter admin build
```

### Environment Variables

**All environment variables are configured in the root `.env` file** (at the monorepo root, not in this package).

The root `.env` file is automatically loaded by:
- Vite development server (via `vite.config.ts`)
- Build scripts
- All package scripts

**Admin-relevant environment variables:**

```bash
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_DEFAULT_CHAIN_ID=42161
VITE_ALCHEMY_API_KEY=your_alchemy_key
VITE_ENVIO_INDEXER_URL=https://indexer.dev.hyperindex.xyz/2e23bea/v1/graphql
```

**Setup:**
1. Create or edit `.env` at the project root (not in `packages/admin/`)
2. Add the required environment variables listed above
3. Variables are automatically loaded when running `bun dev` from root or package directory

## 🧪 Testing

### Unit Tests
```bash
bun --filter admin test
bun --filter admin test:watch
```

### Integration Testing
The admin dashboard integrates with:
- **Indexer**: Real-time GraphQL queries and subscriptions
- **Smart Contracts**: Direct blockchain interactions
- **Privy**: Wallet authentication and management

## 🚀 Deployment

### Production Build
```bash
bun --filter admin build
```

### Environment Setup
1. Configure production environment variables
2. Ensure proper contract deployments on target networks
3. Update admin allow list addresses
4. Configure indexer endpoint

## 🔒 Security Considerations

### Access Control
- Admin functions are restricted to allow list addresses
- Operator functions are restricted to gardens where user is an operator
- All blockchain transactions require wallet signature
- Role detection happens on every route change

### Transaction Safety
- All contract interactions use `useToastAction` for error handling
- Transaction status tracking prevents double-spending
- Clear error messages for failed transactions
- Retry mechanisms for network issues

## 📝 Contributing

1. Follow the project's coding standards (Biome formatting, oxlint)
2. Add tests for new functionality
3. Update this README for new features
4. Ensure all blockchain transactions use toast notifications

## 🐛 Troubleshooting

### Common Issues

#### "Unauthorized" Error
- Verify your wallet address is in the admin allow list
- Check if you're an operator for any gardens via the indexer
- Ensure you're connected to the correct network

#### Contract Interaction Failures
- Verify contract addresses are deployed on the selected network
- Check wallet has sufficient gas
- Ensure you have the correct permissions for the operation

#### GraphQL/Indexer Issues
- Verify indexer URL is correct in environment variables
- Check network connectivity
- Ensure indexer is running and accessible

### Debug Mode
Set `VITE_ENABLE_SW_DEV=true` for additional debugging information.

## 📖 Documentation

📖 **[Admin Dashboard Documentation](https://docs.greengoods.app/developer/architecture/admin-package)** — Complete admin architecture guide

**Essential Guides:**
- 🏗️ [System Architecture](https://docs.greengoods.app/developer/architecture) — Package relationships and data flow
- 🎯 [Operator Quickstart](https://docs.greengoods.app/welcome/quickstart-operator) — Get started as an operator
- 📋 [Managing Gardens Guide](https://docs.greengoods.app/guides/operators/managing-gardens) — Garden management workflows

**Package-Specific Documentation:**
- **[Migration Guide](./docs/GARDEN_FEATURE_MIGRATION.md)** — Implementing garden features that were previously CLI scripts
- **[Local README](./docs/README.md)** — Overview of admin dashboard architecture

## 📚 Related Resources

- [Smart Contracts Package](https://docs.greengoods.app/developer/architecture/contracts-package)
- [GraphQL Indexer Package](https://docs.greengoods.app/developer/architecture/indexer-package)
- [Client Application Package](https://docs.greengoods.app/developer/architecture/client-package)