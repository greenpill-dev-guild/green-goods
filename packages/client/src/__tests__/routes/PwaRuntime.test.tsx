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
  it("leaves startup rendering to the static boot surface while providers are suspended", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route element={<PwaRuntime />}>
            <Route path="/home" element={<div>Home app</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(container.querySelector(".boot-pwa-shell")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Home app")).not.toBeInTheDocument();
  });
});
