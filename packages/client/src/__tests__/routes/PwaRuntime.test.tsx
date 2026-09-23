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

const renderRuntime = () =>
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <Routes>
        <Route element={<PwaRuntime />}>
          <Route path="/home" element={<div>Home app</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe("PwaRuntime", () => {
  it("leaves startup rendering to the static boot surface while providers are suspended", () => {
    const { container } = renderRuntime();

    expect(container.querySelector(".boot-pwa-shell")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Home app")).not.toBeInTheDocument();
  });

  it("answers presses before the sign-in providers load, and stops when it unmounts", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    const press = document.body.appendChild(document.createElement("button"));

    const { unmount } = renderRuntime();
    press.click();
    unmount();
    press.click();

    expect(vibrate.mock.calls).toEqual([[10]]);
    press.remove();
    Reflect.deleteProperty(navigator, "vibrate");
  });
});
