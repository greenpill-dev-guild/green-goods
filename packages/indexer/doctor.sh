#!/bin/bash
# Indexer Doctor - Diagnose and fix common issues
# Usage: ./doctor.sh [--fix]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

FIX_MODE=false
if [ "$1" = "--fix" ] || [ "$1" = "-f" ]; then
  FIX_MODE=true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              🩺 Indexer Health Check                         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

ISSUES_FOUND=0
FIXED=0

# Check 1: Docker Desktop
echo -e "${BLUE}[1/6]${NC} Checking Docker Desktop..."
if ! command -v docker &> /dev/null; then
  echo -e "  ${RED}✗${NC} Docker not installed"
  echo "    Install from: https://www.docker.com/products/docker-desktop"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
elif ! docker ps > /dev/null 2>&1; then
  echo -e "  ${RED}✗${NC} Docker daemon not running"
  if [ "$FIX_MODE" = true ]; then
    echo -e "  ${YELLOW}→${NC} Starting Docker Desktop..."
    open -a Docker 2>/dev/null || true
    echo "    Waiting for Docker to start (up to 60s)..."
    for i in {1..30}; do
      if docker ps > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Docker started successfully"
        FIXED=$((FIXED + 1))
        break
      fi
      sleep 2
    done
    if ! docker ps > /dev/null 2>&1; then
      echo -e "  ${RED}✗${NC} Docker failed to start. Please start manually."
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  else
    echo "    Run: open -a Docker"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
else
  echo -e "  ${GREEN}✓${NC} Docker daemon running"
fi

# Check 2: PostgreSQL Container
echo -e "${BLUE}[2/6]${NC} Checking PostgreSQL container..."
if docker ps > /dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q "postgres"; then
    if nc -z localhost 5433 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} PostgreSQL running and accessible on port 5433"
    else
      echo -e "  ${YELLOW}!${NC} Container running but port 5433 not accessible"
      echo "    Container may still be starting up..."
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  else
    echo -e "  ${RED}✗${NC} PostgreSQL container not running"
    if [ "$FIX_MODE" = true ]; then
      echo -e "  ${YELLOW}→${NC} Starting containers..."
      cd generated && docker compose up -d 2>&1 && cd ..
      sleep 5
      if nc -z localhost 5433 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL started"
        FIXED=$((FIXED + 1))
      else
        echo -e "  ${RED}✗${NC} Failed to start PostgreSQL"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
      fi
    else
      echo "    Run: cd generated && docker compose up -d"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  fi
else
  echo -e "  ${YELLOW}⊘${NC} Skipped (Docker not running)"
fi

# Check 3: Hasura Container
echo -e "${BLUE}[3/6]${NC} Checking Hasura GraphQL Engine..."
if docker ps > /dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q "graphql"; then
    if nc -z localhost 8080 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Hasura running and accessible on port 8080"
    else
      echo -e "  ${YELLOW}!${NC} Container running but port 8080 not accessible"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  else
    echo -e "  ${RED}✗${NC} Hasura container not running"
    if [ "$FIX_MODE" = true ]; then
      echo -e "  ${YELLOW}→${NC} Will be started with PostgreSQL..."
    else
      echo "    Run: cd generated && docker compose up -d"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  fi
else
  echo -e "  ${YELLOW}⊘${NC} Skipped (Docker not running)"
fi

# Check 4: Generated folder
echo -e "${BLUE}[4/6]${NC} Checking generated code..."
if [ -d "generated" ]; then
  if [ -f "generated/src/Index.res.js" ]; then
    echo -e "  ${GREEN}✓${NC} Generated code exists and is compiled"
  elif [ -f "generated/src/Index.res" ]; then
    echo -e "  ${YELLOW}!${NC} Generated code exists but not compiled"
    if [ "$FIX_MODE" = true ]; then
      echo -e "  ${YELLOW}→${NC} Compiling ReScript..."
      cd generated && pnpm exec rescript 2>&1 && cd ..
      if [ -f "generated/src/Index.res.js" ]; then
        echo -e "  ${GREEN}✓${NC} ReScript compiled"
        FIXED=$((FIXED + 1))
      else
        echo -e "  ${RED}✗${NC} Failed to compile"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
      fi
    else
      echo "    Run: cd generated && pnpm exec rescript"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  else
    echo -e "  ${RED}✗${NC} Generated code missing"
    echo "    Run: bunx envio codegen"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
else
  echo -e "  ${RED}✗${NC} Generated folder missing"
  echo "    Run: bunx envio codegen"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 5: Node modules
echo -e "${BLUE}[5/6]${NC} Checking dependencies..."
if [ -d "generated/node_modules" ]; then
  if [ -d "generated/node_modules/rescript" ] && [ -d "generated/node_modules/envio" ]; then
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
  else
    echo -e "  ${YELLOW}!${NC} Some dependencies missing"
    if [ "$FIX_MODE" = true ]; then
      echo -e "  ${YELLOW}→${NC} Installing dependencies..."
      cd generated && pnpm install 2>&1 && cd ..
      echo -e "  ${GREEN}✓${NC} Dependencies installed"
      FIXED=$((FIXED + 1))
    else
      echo "    Run: cd generated && pnpm install"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  fi
else
  echo -e "  ${RED}✗${NC} node_modules missing"
  if [ "$FIX_MODE" = true ]; then
    echo -e "  ${YELLOW}→${NC} Installing dependencies..."
    cd generated && pnpm install 2>&1 && cd ..
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
    FIXED=$((FIXED + 1))
  else
    echo "    Run: cd generated && pnpm install"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
fi

# Check 6: Port conflicts
echo -e "${BLUE}[6/6]${NC} Checking for port conflicts..."
CONFLICT=false
# Check if non-docker process is using 5433
if lsof -ti:5433 > /dev/null 2>&1; then
  PID=$(lsof -ti:5433 2>/dev/null | head -1)
  PROC=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
  if [[ "$PROC" != *"docker"* ]] && [[ "$PROC" != *"com.docker"* ]]; then
    echo -e "  ${RED}✗${NC} Port 5433 in use by non-Docker process: $PROC (PID: $PID)"
    CONFLICT=true
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
fi
if lsof -ti:8080 > /dev/null 2>&1; then
  PID=$(lsof -ti:8080 2>/dev/null | head -1)
  PROC=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
  if [[ "$PROC" != *"docker"* ]] && [[ "$PROC" != *"com.docker"* ]]; then
    echo -e "  ${RED}✗${NC} Port 8080 in use by non-Docker process: $PROC (PID: $PID)"
    CONFLICT=true
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
fi
if lsof -ti:9898 > /dev/null 2>&1; then
  echo -e "  ${YELLOW}!${NC} Port 9898 in use (indexer may already be running)"
  if [ "$FIX_MODE" = true ]; then
    echo -e "  ${YELLOW}→${NC} Stopping existing indexer..."
    pkill -f "envio dev" 2>/dev/null || true
    lsof -ti:9898 | xargs kill -9 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} Stopped"
    FIXED=$((FIXED + 1))
  fi
fi
if [ "$CONFLICT" = false ]; then
  echo -e "  ${GREEN}✓${NC} No port conflicts"
fi

# Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
if [ $ISSUES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Indexer should work correctly.${NC}"
  echo ""
  echo "To start the indexer:"
  echo "  bun dev:indexer      (from repo root)"
  echo "  bun dev              (from packages/indexer)"
else
  if [ "$FIX_MODE" = true ]; then
    echo -e "${YELLOW}Found $ISSUES_FOUND issue(s), fixed $FIXED.${NC}"
    REMAINING=$((ISSUES_FOUND - FIXED))
    if [ $REMAINING -gt 0 ]; then
      echo -e "${RED}$REMAINING issue(s) require manual intervention.${NC}"
    else
      echo -e "${GREEN}All issues fixed!${NC}"
    fi
  else
    echo -e "${RED}Found $ISSUES_FOUND issue(s).${NC}"
    echo ""
    echo "To auto-fix, run:"
    echo "  ./doctor.sh --fix"
  fi
fi
echo ""
