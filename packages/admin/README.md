# Green Goods Admin Dashboard

Administrative dashboard for managing the Green Goods platform, including gardens, operators, gardeners, and smart contract deployments.

## 🚀 Quick Start

```bash
# Install dependencies (from project root)
pnpm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your API keys and configuration

# Start the admin dashboard
pnpm --filter admin dev
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
- **Limited Scope**: Cannot create new gardens or manage contracts

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
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Radix UI
- **State Management**: Zustand + XState workflows
- **Data Fetching**: Urql (GraphQL) + subscriptions
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
pnpm --filter admin dev

# Start all services (includes indexer)
pnpm dev

# Run tests
pnpm --filter admin test

# Build for production
pnpm --filter admin build
```

### Environment Variables
Required environment variables (see `.env.example`):

```bash
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_DEFAULT_CHAIN_ID=42161
VITE_ALCHEMY_KEY=your_alchemy_key
VITE_INDEXER_URL=https://indexer.dev.hyperindex.xyz/2e23bea/v1/graphql
```

## 🧪 Testing

### Unit Tests
```bash
pnpm --filter admin test
pnpm --filter admin test:watch
```

### Integration Testing
The admin dashboard integrates with:
- **Indexer**: Real-time GraphQL queries and subscriptions
- **Smart Contracts**: Direct blockchain interactions
- **Privy**: Wallet authentication and management

## 🚀 Deployment

### Production Build
```bash
pnpm --filter admin build
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

## 📚 Additional Resources

- [Green Goods Documentation](../../docs/)
- [Smart Contracts](../contracts/)
- [GraphQL Indexer](../indexer/)
- [Client Application](../client/)