/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: undefined }),
}));

vi.mock("@green-goods/shared/hooks/app/useNavigateToTop", () => ({
  useNavigateToTop: () => vi.fn(),
}));

import type { Garden, Work } from "@green-goods/shared/types/domain";
import { GardenNotifications } from "../../views/Home/Garden/Notifications";

const garden = { id: "0xgarden", name: "Riverside Commons" } as unknown as Garden;

function work(id: string, status: Work["status"]): Work {
  return {
    id,
    title: id,
    actionUID: 1,
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    gardenAddress: "0xgarden",
    feedback: "",
    metadata: "{}",
    media: [],
    createdAt: 0,
    status,
  } as unknown as Work;
}

function renderNotifications(notifications: Work[]) {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages: {} },
        createElement(GardenNotifications, { garden, notifications })
      )
    )
  );
}

describe("GardenNotifications", () => {
  it("lists only pending work and leaves scrolling to the sheet that hosts it", () => {
    renderNotifications([work("a", "pending"), work("b", "approved"), work("c", "pending")]);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    // The hosting sheet's content region owns scrolling; a nested scroller
    // here has no height of its own and only clips the list.
    expect(links[0].parentElement).not.toHaveClass("overflow-y-auto");
  });

  it("shows the empty state when nothing is pending", () => {
    renderNotifications([work("b", "approved")]);

    expect(screen.getByText("No work submitted yet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
