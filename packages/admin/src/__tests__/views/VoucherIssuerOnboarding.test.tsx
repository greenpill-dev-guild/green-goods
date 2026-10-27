import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData } from "viem";
import {
  serviceIssuerApprovalProvenance,
  serviceIssuerGovernanceDrafts,
  serviceIssuerListingKey,
} from "@green-goods/shared/commitment-pooling";
import { VoucherIssuerCard } from "../../views/Community/components/VoucherIssuerOnboarding";
import {
  voucherIssuerStory,
  voucherIssuerStoryRoute,
} from "../../views/Community/components/voucherIssuerStoryFixtures";
import { render, screen, userEvent, within } from "../test-utils";

// Each owner Safe's signature count is read from that Safe on its own chain; these tests answer
// two of five on Gnosis and three of four on Arbitrum, for the same address.
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useIssuerSafeThreshold: ({ chainId, safe }: { chainId: number; safe?: string }) => ({
    data:
      chainId === 42161
        ? { safe, status: "observed", threshold: 3, owners: 4 }
        : { safe, status: "observed", threshold: 2, owners: 5 },
  }),
}));

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  return writeText;
}
const row = (name: string) => screen.getByText(name).closest("li")!;

describe("voucher issuer onboarding", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps absent live inputs explicit with no transaction or export action", () => {
    render(<VoucherIssuerCard canPrepare routes={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("No receipt-backed issuer configuration");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("requires the protocol steward even for prepared owner drafts", () => {
    render(<VoucherIssuerCard canPrepare={false} {...voucherIssuerStory("ownerSafeDrafts")} />);
    expect(screen.getByRole("button", { name: "Owner Safe Drafts…" })).toBeDisabled();
    expect(screen.getByText(/Member approvals remain separate/)).toBeInTheDocument();
  });

  it("names each issuer's state: a sent draft waits for the member, listed issuers can be delisted", () => {
    render(<VoucherIssuerCard canPrepare {...voucherIssuerStory("issuers")} />);
    expect(within(row("Teo vouchers")).getByText("Waiting for Teo Alves")).toBeInTheDocument();
    expect(
      within(row("Teo vouchers")).getByRole("button", { name: "Remind Teo Alves…" })
    ).toBeEnabled();
    expect(within(row("Maya vouchers")).getByText("Listed")).toBeInTheDocument();
    expect(within(row("Maya vouchers")).getByRole("button", { name: "Delist…" })).toBeEnabled();
    expect(
      within(row("Green Goods vouchers")).queryByRole("button", { name: "Delist…" })
    ).toBeNull();
  });

  it("shows the member's signed approval as the values the issuer record carries, and copying sends nothing", async () => {
    const story = voucherIssuerStory("approved");
    const writeText = stubClipboard();
    render(<VoucherIssuerCard canPrepare {...story} />);
    expect(within(row("Teo vouchers")).getByText("Approved · setup pending")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review Approval…" }));
    const provenance = serviceIssuerApprovalProvenance(story.drafts[0]!.approval!);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(provenance.reference)).toBeInTheDocument();
    expect(dialog.getByText(provenance.digest)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Copy Issuer Record Values" }));
    expect(JSON.parse(writeText.mock.calls[0]![0] as string)).toMatchObject({
      approval: provenance,
      terms: { digest: story.drafts[0]!.approval!.termsDigest },
    });
    expect(dialog.getByText(/^Copied\. Nothing was sent/)).toBeInTheDocument();
  });

  it("exports the exact owner/chain/target/calldata, says nothing was sent, and never sends it", async () => {
    const story = voucherIssuerStory("ownerSafeDrafts");
    const writeText = stubClipboard();
    render(<VoucherIssuerCard canPrepare {...story} />);
    await userEvent.click(screen.getByRole("button", { name: "Owner Safe Drafts…" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy Owner Safe Drafts" }));
    const copied = JSON.parse(writeText.mock.calls[0]![0] as string);
    const expected = serviceIssuerGovernanceDrafts(story.routes[0]!, "teo");
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
    expect(
      screen.getByText("Copied. Nothing was sent: the Safe still reviews and signs each call.")
    ).toBeInTheDocument();
    expect(screen.getByText(/The Safe needs 2 of 5 signatures\./)).toBeInTheDocument();
  });

  it("prepares delisting as one zero-limit Safe call that keeps every holding, booking and obligation", async () => {
    const story = voucherIssuerStory("delist");
    const writeText = stubClipboard();
    render(<VoucherIssuerCard canPrepare {...story} />);
    await userEvent.click(within(row("Maya vouchers")).getByRole("button", { name: "Delist…" }));
    const dialog = within(screen.getByRole("dialog"));
    for (const kept of [
      "Holders keep their vouchers and their terms",
      "Booked services go ahead, with their returns",
      "The issuer's remaining obligations stay recorded",
    ])
      expect(dialog.getByText(kept)).toBeInTheDocument();
    const copy = dialog.getByRole("button", { name: "Copy Delisting Draft" });
    expect(copy).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/Reason/), "Can't deliver this month");
    await userEvent.click(copy);
    const copied = JSON.parse(writeText.mock.calls[0]![0] as string);
    expect(copied.reason).toBe("Can't deliver this month");
    expect(copied.calls).toHaveLength(1);
    const [call] = copied.calls;
    const route = story.routes[0]!;
    const maya = route.assets.find((a) => a.id === "maya")!;
    expect(call).toMatchObject({
      purpose: "pool-delist",
      to: route.pool.limiter.address,
      value: "0",
    });
    const decoded = decodeFunctionData({
      abi: [
        {
          type: "function",
          name: "setLimitFor",
          inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ],
      data: call.data,
    });
    expect(decoded.args).toEqual([maya.token.address, route.pool.deployment.address, 0n]);
    expect(dialog.getByText(/^Copied\. Nothing was sent/)).toBeInTheDocument();
  });

  it("reads a recorded delisting's zero limit as delisted while the pool keeps what it holds", () => {
    render(<VoucherIssuerCard canPrepare {...voucherIssuerStory("delisted")} />);
    expect(within(row("Maya vouchers")).getByText("Delisted")).toBeInTheDocument();
    expect(
      within(row("Maya vouchers")).getByText(/the pool takes in no more · 4 still there/)
    ).toBeInTheDocument();
    expect(within(row("Maya vouchers")).queryByRole("button", { name: "Delist…" })).toBeNull();
  });

  it("reads a registered token whose cap hasn't landed as setup pending, keeping its Safe drafts", () => {
    render(<VoucherIssuerCard canPrepare {...voucherIssuerStory("registered")} />);
    const teo = within(row("Teo vouchers"));
    expect(teo.getByText("Approved · setup pending")).toBeInTheDocument();
    expect(teo.getByRole("button", { name: "Owner Safe Drafts…" })).toBeEnabled();
    expect(teo.queryByText("Delisted")).toBeNull();
  });

  it("names each owner Safe's own signature rule, per chain, beside the calls it signs", async () => {
    render(<VoucherIssuerCard canPrepare {...voucherIssuerStory("ownerSafeDrafts")} />);
    await userEvent.click(screen.getByRole("button", { name: "Owner Safe Drafts…" }));
    const groups = [
      ...document.querySelectorAll<HTMLElement>('[data-component="VoucherIssuerSafeCalls"]'),
    ].map((group) => within(group));
    expect(groups).toHaveLength(2);
    const [source, pool] = groups;
    expect(source!.getByText("Source authority binding")).toBeInTheDocument();
    expect(source!.getByText("The Safe needs 3 of 4 signatures.")).toBeInTheDocument();
    for (const call of ["Pool asset admission", "Pool holding cap", "Pool price index"])
      expect(pool!.getByText(call)).toBeInTheDocument();
    expect(pool!.getByText("The Safe needs 2 of 5 signatures.")).toBeInTheDocument();
  });

  it("keeps fictional export disabled and offers sending only through a draft desk", async () => {
    const onSend = vi.fn();
    render(
      <VoucherIssuerCard
        canPrepare
        rehearsal
        onSend={onSend}
        {...voucherIssuerStory("prepareDraft")}
      />
    );
    expect(within(row("Teo vouchers")).getByText("Draft")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Prepare Draft…" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/You can't approve or issue for them/)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Send to Teo Alves" })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("withholds incomplete drafts and closes a review when the catalog is replaced", async () => {
    const route = voucherIssuerStoryRoute();
    route.assets[0]!.service.capacity = null;
    const listings = new Map([
      [
        serviceIssuerListingKey(route.service.id, route.assets[0]!.id),
        { admitted: false, limit: 0n, holding: 0n },
      ],
    ]);
    const view = render(<VoucherIssuerCard canPrepare routes={[route]} listings={listings} />);
    await userEvent.click(screen.getByRole("button", { name: "Owner Safe Drafts…" }));
    expect(screen.getByRole("button", { name: "Copy Owner Safe Drafts" })).toBeDisabled();
    expect(screen.getByText(/configuration is incomplete/)).toBeInTheDocument();
    view.rerender(<VoucherIssuerCard canPrepare routes={[]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
