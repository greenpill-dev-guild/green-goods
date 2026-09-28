/**
 * The Create Cookie Jar flow decides how it ends: a create whose jar address is not yet known shows
 * the submitted transaction and takes the address by hand, only a valid address completes it, and
 * "Create Another" starts a clean draft at the first step.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithProviders, screen } from "../../../../__tests__/test-utils";

const OWNER = "0x1111111111111111111111111111111111111111";
const FACTORY = "0x9999999999999999999999999999999999999999";
const JAR = "0x7777777777777777777777777777777777777777";
const SUBMITTED_HASH = `0x${"ab".repeat(32)}`;

const createJar = vi.hoisted(() => ({ reset: vi.fn() }));

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
    mutate: vi.fn(),
    reset: createJar.reset,
    isPending: false,
    error: null,
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
});

describe("CampaignCookieJarCreateWorkspace", () => {
  it("shows the submitted transaction until the steward supplies the created jar's address", () => {
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialSubmittedHash={SUBMITTED_HASH} />
    );

    expect(screen.getByText("Creation submitted")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Created jar address"), { target: { value: JAR } });
    fireEvent.click(screen.getByRole("button", { name: "Use jar address" }));

    expect(screen.getByText("Cookie jar created")).toBeInTheDocument();
    expect(screen.getAllByText(JAR).length).toBeGreaterThan(0);
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

  it("returns to the cookie jar list once the jar exists", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={onClose} initialCreatedJarAddress={JAR} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to Cookie Jars" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
