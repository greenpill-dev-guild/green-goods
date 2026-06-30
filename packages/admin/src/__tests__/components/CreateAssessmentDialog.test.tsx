/**
 * @vitest-environment jsdom
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID, queryKeys, useAdminStore, type Garden } from "@green-goods/shared";
import { createTestQueryClient } from "@green-goods/shared/testing";
import CreateAssessment from "@/views/Hub/CreateAssessment";

const OPERATOR = "0x9999999999999999999999999999999999999999";

const SELECTED_GARDEN: Garden = {
  id: "0x1111111111111111111111111111111111111111",
  chainId: DEFAULT_CHAIN_ID,
  tokenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  tokenID: 1n,
  name: "Role-Proven Garden",
  description: "",
  location: "",
  bannerImage: "",
  gardeners: [],
  operators: [OPERATOR],
  owners: [],
  evaluators: [],
  funders: [],
  communities: [],
  openJoining: false,
  domainMask: 1,
  assessments: [],
  works: [],
  createdAt: 1,
};

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: OPERATOR }),
  useReadContract: () => ({ data: 1 }),
  useWalletClient: () => ({ data: undefined }),
}));

function renderCreateAssessment() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), []);
  const router = createMemoryRouter(
    [{ path: "/hub/assess/create", element: <CreateAssessment /> }],
    {
      initialEntries: [`/hub/assess/create?gardenAddress=${SELECTED_GARDEN.tokenAddress}`],
    }
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <RouterProvider router={router} />
      </IntlProvider>
    </QueryClientProvider>
  );
}

describe("CreateAssessment dialog", () => {
  beforeEach(() => {
    useAdminStore.setState({
      selectedChainId: DEFAULT_CHAIN_ID,
      selectedGarden: SELECTED_GARDEN,
      lastGardenIdsByScope: {},
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    useAdminStore.setState({ selectedGarden: null, lastGardenIdsByScope: {} });
    cleanup();
  });

  it("opens the assessment form from the selected garden when the base garden list is stale", async () => {
    await act(async () => {
      renderCreateAssessment();
      await Promise.resolve();
    });

    expect(await screen.findByRole("heading", { name: "Domain & Context" })).toBeInTheDocument();
    expect(screen.getByText("Role-Proven Garden")).toBeInTheDocument();
    expect(screen.queryByText("app.garden.admin.notFound")).not.toBeInTheDocument();
  });
});
