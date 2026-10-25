// TEST-QUALITY: allow-small-test-file - The asset-selection compositor needs isolated identity/catalog hook mocks; merging with the profile shell or callback-driven signing-panel tests would mix independent provider seams.
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test-utils";
import {
  ISSUER_STORY_ADDRESS,
  issuerStoryAssets,
  issuerStorySnapshot,
} from "../../views/Profile/serviceIssuerStoryFixtures";
import { ServiceAssets } from "../../views/Profile/ServiceAssets";

const state = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  profile: "kernel-0.3.3-pilot",
  routes: [] as unknown[],
  operations: vi.fn(),
}));
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({
    primaryAddress: state.address,
    authMode: "passkey",
    passkeyAccountProfile: state.profile,
  }),
}));
vi.mock("@green-goods/shared/commitment-pooling", () => ({
  get SERVICE_ISSUER_ROUTES() {
    return state.routes;
  },
  useServiceIssuerOperations: (...args: unknown[]) => state.operations(...args),
}));

describe("Profile service asset composition", () => {
  it("leaves an empty production catalog unavailable without starting an issuer read", () => {
    state.routes = [];
    state.operations.mockClear();
    renderWithProviders(<ServiceAssets />);
    expect(screen.getByText(/No verified service assets are available yet/)).toBeInTheDocument();
    expect(state.operations).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Service Asset")).not.toBeInTheDocument();
  });

  it("requires explicit asset selection and constructs the actor from the active identity", async () => {
    state.routes = [{ service: { id: "fictional-story" }, assets: issuerStoryAssets }];
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
    await userEvent.selectOptions(screen.getByLabelText("Service Asset"), "0:0");
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
