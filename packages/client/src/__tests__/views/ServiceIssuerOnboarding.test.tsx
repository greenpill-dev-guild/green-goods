import type { ServiceIssuerDraft } from "@green-goods/shared/commitment-pooling";
import { describe, expect, it, vi } from "vitest";
import { ServiceIssuerOnboarding } from "../../views/Profile/ServiceIssuerOnboarding";
import {
  ISSUER_STORY_ADDRESS,
  issuerStoryDraftRecord,
} from "../../views/Profile/serviceIssuerStoryFixtures";
import { renderWithProviders, screen, userEvent, within } from "../test-utils";

const fact = (label: string) => screen.getByText(label).closest("[data-component=FactRow]");

function render(
  state: Parameters<typeof issuerStoryDraftRecord>[0],
  options: { canSign?: boolean; onApprove?: (draft: ServiceIssuerDraft) => Promise<unknown> } = {}
) {
  const record = issuerStoryDraftRecord(state);
  const onApprove = options.onApprove ?? vi.fn(async (_draft: ServiceIssuerDraft) => undefined);
  const onAskForChanges = vi.fn();
  const onDecline = vi.fn();
  renderWithProviders(
    <ServiceIssuerOnboarding
      record={record}
      canSign={options.canSign ?? true}
      approving={false}
      onApprove={onApprove}
      onAskForChanges={onAskForChanges}
      onDecline={onDecline}
    />
  );
  return { record, onApprove, onAskForChanges, onDecline };
}

describe("a member's draft service", () => {
  it("lets the member approve the exact terms from their own account, only after consent", async () => {
    const { record, onApprove } = render("review");
    expect(screen.getByText("Next: review and approve your draft")).toBeInTheDocument();
    expect(screen.getByText("Drafted with Kaya, a Green Goods steward")).toBeInTheDocument();
    expect(fact("One voucher buys")).toHaveTextContent("One 60-minute lesson");
    expect(fact("What you can deliver")).toHaveTextContent("6 over the next 4 weeks");
    expect(fact("Vouchers to issue")).toHaveTextContent(
      "6 TEO2 go to the selected exchange pool, 4 stay in your reserve"
    );
    expect(fact("Exchange value")).toHaveTextContent("1 TEO has an exchange value of 2");
    expect(fact("Fees")).toHaveTextContent("No pool fee proposed");
    expect(fact("Deadline to accept")).toHaveTextContent("7 days from agreeing");
    expect(
      screen.getByText(/They can't issue, spend your reserve or approve for you/)
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    const sheet = within(screen.getByRole("dialog"));
    const approve = sheet.getByRole("button", { name: "Approve My Service" });
    expect(approve).toBeDisabled();
    expect(sheet.getByText("Your signed approval of these terms")).toBeInTheDocument();
    expect(sheet.getByText("Exchange Pool")).toBeInTheDocument();
    expect(sheet.getByText(record.draft.terms.exchangePool!.id)).toBeInTheDocument();
    expect(sheet.getByText(record.draft.terms.exchangePool!.address)).toBeInTheDocument();
    await userEvent.click(
      sheet.getByRole("checkbox", { name: "I read the terms and the controls above" })
    );
    await userEvent.click(approve);
    expect(onApprove).toHaveBeenCalledExactlyOnceWith(record.draft);
    expect(record.draft.member).toBe(ISSUER_STORY_ADDRESS);
  });

  it("shows revised terms without assuming an earlier approval", () => {
    const record = issuerStoryDraftRecord("changed");
    record.approval = null;
    renderWithProviders(
      <ServiceIssuerOnboarding record={record} canSign approving={false} onApprove={vi.fn()} />
    );
    expect(screen.getByText("The service terms changed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and Approve" })).toBeEnabled();
  });

  it("keeps the draft waiting when this account can't sign, with no other way to approve", () => {
    const { onApprove } = render("review", { canSign: false });
    expect(screen.getByText("Approving isn't available yet")).toBeInTheDocument();
    expect(screen.getByText(/a steward can't approve it for you/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and Approve" })).toBeDisabled();
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("names what changed after an approval and asks for a new one", async () => {
    const { onDecline } = render("changed");
    expect(screen.getByText("The service terms changed")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Kaya changed the exchange value\. Review this revision before approving or declining/
      )
    ).toBeInTheDocument();
    expect(fact("Exchange value")).toHaveTextContent("1 TEO has an exchange value of 3");
    expect(fact("Exchange value")).toHaveTextContent("Changed");
    expect(screen.getByRole("button", { name: "Review and Approve" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it("shows an approved draft as others' setup, with nothing left to approve", () => {
    render("approved");
    expect(screen.getByText("Approved. Next: Green Goods sets up your token")).toBeInTheDocument();
    expect(screen.getByText(/You approved the exact terms ·/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review and Approve" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        `Your signed approval: issuer-approval:100:${ISSUER_STORY_ADDRESS.toLowerCase()}:7:1`
      )
    ).toBeInTheDocument();
  });

  it("says when the approval wasn't signed and keeps the sheet open", async () => {
    render("review", { onApprove: vi.fn().mockRejectedValue(new Error("rejected")) });
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    const sheet = within(screen.getByRole("dialog"));
    await userEvent.click(sheet.getByRole("checkbox"));
    await userEvent.click(sheet.getByRole("button", { name: "Approve My Service" }));
    expect(
      await sheet.findByText("The approval wasn't signed, so nothing changed. Try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("records a decline as nothing created, with nothing to act on", () => {
    render("declined");
    expect(
      screen.getByText(
        "Nothing was created and nothing was issued. Kaya can prepare a new draft with you."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
