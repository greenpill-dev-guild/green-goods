import { describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import type { ServiceIssuerDeskRecord } from "@green-goods/shared/commitment-pooling";
import { VoucherIssuerDraftEditor } from "../../views/Community/components/VoucherIssuerDraftEditor";
import { voucherIssuerStory } from "../../views/Community/components/voucherIssuerStoryFixtures";
import { render, screen, userEvent } from "../test-utils";
function fixture() {
  const data = voucherIssuerStory("prepareDraft");
  const route = data.routes[0]!;
  const pool = route.pools[0]!;
  const record: ServiceIssuerDeskRecord = {
    ...data.drafts[0]!,
    revision: 0,
    createdBy: pool.deployment.owner,
    updatedAt: "2026-10-27T12:00:00Z",
    context: {
      routeId: route.service.id,
      poolId: pool.id,
      garden: pool.garden,
      sourceChainId: route.service.sourceChainId,
      chainId: 100,
    },
  };
  return { route, pool, record, onSave: vi.fn(async () => {}), onClose: vi.fn() };
}
describe("steward service draft editor", () => {
  it("reviews and saves the narrative line breaks entered in service textareas", async () => {
    const f = fixture();
    render(<VoucherIssuerDraftEditor {...f} />);
    const buys = "Logo design\nIncludes two revisions";
    const scope = "Initial concept\nFinal artwork";
    const remedy = "Contact the designer\nAgree a revised delivery";
    fireEvent.change(screen.getByRole("textbox", { name: /^One Voucher Buys/ }), {
      target: { value: buys },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^Service Scope/ }), {
      target: { value: scope },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^If a Booking Falls Short/ }), {
      target: { value: remedy },
    });
    await userEvent.click(screen.getByRole("button", { name: "Review Terms" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(f.onSave).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(f.onSave).toHaveBeenCalledOnce());
    expect(f.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        terms: expect.objectContaining({
          service: expect.objectContaining({ buys, scope, remedy }),
        }),
      })
    );
  });
  it("reviews exact pool and amounts before saving a new terms revision", async () => {
    const f = fixture();
    render(<VoucherIssuerDraftEditor {...f} />);
    fireEvent.change(screen.getByRole("textbox", { name: /^Pool Fee/ }), {
      target: { value: "1.25" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Review Terms" }));
    expect(f.onSave).not.toHaveBeenCalled();
    expect(screen.getByText(f.pool.deployment.address)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(f.onSave).toHaveBeenCalledOnce());
    expect(f.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sentAt: null,
        member: f.record.draft.member.toLowerCase(),
        terms: expect.objectContaining({
          revision: 2,
          poolFee: 12500n,
          exchangePool: {
            chainId: 100,
            id: f.pool.id,
            address: f.pool.deployment.address.toLowerCase(),
          },
        }),
      })
    );
    expect(f.onClose).toHaveBeenCalledOnce();
  });
  it("rejects excess precision and impossible fees without rounding or saving", async () => {
    const f = fixture();
    render(<VoucherIssuerDraftEditor {...f} />);
    fireEvent.change(screen.getByRole("textbox", { name: /^Vouchers to Issue/ }), {
      target: { value: "6.0000001" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Review Terms" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(f.onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: /^Vouchers to Issue/ }), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^Pool Fee/ }), {
      target: { value: "100.0001" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Review Terms" }));
    expect(screen.queryByRole("button", { name: "Save Draft" })).not.toBeInTheDocument();
  });
  it("preserves review and reports save failure for an explicit retry", async () => {
    const f = fixture();
    f.onSave.mockRejectedValue(new Error("revision conflict"));
    render(<VoucherIssuerDraftEditor {...f} />);
    await userEvent.click(screen.getByRole("button", { name: "Review Terms" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Reload it and try again")
    );
    expect(f.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Back to Editing" })).toBeEnabled();
  });
  it("locks member identity on an existing draft and disables review while saving", () => {
    const f = fixture();
    render(<VoucherIssuerDraftEditor {...f} pending />);
    expect(screen.getByRole("textbox", { name: /^Member Account/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Review Terms" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
