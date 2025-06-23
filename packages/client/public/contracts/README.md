# Contract Deployment Files

This directory serves deployment configuration files during local development.

When running `pnpm dev:full`, the deployment script will generate:
- `deployments/local.json` - Contains deployed contract addresses and schema UIDs

The client will fetch this file to dynamically load contract addresses for the local environment.

In production, these addresses are hardcoded in the `src/config/networks.ts` file. 