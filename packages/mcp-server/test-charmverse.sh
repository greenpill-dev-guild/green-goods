#!/bin/bash

echo "Testing Green Goods MCP Server with CharmVerse Integration"
echo "=========================================================="

# Test 1: List all available methods
echo -e "\n1. Available Methods:"
curl -s http://localhost:8000/mcp/methods | jq

# Test 2: Get CharmVerse space info
echo -e "\n2. CharmVerse Space Info:"
curl -s -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "get_space_info",
    "params": {}
  }' | jq

# Test 3: List CharmVerse pages
echo -e "\n3. CharmVerse Pages:"
curl -s -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "list_pages",
    "params": {
      "limit": 5
    }
  }' | jq

# Test 4: Get CharmVerse members
echo -e "\n4. CharmVerse Members:"
curl -s -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "get_members",
    "params": {}
  }' | jq

# Test 5: Search CharmVerse
echo -e "\n5. Search CharmVerse for 'green goods':"
curl -s -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "search_charmverse",
    "params": {
      "query": "green goods"
    }
  }' | jq

echo -e "\nTests complete!" 