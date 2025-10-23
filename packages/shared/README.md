# @green-goods/shared

Shared utilities, types, and modules for Green Goods monorepo.

## Installation

This package is used internally by client and admin packages:

```json
{
  "dependencies": {
    "@green-goods/shared": "workspace:*"
  }
}
```

## Usage

### Utilities
```typescript
import { cn } from "@green-goods/shared/utils";
```

### Config
```typescript
import { getEASConfig, getNetworkConfig } from "@green-goods/shared/config";
```

### Modules
```typescript
import { createEasClient, uploadFileToIPFS } from "@green-goods/shared/modules";
```

### Toast Utilities
```typescript
import { toastService, ToastViewport } from "@green-goods/shared";

toastService.error({
  title: "Work submission failed",
  message: "We'll retry in the background.",
  context: "work upload",
  error, // optional diagnostics logged in dev
});

// Render once in your root layout to apply shared styling
<ToastViewport />;
```

### Types
```typescript
import type { Garden, WorkCard } from "@green-goods/shared/types";
```

## Package Structure

```
src/
├── utils/          # Utility functions (cn, etc.)
├── config/         # Configuration (blockchain, chains)
├── modules/        # Data modules (EAS, Pinata, URQL, GraphQL)
├── types/          # TypeScript type definitions
├── toast/          # Toast service + shared viewport component
└── constants/      # Constants (chain IDs, etc.)
```

## Development

```bash
# Format code
bun format

# Lint code
bun lint
```
