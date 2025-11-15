# Critical Fixes Needed for Shared Package Build

## ❌ Problem Summary

The refactoring moved code from client/admin to shared, but:
1. **Vite can't resolve shared package's dependencies** - The shared package imports peer dependencies that Vite can't find during pre-bundling
2. **Type errors from missing application types** - Types like `Action`, `Garden`, `Work`, `WorkDraft` etc. need proper exports
3. **Some `@/` imports remain in shared files** - These refer to admin components and are intentional (admin-specific)

## 🔧 Solution

### Fix 1: Add Missing Peer Dependencies to Shared Package

The shared package needs these dependencies moved from `peerDependencies` to `dependencies`:

```bash
cd packages/shared
bun add @reown/appkit @reown/appkit-adapter-wagmi browser-lang @wagmi/core posthog-js permissionless urql browser-image-compression
```

### Fix 2: Search for Application Types

The application types (`Action`, `Garden`, `Work`, etc.) need to be found and properly exported. They might be:
- In `modules/data/greengoods.ts` as runtime types
- In separate type definition files that weren't moved
- Need to be created from GraphQL introspection types

### Fix 3: Fix Contract ABI Imports

The error shows contract ABIs can't be found:
```
Cannot find module '../../../indexer/abis/GardenToken.json'
```

These imports need to be fixed to point to the correct location.

---

## Next Steps

1. Move peer dependencies to dependencies in shared package
2. Fix contract ABI import paths
3. Create/export missing application types
4. Test both client and admin dev servers

