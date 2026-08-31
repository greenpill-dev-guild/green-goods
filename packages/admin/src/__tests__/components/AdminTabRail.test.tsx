import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTabRail } from "../../components/AdminTabRail";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "impact", label: "Impact" },
  { id: "community", label: "Community" },
];

function rect(left: number, right: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    right,
    top: 0,
    bottom: 44,
    width: right - left,
    height: 44,
    toJSON: () => ({}),
  };
}

function mockNarrowRailGeometry() {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.getAttribute("role") === "tablist") return rect(0, 100);
    if (this.textContent?.includes("Community")) return rect(120, 200);
    if (this.textContent?.includes("Impact")) return rect(60, 120);
    return rect(0, 60);
  });
}

function StatefulRail() {
  const [activeId, setActiveId] = useState("overview");
  return (
    <AdminTabRail
      ariaLabel="Pool sections"
      activeId={activeId}
      onChange={setActiveId}
      tabs={tabs}
    />
  );
}

afterEach(() => vi.restoreAllMocks());

describe("AdminTabRail", () => {
  it("keeps translated label descenders outside clipping containers", () => {
    render(
      <IntlProvider locale="es" messages={{}}>
        <AdminTabRail
          ariaLabel="Secciones de la comunidad"
          activeId="payouts"
          onChange={vi.fn()}
          tabs={[
            { id: "members", label: "Miembros" },
            { id: "coordination", label: "Coordinación" },
            { id: "endowment", label: "Dotación" },
            { id: "payouts", label: "Pagos" },
          ]}
        />
      </IntlProvider>
    );

    const label = screen.getByText("Pagos");
    expect(screen.getByRole("tablist")).toHaveClass("overflow-x-auto");
    expect(label).toHaveClass("whitespace-nowrap");
    expect(label).not.toHaveClass("overflow-hidden");
  });

  it("scrolls an initially clipped active tab into view", () => {
    mockNarrowRailGeometry();

    render(
      <IntlProvider locale="en" messages={{}}>
        <AdminTabRail
          ariaLabel="Pool sections"
          activeId="community"
          onChange={vi.fn()}
          tabs={tabs}
        />
      </IntlProvider>
    );

    expect(screen.getByRole("tablist")).toHaveProperty("scrollLeft", 100);
  });

  it("scrolls on selection changes and keeps keyboard activation and focus", () => {
    mockNarrowRailGeometry();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    render(
      <IntlProvider locale="en" messages={{}}>
        <StatefulRail />
      </IntlProvider>
    );

    fireEvent.click(screen.getByRole("tab", { name: "Community" }));
    expect(screen.getByRole("tab", { name: "Community" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tablist")).toHaveProperty("scrollLeft", 100);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Community" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });
});
