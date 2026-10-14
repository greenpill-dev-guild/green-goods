/**
 * The Create Cookie Jar flow decides how it ends: on its Review (DL-080), where the status row
 * shows the send and the footer becomes Done. A create whose jar address is not yet known shows
 * the submitted transaction and takes the address by hand, only a valid address completes it,
 * "Create Another" starts a clean draft at the first step, and a failed create stays on the Review
 * with its error and Try Again.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithProviders, screen } from "../../../../__tests__/test-utils";

const OWNER = "0x1111111111111111111111111111111111111111";
const FACTORY = "0x9999999999999999999999999999999999999999";
const JAR = "0x7777777777777777777777777777777777777777";
const SUBMITTED_HASH = `0x${"ab".repeat(32)}`;

const createJar = vi.hoisted(() => ({
  reset: vi.fn(),
  mutate: vi.fn(),
  isPending: false,
  error: null as Error | null,
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: OWNER }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [], isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));
vi.mock("@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar", () => ({
  useCreateCampaignCookieJar: () => ({
    mutate: createJar.mutate,
    reset: createJar.reset,
    isPending: createJar.isPending,
    error: createJar.error,
  }),
  useCampaignCookieJar: () => ({ jar: undefined, isLoading: false, hasDetailReadFailure: false }),
}));
vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarFactoryAddress", () => ({
  useCookieJarFactoryAddress: () => ({
    factoryAddress: FACTORY,
    moduleConfigured: true,
    isLoading: false,
  }),
}));
vi.mock("@green-goods/shared/hooks/gardener/useRole", () => ({
  useRole: () => ({ isDeployer: true, loading: false }),
}));
// The route blocker needs a data router; closing is not what these cases test.
vi.mock("@green-goods/shared/hooks/admin-ui/useDirtyClose", () => ({
  useDirtyClose: ({ onClose }: { onClose: () => void }) => ({
    onOpenChange: (open: boolean) => {
      if (!open) onClose();
    },
    confirmOpen: false,
    cancelClose: () => {},
    confirmClose: () => {},
  }),
}));
vi.mock("wagmi", () => ({
  useReadContracts: () => ({ data: undefined, isLoading: false, isFetching: false }),
}));
vi.mock("@/components/EnsAddressText", () => ({
  EnsAddressText: ({ address }: { address: string }) => address,
}));

import { CampaignCookieJarCreateWorkspace } from "./CampaignCookieJarCreateWorkspace";

beforeEach(() => {
  createJar.reset.mockReset();
  createJar.mutate.mockReset();
  createJar.isPending = false;
  createJar.error = null;
});

describe("CampaignCookieJarCreateWorkspace", () => {
  it("shows the submitted transaction until the steward supplies the created jar's address", () => {
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialSubmittedHash={SUBMITTED_HASH} />
    );

    expect(screen.getByText("Creation submitted")).toBeInTheDocument();
    // Its Review, ending on Done: the jar to finish has no fresh start yet.
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Another" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Created jar address"), { target: { value: JAR } });
    fireEvent.click(screen.getByRole("button", { name: "Use jar address" }));

    expect(screen.getByText("Cookie jar created")).toBeInTheDocument();
    expect(screen.getAllByText(JAR).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Create Another" })).toBeInTheDocument();
  });

  it("does not complete the flow with a malformed jar address", () => {
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialSubmittedHash={SUBMITTED_HASH} />
    );

    fireEvent.change(screen.getByLabelText("Created jar address"), { target: { value: "0x7777" } });

    expect(screen.getByRole("button", { name: "Use jar address" })).toBeDisabled();
    expect(screen.queryByText("Cookie jar created")).toBeNull();
  });

  it("starts another jar from a clean first step", () => {
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialCreatedJarAddress={JAR} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Another" }));

    expect(screen.getByLabelText(/Campaign name/)).toHaveValue("");
    expect(screen.queryByText("Cookie jar created")).toBeNull();
    expect(createJar.reset).toHaveBeenCalledTimes(1);
  });

  it("ends a created jar on its Review with Done, back to the cookie jar list", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={onClose} initialCreatedJarAddress={JAR} />
    );

    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText("Cookie jar created")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Cookie Jar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    // Advanced changes what Create sends, so it is gone once the jar exists.
    expect(screen.queryByText(/Advanced/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed create on the Review with its error, Try Again and Back", () => {
    createJar.error = new Error("Execution reverted: factory paused");
    renderWithProviders(<CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialStep={3} />);

    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    const row = document.querySelector('[data-component="FlowStatusRow"]');
    expect(row).toHaveAttribute("data-tone", "error");
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });

  it("holds every button while the create works", () => {
    createJar.isPending = true;
    renderWithProviders(<CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialStep={3} />);

    expect(screen.getByText("Creating the cookie jar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("holds Create while the jar is incomplete", () => {
    renderWithProviders(<CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialStep={3} />);

    expect(screen.getByText("Creates this cookie jar on-chain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Cookie Jar" })).toBeDisabled();
  });
});
