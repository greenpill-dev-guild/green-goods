import { act, fireEvent, render, screen } from "@testing-library/react";
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

/** Lays tabs out at fixed content offsets in a rail, moved by its scroll. */
function mockScrollingRailGeometry(railWidth: number, offsets: Record<string, [number, number]>) {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.getAttribute("role") === "tablist") return rect(0, railWidth);
    const scroll = this.closest<HTMLElement>('[role="tablist"]')?.scrollLeft ?? 0;
    const name = Object.keys(offsets).find((label) => this.textContent?.includes(label));
    const [left, right] = name ? offsets[name] : [0, 0];
    return rect(left - scroll, right - scroll);
  });
}

function StatefulRail({ railTabs = tabs }: { railTabs?: typeof tabs }) {
  const [activeId, setActiveId] = useState("overview");
  return (
    <AdminTabRail
      ariaLabel="Pool sections"
      activeId={activeId}
      onChange={setActiveId}
      tabs={railTabs}
    />
  );
}

/** A ResizeObserver whose callbacks a test fires for one element at a time. */
class ElementResizeObserver {
  static instances: ElementResizeObserver[] = [];
  private readonly observed = new Set<Element>();
  constructor(private readonly callback: ResizeObserverCallback) {
    ElementResizeObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.add(element);
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
  }
  static resize(element: Element) {
    for (const observer of ElementResizeObserver.instances) {
      if (observer.observed.has(element)) {
        observer.callback([], observer as unknown as ResizeObserver);
      }
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  ElementResizeObserver.instances = [];
});

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

    // No earlier tab start clears Community, so it lands on its own.
    expect(screen.getByRole("tablist")).toHaveProperty("scrollLeft", 120);
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
    expect(screen.getByRole("tablist")).toHaveProperty("scrollLeft", 120);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Community" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });

  it("lands a selected tab clear of the edge fades, on a tab's snap position", () => {
    // Five tabs need 340px in a 200px rail, so it scrolls up to 140px.
    mockScrollingRailGeometry(200, {
      Overview: [0, 92],
      Impact: [96, 150],
      Community: [154, 214],
      Payouts: [218, 280],
      Vault: [284, 340],
    });
    render(
      <IntlProvider locale="en" messages={{}}>
        <StatefulRail
          railTabs={[...tabs, { id: "payouts", label: "Payouts" }, { id: "vault", label: "Vault" }]}
        />
      </IntlProvider>
    );
    const rail = screen.getByRole("tablist");
    // admin-m3-components.css pads the rail's scrollport by its 40px fades.
    rail.style.scrollPaddingLeft = "40px";
    rail.style.scrollPaddingRight = "40px";

    // Community runs under the end fade. The rail snaps to tab starts, so it
    // lands on the first one that clears it: Impact's, 40px in, which ends
    // Community at 158, clear of the fade at 160.
    fireEvent.click(screen.getByRole("tab", { name: "Community" }));
    expect(rail.scrollLeft).toBe(56);

    // Swiped on to 120px, Impact starts under the start fade and lands on its
    // own snap position, 40px in.
    rail.scrollLeft = 120;
    fireEvent.click(screen.getByRole("tab", { name: "Impact" }));
    expect(rail.scrollLeft).toBe(56);
  });

  it("fades the clipped edge when a tab widens without the rail resizing (a new locale's labels)", () => {
    vi.stubGlobal("ResizeObserver", ElementResizeObserver);
    render(
      <IntlProvider locale="en" messages={{}}>
        <StatefulRail />
      </IntlProvider>
    );
    const rail = screen.getByRole("tablist");
    expect(rail).toHaveAttribute("data-overflow", "none");

    // Longer labels land: the tabs grow, the rail's own box does not.
    Object.defineProperty(rail, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(rail, "scrollWidth", { configurable: true, value: 180 });
    act(() => ElementResizeObserver.resize(screen.getByRole("tab", { name: "Community" })));

    expect(rail).toHaveAttribute("data-overflow", "end");
  });
});
