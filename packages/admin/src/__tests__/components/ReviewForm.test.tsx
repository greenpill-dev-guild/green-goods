/**
 * @vitest-environment jsdom
 */

import type { Address } from "@green-goods/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewForm } from "@/views/Garden/WorkDetail/ReviewForm";

const mockApprovalMutation = {
  mutateAsync: vi.fn(),
};
const mockPrimaryAddress = vi.fn();
const mockParseAndFormatError = vi.fn();
const mockToastError = vi.fn();

vi.mock("@green-goods/shared", () => ({
  AudioRecorder: () => <div data-testid="audio-recorder" />,
  compareAddresses: (a?: Address, b?: Address) => a?.toLowerCase() === b?.toLowerCase(),
  Confidence: {
    NONE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
  },
  ConfidenceSelector: ({ onChange }: { value: number; onChange: (value: number) => void }) => (
    <button type="button" onClick={() => onChange(2)}>
      Set medium confidence
    </button>
  ),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  VerificationMethod: {
    HUMAN: 1,
    IOT: 2,
    ONCHAIN: 4,
    AGENT: 8,
  },
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
  formatAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
  logger: {
    error: vi.fn(),
  },
  parseAndFormatError: (...args: unknown[]) => mockParseAndFormatError(...args),
  Textarea: ({
    surface: _surface,
    ...props
  }: React.ComponentProps<"textarea"> & { surface?: string }) => <textarea {...props} />,
  toastService: {
    error: mockToastError,
  },
  uploadFileToIPFS: vi.fn(),
  uploadJSONToIPFS: vi.fn(),
  useEnsName: () => ({ data: undefined }),
  usePrimaryAddress: () => mockPrimaryAddress(),
  useWorkApproval: () => mockApprovalMutation,
}));

const messages = {
  "app.common.optional": "optional",
  "app.errors.contract.selfAttestation.action":
    "Ask another garden operator to approve or reject this work",
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
  "app.work.detail.operatorReview": "Operator Review",
  "app.work.detail.reject": "Reject",
  "app.work.detail.rejecting": "Rejecting...",
  "app.work.detail.requiredForApproval": "required for approval",
  "app.toast.approval.errorDecision.title": "Decision failed",
  "app.work.detail.reviewBlocked.expiredMessage":
    "This action is no longer active, so new approval decisions are blocked.",
  "app.work.detail.reviewBlocked.expiredTitle": "Action expired",
  "app.work.detail.reviewBlocked.operatorMessage":
    "Only garden owners or operators can approve or reject work for this garden.",
  "app.work.detail.reviewBlocked.operatorTitle": "Owner or operator access required",
  "app.work.detail.reviewBlocked.selfReviewMessage":
    "You submitted this work. Another garden operator must approve or reject it.",
  "app.work.detail.reviewBlocked.selfReviewTitle": "Independent review required",
  "app.work.detail.reviewSummary": "Review Summary",
  "app.work.detail.verificationMethods": "Verification methods",
};

const TEST_WORK = {
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
} as const;

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

  it("keeps verification method implicit for human operator reviews", async () => {
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
        "You cannot review your own work submission. Ask another garden operator to approve or reject this work",
      parsed: {
        isKnown: true,
        message: "You cannot review your own work submission",
        action: "Ask another garden operator to approve or reject this work",
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
          "You cannot review your own work submission. Ask another garden operator to approve or reject this work",
      });
    });
  });

  it("blocks an operator from reviewing their own submission", () => {
    mockPrimaryAddress.mockReturnValue(TEST_WORK.gardenerAddress);

    renderReviewForm();

    expect(screen.getByText("Independent review required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(mockApprovalMutation.mutateAsync).not.toHaveBeenCalled();
  });
});
