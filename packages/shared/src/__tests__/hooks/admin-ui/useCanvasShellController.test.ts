import { describe, expect, it } from "vitest";
import { selectCanvasRouteChrome } from "../../../hooks/admin-ui/layout/useCanvasShellController";

describe("selectCanvasRouteChrome", () => {
  it.each([
    {
      name: "Review",
      pathname: "/review/work",
      isDesktop: true,
      activePath: "/review",
      workspaceId: "review",
      rawWorkspaceId: "review",
      leftDialogTone: "review",
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
      activePath: "/review/work",
      workspaceId: "review",
      rawWorkspaceId: "profile",
      leftDialogTone: "review",
    },
    {
      name: "mobile Profile tab",
      pathname: "/profile",
      isDesktop: false,
      activePath: "/profile",
      workspaceId: "profile",
      rawWorkspaceId: "profile",
      leftDialogTone: "review",
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
