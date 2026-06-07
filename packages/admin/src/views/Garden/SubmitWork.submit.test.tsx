import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Action } from "../../../../shared/src/types/domain";
import enMessages from "../../../../shared/src/i18n/en.json";
import { Domain } from "../../../../shared/src/types/domain";
import { SubmitWorkPanel } from "./SubmitWork";

const gardenAddress = "0xAbCdEf1234567890aBcDeF1234567890aBcDeF12";
const chainId = 42161;
const actionId = `${chainId}-42`;

const {
  mockState,
  mockSubmitWorkDirectly,
  mockToastError,
  mockToastSuccess,
  mockValidationFormError,
} = vi.hoisted(() => ({
  mockState: {
    actions: [] as Action[],
    selectedGarden: null as { id: string; tokenAddress: string; name: string } | null,
  },
  mockSubmitWorkDirectly: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockValidationFormError: vi.fn(),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();

  return {
    ...actual,
    submitWorkDirectly: mockSubmitWorkDirectly,
    toastService: {
      ...actual.toastService,
      error: mockToastError,
      success: mockToastSuccess,
    },
    validationToasts: {
      ...actual.validationToasts,
      formError: mockValidationFormError,
    },
    useAdminGardenWorkspaceSelection: () => ({
      selectedGarden: mockState.selectedGarden,
    }),
    useGardens: () => ({
      data: [
        {
          id: gardenAddress,
          name: "Green Goods Community Garden",
          domainMask: 1 << Domain.AGRO,
        },
      ],
    }),
    useActions: () => ({
      data: mockState.actions,
    }),
    useAuthState: () => ({ isAuthenticated: true }),
    useGardenPermissions: () => ({ canManageGarden: () => true }),
    useBeforeUnloadWhilePending: () => undefined,
  };
});

function createAction(mediaInfo: Action["mediaInfo"] = {}): Action {
  return {
    id: actionId,
    slug: "agro.site_assessment_before",
    title: "Site Assessment (Before)",
    startTime: 0,
    endTime: 0,
    instructions: "Document site condition before work.",
    capitals: [],
    media: [],
    domain: Domain.AGRO,
    createdAt: 0,
    description: "Before assessment",
    inputs: [
      {
        key: "plot",
        title: "Plot code",
        placeholder: "Plot A",
        type: "text",
        required: true,
        options: [],
      },
    ],
    mediaInfo: {
      title: "Before photos",
      required: true,
      minImageCount: 1,
      maxImageCount: 3,
      ...mediaInfo,
    },
  };
}

async function selectActionAndFillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/Action/), actionId);
  await user.type(screen.getByLabelText(/Plot code/), "Plot A");
}

function uploadFile(container: HTMLElement, fileName = "before.png") {
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  const file = new File(["photo"], fileName, { type: "image/png" });
  fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
  return file;
}

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
        <MemoryRouter initialEntries={["/hub/work/submit"]}>{children}</MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>
  );
}

describe("SubmitWorkPanel submit behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.selectedGarden = {
      id: gardenAddress,
      tokenAddress: gardenAddress,
      name: "Green Goods Community Garden",
    };
    mockState.actions = [createAction()];
    mockSubmitWorkDirectly.mockResolvedValue("0x123");
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("renders a safe missing-garden state without a submit surface", async () => {
    mockState.selectedGarden = null;

    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    expect(await screen.findByText("Garden not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Work" })).not.toBeInTheDocument();
    expect(mockSubmitWorkDirectly).not.toHaveBeenCalled();
  });

  it("blocks required-media actions before opening the wallet", async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockValidationFormError).toHaveBeenCalledWith("At least one image is required");
    });
    expect(mockSubmitWorkDirectly).not.toHaveBeenCalled();
  });

  it("treats required media with no minImageCount as requiring one image", async () => {
    mockState.actions = [createAction({ required: true, minImageCount: undefined })];
    const user = userEvent.setup();

    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockValidationFormError).toHaveBeenCalledWith("At least one image is required");
    });
    expect(mockSubmitWorkDirectly).not.toHaveBeenCalled();
  });

  it("allows optional media actions with minImageCount 0 to submit without images", async () => {
    mockState.actions = [createAction({ required: false, minImageCount: 0 })];
    const user = userEvent.setup();

    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockSubmitWorkDirectly).toHaveBeenCalledWith(
        expect.objectContaining({ media: [] }),
        gardenAddress,
        42,
        "Site Assessment (Before)",
        chainId,
        [],
        expect.any(Object)
      );
    });
    expect(mockValidationFormError).not.toHaveBeenCalled();
  });

  it("blocks required-media actions until the configured minImageCount is met", async () => {
    mockState.actions = [createAction({ required: true, minImageCount: 2 })];
    const user = userEvent.setup();

    const { container } = render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    uploadFile(container);
    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockValidationFormError).toHaveBeenCalledWith("At least 2 images are required");
    });
    expect(mockSubmitWorkDirectly).not.toHaveBeenCalled();
  });

  it("submits when required media is present", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    const file = uploadFile(container);

    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockSubmitWorkDirectly).toHaveBeenCalledWith(
        expect.objectContaining({
          actionUID: 42,
          details: expect.objectContaining({ plot: "Plot A" }),
          media: [file],
          title: "Site Assessment (Before)",
        }),
        gardenAddress,
        42,
        "Site Assessment (Before)",
        chainId,
        [file],
        expect.any(Object)
      );
    });
  });

  it("shows reconnect guidance when a wrapped wallet session error is available", async () => {
    mockSubmitWorkDirectly.mockRejectedValue(
      new Error("Transaction failed", { cause: new Error("Connector not connected") })
    );

    const user = userEvent.setup();

    const { container } = render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    uploadFile(container);

    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "Wallet session unavailable. Disconnect and reconnect your wallet, then try again.",
        })
      );
    });
  });
});
