#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { createHttpServer } from "./http-server.js";
import { handlers } from "./handlers.js";
import { Command } from "commander";
import dotenv from "dotenv";

dotenv.config();

const program = new Command();
program
  .option("--stdio", "Run in stdio mode (default)")
  .option("--http", "Run in HTTP mode")
  .option("--port <port>", "HTTP port", process.env.PORT || "8000")
  .parse();

const options = program.opts();

class GreenGoodsMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "green-goods-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_issue",
            description: "Get a GitHub issue from the greenpill-dev-guild organization",
            inputSchema: {
              type: "object",
              properties: {
                repo: {
                  type: "string",
                  description: "Repository name (e.g., 'green-goods')"
                },
                number: {
                  type: "number",
                  description: "Issue number"
                }
              },
              required: ["repo", "number"]
            }
          },
          {
            name: "search_docs",
            description: "Search project documentation for a query",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query"
                },
                type: {
                  type: "string",
                  description: "Filter by document type (markdown, solidity, etc.)"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return",
                  default: 10
                }
              },
              required: ["query"]
            }
          },
          {
            name: "list_issues",
            description: "List GitHub issues for a repository",
            inputSchema: {
              type: "object",
              properties: {
                repo: {
                  type: "string",
                  description: "Repository name"
                },
                state: {
                  type: "string",
                  enum: ["open", "closed", "all"],
                  description: "Issue state filter",
                  default: "open"
                }
              },
              required: ["repo"]
            }
          },
          {
            name: "analyze_contract",
            description: "Analyze a smart contract in the project",
            inputSchema: {
              type: "object",
              properties: {
                contractName: {
                  type: "string",
                  description: "Name of the contract to analyze"
                }
              },
              required: ["contractName"]
            }
          },
          {
            name: "get_space_info",
            description: "Get information about the Greenpill Dev Guild CharmVerse space",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "list_pages",
            description: "List pages in the Greenpill Dev Guild CharmVerse space",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description: "Filter by page type"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of pages to return",
                  default: 20
                }
              }
            }
          },
          {
            name: "get_members",
            description: "Get members of the Greenpill Dev Guild CharmVerse space",
            inputSchema: {
              type: "object",
              properties: {
                role: {
                  type: "string",
                  description: "Filter by member role"
                }
              }
            }
          },
          {
            name: "get_proposals",
            description: "Get proposals from the Greenpill Dev Guild CharmVerse space",
            inputSchema: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  description: "Filter by proposal status"
                }
              }
            }
          },
          {
            name: "search_charmverse",
            description: "Search the Greenpill Dev Guild CharmVerse space",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query"
                },
                type: {
                  type: "string",
                  description: "Filter by content type"
                }
              },
              required: ["query"]
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      const handler = handlers[name];
      if (!handler) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }

      try {
        const result = await handler(args);
        return {
          content: [
            {
              type: "text",
              text: typeof result === "string" 
                ? result 
                : JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Green Goods MCP Server running in stdio mode");
  }

  async runHttp(port: number) {
    const httpApp = createHttpServer(this.server);
    httpApp.listen(port, '0.0.0.0', () => {
      console.log(`Green Goods MCP Server running in HTTP mode on port ${port}`);
      console.log(`Health check available at: http://0.0.0.0:${port}/health`);
      console.log(`MCP endpoint available at: http://0.0.0.0:${port}/mcp`);
    });
  }

  getServer(): Server {
    return this.server;
  }
}

// Main execution
const server = new GreenGoodsMCPServer();

if (options.http) {
  const port = parseInt(options.port) || 8000;
  server.runHttp(port).catch(console.error);
} else {
  server.runStdio().catch(console.error);
}

export { GreenGoodsMCPServer }; 