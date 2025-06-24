# Green Goods MCP Server

A Model Context Protocol (MCP) server for the Green Goods development environment, providing AI assistants with tools to interact with GitHub, search documentation, and analyze the codebase.

## Features

- **Dual Mode Support**: Run in stdio mode (for MCP clients) or HTTP mode (REST API)
- **GitHub Integration**: Access issues and pull requests from greenpill-dev-guild repositories
- **CharmVerse Integration**: Access workspace data, members, proposals, and pages from Greenpill Dev Guild
- **Optimized Document Search**: Full-text search using Lunr.js with caching and relevance scoring
- **Contract Analysis**: Analyze Solidity smart contracts in the project
- **Performance Optimizations**: Built-in caching, search indexing, and parallel processing

## Installation

```bash
cd packages/mcp-server
pnpm install
```

## Configuration

1. Copy the `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your API tokens:
```
# GitHub personal access token
GITHUB_TOKEN=your_github_token_here

# CharmVerse API key (optional, for CharmVerse features)
CHARMVERSE_API_KEY=your_charmverse_api_key_here
```

- GitHub token: Generate at https://github.com/settings/tokens with `repo` scope for private repos or `public_repo` for public repos only.
- CharmVerse API key: Get from https://app.charmverse.io/api-docs (required for CharmVerse features)

## Usage

### Stdio Mode (Default - for MCP Clients)

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

### HTTP Mode (REST API)

```bash
# Development
pnpm dev:http

# Production
pnpm build
pnpm start:http
```

The HTTP server runs on port 8000 by default. You can specify a different port:
```bash
pnpm start:http --port 3000
```

## Available Tools

### 1. `get_issue`
Get a specific GitHub issue from the greenpill-dev-guild organization.

**Parameters:**
- `repo` (string): Repository name (e.g., "green-goods")
- `number` (number): Issue number

### 2. `search_docs`
Search project documentation for a query.

**Parameters:**
- `query` (string): Search query

### 3. `list_issues`
List GitHub issues for a repository.

**Parameters:**
- `repo` (string): Repository name
- `state` (string, optional): "open", "closed", or "all" (default: "open")

### 4. `analyze_contract`
Analyze a smart contract in the project.

**Parameters:**
- `contractName` (string): Name of the contract to analyze

### 5. `get_space_info`
Get information about the Greenpill Dev Guild CharmVerse space.

**Parameters:** None

### 6. `list_pages`
List pages in the Greenpill Dev Guild CharmVerse space.

**Parameters:**
- `type` (string, optional): Filter by page type
- `limit` (number, optional): Maximum number of pages to return (default: 20)

### 7. `get_members`
Get members of the Greenpill Dev Guild CharmVerse space.

**Parameters:**
- `role` (string, optional): Filter by member role

### 8. `get_proposals`
Get proposals from the Greenpill Dev Guild CharmVerse space.

**Parameters:**
- `status` (string, optional): Filter by proposal status

### 9. `search_charmverse`
Search the Greenpill Dev Guild CharmVerse space.

**Parameters:**
- `query` (string): Search query
- `type` (string, optional): Filter by content type

## HTTP API Endpoints

When running in HTTP mode:

- `POST /mcp` - JSON-RPC endpoint
- `GET /health` - Health check
- `GET /mcp/methods` - List available methods
- `GET /mcp/tools` - Get tool descriptions

### Example HTTP Request

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "get_issue",
    "params": {
      "repo": "green-goods",
      "number": 1
    }
  }'
```

## Testing

Run the test script to verify your setup:

```bash
pnpm test
```

This will check:
- GitHub connectivity
- File system access
- Contract directory structure
- HTTP server status (if running)

## Integration with Claude/Cursor

### Stdio Mode
Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "green-goods": {
      "command": "node",
      "args": ["/path/to/green-goods/packages/mcp-server/build/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    }
  }
}
```

### HTTP Mode
Point your MCP client to `http://localhost:8000/mcp` for JSON-RPC requests.

## Development

The server is built with:
- TypeScript
- MCP SDK for protocol implementation
- Express.js for HTTP mode
- Octokit for GitHub API
- Commander for CLI options

## Troubleshooting

1. **GitHub authentication fails**: Ensure your GITHUB_TOKEN is valid and has the necessary scopes
2. **File not found errors**: Run the server from the project root directory
3. **Port already in use**: Change the port with `--port` flag or kill the process using port 8000

## Contributing

1. Make changes in the `src` directory
2. Build with `pnpm build`
3. Test your changes with `pnpm test`
4. Submit a PR to the develop branch 