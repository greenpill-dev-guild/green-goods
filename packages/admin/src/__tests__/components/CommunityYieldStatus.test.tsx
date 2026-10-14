import { useGardenYieldWiringState } from "@green-goods/shared/hooks/yield/useGardenYieldWiringState";
import type { Address } from "@green-goods/shared/types/domain";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
import { CommunityYieldStatus } from "@/views/Community/components/CommunityYieldStatus";

vi.mock("@green-goods/shared/hooks/yield/useGardenYieldWiringState", () => ({
  useGardenYieldWiringState: vi.fn(),
}));

const GARDEN_ID: Address = "0x1111111111111111111111111111111111111111";
const HYPERCERT_POOL: Address = "0x2222222222222222222222222222222222222222";
const REPAIR_HREF = `/community/coordination?gardenId=${GARDEN_ID}`;

type WiringResult = ReturnType<typeof useGardenYieldWiringState>;
type WiringState = NonNullable<WiringResult["wiringState"]>;

function wiringResult(status: WiringState["status"], repairHref?: string): WiringResult {
  const wiringState: WiringState = {
    readStatus: "available",
    status,
    gardenAddress: GARDEN_ID,
    expectedHypercertPoolAddress: HYPERCERT_POOL,
    canRepairFromCommunity: status !== "connected",
    issues: [],
    ...(status === "connected" ? { resolverHypercertPoolAddress: HYPERCERT_POOL } : {}),
  };
  return {
    data: wiringState,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isError: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: true,
    isEnabled: true,
    refetch: vi.fn(),
    status: "success",
    fetchStatus: "idle",
    promise: Promise.resolve(wiringState),
    wiringStatus: status,
    wiringState,
    repairHref,
  };
}

function renderYieldStatus(enabled = true) {
  return renderWithProviders(
    <IntlProvider
      locale="en"
      messages={{
        "app.community.yield.connectAction": "Connect to Yield",
        "app.community.yield.connected": "Yield connected",
        "app.community.yield.mismatch": "Yield wiring mismatch",
        "app.community.yield.notConnected": "Yield not connected",
      }}
    >
      <MemoryRouter>
        <CommunityYieldStatus gardenId={GARDEN_ID} enabled={enabled} />
      </MemoryRouter>
    </IntlProvider>
  );
}

describe("CommunityYieldStatus", () => {
  beforeEach(() => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue(wiringResult("connected"));
  });

  it("shows the connected pill when yield is wired", () => {
    renderYieldStatus();

    expect(screen.getByText("Yield connected")).toBeInTheDocument();
    expect(screen.queryByText("Yield not connected")).not.toBeInTheDocument();
  });

  it("warns and links to the repair flow when resolver wiring is missing", () => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue(
      wiringResult("missing-resolver-wiring", REPAIR_HREF)
    );
    renderYieldStatus();

    expect(screen.getByText("Yield not connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect to Yield" })).toHaveAttribute(
      "href",
      REPAIR_HREF
    );
    expect(screen.queryByText("Yield connected")).not.toBeInTheDocument();
  });

  it("names a wiring mismatch distinctly from missing wiring", () => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue(wiringResult("mismatch", REPAIR_HREF));
    renderYieldStatus();

    expect(screen.getByText("Yield wiring mismatch")).toBeInTheDocument();
    expect(screen.queryByText("Yield not connected")).not.toBeInTheDocument();
  });

  it("keeps the warning but drops the repair link when no repair route exists", () => {
    vi.mocked(useGardenYieldWiringState).mockReturnValue(wiringResult("missing-resolver-wiring"));
    renderYieldStatus();

    expect(screen.getByText("Yield not connected")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Connect to Yield" })).not.toBeInTheDocument();
  });

  it("renders nothing and skips the wiring read when there is nothing to wire", () => {
    renderYieldStatus(false);

    expect(useGardenYieldWiringState).toHaveBeenCalledWith(GARDEN_ID, { enabled: false });
    expect(screen.queryByText("Yield connected")).not.toBeInTheDocument();
  });
});
