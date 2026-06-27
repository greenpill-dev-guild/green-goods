import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const actionId = "42161-42";

const {
  mockState,
  mockMutate,
  mockToastError,
  mockToastInfo,
  mockToastSuccess,
  mockUseWorkMutation,
  mockValidationFormError,
  mockImageCompressor,
} = vi.hoisted(() => ({
  mockState: {
    actions: [] as Action[],
    actionsLoading: false,
    selectedGarden: null as { id: string; tokenAddress: string; name: string } | null,
    workMutationOptions: null as null | Record<string, unknown>,
  },
  mockMutate: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUseWorkMutation: vi.fn(),
  mockValidationFormError: vi.fn(),
  mockImageCompressor: {
    shouldCompress: vi.fn(() => false),
    compressImages: vi.fn(
      async (files: File[], _options: unknown, onProgress?: (progress: number) => void) => {
        onProgress?.(100);
        return files.map((file) => ({
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 0,
        }));
      }
    ),
  },
}));

const heicToMocks = vi.hoisted(() => ({
  heicTo: vi.fn(),
  isHeic: vi.fn(),
}));

vi.mock("heic-to/csp", () => heicToMocks);

vi.mock("@green-goods/shared/modules", () => ({
  validateWorkSubmissionContext: (
    gardenAddress: string | null,
    actionUID: number | null,
    images: File[],
    options?: { minRequired?: number }
  ) => {
    if (!gardenAddress) return ["Garden must be selected before submitting work"];
    if (actionUID === null) return ["Action must be selected before submitting work"];
    const minRequired = options?.minRequired ?? 0;
    if (images.length < minRequired) {
      return [
        minRequired === 1
          ? "At least one image is required"
          : `At least ${minRequired} images are required`,
      ];
    }
    return [];
  },
}));

vi.mock("@green-goods/shared", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const { useForm } = await vi.importActual<typeof import("react-hook-form")>("react-hook-form");

  const Card = Object.assign(
    ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "card" }, children),
    {
      Body: ({ children }: { children: React.ReactNode }) =>
        React.createElement("div", null, children),
      Footer: ({ children, className }: { children: React.ReactNode; className?: string }) =>
        React.createElement("div", { className }, children),
    }
  );

  return {
    Alert: ({
      children,
      action,
      variant,
    }: {
      children: React.ReactNode;
      action?: React.ReactNode;
      variant?: string;
    }) =>
      React.createElement(
        "div",
        { role: variant === "error" ? "alert" : "status" },
        children,
        action
      ),
    adminRoutes: {
      gardenSettings: () => "/garden/settings",
      hub: () => "/hub",
    },
    Card,
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
    Capital: {
      SOCIAL: 0,
      MATERIAL: 1,
      FINANCIAL: 2,
      LIVING: 3,
      INTELLECTUAL: 4,
      EXPERIENTIAL: 5,
      SPIRITUAL: 6,
      CULTURAL: 7,
    },
    expandDomainMask: (mask: number) => {
      const domains: number[] = [];
      if (mask & 1) domains.push(0);
      if (mask & 2) domains.push(1);
      if (mask & 4) domains.push(2);
      if (mask & 8) domains.push(3);
      return domains;
    },
    FileUploadField: ({
      onFilesChange,
      currentFiles = [],
      onRemoveFile,
      disabled,
      label,
      helpText,
      accept,
      multiple,
    }: {
      onFilesChange: (files: File[]) => void;
      currentFiles?: File[];
      onRemoveFile?: (index: number) => void;
      disabled?: boolean;
      label?: string;
      helpText?: string;
      accept?: string;
      multiple?: boolean;
    }) =>
      React.createElement(
        "div",
        null,
        label ? React.createElement("label", null, label) : null,
        helpText ? React.createElement("p", null, helpText) : null,
        React.createElement("input", {
          type: "file",
          accept,
          multiple,
          disabled,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            onFilesChange(Array.from(event.target.files ?? []));
          },
        }),
        currentFiles.map((file, index) =>
          React.createElement(
            "button",
            {
              key: `${file.name}-${index}`,
              type: "button",
              onClick: () => onRemoveFile?.(index),
            },
            file.name
          )
        )
      ),
    findActionByUID: (actions: Action[], uid: number | null) =>
      uid === null
        ? null
        : (actions.find((action) => Number(action.id.split("-").pop()) === uid) ?? null),
    FormField: ({
      children,
      label,
      htmlFor,
      error,
      required,
    }: {
      children: React.ReactNode;
      label?: string;
      htmlFor?: string;
      error?: string;
      required?: boolean;
    }) =>
      React.createElement(
        "div",
        null,
        label ? React.createElement("label", { htmlFor }, `${label}${required ? " *" : ""}`) : null,
        children,
        error ? React.createElement("p", null, error) : null
      ),
    getActionTitle: (actions: Action[], uid: number | null, fallback = "Unknown Action") =>
      uid === null
        ? fallback
        : (actions.find((action) => Number(action.id.split("-").pop()) === uid)?.title ?? fallback),
    imageCompressor: mockImageCompressor,
    isOfflineTxHash: (txHash: string) => txHash.startsWith("0xoffline_"),
    logger: {
      error: vi.fn(),
    },
    NativeSelect: ({
      invalid: _invalid,
      surface: _surface,
      ...props
    }: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; surface?: string }) =>
      React.createElement("select", props),
    normalizeWorkMediaFiles: async (files: File[]) => {
      const accepted = [];
      const rejected = [];
      const converted = [];
      for (const file of files) {
        if (file.type === "text/plain") {
          rejected.push({
            file,
            reason: "unsupported",
            metadata: {},
          });
          continue;
        }
        if (file.type === "image/heic" || file.name.endsWith(".heic")) {
          const isHeic = await heicToMocks.isHeic(file);
          if (!isHeic) {
            rejected.push({ file, reason: "unsupported", metadata: {} });
            continue;
          }
          const blob = await heicToMocks.heicTo({
            blob: file,
            type: "image/jpeg",
            quality: 0.85,
          });
          const convertedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
          accepted.push({
            file: convertedFile,
            originalFile: file,
            converted: true,
            metadata: {},
          });
          converted.push({ originalFile: file, file: convertedFile, metadata: {} });
          continue;
        }
        accepted.push({ file, originalFile: file, converted: false, metadata: {} });
      }
      return { accepted, rejected, converted };
    },
    parseActionUID: (compositeId: string | undefined | null) => {
      if (!compositeId) return null;
      const uid = Number(String(compositeId).split("-").pop());
      return Number.isFinite(uid) ? uid : null;
    },
    SheetBody: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    SheetFooter: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    Surface: ({
      children,
      as: As = "div",
      className,
      "data-region": dataRegion,
      "aria-labelledby": ariaLabelledby,
    }: {
      children?: React.ReactNode;
      as?: React.ElementType;
      className?: string;
      "data-region"?: string;
      "aria-labelledby"?: string;
    }) =>
      React.createElement(
        As,
        { className, "data-region": dataRegion, "aria-labelledby": ariaLabelledby },
        children
      ),
    Textarea: ({
      invalid: _invalid,
      surface: _surface,
      ...props
    }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
      invalid?: boolean;
      surface?: string;
    }) => React.createElement("textarea", props),
    TxInlineFeedback: ({
      visible,
      title,
      message,
      action,
    }: {
      visible: boolean;
      title: string;
      message: string;
      action?: React.ReactNode;
    }) => (visible ? React.createElement("div", { role: "alert" }, title, message, action) : null),
    useMediaQuery: () => true,
    useWorkMutation: mockUseWorkMutation,
    toastService: {
      error: mockToastError,
      info: mockToastInfo,
      success: mockToastSuccess,
    },
    validationToasts: {
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
      isLoading: mockState.actionsLoading,
    }),
    useAuthState: () => ({ isAuthenticated: true, authMode: "wallet" }),
    useUser: () => ({ authMode: "wallet", primaryAddress: gardenAddress }),
    useGardenPermissions: () => ({ canManageGarden: () => true }),
    useBeforeUnloadWhilePending: () => undefined,
    useWorkForm: () =>
      useForm<Record<string, unknown>>({
        mode: "onChange",
        defaultValues: {},
      }),
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

// A single eligible action auto-selects into the Capture step, so the chooser is
// skipped entirely — fill the required field directly.
async function selectActionAndFillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/Plot code/), "Plot A");
}

function uploadFile(container: HTMLElement, fileName = "before.png", type = "image/png") {
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  const file = new File(["photo"], fileName, { type });
  fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
  return file;
}

function setNavigatorOnline(isOnline: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => isOnline,
  });
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
    setNavigatorOnline(true);
    mockState.selectedGarden = {
      id: gardenAddress,
      tokenAddress: gardenAddress,
      name: "Green Goods Community Garden",
    };
    mockState.actions = [createAction()];
    mockState.actionsLoading = false;
    mockState.workMutationOptions = null;
    mockUseWorkMutation.mockImplementation((options) => {
      mockState.workMutationOptions = options;
      return {
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
        reset: vi.fn(),
      };
    });
    heicToMocks.isHeic.mockResolvedValue(false);
    heicToMocks.heicTo.mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
    mockImageCompressor.shouldCompress.mockReturnValue(false);
    mockImageCompressor.compressImages.mockImplementation(
      async (files: File[], _options: unknown, onProgress?: (progress: number) => void) => {
        onProgress?.(100);
        return files.map((file) => ({
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 0,
        }));
      }
    );
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
    expect(mockMutate).not.toHaveBeenCalled();
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
    expect(mockMutate).not.toHaveBeenCalled();
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
    expect(mockMutate).not.toHaveBeenCalled();
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
      expect(mockMutate).toHaveBeenCalledWith({
        draft: expect.objectContaining({ media: [] }),
        images: [],
      });
    });
    expect(mockValidationFormError).not.toHaveBeenCalled();
    expect(mockUseWorkMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        authMode: "wallet",
        gardenAddress,
        actionUID: 42,
        userAddress: gardenAddress,
        completeClientFlow: false,
        allowOfflineQueue: false,
      })
    );
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
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("submits through the shared mutation when required media is present", async () => {
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
      expect(mockMutate).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          actionUID: 42,
          details: expect.objectContaining({ plot: "Plot A" }),
          media: [file],
          title: "Site Assessment (Before)",
        }),
        images: [file],
      });
    });
  });

  it("compresses normalized media before submitting", async () => {
    const user = userEvent.setup();
    const compressedFile = new File(["compressed"], "large-compressed.jpg", {
      type: "image/jpeg",
    });
    mockImageCompressor.shouldCompress.mockReturnValue(true);
    mockImageCompressor.compressImages.mockResolvedValue([
      {
        file: compressedFile,
        originalSize: 12 * 1024 * 1024,
        compressedSize: compressedFile.size,
        compressionRatio: 99,
      },
    ]);

    const { container } = render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    const rawFile = uploadFile(container, "large.png", "image/png");

    await waitFor(() => {
      expect(mockImageCompressor.compressImages).toHaveBeenCalledWith(
        [rawFile],
        expect.objectContaining({
          maxSizeMB: 0.8,
          maxWidthOrHeight: 2048,
          initialQuality: 0.8,
          useWebWorker: true,
        }),
        expect.any(Function)
      );
    });

    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          media: [compressedFile],
        }),
        images: [compressedFile],
      });
    });
  });

  it("normalizes HEIC media before submitting", async () => {
    heicToMocks.isHeic.mockResolvedValue(true);
    const user = userEvent.setup();

    const { container } = render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    uploadFile(container, "garden.heic", "image/heic");

    await waitFor(() => {
      expect(heicToMocks.heicTo).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          media: [expect.objectContaining({ name: "garden.jpg", type: "image/jpeg" })],
        }),
        images: [expect.objectContaining({ name: "garden.jpg", type: "image/jpeg" })],
      });
    });
  });

  it("blocks action switches and cancel while media is preparing", async () => {
    mockState.actions = [
      createAction(),
      {
        ...createAction(),
        id: "42161-43",
        slug: "agro.site_assessment_after",
        title: "Site Assessment (After)",
      },
    ];
    const user = userEvent.setup();
    const compressedFile = new File(["compressed"], "large-compressed.jpg", {
      type: "image/jpeg",
    });
    const compression =
      createDeferred<
        Array<{
          file: File;
          originalSize: number;
          compressedSize: number;
          compressionRatio: number;
        }>
      >();
    mockImageCompressor.shouldCompress.mockReturnValue(true);
    mockImageCompressor.compressImages.mockImplementation(
      async (_files: File[], _options: unknown, onProgress?: (progress: number) => void) => {
        onProgress?.(20);
        return compression.promise;
      }
    );

    const { container } = render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    // Two eligible actions → the chooser is shown; pick one to enter Capture.
    await user.click(screen.getByRole("radio", { name: /Site Assessment \(Before\)/ }));
    await user.type(await screen.findByLabelText(/Plot code/), "Plot A");
    uploadFile(container, "large.png", "image/png");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Change action" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Submit Work" })).toBeDisabled();
    });

    act(() => {
      compression.resolve([
        {
          file: compressedFile,
          originalSize: 12 * 1024 * 1024,
          compressedSize: compressedFile.size,
          compressionRatio: 99,
        },
      ]);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Change action" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
    });
  });

  it("rejects unsupported media before the shared mutation is called", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    uploadFile(container, "notes.txt", "text/plain");

    expect(
      await screen.findByText("That file is not a supported photo or video.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockValidationFormError).toHaveBeenCalledWith("At least one image is required");
    });
    expect(mockToastInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Some files were not added",
      })
    );
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("does not report success when the shared mutation returns an offline queue hash", async () => {
    const onSuccess = vi.fn();

    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" onSuccess={onSuccess} />
      </TestProviders>
    );

    act(() => {
      const handleSuccess = mockState.workMutationOptions?.onSuccess as
        | ((txHash: string) => void)
        | undefined;
      handleSuccess?.("0xoffline_stranded");
    });

    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Work was not submitted",
        message: "Reconnect and submit again from admin so the transaction can be confirmed.",
        context: "admin work submission",
      })
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("blocks offline admin submissions instead of queuing them", async () => {
    mockState.actions = [createAction({ required: false, minImageCount: 0 })];
    setNavigatorOnline(false);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    await selectActionAndFillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Submit Work" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "You're offline",
          message: "Reconnect to the internet before submitting work.",
          context: "admin work submission",
        })
      );
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("maps shared submission progress into the admin footer status", async () => {
    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    // Single eligible action auto-selects into Capture, surfacing the footer.
    await screen.findByLabelText(/Plot code/);

    act(() => {
      const onProgress = mockState.workMutationOptions?.onProgress as
        | ((stage: string, message: string) => void)
        | undefined;
      onProgress?.("uploading", "Uploading media to IPFS...");
    });

    expect(screen.getByText("Uploading media...")).toBeInTheDocument();

    act(() => {
      const onSettled = mockState.workMutationOptions?.onSettled as (() => void) | undefined;
      onSettled?.();
    });

    expect(screen.queryByText("Uploading media...")).not.toBeInTheDocument();
  });

  it("auto-selects the only eligible action and lands in the Capture step", async () => {
    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    // Single action → no chooser, no "Change action", straight to the form.
    expect(await screen.findByLabelText(/Plot code/)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change action" })).not.toBeInTheDocument();
  });

  it("shows the action chooser when multiple actions are eligible", async () => {
    mockState.actions = [
      createAction(),
      {
        ...createAction(),
        id: "42161-43",
        slug: "agro.site_assessment_after",
        title: "Site Assessment (After)",
      },
    ];
    const user = userEvent.setup();

    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByLabelText(/Plot code/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Site Assessment \(After\)/ }));

    expect(await screen.findByLabelText(/Plot code/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change action" })).toBeInTheDocument();
  });

  it("shows a loading state instead of the empty state while actions load", async () => {
    mockState.actions = [];
    mockState.actionsLoading = true;

    render(
      <TestProviders>
        <SubmitWorkPanel layout="page" />
      </TestProviders>
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByText("No actions available for this garden's domains")
    ).not.toBeInTheDocument();
  });
});
