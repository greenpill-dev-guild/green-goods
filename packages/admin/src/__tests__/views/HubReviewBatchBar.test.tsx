import { describe, expect, it, vi } from "vitest";
import { HubReviewBatchBar } from "@/views/Hub/components/HubReviewBatchBar";
import { fireEvent, renderWithProviders, screen } from "../test-utils";

const review = (note: object = {}) => ({ draft: {} as never, ...note });

const batch = (state: Partial<Parameters<typeof HubReviewBatchBar>[0]["batch"]> = {}) => ({
  approvals: 2,
  rejections: 1,
  signatures: 1,
  signatureStep: 1,
  sendSize: 0,
  blockedCount: 0,
  reviews: [review(), review(), review()],
  isSending: false,
  send: vi.fn(async () => {}),
  unstageBlocked: vi.fn(),
  ...state,
});

describe("HubReviewBatchBar", () => {
  it("isn't there with nothing to send", () => {
    renderWithProviders(<HubReviewBatchBar batch={batch({ approvals: 0, rejections: 0 })} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("says what goes and how many signatures it takes before anyone presses", () => {
    const props = batch();
    renderWithProviders(<HubReviewBatchBar batch={props} gardenName="Rio Lab" />);

    expect(screen.getByText("2 approvals, 1 rejection")).toBeInTheDocument();
    expect(screen.getByText("Rio Lab · 1 signature")).toBeInTheDocument();
    expect(props.send).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send 3" }));
    expect(props.send).toHaveBeenCalledOnce();
  });

  it("names only the side that has any", () => {
    renderWithProviders(<HubReviewBatchBar batch={batch({ approvals: 0, rejections: 1 })} />);

    expect(screen.getByText("1 rejection")).toBeInTheDocument();
    expect(screen.queryByText(/approval/)).not.toBeInTheDocument();
  });

  it("shows which signature a send is on, and won't start another", () => {
    const props = batch({ isSending: true, signatureStep: 2, sendSize: 3 });
    renderWithProviders(<HubReviewBatchBar batch={props} />);

    expect(screen.getByText("Signature 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Send 3/ }));
    expect(props.send).not.toHaveBeenCalled();
  });

  it("says a refused review stops the list, and offers to take it out", () => {
    const props = batch({
      blockedCount: 1,
      reviews: [review({ refusal: "This action has ended." }), review(), review()],
    });
    renderWithProviders(<HubReviewBatchBar batch={props} />);

    expect(screen.getByText(/1 review can’t be sent, so nothing has gone out/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take Out" }));
    expect(props.unstageBlocked).toHaveBeenCalledOnce();
  });

  it("says when the list costs too much to send together", () => {
    renderWithProviders(
      <HubReviewBatchBar
        batch={batch({ blockedCount: 3, reviews: [review({ notBatchable: true })] })}
      />
    );

    expect(screen.getByText(/cost too much to send together/)).toBeInTheDocument();
  });
});
