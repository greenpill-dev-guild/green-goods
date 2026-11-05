import { logger } from "@green-goods/shared/modules/app/logger";

type WebMcpInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

type WebMcpToolExecuteOptions = {
  signal: AbortSignal;
};

type WebMcpToolDefinition = {
  name: string;
  description: string;
  inputSchema: WebMcpInputSchema;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  // The browser calls `execute(input, { signal })`. Both public tools finish synchronously, so
  // their implementations may leave the abort signal unused.
  execute: (input: Record<string, unknown>, options: WebMcpToolExecuteOptions) => unknown;
};

type WebMcpRuntimeLocation = Pick<Location, "assign" | "pathname">;

type WebMcpRegisterToolOptions = {
  signal?: AbortSignal;
};

type WebMcpModelContext = {
  registerTool?: (
    tool: WebMcpToolDefinition,
    options?: WebMcpRegisterToolOptions
  ) => Promise<void> | void;
};

declare global {
  interface Document {
    modelContext?: WebMcpModelContext;
  }

  interface Navigator {
    modelContext?: WebMcpModelContext;
  }

  interface Window {
    __GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__?: boolean;
    __GREEN_GOODS_WEBMCP_PUBLIC_TOOLS__?: string[];
  }
}

const publicRouteDescriptions = {
  "/": "Public Green Goods overview and editorial homepage.",
  "/fund": "Public funding and endowment explainer for supporting Gardens.",
  "/impact": "Public impact narrative and proof-of-work overview.",
  "/vaults": "Public Octant vault campaign crowdfunding surface.",
  "/gardens": "Public Garden directory and discovery surface.",
  "/actions": "Public Action directory and regenerative work template surface.",
  "/cookies": "Public Cookie Jar explainer and funding route surface.",
  "/glossary": "Public glossary of Green Goods terms and regenerative finance concepts.",
  "/landing": "Public landing-page variant used by browser/editorial presentation mode.",
} as const;

const publicRoutes = Object.keys(publicRouteDescriptions);

function normalizePublicPath(path: string) {
  const rawPath = path.trim();
  if (!rawPath) return "";

  const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return normalized.replace(/\/+$/, "") || "/";
}

function isPublicPath(pathname: string) {
  const path = normalizePublicPath(pathname);
  return publicRoutes.includes(path) || path.startsWith("/gardens/");
}

function visibleHeadings(pageDocument: Pick<Document, "querySelectorAll">) {
  return [...pageDocument.querySelectorAll("h1, h2")]
    .map((heading) => heading.textContent?.trim().replace(/\s+/g, " "))
    .filter((text): text is string => Boolean(text))
    .slice(0, 8);
}

function describeCurrentPublicPage(
  pageDocument: Pick<Document, "querySelectorAll" | "title">,
  pageLocation: Pick<Location, "pathname">
) {
  const path = normalizePublicPath(pageLocation.pathname);
  if (!isPublicPath(path)) {
    return {
      status: "not_available",
      reason: "Green Goods WebMCP tools are limited to public browser routes.",
      path,
    };
  }

  return {
    status: "ok",
    path,
    title: pageDocument.title,
    description:
      publicRouteDescriptions[path as keyof typeof publicRouteDescriptions] ??
      "Public Garden detail or public browser route.",
    headings: visibleHeadings(pageDocument),
    publicOnly: true,
  };
}

function navigatePublicRoute(
  input: Record<string, unknown>,
  pageLocation: Pick<Location, "assign">
) {
  const route = typeof input.route === "string" ? normalizePublicPath(input.route) : "";
  if (!route || !publicRoutes.includes(route)) {
    return {
      status: "rejected",
      reason: "Route must be one of the approved public Green Goods routes.",
      allowedRoutes: publicRoutes,
    };
  }

  pageLocation.assign(route);
  return {
    status: "navigating",
    route,
    publicOnly: true,
  };
}

/**
 * The WebMCP draft moved the tool registry from `navigator.modelContext` to
 * `document.modelContext` in July 2026, and Chromium 150+ (Brave Beta 156 included) exposes only
 * the document form. Older builds still carry the navigator alias, so the document form wins and
 * the alias is the fallback.
 */
function resolveWebMcpModelContext() {
  return document.modelContext ?? navigator.modelContext;
}

export function createPublicWebMcpTools({
  pageDocument = document,
  pageLocation = window.location,
}: {
  pageDocument?: Pick<Document, "querySelectorAll" | "title">;
  pageLocation?: WebMcpRuntimeLocation;
} = {}) {
  return [
    {
      name: "green_goods_describe_public_page",
      description:
        "Summarize the currently visible public Green Goods route using rendered page title and headings.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false,
      },
      execute: () => describeCurrentPublicPage(pageDocument, pageLocation),
    },
    {
      name: "green_goods_navigate_public_route",
      description:
        "Navigate to an approved public Green Goods browser route so the user can inspect visible public content.",
      inputSchema: {
        type: "object",
        properties: {
          route: {
            type: "string",
            enum: publicRoutes,
            description: "Approved public route to open.",
          },
        },
        required: ["route"],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false,
      },
      execute: (input) => navigatePublicRoute(input, pageLocation),
    },
  ] satisfies WebMcpToolDefinition[];
}

let pendingRegistration: Promise<void> | undefined;

export function registerPublicWebMcpTools() {
  const modelContext = resolveWebMcpModelContext();
  const registerTool = modelContext?.registerTool;
  if (typeof registerTool !== "function" || window.__GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__) {
    return;
  }
  if (pendingRegistration) return pendingRegistration;

  const tools = createPublicWebMcpTools();
  const controller = new AbortController();
  pendingRegistration = (async () => {
    try {
      await Promise.all(
        tools.map((tool) => registerTool.call(modelContext, tool, { signal: controller.signal }))
      );
      window.__GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__ = true;
      window.__GREEN_GOODS_WEBMCP_PUBLIC_TOOLS__ = tools.map((tool) => tool.name);
    } catch (error) {
      // Remove any successful registrations from this attempt before allowing a retry.
      controller.abort();
      logger.warn("Public WebMCP tool registration failed", { source: "webmcp", error });
    }
  })().finally(() => {
    pendingRegistration = undefined;
  });
  return pendingRegistration;
}

export const greenGoodsPublicWebMcpRoutes = publicRoutes;
