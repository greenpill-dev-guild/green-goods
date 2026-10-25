import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData } from "viem";
import { serviceIssuerGovernanceDrafts } from "@green-goods/shared/commitment-pooling";
import { VoucherIssuerOnboarding } from "../../views/Community/components/VoucherIssuerOnboarding";
import { voucherIssuerStoryRoute } from "../../views/Community/components/voucherIssuerStoryFixtures";
import { render, screen, userEvent } from "../test-utils";

describe("voucher issuer onboarding", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("keeps absent live inputs explicit with no transaction or export action", () => {
    render(<VoucherIssuerOnboarding canPrepare routes={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("No receipt-backed issuer configuration");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("requires the protocol steward even for prepared owner drafts", () => {
    render(<VoucherIssuerOnboarding canPrepare={false} routes={[voucherIssuerStoryRoute()]} />);
    expect(screen.getByRole("button", { name: "Review Prepared Terms" })).toBeDisabled();
    expect(screen.getByText(/Member approvals remain separate/)).toBeInTheDocument();
  });

  it("reviews exact terms while keeping fictional export disabled", async () => {
    render(<VoucherIssuerOnboarding canPrepare routes={[voucherIssuerStoryRoute()]} rehearsal />);
    await userEvent.click(screen.getByRole("button", { name: "Review Prepared Terms" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("6 DEMO");
    expect(screen.getByRole("dialog")).toHaveTextContent("https://example.org/fictional-lesson");
    expect(screen.getByRole("dialog")).toHaveTextContent("Returned vouchers do not restore");
    expect(screen.getByRole("button", { name: "Copy Owner Safe Drafts" })).toBeDisabled();
  });

  it("exports the exact owner/chain/target/calldata and never sends it", async () => {
    const route = voucherIssuerStoryRoute();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<VoucherIssuerOnboarding canPrepare routes={[route]} />);
    await userEvent.click(screen.getByRole("button", { name: "Review Prepared Terms" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy Owner Safe Drafts" }));
    const copied = JSON.parse(writeText.mock.calls[0]![0] as string);
    const expected = serviceIssuerGovernanceDrafts(route, route.assets[0]!.id);
    expect(copied.kind).toBe("owner-safe-drafts");
    expect(copied.calls).toHaveLength(4);
    copied.calls.forEach(
      (
        call: { owner: string; chainId: number; to: string; value: string; data: `0x${string}` },
        i: number
      ) => {
        const draft = expected[i]!;
        expect(call).toMatchObject({
          owner: draft.owner,
          chainId: draft.call.chainId,
          to: draft.call.address,
          value: "0",
        });
        const decoded = decodeFunctionData({ abi: draft.call.abi, data: call.data });
        expect(decoded.functionName).toBe(draft.call.functionName);
        expect(decoded.args).toEqual(draft.call.args);
      }
    );
    vi.unstubAllGlobals();
  });

  it("withholds incomplete drafts and closes a review when the catalog is replaced", async () => {
    const route = voucherIssuerStoryRoute();
    route.assets[0]!.service.capacityConfirmed = false;
    const view = render(<VoucherIssuerOnboarding canPrepare routes={[route]} />);
    await userEvent.click(screen.getByRole("button", { name: "Review Prepared Terms" }));
    expect(screen.getByRole("button", { name: "Copy Owner Safe Drafts" })).toBeDisabled();
    expect(screen.getByText(/configuration is incomplete/)).toBeInTheDocument();
    view.rerender(<VoucherIssuerOnboarding canPrepare routes={[]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
