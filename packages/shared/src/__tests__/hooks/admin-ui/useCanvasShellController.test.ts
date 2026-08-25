import { describe, expect, it } from "vitest";
import { selectCanvasRouteChrome } from "../../../hooks/admin-ui/layout/useCanvasShellController";

describe("selectCanvasRouteChrome", () => {
  it.each([
    {
      name: "Hub",
      pathname: "/hub/work",
      isDesktop: true,
      activePath: "/hub",
      workspaceId: "hub",
      rawWorkspaceId: "hub",
      leftDialogTone: "hub",
    },
    {
      name: "Garden",
      pathname: "/garden/0x1/work",
      isDesktop: true,
      activePath: "/garden",
      workspaceId: "garden",
      rawWorkspaceId: "garden",
      leftDialogTone: "garden",
    },
    {
      name: "Community",
      pathname: "/community/signals",
      isDesktop: false,
      activePath: "/community",
      workspaceId: "community",
      rawWorkspaceId: "community",
      leftDialogTone: "community",
    },
    {
      name: "Actions",
      pathname: "/actions/action-1",
      isDesktop: true,
      activePath: "/actions",
      workspaceId: "actions",
      rawWorkspaceId: "actions",
      leftDialogTone: "actions",
    },
    {
      name: "desktop Profile redirect",
      pathname: "/profile",
      isDesktop: true,
      activePath: "/hub/work",
      workspaceId: "hub",
      rawWorkspaceId: "profile",
      leftDialogTone: "hub",
    },
    {
      name: "mobile Profile tab",
      pathname: "/profile",
      isDesktop: false,
      activePath: "/profile",
      workspaceId: "profile",
      rawWorkspaceId: "profile",
      leftDialogTone: "hub",
    },
  ])("maps the $name route to chrome state", ({
    pathname,
    isDesktop,
    name: _name,
    ...expected
  }) => {
    expect(selectCanvasRouteChrome(pathname, isDesktop)).toEqual(expected);
  });
});
