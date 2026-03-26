#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// --- Auth ---

interface ADCCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  quota_project_id?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function loadADC(): ADCCredentials {
  const path = join(
    homedir(),
    ".config",
    "gcloud",
    "application_default_credentials.json",
  );
  return JSON.parse(readFileSync(path, "utf-8"));
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const adc = loadADC();
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: adc.client_id,
      client_secret: adc.client_secret,
      refresh_token: adc.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = (await resp.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

function headers(): Record<string, string> {
  return {}; // filled per-request
}

async function driveHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const adc = loadADC();
  return {
    Authorization: `Bearer ${token}`,
    "x-goog-user-project": adc.quota_project_id || "greenpill-dev-guild",
  };
}

// --- Drive API helpers ---

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

async function driveRequest(
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const h = await driveHeaders();
  const url = new URL(`${DRIVE_BASE}${path}`);
  // Always include shared drive support
  params.includeItemsFromAllDrives = "true";
  params.supportsAllDrives = "true";
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString(), { headers: h });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive API ${resp.status}: ${err}`);
  }
  return resp.json();
}

async function driveExport(
  fileId: string,
  mimeType = "text/plain",
): Promise<string> {
  const h = await driveHeaders();
  const url = `${DRIVE_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`;
  const resp = await fetch(url, { headers: h });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive export ${resp.status}: ${err}`);
  }
  return resp.text();
}

async function driveMove(
  fileId: string,
  newParentId: string,
): Promise<unknown> {
  const h = await driveHeaders();
  // Get current parents
  const meta = (await driveRequest(`/files/${fileId}`, {
    fields: "parents",
  })) as { parents?: string[] };
  const currentParents = (meta.parents || []).join(",");

  const url = new URL(`${DRIVE_BASE}/files/${fileId}`);
  url.searchParams.set("addParents", newParentId);
  if (currentParents) url.searchParams.set("removeParents", currentParents);
  url.searchParams.set("supportsAllDrives", "true");

  const resp = await fetch(url.toString(), {
    method: "PATCH",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive move ${resp.status}: ${err}`);
  }
  return resp.json();
}

// --- MCP Server ---

const mcp = new Server(
  { name: "gdrive", version: "0.1.0" },
  {
    capabilities: { tools: {} },
    instructions: `Google Drive integration for Greenpill shared drives. Provides tools to search, list, read, and move files across all shared drives. Google Docs are exported as plain text or markdown. Use drive_search to find meeting notes by name pattern, drive_read to export their content, and drive_move to sort them into the correct folder.`,
  },
);

// --- Tool definitions ---

const TOOLS = [
  {
    name: "drive_list_drives",
    description: "List all shared drives accessible to the authenticated user",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "drive_list",
    description:
      "List files in a folder. Use folderId for a specific folder, or driveId for the root of a shared drive.",
    inputSchema: {
      type: "object" as const,
      properties: {
        folderId: {
          type: "string",
          description: "Folder ID to list. Omit to use driveId root.",
        },
        driveId: {
          type: "string",
          description: "Shared drive ID (required if no folderId)",
        },
        pageSize: {
          type: "number",
          description: "Max results (default 50)",
        },
      },
    },
  },
  {
    name: "drive_search",
    description:
      "Search for files across all shared drives. Supports name patterns, MIME types, and date filters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        nameContains: {
          type: "string",
          description: "File name must contain this string",
        },
        mimeType: {
          type: "string",
          description:
            "MIME type filter (e.g. application/vnd.google-apps.document)",
        },
        modifiedAfter: {
          type: "string",
          description: "ISO date string — only files modified after this time",
        },
        driveId: {
          type: "string",
          description: "Limit search to a specific shared drive",
        },
        pageSize: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
      required: ["nameContains"],
    },
  },
  {
    name: "drive_read",
    description:
      "Read/export a Google Doc, Sheet, or other file. Google Docs are exported as plain text by default. Returns the file content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fileId: { type: "string", description: "The file ID to read" },
        exportAs: {
          type: "string",
          description:
            "Export MIME type for Google Docs (default: text/plain). Use text/markdown for markdown.",
        },
      },
      required: ["fileId"],
    },
  },
  {
    name: "drive_move",
    description:
      "Move a file to a different folder within or across shared drives.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fileId: { type: "string", description: "The file ID to move" },
        targetFolderId: {
          type: "string",
          description: "The destination folder ID",
        },
      },
      required: ["fileId", "targetFolderId"],
    },
  },
  {
    name: "drive_get_folder_id",
    description:
      "Resolve a folder path to its ID by navigating the shared drive tree. Use this to find the target folder ID for drive_move.",
    inputSchema: {
      type: "object" as const,
      properties: {
        driveId: { type: "string", description: "Shared drive ID" },
        path: {
          type: "string",
          description:
            'Slash-separated folder path from drive root (e.g. "Engineering/Sync")',
        },
      },
      required: ["driveId", "path"],
    },
  },
];

// --- Tool handlers ---

async function handleTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "drive_list_drives": {
      const data = (await driveRequest("/drives", { pageSize: "20" })) as {
        drives: { id: string; name: string }[];
      };
      return JSON.stringify(
        data.drives.map((d) => ({ id: d.id, name: d.name })),
        null,
        2,
      );
    }

    case "drive_list": {
      const folderId = args.folderId as string | undefined;
      const driveId = args.driveId as string | undefined;
      const parent = folderId || driveId;
      if (!parent) throw new Error("Provide folderId or driveId");

      const q = `'${parent}' in parents and trashed = false`;
      const params: Record<string, string> = {
        q,
        fields:
          "files(id,name,mimeType,modifiedTime,parents),nextPageToken",
        pageSize: String(args.pageSize || 50),
        orderBy: "modifiedTime desc",
      };
      if (driveId) {
        params.driveId = driveId;
        params.corpora = "drive";
      } else {
        params.corpora = "allDrives";
      }

      const data = (await driveRequest("/files", params)) as {
        files: {
          id: string;
          name: string;
          mimeType: string;
          modifiedTime: string;
        }[];
      };
      return JSON.stringify(
        data.files.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.mimeType.replace("application/vnd.google-apps.", ""),
          modified: f.modifiedTime,
        })),
        null,
        2,
      );
    }

    case "drive_search": {
      const parts: string[] = ["trashed = false"];
      if (args.nameContains)
        parts.push(`name contains '${args.nameContains}'`);
      if (args.mimeType) parts.push(`mimeType = '${args.mimeType}'`);
      if (args.modifiedAfter)
        parts.push(`modifiedTime > '${args.modifiedAfter}'`);

      const params: Record<string, string> = {
        q: parts.join(" and "),
        fields: "files(id,name,mimeType,modifiedTime,parents,driveId)",
        pageSize: String(args.pageSize || 20),
        orderBy: "modifiedTime desc",
      };
      if (args.driveId) {
        params.driveId = args.driveId as string;
        params.corpora = "drive";
      } else {
        params.corpora = "allDrives";
      }

      const data = (await driveRequest("/files", params)) as {
        files: {
          id: string;
          name: string;
          mimeType: string;
          modifiedTime: string;
          driveId: string;
          parents: string[];
        }[];
      };
      return JSON.stringify(
        data.files.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.mimeType.replace("application/vnd.google-apps.", ""),
          modified: f.modifiedTime,
          driveId: f.driveId,
          parentId: f.parents?.[0],
        })),
        null,
        2,
      );
    }

    case "drive_read": {
      const fileId = args.fileId as string;
      const exportAs = (args.exportAs as string) || "text/plain";
      const text = await driveExport(fileId, exportAs);
      return text;
    }

    case "drive_move": {
      const result = await driveMove(
        args.fileId as string,
        args.targetFolderId as string,
      );
      return JSON.stringify(result, null, 2);
    }

    case "drive_get_folder_id": {
      const driveId = args.driveId as string;
      const pathStr = args.path as string;
      const segments = pathStr.split("/").filter(Boolean);

      let currentId = driveId;
      for (const segment of segments) {
        const q = `'${currentId}' in parents and name = '${segment}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const data = (await driveRequest("/files", {
          q,
          fields: "files(id,name)",
          pageSize: "1",
          driveId,
          corpora: "drive",
        })) as { files: { id: string; name: string }[] };

        if (!data.files.length) {
          throw new Error(
            `Folder "${segment}" not found in path "${pathStr}" (parent: ${currentId})`,
          );
        }
        currentId = data.files[0].id;
      }
      return JSON.stringify({ folderId: currentId, path: pathStr });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- Register handlers ---

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const result = await handleTool(
      req.params.name,
      (req.params.arguments || {}) as Record<string, unknown>,
    );
    return { content: [{ type: "text" as const, text: result }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
});

// --- Start ---

await mcp.connect(new StdioServerTransport());
