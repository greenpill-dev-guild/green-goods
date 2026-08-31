/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { WorkListTab } from "@/views/Home/WorkDashboard/WorkListTab";

vi.mock("@/components/Cards", () => ({
  MinimalWorkCard: ({ work }: { work: { title: string } }) =>
    createElement("div", { "data-testid": "work-card" }, work.title),
}));

vi.mock("@/components/Communication", () => ({
  EmptyState: () => createElement("div", null, "Empty"),
  Loader: () => createElement("div", null, "Loading"),
}));

const messages = {
  itemCount: { id: "count", defaultMessage: "{count} items" },
  loading: { id: "loading", defaultMessage: "Loading" },
  emptyTitle: { id: "emptyTitle", defaultMessage: "Empty" },
  emptyDescription: { id: "emptyDescription", defaultMessage: "No items" },
};

describe("WorkListTab", () => {
  it("lets list content contribute to the dashboard scroll owner", () => {
    render(
      createElement(
        IntlProvider,
        { locale: "en", messages: {} },
        createElement(WorkListTab, {
          items: [{ id: "work-1", title: "Plant trees" }] as never,
          isLoading: false,
          hasError: false,
          onWorkClick: vi.fn(),
          messages,
          emptyIcon: createElement("span"),
        })
      )
    );

    expect(screen.getByTestId("work-card").closest(".overflow-y-auto")).toBeNull();
    expect(screen.getByTestId("work-card").closest(".overflow-x-hidden")).toBeNull();
  });
});
