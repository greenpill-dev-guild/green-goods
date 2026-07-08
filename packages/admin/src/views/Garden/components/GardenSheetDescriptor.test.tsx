/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { isValidElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeftSheetConfig } from "@/components/Layout";
import { GardenSheetDescriptor } from "./GardenSheetDescriptor";

const { mockUseLeftSheetConfig } = vi.hoisted(() => ({
  mockUseLeftSheetConfig: vi.fn(),
}));

// The descriptor publishes through the admin-local left-sheet channel
// (re-homed from @green-goods/shared), so mock that module's useLeftSheetConfig.
vi.mock("@/components/Layout", () => ({
  useLeftSheetConfig: mockUseLeftSheetConfig,
}));

vi.mock("@/views/Garden/HypercertDetail", () => ({
  default: () => null,
}));

function renderDescriptor(hypercertId: string | undefined) {
  return render(
    <IntlProvider locale="en" messages={{ "app.hypercerts.detail.title": "Hypercert" }}>
      <MemoryRouter>
        <GardenSheetDescriptor hypercertId={hypercertId} closeTo="/garden" />
      </MemoryRouter>
    </IntlProvider>
  );
}

function getCurrentConfig(): LeftSheetConfig | null {
  return mockUseLeftSheetConfig.mock.calls.at(-1)?.[0] as LeftSheetConfig | null;
}

describe("GardenSheetDescriptor", () => {
  beforeEach(() => {
    mockUseLeftSheetConfig.mockClear();
  });

  it("publishes the route-backed hypercert sheet when a hypercert id is present", () => {
    renderDescriptor("hc-1");

    const config = getCurrentConfig();
    expect(config).not.toBeNull();
    expect(config?.title).toBe("Hypercert");
    expect(config?.size).toBe("lg");
    expect(config?.tone).toBe("garden");
    expect(isValidElement(config?.content)).toBe(true);
  });

  it("publishes no sheet when there is nothing to inspect", () => {
    renderDescriptor(undefined);

    expect(getCurrentConfig()).toBeNull();
  });
});
