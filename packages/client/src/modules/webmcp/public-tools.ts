type WebMcpInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

type WebMcpToolDefinition = {
  name: string;
  description: string;
  inputSchema: WebMcpInputSchema;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: Record<string, unknown>) => unknown;
};

type WebMcpRuntimeLocation = Pick<Location, "assign" | "pathname">;

type WebMcpModelContext = {
  registerTool?: (tool: WebMcpToolDefinition) => unknown;
};

declare global {
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

export function registerPublicWebMcpTools() {
  const registerTool = navigator.modelContext?.registerTool;
  if (typeof registerTool !== "function" || window.__GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__) {
    return;
  }

  const tools = createPublicWebMcpTools();

  for (const tool of tools) {
    registerTool.call(navigator.modelContext, tool);
  }

  window.__GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__ = true;
  window.__GREEN_GOODS_WEBMCP_PUBLIC_TOOLS__ = tools.map((tool) => tool.name);
}

export const greenGoodsPublicWebMcpRoutes = publicRoutes;
