#!/bin/bash
# ─────────────────────────────────────────
#  LearnVault – Mac Startup Script (sql.js edition)
# ─────────────────────────────────────────
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🎓  LearnVault Starter          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}⚠️  Node.js not found. Please install it from https://nodejs.org (LTS version)${NC}"
  exit 1
fi

NODE_VER=$(node -v)
echo -e "${GREEN}✅  Node.js ${NODE_VER} found${NC}"

# Clean old node_modules if it has better-sqlite3 (the old broken package)
if [ -d "node_modules/better-sqlite3" ]; then
  echo -e "${YELLOW}🧹  Removing old incompatible packages...${NC}"
  rm -rf node_modules package-lock.json
fi

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}📦  Installing dependencies (this takes ~30 seconds)...${NC}"
  npm install
  echo -e "${GREEN}✅  Dependencies installed${NC}"
else
  echo -e "${GREEN}✅  Dependencies already installed${NC}"
fi

# Create folders if missing
mkdir -p uploads db

echo ""
echo -e "${GREEN}🚀  Starting LearnVault...${NC}"
echo -e "${BLUE}🌐  Open your browser at: http://localhost:3000${NC}"
echo -e "${YELLOW}    Press Ctrl+C to stop the server${NC}"
echo ""

# Open browser after 2 seconds
(sleep 2 && open http://localhost:3000) &

# Start server
node server.js
