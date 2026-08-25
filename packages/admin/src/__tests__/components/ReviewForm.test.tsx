/**
 * @vitest-environment jsdom
 */

import type { Address, Work } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewForm } from "@/views/Garden/WorkDetail/ReviewForm";

const { mockApprovalMutation, mockPrimaryAddress, mockParseAndFormatError, mockToastError } =
  vi.hoisted(() => ({
    mockApprovalMutation: {
      mutateAsync: vi.fn(),
    },
    mockPrimaryAddress: vi.fn(),
    mockParseAndFormatError: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("@green-goods/shared/components/Audio/AudioRecorder", () => ({
  AudioRecorder: () => <div data-testid="audio-recorder" />,
}));

vi.mock("@green-goods/shared/components/ErrorBoundary/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@green-goods/shared/components/Form/ConfidenceSelector", () => ({
  ConfidenceSelector: ({ onChange }: { value: number; onChange: (value: number) => void }) => (
    <button type="button" onClick={() => onChange(2)}>
      Set medium confidence
    </button>
  ),
}));

vi.mock("@green-goods/shared/components/Form/ControlPrimitives", () => ({
  Textarea: ({
    surface: _surface,
    ...props
  }: React.ComponentProps<"textarea"> & { surface?: string }) => <textarea {...props} />,
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: {
    error: mockToastError,
  },
}));

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mockPrimaryAddress(),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: undefined }),
}));

vi.mock("@green-goods/shared/hooks/work/useWorkApproval", () => ({
  useWorkApproval: () => mockApprovalMutation,
}));

vi.mock("@green-goods/shared/modules/app/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared/modules/app/logger")>();
  return {
    ...actual,
    logger: {
      error: vi.fn(),
    },
  };
});

vi.mock("@green-goods/shared/modules/data/ipfs/upload", () => ({
  uploadFileToIPFS: vi.fn(),
  uploadJSONToIPFS: vi.fn(),
}));

vi.mock("@green-goods/shared/types/domain", () => ({
  Confidence: {
    NONE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
  },
  VerificationMethod: {
    HUMAN: 1,
    IOT: 2,
    ONCHAIN: 4,
    AGENT: 8,
  },
}));

vi.mock("@green-goods/shared/utils/app/text", () => ({
  formatAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
}));

vi.mock("@green-goods/shared/utils/blockchain/address", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/utils/blockchain/address")>();
  return {
    ...actual,
    compareAddresses: (a?: Address, b?: Address) => a?.toLowerCase() === b?.toLowerCase(),
  };
});

vi.mock("@green-goods/shared/utils/errors/contract-errors", () => ({
  parseAndFormatError: (...args: unknown[]) => mockParseAndFormatError(...args),
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

const messages = {
  "app.common.optional": "optional",
  "app.errors.contract.selfAttestation.action":
    "Ask another garden steward to approve or reject this work",
  "app.errors.contract.selfAttestation.message": "You cannot review your own work submission",
  "app.work.detail.approve": "Approve",
  "app.work.detail.approving": "Approving...",
  "app.work.detail.audioReviewNote": "Audio review note",
  "app.work.detail.cascade.heading": "Who this affects",
  "app.work.detail.cascade.notice":
    "{gardener} will see this decision. This counts toward {garden}'s impact record.",
  "app.work.detail.confidenceLevel": "Confidence level",
  "app.work.detail.feedback": "Feedback",
  "app.work.detail.feedbackPlaceholder": "Add feedback for the gardener...",
  "app.work.detail.hint.lowConfidence": "Select a confidence level to approve this work.",
  "app.work.detail.stewardReview": "Steward Review",
  "app.work.detail.reject": "Reject",
  "app.work.detail.rejecting": "Rejecting...",
  "app.work.detail.requiredForApproval": "required for approval",
  "app.toast.approval.errorDecision.title": "Decision failed",
  "app.work.detail.reviewBlocked.expiredMessage":
    "This action is no longer active, so new approval decisions are blocked.",
  "app.work.detail.reviewBlocked.expiredTitle": "Action expired",
  "app.work.detail.reviewBlocked.stewardMessage":
    "Only garden owners or stewards can approve or reject work for this garden.",
  "app.work.detail.reviewBlocked.stewardTitle": "Owner or steward access required",
  "app.work.detail.reviewBlocked.selfReviewMessage":
    "You submitted this work. Another garden steward must approve or reject it.",
  "app.work.detail.reviewBlocked.selfReviewTitle": "Independent review required",
  "app.work.detail.reviewSummary": "Review Summary",
  "app.work.detail.verificationMethods": "Verification methods",
};

const TEST_WORK: Work = {
  id: "0xWork",
  title: "Mulch beds",
  actionUID: 1,
  gardenerAddress: "0x1234567890abcdef1234567890abcdef12345678",
  gardenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  feedback: "",
  metadata: "{}",
  media: [],
  createdAt: 1_700_000_000,
  status: "pending",
};

function renderReviewForm(work = TEST_WORK) {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <ReviewForm
        work={work}
        gardenName="Demo Garden"
        canReview
        canApproveOrReject
        isReviewed={false}
      />
    </IntlProvider>
  );
}

describe("ReviewForm", () => {
  beforeEach(() => {
    mockApprovalMutation.mutateAsync.mockReset();
    mockApprovalMutation.mutateAsync.mockResolvedValue(undefined);
    mockParseAndFormatError.mockReset();
    mockParseAndFormatError.mockReturnValue({ message: "Failed", parsed: { isKnown: false } });
    mockToastError.mockReset();

    mockPrimaryAddress.mockReturnValue("0x9999999999999999999999999999999999999999");
  });

  it("keeps verification method implicit for huma steward reviews", async () => {
    renderReviewForm();

    expect(screen.queryByText("Verification methods")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Human verification" })).not.toBeInTheDocument();
    expect(screen.getByText("Confidence level")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Set medium confidence" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(mockApprovalMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            approved: true,
            verificationMethod: 1,
          }),
          work: TEST_WORK,
        })
      );
    });
  });

  it("localizes SelfAttestation errors before showing the review toast", async () => {
    mockApprovalMutation.mutateAsync.mockRejectedValue(new Error("SelfAttestation"));
    mockParseAndFormatError.mockReturnValue({
      message:
        "You cannot review your own work submission. Ask another garden steward to approve or reject this work",
      parsed: {
        isKnown: true,
        message: "You cannot review your own work submission",
        action: "Ask another garden steward to approve or reject this work",
        messageKey: "app.errors.contract.selfAttestation.message",
        actionKey: "app.errors.contract.selfAttestation.action",
      },
    });

    renderReviewForm();

    fireEvent.click(screen.getByRole("button", { name: "Set medium confidence" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith({
        title: "Decision failed",
        message:
          "You cannot review your own work submission. Ask another garden steward to approve or reject this work",
      });
    });
  });

  it("blocks a steward from reviewing their own submission", () => {
    mockPrimaryAddress.mockReturnValue(TEST_WORK.gardenerAddress);

    renderReviewForm();

    expect(screen.getByText("Independent review required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(mockApprovalMutation.mutateAsync).not.toHaveBeenCalled();
  });
});
