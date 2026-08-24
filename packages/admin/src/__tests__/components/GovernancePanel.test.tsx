import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useConvictionProposalsForPool } from "@green-goods/shared/hooks/conviction/useConvictionProposalsForPool";
import { PoolType } from "@green-goods/shared/types/gardens-community";
import { renderWithProviders, screen } from "@/__tests__/test-utils";
import { GovernancePanel } from "@/views/Community/components/GovernancePanel";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/conviction/useConvictionProposalsForPool", () => ({
  useConvictionProposalsForPool: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/conviction/useConvictionWeightAllocator", () => ({
  useConvictionWeightAllocator: vi.fn(() => ({
    allocations: {},
    flush: vi.fn(),
    isDirty: false,
    isLoading: false,
    isSaving: false,
    setAllocations: vi.fn(),
  })),
}));

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const HYPERCERT_POOL = "0x2222222222222222222222222222222222222222";
const COMMUNITY = "0x3333333333333333333333333333333333333333";

describe("GovernancePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePrimaryAddress).mockReturnValue(null);
    vi.mocked(useConvictionProposalsForPool).mockReturnValue({
      hasError: false,
      isLoading: false,
      registeredHypercertIds: [1n, 2n],
      proposals: [
        {
          id: "1",
          title: "Solar canopy hypercert",
          summary: "Registered from recent impact reporting.",
          conviction: 64,
          threshold: 80,
          dailyAccrual: 4.2,
          supporters: 2,
          status: "accruing",
        },
        {
          id: "2",
          title: "Compost recovery hypercert",
          summary: "Ready for conviction review.",
          conviction: 82,
          threshold: 80,
          dailyAccrual: 0,
          supporters: 1,
          status: "passing",
        },
      ],
    });
  });

  it("renders registered proposals as a pool-scoped operator list", () => {
    renderWithProviders(
      <MemoryRouter>
        <GovernancePanel
          gardenId={GARDEN_ID}
          pools={[
            {
              communityAddress: COMMUNITY,
              gardenAddress: GARDEN_ID,
              poolAddress: HYPERCERT_POOL,
              poolType: PoolType.Hypercert,
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Hypercert signal pool")).toBeInTheDocument();
    expect(screen.getByText("2 proposals")).toBeInTheDocument();
    expect(screen.getByText("Proposal")).toBeInTheDocument();
    expect(screen.getAllByText("Support").length).toBeGreaterThan(0);
    expect(screen.getByText("Conviction")).toBeInTheDocument();
    expect(screen.getByText("Solar canopy hypercert")).toBeInTheDocument();
    expect(screen.getByText("Compost recovery hypercert")).toBeInTheDocument();
    expect(screen.getByText("2 supporters")).toBeInTheDocument();
    expect(screen.getByText("1 supporter")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open pool/i })).toBeInTheDocument();
    expect(screen.getByText("Sign in to allocate conviction")).toBeInTheDocument();
  });
});
