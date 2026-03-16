import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("@green-goods/shared", () => ({
  Confidence: {
    NONE: "NONE",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
  },
  DEFAULT_CHAIN_ID: 11155111,
  VerificationMethod: {
    HUMAN: "HUMAN",
  },
  debugWarn: vi.fn(),
  downloadWorkData: vi.fn(),
  downloadWorkMedia: vi.fn(),
  getJsonByHash: vi.fn(),
  isAddressInList: vi.fn(() => false),
  isUserAddress: vi.fn(() => false),
  isValidAttestationId: vi.fn(() => false),
  jobQueue: { processJob: vi.fn() },
  openEASExplorer: vi.fn(),
  queryKeys: {
    workApprovals: { all: ["workApprovals"] },
    works: {
      merged: () => ["works", "merged"],
      online: () => ["works", "online"],
    },
  },
  shareWork: vi.fn(),
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
  useActions: () => ({ data: [] }),
  useAsyncEffect: vi.fn(),
  useGardens: () => ({ data: [] }),
  useHasRole: () => ({ hasRole: false }),
  useJobQueueEvents: vi.fn(),
  useNavigateToTop: () => mockNavigate,
  useTimeout: () => ({
    set: (fn: () => void) => fn,
  }),
  useUser: () => ({ user: null, smartAccountClient: null }),
  useWorkApproval: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useWorks: () => ({ works: [] }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/components/Features/Work", () => ({
  WorkViewSkeleton: () => createElement("div", null, "Skeleton"),
}));

vi.mock("@/components/Navigation", () => ({
  TopNav: ({ onBackClick }: { onBackClick?: () => void }) =>
    createElement(
      "button",
      { type: "button", onClick: onBackClick, "data-testid": "work-back" },
      "Back"
    ),
}));

vi.mock("../../views/Home/Garden/WorkViewSection", () => ({
  WorkViewSection: () => null,
}));

import { GardenWork } from "../../views/Home/Garden/Work";

describe("Home garden work detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to the route garden id when back navigation state is missing", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/garden-1/work/work-1"] },
        createElement(
          IntlProvider,
          { locale: "en", messages: {} },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/home/:id/work/:workId",
              element: createElement(GardenWork),
            })
          )
        )
      )
    );

    fireEvent.click(screen.getByTestId("work-back"));

    expect(mockNavigate).toHaveBeenCalledWith("/home/garden-1");
  });
});
