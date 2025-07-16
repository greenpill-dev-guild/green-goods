import express, { Express } from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { handlers } from "./handlers.js";

export function createHttpServer(mcpServer: Server): Express {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", server: "green-goods-mcp-server" });
  });

  // Base route - serve info on GET, handle JSON-RPC on POST
  app.get("/", (req, res) => {
    res.json({
      server: "green-goods-mcp-server",
      version: "1.0.0",
      description: "Model Context Protocol server for Green Goods development",
      endpoints: {
        jsonrpc: "POST /",
        health: "GET /health", 
        methods: "GET /methods",
        tools: "GET /tools"
      },
      documentation: "https://github.com/greenpill-dev-guild/green-goods"
    });
  });

  // Main JSON-RPC endpoint at base route
  app.post("/", async (req, res) => {
    const rpcReq = req.body;
    
    // Validate JSON-RPC request
    if (!rpcReq.jsonrpc || rpcReq.jsonrpc !== "2.0") {
      return res.json({
        jsonrpc: "2.0",
        id: rpcReq.id || null,
        error: { code: -32600, message: "Invalid Request" }
      });
    }

    const handler = handlers[rpcReq.method];
    if (!handler) {
      return res.json({
        jsonrpc: "2.0",
        id: rpcReq.id,
        error: { code: -32601, message: "Method not found" }
      });
    }

    try {
      const result = await handler(rpcReq.params);
      res.json({
        jsonrpc: "2.0",
        id: rpcReq.id,
        result
      });
    } catch (err) {
      res.json({
        jsonrpc: "2.0",
        id: rpcReq.id,
        error: {
          code: -32603,
          message: "Internal error",
          data: err instanceof Error ? err.toString() : String(err)
        }
      });
    }
  });

  // List available methods endpoint
  app.get("/methods", (req, res) => {
    const methods = Object.keys(handlers);
    res.json({
      methods,
      server: "green-goods-mcp-server",
      version: "1.0.0"
    });
  });

  // MCP tools endpoint (for discovery)
  app.get("/tools", (req, res) => {
    res.json({
      tools: [
        {
          name: "get_issue",
          description: "Get a GitHub issue from the greenpill-dev-guild organization",
          parameters: {
            repo: { type: "string", required: true },
            number: { type: "number", required: true }
          }
        },
        {
          name: "search_docs",
          description: "Search project documentation",
          parameters: {
            query: { type: "string", required: true },
            type: { type: "string", required: false },
            limit: { type: "number", required: false }
          }
        },
        {
          name: "list_issues",
          description: "List GitHub issues for a repository",
          parameters: {
            repo: { type: "string", required: true },
            state: { type: "string", enum: ["open", "closed", "all"], default: "open" }
          }
        },
        {
          name: "analyze_contract",
          description: "Analyze a smart contract in the project",
          parameters: {
            contractName: { type: "string", required: true }
          }
        },
        {
          name: "get_space_info",
          description: "Get information about the Greenpill Dev Guild CharmVerse space",
          parameters: {}
        },
        {
          name: "list_pages",
          description: "List pages in the Greenpill Dev Guild CharmVerse space",
          parameters: {
            type: { type: "string", required: false },
            limit: { type: "number", required: false, default: 20 }
          }
        },
        {
          name: "get_members",
          description: "Get members of the Greenpill Dev Guild CharmVerse space",
          parameters: {
            role: { type: "string", required: false }
          }
        },
        {
          name: "get_proposals",
          description: "Get proposals from the Greenpill Dev Guild CharmVerse space",
          parameters: {
            status: { type: "string", required: false }
          }
        },
        {
          name: "search_charmverse",
          description: "Search the Greenpill Dev Guild CharmVerse space",
          parameters: {
            query: { type: "string", required: true },
            type: { type: "string", required: false }
          }
        }
      ]
    });
  });

  return app;
} 