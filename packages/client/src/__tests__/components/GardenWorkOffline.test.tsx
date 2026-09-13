import { cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@green-goods/shared/hooks/offline/useOfflineContent", () => ({
  useGardenOfflineContent: () => ({ state: "unavailable", workCount: 0 }),
}));
vi.mock("@green-goods/shared/hooks/app/useNavigateToTop", () => ({
  useNavigateToTop: () => vi.fn(),
}));
vi.mock("@/components/Cards", () => ({
  MinimalWorkCard: ({ work }: { work: { title: string } }) => (
    <div data-testid="cached-work">{work.title}</div>
  ),
}));
vi.mock("@/components/Communication", async () => ({
  ...(await import("../../components/Communication/EmptyState")),
  Loader: () => <div>Loading</div>,
}));
import { GardenWork } from "../../components/Features/Garden/Work";
afterEach(cleanup);
it("preserves downloaded work when a refresh fails", () => {
  render(
    <IntlProvider locale="en" messages={{}}>
      <GardenWork
        works={[
          {
            id: "cached",
            title: "Previously downloaded work",
            actionUID: 1,
            gardenAddress: "0xgarden",
            gardenerAddress: "0xuser",
            createdAt: 1,
            status: "pending",
            metadata: "{}",
            media: [],
            feedback: "",
          },
        ]}
        actions={[]}
        workFetchStatus="error"
        isFetching={false}
        onRefresh={vi.fn()}
      />
    </IntlProvider>
  );
  expect(screen.queryByTestId("cached-work")).not.toBeNull();
});
it("explains an offline cache miss without a network spinner or empty-garden claim", () => {
  render(
    <IntlProvider locale="en" messages={{}}>
      <GardenWork
        works={[]}
        actions={[]}
        workFetchStatus="pending"
        isFetching
        isOffline
        availability="unavailable"
        onRefresh={vi.fn()}
      />
    </IntlProvider>
  );
  expect(screen.getByRole("status")).toHaveTextContent("hasn’t been downloaded");
  expect(screen.queryByText("Loading")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByText(/No work yet/)).toBeNull();
});
it("distinguishes a successfully fetched empty collection from an offline cache miss", () => {
  render(
    <IntlProvider locale="en" messages={{}}>
      <GardenWork
        works={[]}
        actions={[]}
        workFetchStatus="success"
        isOffline
        availability="empty"
      />
    </IntlProvider>
  );
  expect(screen.getByText(/No work yet/)).toBeInTheDocument();
  expect(screen.queryByText(/hasn’t been downloaded/)).toBeNull();
});
it("does not call an incomplete download with zero local records an empty garden", () => {
  render(
    <IntlProvider locale="en" messages={{}}>
      <GardenWork
        works={[]}
        actions={[]}
        workFetchStatus="success"
        isOffline
        availability="partial"
      />
    </IntlProvider>
  );
  expect(screen.getByRole("status")).toHaveTextContent("Partially available offline");
  expect(screen.queryByText(/No work yet/)).toBeNull();
});
