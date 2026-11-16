import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { HypercertRecord } from "@green-goods/shared/types/hypercerts";
import { render, screen } from "../test-utils";
import HypercertDetail from "@/views/Garden/HypercertDetail";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@green-goods/shared/hooks/hypercerts/useHypercerts", () => ({ useHypercerts: read }));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [{ id: "fixture-garden", chainId: 11155111 }] }),
}));
vi.mock("@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({ selectedGarden: { id: "fixture-garden" } }),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => ({ canManageGarden: () => false }),
}));
vi.mock("@/components/EnsAddressText", () => ({ EnsAddressText: () => "Certificate issuer" }));

const certificate: HypercertRecord = {
  id: "fixture-certificate",
  tokenId: 1n,
  gardenId: "fixture-garden",
  metadataUri: "",
  mintedAt: 1,
  mintedBy: "0x",
  txHash: "0x",
  totalUnits: 100n,
  claimedUnits: 0n,
  title: "Recorded planting",
  attestationCount: 2,
  attestations: [],
};

function open() {
  render(
    <MemoryRouter>
      <HypercertDetail layout="sheet" hypercertId="fixture-certificate" />
    </MemoryRouter>
  );
}

describe("certificate evidence visibility", () => {
  beforeEach(() => {
    read.mockReturnValue({
      hypercert: certificate,
      isLoading: false,
      hasError: false,
      syncStatus: "synced",
    });
  });

  it("keeps issued facts visible and reports unavailable evidence", () => {
    read.mockReturnValue({
      hypercert: certificate,
      isLoading: false,
      hasError: true,
      syncStatus: "synced",
    });
    open();
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load attestations.");
    expect(screen.getByText("Recorded planting")).toBeInTheDocument();
    expect(screen.getByText("2", { exact: true })).toBeInTheDocument();
  });

  it("shows a settled visible certificate without an unavailable notice", () => {
    open();
    expect(screen.getByText("Recorded planting")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps issued facts visible while linked evidence is loading", () => {
    read.mockReturnValue({
      hypercert: certificate,
      isLoading: false,
      evidenceLoading: true,
      hasError: false,
      syncStatus: "synced",
    });
    open();
    expect(screen.getByText("Recorded planting")).toBeInTheDocument();
    expect(screen.getByText("2", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading attestations...");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a missing certificate distinct from unavailable evidence", () => {
    read.mockReturnValue({
      hypercert: null,
      isLoading: false,
      hasError: false,
      syncStatus: "synced",
    });
    open();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Unable to load attestations.");
  });
});
