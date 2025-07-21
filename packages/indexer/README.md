# Green Goods Indexer

This package contains the blockchain indexer for Green Goods, built with [Envio](https://envio.dev/). It provides a real-time GraphQL API for querying garden, attestation, and work submission data from the blockchain.

## 🚀 Features

- **Real-time Indexing**: Automatically indexes blockchain events as they occur
- **GraphQL API**: Rich GraphQL interface for querying indexed data
- **Multi-chain Support**: Indexes data from multiple EVM chains
- **Type Safety**: Generated TypeScript types for all indexed entities
- **High Performance**: Optimized for fast queries and real-time updates

## 📁 Structure

```
packages/indexer/
├── config.yaml              # Envio configuration
├── schema.graphql           # GraphQL schema definition
├── src/
│   └── EventHandlers.ts     # Event handling logic
├── abis/                    # Contract ABIs
│   ├── ActionRegistry.json
│   ├── GardenAccount.json
│   └── GardenToken.json
├── generated/               # Generated code (auto-created)
└── test/
    └── test.ts             # Test files
```

## 🛠 Development

### Prerequisites

- Node.js (v18 or higher)
- pnpm
- Envio CLI installed globally

### Installation

```bash
# Install dependencies
pnpm install

# Install Envio CLI globally (if not already installed)
npm install -g envio
```

### Development Setup

**Prerequisites:**
- Node.js (v18 or higher)
- pnpm package manager
- Envio CLI installed globally
- Access to RPC endpoints for target networks

**Development Tools:**
- **Envio**: Blockchain indexing framework
- **TypeScript**: Type safety with generated types
- **GraphQL**: Schema-first development
- **PostgreSQL**: Database (managed by Envio)

**Code Quality Tools:**
- **Biome**: Fast formatting and linting
- **TypeScript**: Strict type checking
- **Envio CodeGen**: Automatic type generation

### Development Workflow

**Initial Setup:**
```bash
# Generate TypeScript types and handlers from schema
pnpm codegen

# Alternative: use Envio directly
envio codegen
```

**Development Server:**
```bash
# Start development server with hot reload
pnpm dev

# Alternative: use Envio directly
envio dev
```

This starts the indexer and GraphQL playground at `http://localhost:8080`.

**Code Generation:**
Run `pnpm codegen` whenever you update:
- `schema.graphql` - GraphQL schema definitions
- `config.yaml` - Network and contract configuration
- Contract ABIs in `abis/` directory

**Testing:**
```bash
# Run unit tests
pnpm test

# Alternative test command
pnpm mocha

# Test specific file
pnpm mocha test/test.ts
```

### Configuration Management

**Environment Variables:**
Create a `.env` file in the indexer directory:
```bash
# Network RPC URLs
CELO_RPC_URL=https://forno.celo.org
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
ARBITRUM_RPC_URL=https://arbitrum-one.publicnode.com
BASE_RPC_URL=https://mainnet.base.org
```

**Network Configuration (`config.yaml`):**
```yaml
networks:
  - id: 42220  # Celo
    rpc_url: ${CELO_RPC_URL}
    start_block: 25000000
  - id: 11155111  # Sepolia
    rpc_url: ${SEPOLIA_RPC_URL}  
    start_block: 5000000
```

**Schema Development:**
- Define entities in `schema.graphql`
- Add relationships between entities
- Use appropriate GraphQL scalar types
- Consider indexing performance for large datasets

### Integration with Contracts

**Automatic Integration:**
The indexer automatically integrates with the contracts package:
1. **Contract Deployment**: Addresses are updated when contracts are deployed
2. **ABI Sync**: Contract ABIs are kept in sync
3. **Network Configuration**: Supported networks match deployment targets

**Integration Scripts:**
```bash
# Enable local development mode
pnpm --filter contracts envio:enable-local

# Disable local development (cleanup)
pnpm --filter contracts envio:disable-local

# Update indexer config after contract deployment
node ../contracts/script/utils/envio-integration.js update
```

**Manual Configuration Update:**
If you need to manually update contract addresses:
1. Check deployed addresses in `../contracts/deployments/`
2. Update `config.yaml` with new addresses
3. Run `pnpm codegen` to regenerate types
4. Restart development server

### Event Handler Development

**Creating Event Handlers:**
Event handlers are defined in `src/EventHandlers.ts`:

```typescript
// Example: Handle garden creation
export const handleGardenCreated = async (event: GardenCreatedEvent) => {
  const garden = {
    id: event.params.tokenId.toString(),
    tokenId: event.params.tokenId,
    name: event.params.name,
    description: event.params.description,
    location: event.params.location,
    bannerImage: event.params.bannerImage,
    gardeners: event.params.gardeners,
    operators: event.params.operators,
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  };

  await Garden.create(garden);
};
```

**Best Practices:**
- Use descriptive entity IDs (often derived from transaction hash + log index)
- Handle relationship updates carefully
- Consider database constraints and unique indexes
- Add error handling for malformed data

### GraphQL Development

**Testing Queries:**
Use the GraphQL playground at `http://localhost:8080` to test queries:

```graphql
# Get all gardens with recent works
query GetGardensWithWorks {
  gardens(limit: 10) {
    id
    name
    description
    works(limit: 5, orderBy: { submittedAt: desc }) {
      id
      title
      submittedBy
      submittedAt
    }
  }
}
```

**Performance Optimization:**
- Use appropriate limits for large result sets
- Consider pagination for mobile clients
- Select only needed fields to reduce payload size
- Add database indexes for frequently queried fields

### Troubleshooting

**Common Development Issues:**

**Indexer not starting:**
```bash
# Check RPC URLs are accessible
curl -X POST $CELO_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Verify contract addresses in config
cat config.yaml | grep -A 5 "contracts:"

# Check start_block is not too far back
```

**Missing events:**
- Verify contract deployment addresses match config
- Check ABI matches deployed contract version
- Ensure network configuration is correct
- Check start_block is before contract deployment

**Performance issues:**
```bash
# Monitor sync progress
# Check GraphQL playground for current block vs latest block

# Optimize start_block
# Set to block just before contract deployment

# Check RPC rate limits
# Use multiple RPC providers if needed
```

**Database issues:**
```bash
# Reset local database
envio local db reset

# Check database connection
envio local db status

# View database logs
envio local logs
```

### Debugging

**Debug Mode:**
```bash
# Run with debug logging
DEBUG=* pnpm dev

# Run specific debug categories
DEBUG=envio:* pnpm dev

# Debug specific event handlers
DEBUG=envio:handlers pnpm dev
```

**Logging:**
- Console logs appear in development server output
- Use structured logging for production deployments
- Check Envio Cloud dashboard for deployed indexers

### Performance Monitoring

**Local Monitoring:**
- GraphQL playground shows sync status
- Console logs show event processing speed
- Check memory usage for large datasets

**Production Monitoring:**
- Envio Cloud provides comprehensive metrics
- Monitor sync lag (current block vs latest block)
- Track query performance and error rates
- Set up alerts for sync failures

**Optimization Tips:**
- Use appropriate `start_block` values
- Batch database operations when possible
- Consider entity relationships and join patterns
- Monitor database query performance

## 📊 GraphQL Schema

The indexer provides the following main entities:

### Garden
```graphql
type Garden {
  id: ID!
  tokenId: BigInt!
  name: String!
  description: String
  location: String
  bannerImage: String
  gardeners: [String!]!
  operators: [String!]!
  createdAt: BigInt!
  updatedAt: BigInt!
  works: [Work!]!
  assessments: [Assessment!]!
}
```

### Work
```graphql
type Work {
  id: ID!
  gardenId: String!
  garden: Garden!
  actionUID: BigInt!
  title: String!
  description: String
  submittedBy: String!
  submittedAt: BigInt!
  status: WorkStatus!
  approvals: [WorkApproval!]!
}
```

### Assessment
```graphql
type Assessment {
  id: ID!
  gardenId: String!
  garden: Garden!
  soilMoisturePercentage: Int!
  carbonTonStock: BigInt!
  assessedBy: String!
  assessedAt: BigInt!
}
```

### WorkApproval
```graphql
type WorkApproval {
  id: ID!
  workId: String!
  work: Work!
  approved: Boolean!
  feedback: String
  approvedBy: String!
  approvedAt: BigInt!
}
```

## 🔄 Event Handling

The indexer processes the following blockchain events:

### GardenToken Events
- **GardenCreated**: New garden registration
- **GardenUpdated**: Garden metadata updates
- **Transfer**: Garden ownership changes

### ActionRegistry Events  
- **WorkSubmitted**: New work submissions
- **WorkApproved**: Work approval status updates

### EAS Events
- **AttestationCreated**: New attestations (assessments, work, approvals)
- **AttestationRevoked**: Revoked attestations

### Event Handlers

Event handlers are defined in `src/EventHandlers.ts`:

```typescript
// Example event handler
export const handleGardenCreated = async (event: GardenCreatedEvent) => {
  const garden = {
    id: event.params.tokenId.toString(),
    tokenId: event.params.tokenId,
    name: event.params.name,
    description: event.params.description,
    location: event.params.location,
    bannerImage: event.params.bannerImage,
    gardeners: event.params.gardeners,
    operators: event.params.operators,
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  };

  await Garden.create(garden);
};
```

## 🌐 GraphQL Queries

### Example Queries

**Get all gardens:**
```graphql
query GetGardens {
  gardens {
    id
    name
    description
    location
    gardeners
    operators
    createdAt
  }
}
```

**Get garden with works:**
```graphql
query GetGardenWithWorks($gardenId: ID!) {
  garden(id: $gardenId) {
    id
    name
    description
    works {
      id
      title
      description
      submittedBy
      submittedAt
      status
      approvals {
        approved
        feedback
        approvedBy
        approvedAt
      }
    }
  }
}
```

**Get recent assessments:**
```graphql
query GetRecentAssessments($limit: Int = 10) {
  assessments(limit: $limit, orderBy: { assessedAt: desc }) {
    id
    garden {
      name
      location
    }
    soilMoisturePercentage
    carbonTonStock
    assessedBy
    assessedAt
  }
}
```

## 🔧 Configuration

### Networks

The indexer supports multiple networks configured in `config.yaml`:

```yaml
networks:
  - id: 42220  # Celo
    rpc_url: ${CELO_RPC_URL}
    start_block: 25000000
  - id: 11155111  # Sepolia
    rpc_url: ${SEPOLIA_RPC_URL}  
    start_block: 5000000
```

### Environment Variables

Create a `.env` file with RPC URLs:

```bash
# Network RPC URLs
CELO_RPC_URL=https://forno.celo.org
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
ARBITRUM_RPC_URL=https://arbitrum-one.publicnode.com
BASE_RPC_URL=https://mainnet.base.org
```

### Contract Integration

Contracts are automatically configured via integration with the contracts package. The indexer will:

1. Read deployed contract addresses from `../contracts/deployments/`
2. Use ABIs from `abis/` directory
3. Update configuration when contracts are redeployed

## 🚀 Deployment

### Local Development

```bash
# Start with hot reload
pnpm dev

# View at http://localhost:8080
```

### Production Deployment

The indexer can be deployed to various platforms:

**Envio Cloud (Recommended):**
```bash
# Deploy to Envio's managed infrastructure
envio deploy
```

**Docker:**
```bash
# Build Docker image
docker build -t green-goods-indexer .

# Run container
docker run -p 8080:8080 green-goods-indexer
```

**Self-hosted:**
```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## 🔄 Integration with Contracts

The indexer automatically integrates with the contracts package:

1. **Contract Deployment**: When contracts are deployed, addresses are automatically updated
2. **ABI Sync**: Contract ABIs are kept in sync with deployed contracts
3. **Network Configuration**: Supported networks match contract deployment targets

### Envio Integration Scripts

The contracts package includes Envio integration utilities:

```bash
# Enable local development
pnpm --filter contracts envio:enable-local

# Disable local development (cleanup)
pnpm --filter contracts envio:disable-local

# Update indexer config after deployment
node script/utils/envio-integration.js update
```

## 📊 Performance & Monitoring

### Metrics

The indexer tracks:
- **Sync Progress**: Current vs latest block
- **Event Processing**: Events per second
- **Query Performance**: GraphQL query times
- **Error Rates**: Failed event processing

### Health Checks

Health status available at:
- `http://localhost:8080/health` - Basic health check
- `http://localhost:8080/metrics` - Detailed metrics

### Optimization

For optimal performance:
- Use appropriate `start_block` values to avoid unnecessary historical data
- Monitor memory usage for large datasets
- Use GraphQL query optimization (select only needed fields)
- Consider pagination for large result sets

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm mocha test/test.ts
```

### Integration Testing

Test against live contracts:

```bash
# Test with local network
pnpm --filter contracts deploy:local
pnpm dev

# Test with testnet
pnpm --filter contracts deploy:sepolia
# Update config for Sepolia and restart indexer
```

### GraphQL Testing

Use the GraphQL playground at `http://localhost:8080` to test queries interactively.

## 🔍 Troubleshooting

### Common Issues

**Indexer not starting:**
- Check RPC URLs are accessible
- Verify contract addresses in config
- Ensure start_block is not too far back

**Missing events:**
- Check contract deployment addresses
- Verify ABI matches deployed contracts
- Check network configuration

**Performance issues:**
- Lower start_block if possible
- Optimize GraphQL queries
- Check RPC rate limits

### Debug Mode

```bash
# Run with debug logging
DEBUG=* pnpm dev

# Run specific debug categories
DEBUG=envio:* pnpm dev
```

### Logs

Logs are available in:
- Console output during development
- Log files in production deployments
- Envio Cloud dashboard (for cloud deployments)

## 📚 Additional Resources

- [Envio Documentation](https://docs.envio.dev/)
- [GraphQL Documentation](https://graphql.org/learn/)
- [Green Goods Contract Documentation](../contracts/README.md)
- [Client Integration Guide](../client/README.md)

## 🤝 Contributing

When contributing to the indexer:

1. Update the GraphQL schema if adding new entities
2. Add appropriate event handlers for new contract events
3. Update tests to cover new functionality
4. Run code generation after schema changes
5. Test against both local and testnet deployments

For more information, see the [main project contributing guide](../../README.md#contributing).
