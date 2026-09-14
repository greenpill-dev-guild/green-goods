import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, expect, it, vi } from "vitest";

const offline = vi.hoisted(() => ({ useActiveOfflineGarden: vi.fn() }));
vi.mock("@green-goods/shared/hooks/offline/useOfflineContent", () => offline);
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
import type { Work } from "@green-goods/shared/types/domain";
import { GardenWork } from "../../components/Features/Garden/Work";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function savedWork(index: number): Work {
  return {
    id: `cached-${index}`,
    title: `Previously downloaded work ${index}`,
    actionUID: 1,
    gardenAddress: "0xgarden",
    gardenerAddress: "0xuser",
    createdAt: index,
    status: "approved",
    metadata: "{}",
    media: [],
    feedback: "",
  } as Work;
}

const renderList = (props: Partial<Parameters<typeof GardenWork>[0]>) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <GardenWork works={[]} actions={[]} {...props} />
    </IntlProvider>
  );

it("says nothing about offline content while online", () => {
  renderList({
    works: [savedWork(1)],
    workFetchStatus: "success",
    gardenId: "0xgarden",
    lastSuccessfulRefresh: Date.now(),
  });

  expect(screen.queryByRole("status")).toBeNull();
  expect(offline.useActiveOfflineGarden).toHaveBeenCalledWith("0xgarden");
});

it("keeps saved work visible when a refresh fails and says when it was saved", () => {
  renderList({
    works: [savedWork(1)],
    workFetchStatus: "error",
    isFetching: false,
    lastSuccessfulRefresh: Date.now(),
    onRefresh: vi.fn(),
  });

  expect(screen.getByTestId("cached-work")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/^Couldn’t refresh · Saved \d/);
});

it("labels a saved copy while offline on one line", () => {
  renderList({
    works: [savedWork(1)],
    isOffline: true,
    availability: "available",
    lastSuccessfulRefresh: new Date(2026, 8, 13, 16, 5).getTime(),
  });

  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Offline · Saved Sep 13");
  expect(status.querySelector("p")).toHaveClass("truncate");
});

it("explains an offline cache miss without a network spinner or empty-garden claim", () => {
  renderList({
    workFetchStatus: "pending",
    isFetching: true,
    isOffline: true,
    availability: "unavailable",
    onRefresh: vi.fn(),
  });

  expect(screen.getByRole("status")).toHaveTextContent("Not saved yet · Connect to load it");
  expect(screen.queryByText("Loading")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByText(/No work yet/)).toBeNull();
});

it("distinguishes a successfully fetched empty collection from an offline cache miss", () => {
  renderList({ workFetchStatus: "success", isOffline: true, availability: "empty" });

  expect(screen.getByText(/No work yet/)).toBeInTheDocument();
  expect(screen.queryByText(/Not saved yet/)).toBeNull();
});

it("does not call a partial offline copy with no rows an empty garden", () => {
  renderList({ workFetchStatus: "success", isOffline: true, availability: "partial" });

  expect(screen.getByRole("status")).toHaveTextContent("Not saved yet");
  expect(screen.queryByText(/No work yet/)).toBeNull();
});

it("renders the newest fifty cards and shows older work when asked", () => {
  const works = Array.from({ length: 60 }, (_, index) => savedWork(index + 1));
  renderList({ works, workFetchStatus: "success", gardenId: "0xgarden" });

  expect(screen.getAllByTestId("cached-work")).toHaveLength(50);
  expect(screen.getAllByTestId("cached-work")[0]).toHaveTextContent("work 60");

  fireEvent.click(screen.getByRole("button", { name: "Show older work" }));

  expect(screen.getAllByTestId("cached-work")).toHaveLength(60);
  expect(screen.queryByRole("button", { name: "Show older work" })).toBeNull();
});
