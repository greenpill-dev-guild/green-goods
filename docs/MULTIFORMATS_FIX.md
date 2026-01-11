# Multiformats v13 Compatibility Fix

## Issue

The project uses `multiformats` v13+ which removed the `multiformats/basics` export. However, some dependencies (notably `@walletconnect/utils` via `uint8arrays` v3.x) still try to import from this path, causing build and test failures.

## Solution

We've implemented an automatic postinstall script that:

1. Creates `/node_modules/multiformats/basics.js` as a compatibility shim
2. Patches `uint8arrays` to use the correct import path
3. Patches any `@walletconnect` packages if needed

## How It Works

### Automatic Fix (Recommended)

The fix is applied automatically when you run:
```bash
bun install
# or
npm install
# or
yarn install
```

This works in:
- ✅ Local development
- ✅ GitHub Actions (with caching optimization)
- ✅ Vercel deployments
- ✅ Any CI/CD environment

### Manual Fix

If needed, you can run the fix manually:
```bash
node scripts/fix-multiformats.cjs
```

## Files Involved

- `/scripts/fix-multiformats.cjs` - The postinstall script
- `/package.json` - Contains `"postinstall": "node scripts/fix-multiformats.cjs"`
- `/vercel.json` - Ensures Vercel runs the postinstall

## Maintenance

This fix can be removed when:
1. `@walletconnect/utils` updates to use `uint8arrays` v5+ 
2. OR when all dependencies stop importing `multiformats/basics`

## Troubleshooting

If you see errors like:
```
Error: Package subpath './basics' is not defined by "exports"
```

Run:
```bash
rm -rf node_modules
bun install
```

The postinstall script will automatically apply the fix.