/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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

describe("PwaRuntime", () => {
  it("renders a boot loading surface while runtime providers are suspended", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route element={<PwaRuntime />}>
            <Route path="/home" element={<div>Home app</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Loading Green Goods")).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Home app")).not.toBeInTheDocument();
  });
});
