# Simple Indexer Setup - Actually Works ✅

## What Changed

Replaced complex auto-magic Docker management with a **simple, reliable script** that just works.

## The Solution

### Simple 2-Step Workflow

**Step 1: Start Docker Desktop**
```bash
open -a Docker
# Wait 30 seconds
```

**Step 2: Start Indexer**
```bash
bun dev
```

That's it.

## What the Script Does

The `setup-and-start.sh` script is now simple and reliable:

1. ✅ Checks if Docker is accessible
2. ✅ If not → Shows clear instructions and exits
3. ✅ If yes → Stops existing indexer instances
4. ✅ Installs ReScript dependencies with pnpm
5. ✅ Builds ReScript code
6. ✅ Starts the indexer

**No auto-starting. No auto-restarting. No fighting Docker Desktop.**

## Why This Works

### Before (Complex Script)
- Tried to auto-detect Docker Desktop state
- Tried to auto-start Docker Desktop
- Tried to auto-restart when stale
- Tried to manage Docker contexts
- **Result:** Unreliable, complex, still failed

### After (Simple Script)
- Checks if Docker works
- If yes → proceed
- If no → show instructions and exit
- **Result:** Reliable, simple, actually works

## Error Messages

### If Docker Isn't Running

```bash
$ bun dev

❌ Docker is not running or not accessible.

To fix:
  1. Open Docker Desktop: open -a Docker
  2. Wait 30 seconds for it to start
  3. Run: bun dev
```

Clear, actionable, no guessing.

## Test Results ✅

```bash
$ bun dev
🔧 Setting up indexer...
📦 Installing ReScript dependencies with pnpm...
🔨 Building ReScript code...
✅ Setup complete!
🚀 Starting indexer...

 ███████╗ ███╗   ██╗ ██╗   ██╗ ██╗  ██████╗ 
 ██╔════╝ ████╗  ██║ ██║   ██║ ██║ ██╔═══██╗
 █████╗   ██╔██╗ ██║ ██║   ██║ ██║ ██║   ██║
 ██╔══╝   ██║╚██╗██║ ╚██╗ ██╔╝ ██║ ██║   ██║
 ███████╗ ██║ ╚████║  ╚████╔╝  ██║ ╚██████╔╝

✅ Health: http://localhost:8080/healthz → OK
✅ GraphQL: http://localhost:8080/v1/graphql → Active
```

## Daily Workflow

```bash
# Morning: Start Docker Desktop once
open -a Docker

# Then any time you need the indexer:
cd /Users/afo/Code/greenpill/green-goods/packages/indexer
bun dev

# Stop when done:
bun stop
# or just Ctrl+C
```

## Commands

```bash
bun dev      # Start indexer (checks Docker first)
bun stop     # Stop indexer
bun reset    # Clean Docker state + restart
```

## What Was Removed

- ❌ Auto-detect Docker Desktop installation
- ❌ Auto-start Docker Desktop
- ❌ Auto-restart Docker Desktop
- ❌ Complex Docker context switching
- ❌ Docker socket path detection
- ❌ Waiting loops for Docker to start
- ❌ 150+ lines of complex Docker management

## What Was Kept

- ✅ Simple Docker accessibility check
- ✅ Clear error messages
- ✅ Auto-stop existing indexer instances
- ✅ ReScript setup automation
- ✅ ~60 lines of straightforward code

## Philosophy

**Computers should do what you tell them, not try to be smart.**

The complex script tried to be too smart and failed. The simple script does exactly what you tell it and works every time.

## Files Modified

1. ✅ `setup-and-start.sh` - Simplified from 150+ to ~60 lines
2. ✅ `README.md` - Updated with 2-step workflow
3. ✅ `AGENTS.md` - Updated quick reference

## Status

✅ **Production Ready and Actually Works**

- Simple
- Reliable
- Clear error messages
- No surprises

---

**Date:** 2025-10-20  
**Status:** ✅ Working Reliably  
**Philosophy:** Keep it simple, stupid (KISS)







