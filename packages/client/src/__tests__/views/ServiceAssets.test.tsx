// TEST-QUALITY: allow-small-test-file - The asset-selection compositor needs isolated identity/catalog hook mocks; merging with the profile shell or callback-driven signing-panel tests would mix independent provider seams.
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, within } from "../test-utils";
import {
  ISSUER_STORY_ADDRESS,
  issuerStoryAssets,
  issuerStoryDraftRecord,
  issuerStorySnapshot,
} from "../../views/Profile/serviceIssuerStoryFixtures";
import { ServiceAssets } from "../../views/Profile/ServiceAssets";

const state = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  profile: "kernel-0.3.3-pilot",
  routes: [] as unknown[],
  operations: vi.fn(),
  drafts: vi.fn(),
  approval: {
    approve: { isPending: false, mutateAsync: vi.fn() },
    canSign: true,
  },
}));
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({
    primaryAddress: state.address,
    authMode: "passkey",
    passkeyAccountProfile: state.profile,
  }),
}));
// A booking row names its holder; this composition test reads no profile, ENS or Green Goods name.
vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", () => ({
  useResolvedProfileAvatar: () => ({ avatarUri: null, isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  get SERVICE_ISSUER_ROUTES() {
    return state.routes;
  },
  useServiceIssuerOperations: (...args: unknown[]) => state.operations(...args),
  useServiceIssuerDrafts: (...args: unknown[]) => state.drafts(...args),
  useServiceIssuerApproval: () => state.approval,
}));

describe("Profile service asset composition", () => {
  it("leaves an empty production catalog unavailable without starting an issuer read", () => {
    state.routes = [];
    state.drafts.mockReturnValue({ data: { status: "unavailable" } });
    state.operations.mockClear();
    renderWithProviders(<ServiceAssets />);
    expect(screen.getByText(/No verified service assets are available yet/)).toBeInTheDocument();
    expect(state.operations).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers only the signed-in member's own drafts, approved by their own signature", async () => {
    state.routes = [];
    const own = issuerStoryDraftRecord("review");
    const someoneElse = issuerStoryDraftRecord("review");
    someoneElse.draft = {
      ...someoneElse.draft,
      id: "8",
      member: "0x6666666666666666666666666666666666666666",
    };
    state.drafts.mockReturnValue({
      data: { status: "observed", records: [own, someoneElse] },
    });
    state.approval.approve.mutateAsync.mockResolvedValue(undefined);
    renderWithProviders(<ServiceAssets />);
    expect(state.drafts).toHaveBeenCalledWith(ISSUER_STORY_ADDRESS);
    const select = screen.getByLabelText("Vouchers you hold and services you offer.");
    expect(within(select).getAllByRole("option")).toHaveLength(2);
    await userEvent.selectOptions(select, "draft:7");
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    const sheet = within(screen.getByRole("dialog"));
    await userEvent.click(sheet.getByRole("checkbox"));
    await userEvent.click(sheet.getByRole("button", { name: "Approve My Service" }));
    expect(state.approval.approve.mutateAsync).toHaveBeenCalledExactlyOnceWith(own.draft);
    expect(state.operations).not.toHaveBeenCalled();
  });

  it("requires explicit asset selection and constructs the actor from the active identity", async () => {
    state.routes = [{ service: { id: "fictional-story" }, assets: issuerStoryAssets }];
    state.drafts.mockReturnValue({ data: { status: "unavailable" } });
    state.operations.mockReturnValue({
      snapshot: { data: issuerStorySnapshot(), isLoading: false, isError: false, refetch: vi.fn() },
      review: { mutateAsync: vi.fn() },
      execute: { mutateAsync: vi.fn() },
      reconcile: { mutateAsync: vi.fn() },
      quote: { mutateAsync: vi.fn() },
    });
    state.operations.mockClear();
    const view = renderWithProviders(<ServiceAssets />);
    expect(state.operations).not.toHaveBeenCalled();
    await userEvent.selectOptions(
      screen.getByLabelText("Vouchers you hold and services you offer."),
      "0:0"
    );
    expect(state.operations).toHaveBeenLastCalledWith({
      address: ISSUER_STORY_ADDRESS,
      routeId: "fictional-story",
      assetId: "engineer-help",
    });
    state.address = "0x6666666666666666666666666666666666666666";
    view.rerender(<ServiceAssets />);
    expect(state.operations).toHaveBeenLastCalledWith({
      address: state.address,
      routeId: "fictional-story",
      assetId: "engineer-help",
    });
    state.address = ISSUER_STORY_ADDRESS;
    state.routes = [];
  });
});
