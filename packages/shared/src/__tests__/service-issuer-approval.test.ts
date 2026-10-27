import { describe, expect, it, vi } from "vitest";
import { type Hex, verifyTypedData } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { ServiceLiveSession } from "../modules/commitment-pooling/service-access-live";
import type { ServiceLiveChain } from "../modules/commitment-pooling/service-access-live-route";
import {
  serviceIssuerApprovalProvenance,
  serviceIssuerApprovalTypedData,
  serviceIssuerDraftApproval,
  serviceIssuerTermsDigest,
  signServiceIssuerApproval,
  type ServiceIssuerDraft,
} from "../modules/commitment-pooling/service-issuer-approval";
import type { AccountTypedDataRequest, TransactionSender } from "../modules/transactions/types";
import type { Address } from "../types/domain";

const MEMBER = "0x9b4c3a2e1f0d9c8b7a6f5e4d3c2b1a0f9e8de21c" as Address;
const STEWARD = "0x04D60647836bcA09c37B379550038BdaaFD82503" as Address;
const DOCUMENT = `0x${"d".repeat(64)}` as Hex;
const SIGNATURE = `0x${"5".repeat(130)}` as Hex;

function draft(member: Address = MEMBER): ServiceIssuerDraft {
  return {
    version: 1,
    id: "7",
    member,
    memberName: "Fictional member",
    preparedBy: "Fictional steward",
    garden: "Fictional garden",
    sourceChainId: 42161,
    sentAt: 1_900_000_000n,
    changed: [],
    terms: {
      revision: 1,
      service: {
        title: "Integration lesson",
        buys: "One 60-minute lesson",
        scope: "Remote, within 2 weeks of booking",
        remedy: "By minutes delivered",
        unit: "minutes",
      },
      token: { name: "Fictional lesson vouchers", symbol: "FLV", decimals: 6 },
      capacity: { units: 6_000_000n, weeks: 4 },
      issue: { total: 6_000_000n, pool: 2_000_000n },
      rewardAllowance: 1_000_000n,
      poolHoldingCap: 6_000_000n,
      priceIndex: 2_000_000n,
      poolFee: 0n,
      replyBusinessDays: 2,
      acceptanceDays: 7,
      document: { reference: "https://example.org/fictional-lesson", digest: DOCUMENT },
    },
  };
}

function harness(signedIn: Address = MEMBER, authMode: "passkey" | "wallet" = "passkey") {
  const session: ServiceLiveSession = {
    address: signedIn,
    authMode,
    profile: authMode === "passkey" ? "kernel-0.3.3-pilot" : null,
    generation: 0,
    online: true,
  };
  const requests: AccountTypedDataRequest[] = [];
  const sender: TransactionSender = {
    authMode,
    supportsSponsorship: false,
    supportsBatching: false,
    assertOwnership: vi.fn(async (account: Address, chainId: number) => {
      if (account.toLowerCase() !== signedIn.toLowerCase() || chainId !== 100)
        throw new Error("Wallet ownership/chain mismatch");
    }),
    signTypedData: vi.fn(async (request: AccountTypedDataRequest, options) => {
      await options?.assertOwnership?.();
      requests.push(request);
      return SIGNATURE;
    }),
    sendContractCall: vi.fn(async () => {
      throw new Error("An approval never sends a transaction");
    }),
  };
  const chain = { code: vi.fn(async () => "0x") } as unknown as ServiceLiveChain;
  return {
    sender,
    requests,
    deps: { session: () => session, sender: () => sender, chain, now: () => 1_900_000_100n },
  };
}

describe("a member's signed draft approval", () => {
  it("binds the exact terms: any changed setting changes the digest it signs", () => {
    const base = draft();
    const digest = serviceIssuerTermsDigest(base);
    const reordered = { ...base, terms: { ...base.terms, poolFee: 0n, priceIndex: 2_000_000n } };
    expect(serviceIssuerTermsDigest(reordered)).toBe(digest);
    const changed = draft();
    changed.terms.priceIndex = 3_000_000n;
    expect(serviceIssuerTermsDigest(changed)).not.toBe(digest);
    const otherMember = draft("0x1234567890123456789012345678901234567890" as Address);
    expect(serviceIssuerTermsDigest(otherMember)).not.toBe(digest);
  });

  it("signs from the member's own account on Gnosis and sends nothing", async () => {
    const h = harness();
    const approval = await signServiceIssuerApproval(h.deps, draft());
    expect(h.requests).toHaveLength(1);
    const [request] = h.requests;
    expect(request!.account).toBe(MEMBER);
    expect(request!.chainId).toBe(100);
    expect(request!.data.domain?.chainId).toBe(100);
    expect(request!.data.message).toMatchObject({
      member: MEMBER,
      draft: "7",
      revision: 1n,
      termsDigest: serviceIssuerTermsDigest(draft()),
    });
    expect(approval).toEqual({
      version: 1,
      draftId: "7",
      revision: 1,
      member: MEMBER,
      service: "Integration lesson",
      termsDigest: serviceIssuerTermsDigest(draft()),
      signedAt: 1_900_000_100n,
      signature: SIGNATURE,
    });
    expect(h.sender.assertOwnership).toHaveBeenCalledWith(MEMBER, 100);
    expect(h.sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("refuses a steward's session: nobody signs a member's approval for them", async () => {
    const h = harness(STEWARD);
    await expect(signServiceIssuerApproval(h.deps, draft())).rejects.toThrow(
      "Service account or session changed"
    );
    expect(h.sender.signTypedData).not.toHaveBeenCalled();
  });

  it("refuses an account that can't sign typed data instead of approving another way", async () => {
    const h = harness();
    delete (h.sender as { signTypedData?: unknown }).signTypedData;
    await expect(signServiceIssuerApproval(h.deps, draft())).rejects.toThrow(
      "can't sign a service approval"
    );
  });

  it("gives the issuer metadata a reference and digest that point at the signed record", async () => {
    const h = harness();
    const approval = await signServiceIssuerApproval(h.deps, draft());
    const provenance = serviceIssuerApprovalProvenance(approval);
    expect(provenance.reference).toBe(`issuer-approval:100:${MEMBER.toLowerCase()}:7:1`);
    expect(provenance.digest).toMatch(/^0x[0-9a-f]{64}$/);
    const resigned = { ...approval, signature: `0x${"6".repeat(130)}` as Hex };
    expect(serviceIssuerApprovalProvenance(resigned).digest).not.toBe(provenance.digest);
  });

  it("holds an approval to the revision it signed: a changed draft needs a new one", async () => {
    const h = harness();
    const approval = await signServiceIssuerApproval(h.deps, draft());
    expect(serviceIssuerDraftApproval(draft(), approval)).toBe("current");
    const revised = draft();
    revised.terms.revision = 2;
    revised.terms.priceIndex = 3_000_000n;
    expect(serviceIssuerDraftApproval(revised, approval)).toBe("outdated");
    expect(serviceIssuerDraftApproval(draft(), null)).toBe("none");
    const someoneElse = { ...approval, member: STEWARD };
    expect(serviceIssuerDraftApproval(draft(), someoneElse)).toBe("none");
  });

  it("produces typed data a member's wallet signature verifies against, and only for those terms", async () => {
    const wallet = privateKeyToAccount(generatePrivateKey());
    const h = harness(wallet.address, "wallet");
    h.sender.signTypedData = async (request) => wallet.signTypedData(request.data as never);
    const approval = await signServiceIssuerApproval(h.deps, draft(wallet.address));
    const { signature, ...unsigned } = approval;
    const typed = serviceIssuerApprovalTypedData(unsigned);
    expect(await verifyTypedData({ ...typed, address: wallet.address, signature } as never)).toBe(
      true
    );
    const tampered = serviceIssuerApprovalTypedData({ ...unsigned, termsDigest: DOCUMENT });
    expect(
      await verifyTypedData({ ...tampered, address: wallet.address, signature } as never)
    ).toBe(false);
  });
});
