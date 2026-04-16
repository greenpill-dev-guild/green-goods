/**
 * GardensList Component Tests
 *
 * Tests the profile gardens list: loading, empty, member/non-member gardens,
 * join flow, and null address handling.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track mock state
const mockGardensState = {
  data: [] as any[],
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
};
const mockJoinState = {
  joinGarden: vi.fn(),
  isJoining: false,
  joiningGardenId: null as string | null,
};
const mockNavigate = vi.fn();

// Mock @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  ConfirmDialog: ({
    isOpen,
    onClose,
    onConfirm,
    title,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
  }) =>
    isOpen
      ? createElement(
          "div",
          { "data-testid": "join-dialog" },
          createElement("span", null, title),
          createElement("button", { "data-testid": "confirm-join", onClick: onConfirm }, "Confirm"),
          createElement("button", { "data-testid": "cancel-join", onClick: onClose }, "Cancel")
        )
      : null,
  createPublicClientForChain: () => ({
    estimateContractGas: vi.fn().mockResolvedValue(BigInt(100000)),
  }),
  DEFAULT_CHAIN_ID: 11155111,
  debugError: vi.fn(),
  GardenAccountABI: [],
  getDefaultChain: () => ({ chainId: 11155111 }),
  hapticLight: vi.fn(),
  hapticSuccess: vi.fn(),
  isAlreadyGardenerError: () => false,
  isGardenMember: (address: string, gardeners: string[], _operators: string[], _id: string) =>
    gardeners.includes(address),
  parseAndFormatError: () => ({ title: "Error", message: "Something went wrong" }),
  queryKeys: { gardens: { all: ["gardens"] } },
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  useGardens: () => mockGardensState,
  useJoinGarden: () => mockJoinState,
  useTimeout: () => ({ set: vi.fn(), clear: vi.fn(), isPending: false }),
}));

// Mock @tanstack/react-query
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

// Mock react-router-dom navigate
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock @remixicon/react
vi.mock("@remixicon/react", () => ({
  RiCheckLine: (props: any) => createElement("span", props),
  RiMapPinLine: (props: any) => createElement("span", props),
  RiPlantLine: (props: any) => createElement("span", props),
  RiRefreshLine: (props: any) => createElement("span", props),
}));

// Mock client components
vi.mock("@/components/Actions", () => ({
  Button: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    mode?: string;
    size?: string;
    className?: string;
    leadingIcon?: React.ReactNode;
  }) => createElement("button", { onClick, disabled, "data-testid": `btn-${label}` }, label),
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "card" }, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

import { GardensList } from "../../views/Profile/GardensList";

const wrap = (el: React.ReactElement) =>
  createElement(
    MemoryRouter,
    null,
    createElement(IntlProvider, { locale: "en", messages: {} }, el)
  );

const MOCK_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

describe("GardensList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGardensState.data = [];
    mockGardensState.isLoading = false;
    mockGardensState.isFetching = false;
    mockJoinState.isJoining = false;
    mockJoinState.joiningGardenId = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("returns null when no primaryAddress", () => {
    const { container } = render(wrap(createElement(GardensList, { primaryAddress: undefined })));

    expect(container.innerHTML).toBe("");
  });

  it("shows loading state", () => {
    mockGardensState.isLoading = true;

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText(/loading gardens/i)).toBeInTheDocument();
  });

  it("shows empty state when no gardens available", () => {
    mockGardensState.data = [];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText(/no gardens yet/i)).toBeInTheDocument();
    expect(screen.getByText(/discover and join gardens/i)).toBeInTheDocument();
  });

  it("navigates to home when Open Gardens is clicked from empty state", async () => {
    mockGardensState.data = [];
    const user = userEvent.setup();

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    await user.click(screen.getByTestId("btn-Open Gardens"));
    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  it("shows member badge for gardens user belongs to", () => {
    mockGardensState.data = [
      {
        id: "0xgarden1",
        name: "My Garden",
        location: "Berlin",
        openJoining: true,
        gardeners: [MOCK_ADDRESS],
        operators: [],
      },
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText("My Garden")).toBeInTheDocument();
    expect(screen.getByText("Berlin")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("shows join button for open gardens user has not joined", () => {
    mockGardensState.data = [
      {
        id: "0xgarden2",
        name: "Open Garden",
        location: "",
        openJoining: true,
        gardeners: [],
        operators: [],
      },
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText("Open Garden")).toBeInTheDocument();
    expect(screen.getByTestId("btn-Join")).toBeInTheDocument();
    expect(screen.getByText(/join as a gardener/i)).toBeInTheDocument();
  });

  it("opens join dialog when Join is clicked", async () => {
    const user = userEvent.setup();
    mockGardensState.data = [
      {
        id: "0xgarden2",
        name: "Open Garden",
        location: "",
        openJoining: true,
        gardeners: [],
        operators: [],
      },
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    await user.click(screen.getByTestId("btn-Join"));
    expect(screen.getByTestId("join-dialog")).toBeInTheDocument();
    expect(screen.getByText("Join Garden")).toBeInTheDocument();
  });

  it("hides closed gardens where user is not a member", () => {
    mockGardensState.data = [
      {
        id: "0xgarden3",
        name: "Private Garden",
        location: "",
        openJoining: false,
        gardeners: [],
        operators: [],
      },
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.queryByText("Private Garden")).not.toBeInTheDocument();
    expect(screen.getByText(/no gardens yet/i)).toBeInTheDocument();
  });

  it("shows refresh button", () => {
    mockGardensState.data = [
      {
        id: "0xgarden1",
        name: "Test Garden",
        location: "",
        openJoining: true,
        gardeners: [MOCK_ADDRESS],
        operators: [],
      },
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByRole("button", { name: /refresh gardens/i })).toBeInTheDocument();
  });
});
