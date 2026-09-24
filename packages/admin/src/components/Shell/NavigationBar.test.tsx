/**
 * @vitest-environment jsdom
 */

import type { ToolbarSlot } from "@green-goods/shared/components/Canvas/NavigationBar";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/__tests__/test-utils";
import { NavigationBar } from "./NavigationBar";

const slots: ToolbarSlot[] = [
  {
    id: "hub",
    label: "Hub",
    labelId: "cockpit.nav.hub",
    icon: () => null,
    path: "/hub",
    visible: true,
  },
  {
    id: "garden",
    label: "Garden",
    labelId: "cockpit.nav.garden",
    icon: () => null,
    path: "/garden",
    visible: true,
  },
  {
    id: "community",
    label: "Community",
    labelId: "cockpit.nav.community",
    icon: () => null,
    path: "/community",
    visible: true,
  },
];

describe("NavigationBar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expands desktop wells for the Portuguese Community label", () => {
    render(
      <IntlProvider locale="pt" messages={ptMessages}>
        <NavigationBar slots={slots} activePath="/garden" onNavigate={vi.fn()} />
      </IntlProvider>
    );

    expect(screen.getByText("Comunidade")).toBeVisible();
    expect(screen.getByRole("navigation")).toHaveStyle({
      gridTemplateColumns:
        "repeat(3, minmax(var(--admin-nav-item-width-desktop, 5.875rem), max-content))",
      width: "fit-content",
    });
  });

  it("renders a usable desktop dock with only Hub and Garden", () => {
    const onNavigate = vi.fn();
    render(
      <IntlProvider locale="pt" messages={ptMessages}>
        <NavigationBar slots={slots.slice(0, 2)} activePath="/hub" onNavigate={onNavigate} />
      </IntlProvider>
    );

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("data-item-count", "2");
    expect(nav.querySelector('[data-item-id="hub"]')).toHaveAttribute("aria-current", "page");
    fireEvent.click(nav.querySelector('[data-item-id="garden"]') as HTMLElement);
    expect(onNavigate).toHaveBeenCalledWith("/garden");
  });
});
