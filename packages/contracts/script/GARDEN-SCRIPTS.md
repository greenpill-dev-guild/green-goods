# Garden Management Scripts

A comprehensive suite of scripts for managing Green Goods Garden contracts and their members.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Available Scripts](#available-scripts)
  - [Garden Member Management](#garden-member-management)
  - [Garden Information](#garden-information)
  - [Batch Operations](#batch-operations)
  - [Monitoring & Analytics](#monitoring--analytics)
  - [Action Management](#action-management)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## Installation

```bash
# Install dependencies
pnpm install

# Make scripts executable (already done)
chmod +x script/*.js
```

## Configuration

### Environment Variables

Create a `.env` file with the following:

```env
# Private key for operations (use one of these)
OPERATOR_PRIVATE_KEY=your_private_key_here
DEPLOYER_PRIVATE_KEY=your_private_key_here
PRIVATE_KEY=your_private_key_here

# Optional: Custom RPC URLs
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
CELO_RPC_URL=https://forno.celo.org
```

### Supported Networks

- `localhost` - Local development
- `sepolia` - Ethereum Sepolia testnet
- `arbitrum` - Arbitrum One mainnet
- `arbitrum-sepolia` - Arbitrum Sepolia testnet
- `celo` - Celo mainnet
- `celo-testnet` - Celo Alfajores testnet
- `base` - Base mainnet
- `base-sepolia` - Base Sepolia testnet
- `optimism` - Optimism mainnet

## Available Scripts

### Garden Member Management

#### 1. Add Garden Members
```bash
# Add single gardener
pnpm garden:add-members --chain arbitrum --garden 0x123... --addresses 0x456...

# Add multiple addresses as both gardeners and operators
pnpm garden:add-members --chain arbitrum --garden 0x123... \
  --addresses 0x456...,0x789... --roles gardener,operator

# Add from CSV file
pnpm garden:add-members --chain arbitrum --garden 0x123... --csv members.csv

# Dry run
pnpm garden:add-members --chain arbitrum --garden 0x123... \
  --addresses 0x456... --dry-run
```

#### 2. Remove Garden Members
```bash
# Remove gardener
pnpm garden:remove-members --chain arbitrum --garden 0x123... \
  --addresses 0x456... --roles gardener

# Remove multiple operators
pnpm garden:remove-members --chain arbitrum --garden 0x123... \
  --csv members.csv --roles operator

# Force continue on errors
pnpm garden:remove-members --chain arbitrum --garden 0x123... \
  --addresses 0x456... --force
```

### Garden Information

#### 3. Update Garden Info
```bash
# Update name
pnpm garden:update-info --chain arbitrum --garden 0x123... \
  --name "New Garden Name"

# Update description
pnpm garden:update-info --chain arbitrum --garden 0x123... \
  --description "New description for the garden"

# Dry run
pnpm garden:update-info --chain arbitrum --garden 0x123... \
  --name "Test" --dry-run
```

#### 4. Garden Status
```bash
# Get garden status
pnpm garden:status --chain arbitrum --garden 0x123...

# Export to JSON
pnpm garden:status --chain arbitrum --garden 0x123... --export json

# Include events scan
pnpm garden:status --chain arbitrum --garden 0x123... \
  --include-events --from-block 1000000
```

#### 5. Export Garden Data
```bash
# Export to JSON
pnpm garden:export --chain arbitrum --garden 0x123... --format json

# Export to CSV
pnpm garden:export --chain arbitrum --garden 0x123... \
  --format csv --output members.csv

# Include inactive members
pnpm garden:export --chain arbitrum --garden 0x123... \
  --include-inactive --scan-depth 50000
```

### Batch Operations

#### 6. Batch Garden Operations
```bash
# Run batch operations from config file
pnpm garden:batch-ops --chain arbitrum --config operations.json

# Dry run
pnpm garden:batch-ops --chain arbitrum --config operations.json --dry-run

# Continue on errors
pnpm garden:batch-ops --chain arbitrum --config operations.json \
  --continue-on-error true
```

**Configuration File Format:**
```json
{
  "gardens": [
    {
      "address": "0x123...",
      "addGardeners": ["0x456...", "0x789..."],
      "removeGardeners": ["0xabc..."],
      "addOperators": ["0xdef..."],
      "removeOperators": ["0xghi..."],
      "updateName": "New Name",
      "updateDescription": "New description"
    }
  ]
}
```

### Monitoring & Analytics

#### 7. Monitor Garden Events
```bash
# Real-time monitoring
pnpm garden:monitor --chain arbitrum --garden 0x123... --realtime

# Monitor specific events
pnpm garden:monitor --chain arbitrum --garden 0x123... \
  --events GardenerAdded,GardenerRemoved

# Historical scan
pnpm garden:monitor --chain arbitrum --garden 0x123... \
  --historical --from-block 1000000 --to-block 1100000
```

#### 8. Garden Analytics
```bash
# Summary report
pnpm garden:analytics --chain arbitrum --garden 0x123... \
  --report summary --period 30d

# Activity report
pnpm garden:analytics --chain arbitrum --garden 0x123... \
  --report activity --period 7d --export

# Members report
pnpm garden:analytics --chain arbitrum --garden 0x123... \
  --report members --period all
```

### Action Management

#### 9. Action Manager
```bash
# Register actions from file
pnpm action:register --chain arbitrum --file actions.json

# Update action
pnpm action:update --chain arbitrum --uid 1 \
  --end-time "2024-12-31T23:59:59Z"

# List actions
pnpm action:list --chain arbitrum --export
```

**Actions File Format:**
```json
{
  "actions": [
    {
      "title": "Action Title",
      "instructions": "Detailed instructions",
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-12-31T23:59:59Z",
      "capitals": ["LIVING", "INTELLECTUAL", "MATERIAL"],
      "media": ["QmHash1", "QmHash2"]
    }
  ]
}
```

## Usage Examples

### Complete Garden Setup
```bash
# 1. Deploy a new garden (using existing deploy script)
pnpm deploy:garden config/garden.json

# 2. Add initial members
pnpm garden:add-members --chain arbitrum --garden 0x123... \
  --csv initial-members.csv --roles gardener

# 3. Add operators
pnpm garden:add-members --chain arbitrum --garden 0x123... \
  --addresses 0x456...,0x789... --roles operator

# 4. Update garden info
pnpm garden:update-info --chain arbitrum --garden 0x123... \
  --name "Community Garden" --description "A sustainable community garden"

# 5. Check status
pnpm garden:status --chain arbitrum --garden 0x123... --export json
```

### Regular Maintenance
```bash
# Export current member list
pnpm garden:export --chain arbitrum --garden 0x123... \
  --format csv --output members-backup.csv

# Monitor for changes
pnpm garden:monitor --chain arbitrum --garden 0x123... --realtime

# Generate monthly report
pnpm garden:analytics --chain arbitrum --garden 0x123... \
  --report summary --period 30d --export
```

### Bulk Operations
```bash
# Create operations config
cat > operations.json << EOF
{
  "gardens": [
    {
      "address": "0x123...",
      "addGardeners": ["0x456...", "0x789..."],
      "updateDescription": "Updated for spring season"
    }
  ]
}
EOF

# Execute operations
pnpm garden:batch-ops --chain arbitrum --config operations.json
```

## CSV File Format

For scripts that accept CSV files (`--csv` option), use the following format:

```csv
address
0x1234567890123456789012345678901234567890
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
```

Alternative column names are also supported: `Address`, `wallet`, `Wallet`, `member`, `Member`

## Advanced Features

### Gas Optimization
- All scripts support `--estimate-gas` to show estimated costs before transactions
- Batch operations process multiple addresses efficiently
- Use `--batch-size` to control transaction batching

### Error Handling
- Use `--force` to continue operations even if some fail
- Use `--dry-run` to simulate operations without executing
- All scripts have retry logic for network errors

### Export Options
- JSON format for programmatic processing
- CSV format for spreadsheet compatibility
- Timestamped filenames prevent overwrites

## Troubleshooting

### Common Issues

1. **"Missing required environment variable"**
   - Ensure your `.env` file contains one of: `OPERATOR_PRIVATE_KEY`, `DEPLOYER_PRIVATE_KEY`, or `PRIVATE_KEY`

2. **"Failed to connect to garden"**
   - Verify the garden address is correct
   - Check you're using the right network
   - Ensure your RPC URL is working

3. **"Not a garden operator"**
   - The private key must belong to a current garden operator
   - Use `garden:status` to check current operators

4. **Transaction failures**
   - Check gas prices on the network
   - Ensure account has sufficient balance
   - Verify you have the required permissions

### Debug Mode

For detailed logging, run scripts with Node.js debug flag:
```bash
NODE_ENV=development node script/garden-status.js --chain arbitrum --garden 0x123...
```

## Contributing

When adding new scripts:
1. Follow the existing pattern in `utils/garden-utils.js`
2. Add comprehensive `--help` documentation
3. Support `--dry-run` where applicable
4. Update this README with examples
5. Add to `package.json` scripts section

## License

MIT
