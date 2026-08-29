/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/Communication/PwaUpdateNotifier", () => ({
  PwaUpdateNotifier: () => null,
}));

vi.mock("../../routes/WalletRuntimeProviders", () => ({
  default: ({ children }: { children: ReactNode }) => {
    void children;
    throw new Promise(() => {});
  },
}));

import PwaRuntime from "../../routes/PwaRuntime";
import { PwaHydrationFallback } from "../../routes/PresentationHydrationFallback";

afterEach(() => {
  delete document.documentElement.dataset.bootLoadingMessage;
});

describe("PwaRuntime", () => {
  it("renders a boot loading surface while runtime providers are suspended", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route element={<PwaRuntime />}>
            <Route path="/home" element={<div>Home app</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(container.querySelector('img[src="/icon.png"]')).toBeInTheDocument();
    expect(screen.getByText("Green Goods is loading.")).toBeVisible();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByLabelText("Loading Green Goods")).not.toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("[data-boot-slot]")).map((slot) =>
        slot.getAttribute("data-boot-slot")
      )
    ).toEqual(["logo", "message", "action"]);
    expect(screen.queryByText("Home app")).not.toBeInTheDocument();
  });

  it.each([
    ["Green Goods se está cargando."],
    ["Green Goods está carregando."],
  ])("keeps the boot-resolved locale through the React handoff", (message) => {
    document.documentElement.dataset.bootLoadingMessage = message;

    render(<PwaHydrationFallback />);

    expect(screen.getByText(message)).toBeVisible();
    expect(screen.queryByText("Green Goods is loading.")).not.toBeInTheDocument();
  });
});
