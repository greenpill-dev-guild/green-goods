// Source checks here protect architecture; route resolution is exercised in runtime-navigation.test.tsx.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAdminIndexRedirect } from "@green-goods/shared/hooks/admin-ui/navigation/workspaceNavigation";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname, "../../");
const routeViewsPath = resolve(srcDir, "routes/views.tsx");
const hubSheetDescriptorPath = resolve(srcDir, "views/Hub/components/HubSheetDescriptor.tsx");
const sheetRegistryPath = resolve(
  srcDir,
  "../../shared/src/hooks/admin-ui/navigation/sheetRegistry.ts"
);
const canvasLayoutPath = resolve(srcDir, "components/Layout/CanvasLayout.tsx");
const canvasControllerPath = resolve(
  srcDir,
  "../../shared/src/hooks/admin-ui/layout/useCanvasShellController.ts"
);
const rightSheetDescriptorPath = resolve(
  srcDir,
  "../../shared/src/hooks/admin-ui/layout/useAdminRightSheetDescriptor.tsx"
);
const sharedAdminRoutesPath = resolve(srcDir, "../../shared/src/utils/navigation/admin-routes.ts");
const readSource = (path: string) => readFileSync(path, "utf-8");

describe("route folding", () => {
  // Canvas matching does not inspect additional routes introduced by the root composition.
  it("keeps retired route families out of the root composition", () => {
    expect(readSource(resolve(srcDir, "router.tsx"))).not.toMatch(
      /path:\s*["'](?:assessments|endowments)["']/
    );
  });

  it.each([
    ["hub", "?garden=0x1&view=queue", "/hub/work?garden=0x1"],
    ["garden", "?garden=0x1&view=overview", "/garden/health?garden=0x1"],
    ["garden-overview", "?view=overview", "/garden/health"],
    ["community", "?garden=0x1&card=c1&pool=p1", "/community/members?garden=0x1"],
    ["garden-members", "?garden=0x1&card=c1", "/community/members?garden=0x1&card=c1"],
  ] as const)("resolves the %s index redirect through one policy", (kind, search, expected) => {
    expect(resolveAdminIndexRedirect(kind, search)).toBe(expected);
  });

  it("uses one index redirect component without route string concatenation", () => {
    const routeViews = readSource(routeViewsPath);

    expect(routeViews.match(/function IndexRedirect/g)).toHaveLength(1);
    expect(routeViews.match(/<IndexRedirect kind=/g)).toHaveLength(5);
    expect(routeViews).not.toContain("preserveSearch");
    expect(routeViews).not.toMatch(/to=\{`\$\{adminRoutes\./);
  });

  it("Hub sheet descriptor owns only the read/review inspectors", () => {
    // Inspector panels are composed in the Hub sheet descriptor; Submit Work is
    // a creation/commit flow with its own route, so it is no longer a Hub sheet.
    const hubSheetDescriptor = readSource(hubSheetDescriptorPath);
    const sheetRegistry = readSource(sheetRegistryPath);

    expect(hubSheetDescriptor).toContain("WorkDetailPanel");
    expect(hubSheetDescriptor).not.toContain("SubmitWorkPanel");
    expect(sheetRegistry).toContain("hub:work-detail:");
    // The retired History stage keeps no registry entry — only the
    // stale-state guard that refuses to restore its persisted ids.
    expect(sheetRegistry).not.toContain("HISTORY_CONTENT_ID_PREFIX");
    expect(sheetRegistry).toContain("RETIRED_SHEET_CONTENT_ID_PREFIXES");
    expect(sheetRegistry).toContain("ADMIN_ROUTE_SHEET_REGISTRY");
  });

  it("global right sheet content is resolved through the canvas controller and registry", () => {
    const sheetRegistry = readSource(sheetRegistryPath);
    const canvasLayout = readSource(canvasLayoutPath);
    const canvasController = readSource(canvasControllerPath);
    const rightSheetDescriptor = readSource(rightSheetDescriptorPath);

    expect(sheetRegistry).toContain("ADMIN_RIGHT_SHEET_REGISTRY");
    expect(sheetRegistry).toContain("notifications");
    expect(canvasLayout).toContain("useCanvasShellController");
    expect(canvasController).toContain("useAdminRightSheetDescriptor");
    expect(canvasLayout).not.toContain("RIGHT_SHEET_TITLES");
    expect(canvasLayout).toContain("AccountProfilePanel");
    expect(canvasLayout).toContain("AccountSettingsPanel");
    expect(rightSheetDescriptor).not.toContain("renderAccountSurface");
    // Notification rendering lives in CanvasLayout (it owns the garden-scoped
    // data wiring); the descriptor stays a pure contentId→content mapping and
    // delegates through the injected renderNotifications callback.
    expect(rightSheetDescriptor).toContain("renderNotifications");
    expect(canvasLayout).toContain("NotificationPanel");
  });

  it("keeps the public Hub context narrow and retired route helpers absent", () => {
    const source = readSource(sharedAdminRoutesPath);
    const context =
      source.match(/export interface AdminHubRouteContext \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(context).toContain("gardenAddress?: Address | string;");
    expect(context).toContain("sort?: AdminHubSort;");
    expect(context).toContain("scope?: AdminHubWorkScope;");
    expect(context).not.toContain("item?: string;");
    expect(source).not.toContain("hubHistoryDetail");
    expect(source).not.toContain("hubCertifyDetail");
  });
});
