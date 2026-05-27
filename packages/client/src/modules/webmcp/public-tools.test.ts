import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPublicWebMcpTools,
  greenGoodsPublicWebMcpRoutes,
  registerPublicWebMcpTools,
} from "./public-tools";

type PublicWebMcpTool = ReturnType<typeof createPublicWebMcpTools>[number];

function getTool(name: PublicWebMcpTool["name"], tools = createPublicWebMcpTools()) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing WebMCP tool: ${name}`);
  return tool;
}

function modelContextWithRegister(registerTool = vi.fn<(tool: PublicWebMcpTool) => unknown>()) {
  const modelContext = { registerTool };
  Object.defineProperty(navigator, "modelContext", {
    configurable: true,
    value: modelContext,
  });
  return { modelContext, registerTool };
}

function readRouteEnum(tool: PublicWebMcpTool) {
  const routeProperty = tool.inputSchema.properties?.route;
  if (
    !routeProperty ||
    typeof routeProperty !== "object" ||
    !("enum" in routeProperty) ||
    !Array.isArray(routeProperty.enum)
  ) {
    throw new Error("Missing route enum on WebMCP navigate tool schema.");
  }
  return routeProperty.enum;
}

describe("public WebMCP tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/");
    Object.defineProperty(window, "__GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__", {
      configurable: true,
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, "__GREEN_GOODS_WEBMCP_PUBLIC_TOOLS__", {
      configurable: true,
      value: undefined,
      writable: true,
    });
    document.title = "Green Goods";
    document.body.innerHTML =
      "<main><h1>Fund regenerative work</h1><h2>Endowment engine</h2></main>";
  });

  it("keeps the WebMCP route allowlist aligned to public browser routes only", () => {
    expect(greenGoodsPublicWebMcpRoutes).toEqual([
      "/",
      "/fund",
      "/impact",
      "/gardens",
      "/actions",
      "/cookies",
      "/glossary",
      "/landing",
    ]);
    expect(greenGoodsPublicWebMcpRoutes).not.toEqual(
      expect.arrayContaining([
        "/admin",
        "/dashboard",
        "/home",
        "/home/garden",
        "/home/profile",
        "/login",
        "/work",
      ])
    );

    const navigateTool = getTool("green_goods_navigate_public_route");
    expect(readRouteEnum(navigateTool)).toEqual(greenGoodsPublicWebMcpRoutes);
    expect(navigateTool.inputSchema).toMatchObject({
      required: ["route"],
      additionalProperties: false,
    });
  });

  it("does nothing when the browser has no WebMCP modelContext", () => {
    Object.defineProperty(navigator, "modelContext", { configurable: true, value: undefined });

    registerPublicWebMcpTools();

    expect(window.__GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__).toBeUndefined();
  });

  it("does nothing when modelContext cannot register tools", () => {
    Object.defineProperty(navigator, "modelContext", { configurable: true, value: {} });

    registerPublicWebMcpTools();

    expect(window.__GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__).toBeUndefined();
    expect(window.__GREEN_GOODS_WEBMCP_PUBLIC_TOOLS__).toBeUndefined();
  });

  it("registers public-safe tools when modelContext is available", () => {
    const { modelContext, registerTool } = modelContextWithRegister();

    registerPublicWebMcpTools();

    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(window.__GREEN_GOODS_WEBMCP_PUBLIC_TOOLS__).toEqual([
      "green_goods_describe_public_page",
      "green_goods_navigate_public_route",
    ]);
    expect(registerTool.mock.calls.map(([tool]) => tool.annotations)).toEqual([
      { readOnlyHint: true, untrustedContentHint: false },
      { readOnlyHint: false, untrustedContentHint: false },
    ]);
    expect(registerTool.mock.contexts).toEqual([modelContext, modelContext]);
  });

  it("does not register duplicate tools after the first successful registration", () => {
    const { registerTool } = modelContextWithRegister();

    registerPublicWebMcpTools();
    registerPublicWebMcpTools();

    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(window.__GREEN_GOODS_WEBMCP_TOOLS_REGISTERED__).toBe(true);
  });

  it("describes only public rendered page state", () => {
    const describeTool = getTool("green_goods_describe_public_page");
    expect(describeTool.execute({})).toMatchObject({
      status: "ok",
      path: "/",
      headings: ["Fund regenerative work", "Endowment engine"],
      publicOnly: true,
    });
  });

  it("normalizes rendered headings and limits the description payload", () => {
    document.body.innerHTML = Array.from(
      { length: 10 },
      (_, index) =>
        `<h${index % 2 === 0 ? "1" : "2"}>  Heading \n ${index + 1}  </h${
          index % 2 === 0 ? "1" : "2"
        }>`
    ).join("");

    const describeTool = getTool("green_goods_describe_public_page");

    expect(describeTool.execute({})).toMatchObject({
      headings: [
        "Heading 1",
        "Heading 2",
        "Heading 3",
        "Heading 4",
        "Heading 5",
        "Heading 6",
        "Heading 7",
        "Heading 8",
      ],
    });
  });

  it("describes public Garden detail routes without adding them to the navigation allowlist", () => {
    const describeTool = getTool("green_goods_describe_public_page", [
      ...createPublicWebMcpTools({
        pageLocation: {
          pathname: "/gardens/decleanup/",
          assign: vi.fn(),
        },
      }),
    ]);

    expect(describeTool.execute({})).toMatchObject({
      status: "ok",
      path: "/gardens/decleanup",
      description: "Public Garden detail or public browser route.",
      publicOnly: true,
    });
  });

  it("rejects describe requests from non-public app routes", () => {
    const describeTool = getTool("green_goods_describe_public_page", [
      ...createPublicWebMcpTools({
        pageLocation: {
          pathname: "/home/profile",
          assign: vi.fn(),
        },
      }),
    ]);

    expect(describeTool.execute({})).toEqual({
      status: "not_available",
      reason: "Green Goods WebMCP tools are limited to public browser routes.",
      path: "/home/profile",
    });
  });

  it("navigates only to approved public routes", () => {
    const assign = vi.fn<(route: string) => void>();
    const navigateTool = getTool("green_goods_navigate_public_route", [
      ...createPublicWebMcpTools({
        pageLocation: {
          pathname: "/",
          assign,
        },
      }),
    ]);

    expect(navigateTool.execute({ route: "fund/" })).toEqual({
      status: "navigating",
      route: "/fund",
      publicOnly: true,
    });
    expect(assign).toHaveBeenCalledWith("/fund");
  });

  it.each([
    undefined,
    "",
    "   ",
    "/admin",
    "/dashboard",
    "/home",
    "/home/profile",
    "/gardens/decleanup",
    "https://example.com/fund",
  ])("rejects navigation outside the public route allowlist: %s", (route) => {
    const assign = vi.fn<(route: string) => void>();
    const navigateTool = getTool("green_goods_navigate_public_route", [
      ...createPublicWebMcpTools({
        pageLocation: {
          pathname: "/",
          assign,
        },
      }),
    ]);

    expect(navigateTool.execute({ route })).toEqual({
      status: "rejected",
      reason: "Route must be one of the approved public Green Goods routes.",
      allowedRoutes: greenGoodsPublicWebMcpRoutes,
    });
    expect(assign).not.toHaveBeenCalled();
  });
});
