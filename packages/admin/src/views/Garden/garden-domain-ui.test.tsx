import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../../../shared/src/i18n/en.json";
import { GardenDomainSummaryRow } from "./components/GardenDetailHelpers";
import { SubmitWorkPanel } from "./SubmitWork";

const gardenAddress = "0xAbCdEf1234567890aBcDeF1234567890aBcDeF12";

const { mockCanManageGarden } = vi.hoisted(() => ({
  mockCanManageGarden: vi.fn(() => true),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();

  return {
    ...actual,
    useAdminGardenWorkspaceSelection: () => ({
      selectedGarden: {
        id: gardenAddress,
        tokenAddress: gardenAddress,
        name: "No Domain Garden",
      },
    }),
    useGardens: () => ({
      data: [
        {
          id: gardenAddress,
          name: "No Domain Garden",
          domainMask: 0,
        },
      ],
    }),
    useActions: () => ({ data: [] }),
    useAuthState: () => ({ isAuthenticated: true }),
    useGardenPermissions: () => ({ canManageGarden: mockCanManageGarden }),
    useBeforeUnloadWhilePending: () => undefined,
  };
});

function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={enMessages}>
        {children}
      </IntlProvider>
    </QueryClientProvider>
  );
}

describe("garden domain recovery UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanManageGarden.mockReturnValue(true);
  });

  it("shows the empty-domain affordance and edit CTA for managers", () => {
    const onEditDomains = vi.fn();

    render(
      <TestProviders>
        <GardenDomainSummaryRow domainMask={0} canManage onEditDomains={onEditDomains} />
      </TestProviders>
    );

    expect(screen.getByText("No domains configured")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit domains" })).toBeVisible();
  });

  it("keeps the empty-domain label visible for read-only users", () => {
    render(
      <TestProviders>
        <GardenDomainSummaryRow domainMask={0} canManage={false} />
      </TestProviders>
    );

    expect(screen.getByText("No domains configured")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit domains" })).not.toBeInTheDocument();
  });

  it("routes Submit Work's empty domain state back to garden settings", async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MemoryRouter initialEntries={["/hub/work/submit"]}>
          <Routes>
            <Route path="/hub/work/submit" element={<SubmitWorkPanel layout="page" />} />
            <Route path="/garden/settings" element={<div>Garden settings route</div>} />
          </Routes>
        </MemoryRouter>
      </TestProviders>
    );

    expect(screen.getByText("No actions available for this garden's domains")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Configure domains" }));

    expect(screen.getByText("Garden settings route")).toBeVisible();
  });
});
