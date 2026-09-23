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

const pressHaptics = vi.hoisted(() => ({ install: vi.fn(), uninstall: vi.fn() }));
vi.mock("@green-goods/shared/utils/app/haptics", () => ({
  installPressHaptics: pressHaptics.install,
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
    pressHaptics.install.mockClear().mockReturnValue(pressHaptics.uninstall);
    pressHaptics.uninstall.mockClear();

    const { unmount } = renderRuntime();
    expect(pressHaptics.install).toHaveBeenCalledTimes(1);
    expect(pressHaptics.uninstall).not.toHaveBeenCalled();

    unmount();
    expect(pressHaptics.uninstall).toHaveBeenCalledTimes(1);
  });
});
