import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { gnosis } from "viem/chains";
import type {
  ServiceIssuerDeskCommand,
  ServiceIssuerDraft,
  ServiceIssuerSignedApproval,
} from "@green-goods/shared/public-contracts";
import {
  encodeServiceIssuerDesk,
  SERVICE_ISSUER_DESK_POOLS,
  serviceIssuerDeskMessage,
} from "@green-goods/shared/modules/commitment-pooling/service-issuer-desk-protocol";
import {
  serviceIssuerApprovalTypedData,
  serviceIssuerTermsDigest,
} from "@green-goods/shared/modules/commitment-pooling/service-issuer-approval-terms";
import { createServiceIssuerDeskStore } from "../services/db/service-issuer-desk";
import {
  createServiceIssuerDeskService,
  serviceIssuerDeskContext,
} from "../services/service-issuer-desk";
import {
  createViemAccountHashVerifier,
  createViemAccountSignatureVerifier,
} from "../services/account-signatures";

const now = 1_800_000_000;
const pool = SERVICE_ISSUER_DESK_POOLS[0];
const selection = { routeId: pool.routeId, poolId: pool.poolId };
const databases: Database[] = [];
function fixture() {
  const db = new Database(":memory:");
  databases.push(db);
  const store = createServiceIssuerDeskStore(db);
  const member = privateKeyToAccount(generatePrivateKey());
  const steward = privateKeyToAccount(generatePrivateKey());
  const other = privateKeyToAccount(generatePrivateKey());
  const canManage = vi.fn(
    async (_selection, actor) => actor.toLowerCase() === steward.address.toLowerCase()
  );
  const verificationClient = { call: vi.fn(async () => ({ data: "0x00" as const })) };
  const verification = {
    chain: gnosis,
    rpcUrl: "https://unused.invalid",
    client: verificationClient,
  };
  const service = createServiceIssuerDeskService({
    store,
    authority: { context: serviceIssuerDeskContext, canManage },
    now: () => now,
    verify: createViemAccountSignatureVerifier(verification),
    verifyApproval: createViemAccountHashVerifier(verification),
  });
  const request = async (command: ServiceIssuerDeskCommand, signer = steward) => {
    const proof = {
      version: 1 as const,
      chainId: 100 as const,
      actor: signer.address,
      issuedAt: now,
      audience: "https://greengoods.app",
      command: encodeServiceIssuerDesk(command),
    };
    return service.request(
      {
        ...proof,
        signature: await signer.signMessage({ message: serviceIssuerDeskMessage(proof) }),
      },
      proof.audience
    );
  };
  const draft: ServiceIssuerDraft = {
    version: 1,
    id: "member-service-21",
    member: member.address,
    memberName: "Fictional gardener",
    preparedBy: "Forged display steward",
    garden: "Forged display garden",
    sourceChainId: pool.sourceChainId,
    sentAt: null,
    changed: [],
    terms: {
      revision: 1,
      service: {
        title: "Design session",
        buys: "One session",
        scope: "Remote",
        remedy: "Refund unused time",
        unit: "session",
      },
      token: { name: "Design vouchers", symbol: "DV", decimals: 6 },
      capacity: { units: 6_000_000n, weeks: 4 },
      issue: { total: 6_000_000n, pool: 2_000_000n },
      rewardAllowance: 1_000_000n,
      poolHoldingCap: 6_000_000n,
      priceIndex: 1_000_000n,
      poolFee: 0n,
      exchangePool: { chainId: 100, id: pool.poolId, address: pool.deployment.address },
      replyBusinessDays: 2,
      acceptanceDays: 7,
      document: { reference: "https://example.org/terms", digest: `0x${"ab".repeat(32)}` },
    },
  };
  const sent = async () => {
    const created = (await request({ action: "save", selection, draft, expectedRevision: null }))
      .record!;
    return (await request({ action: "send", id: draft.id, expectedRevision: created.revision }))
      .record!;
  };
  const approve = async (current = draft): Promise<ServiceIssuerSignedApproval> => {
    const unsigned = {
      version: 1 as const,
      draftId: current.id,
      revision: current.terms.revision,
      member: member.address,
      service: current.terms.service.title,
      termsDigest: serviceIssuerTermsDigest(current),
      signedAt: BigInt(now),
    };
    return {
      ...unsigned,
      signature: await member.signTypedData(serviceIssuerApprovalTypedData(unsigned)),
    };
  };
  return {
    db,
    store,
    member,
    steward,
    other,
    canManage,
    service,
    draft,
    request,
    sent,
    approve,
    verificationClient,
  };
}
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("persistent member issuer desk", () => {
  it("binds canonical pool context and actual steward, and hides unsent/other-member drafts", async () => {
    const f = fixture();
    const created = (
      await f.request({ action: "save", selection, draft: f.draft, expectedRevision: null })
    ).record!;
    expect(created.draft.preparedBy).toBe(f.steward.address.toLowerCase());
    expect(created.draft.garden).toBe(pool.garden.toLowerCase());
    expect((await f.request({ action: "list", selection: null }, f.member)).records).toEqual([]);
    await expect(f.request({ action: "read", id: f.draft.id }, f.member)).rejects.toMatchObject({
      code: "not_authorized",
    });
    await f.request({ action: "send", id: f.draft.id, expectedRevision: created.revision });
    expect((await f.request({ action: "list", selection: null }, f.member)).records).toHaveLength(
      1
    );
    expect((await f.request({ action: "list", selection: null }, f.other)).records).toEqual([]);
    await expect(f.request({ action: "list", selection }, f.other)).rejects.toMatchObject({
      code: "not_authorized",
    });
  });
  it("rejects swapped source/pool and checks current pool authority again before sending", async () => {
    const f = fixture();
    await expect(
      f.request({
        action: "save",
        selection,
        draft: { ...f.draft, sourceChainId: 1 },
        expectedRevision: null,
      })
    ).rejects.toMatchObject({ code: "draft_context_changed" });
    await expect(
      f.request({
        action: "save",
        selection,
        draft: {
          ...f.draft,
          terms: {
            ...f.draft.terms,
            exchangePool: { chainId: 100, id: pool.poolId, address: f.other.address },
          },
        },
        expectedRevision: null,
      })
    ).rejects.toMatchObject({ code: "draft_context_changed" });
    const saved = (
      await f.request({ action: "save", selection, draft: f.draft, expectedRevision: null })
    ).record!;
    f.canManage.mockResolvedValue(false);
    await expect(
      f.request({ action: "send", id: f.draft.id, expectedRevision: saved.revision })
    ).rejects.toMatchObject({ code: "not_authorized" });
    expect(f.store.get(f.draft.id)?.draft.sentAt).toBeNull();
  });
  it("requires the member's real separate typed approval even when command authentication is valid", async () => {
    const f = fixture();
    const sent = await f.sent();
    const approval = await f.approve(sent.draft);
    await expect(
      f.request(
        {
          action: "approve",
          id: sent.draft.id,
          expectedRevision: sent.revision,
          approval: { ...approval, signature: "0x1234" },
        },
        f.member
      )
    ).rejects.toMatchObject({ code: "approval_signature_invalid" });
    expect(f.store.get(sent.draft.id)?.approval).toBeNull();
    await expect(
      f.request(
        { action: "approve", id: sent.draft.id, expectedRevision: sent.revision, approval },
        f.steward
      )
    ).rejects.toMatchObject({ code: "not_authorized" });
    const result = await f.request(
      { action: "approve", id: sent.draft.id, expectedRevision: sent.revision, approval },
      f.member
    );
    expect(result.record?.approval?.signature).toBe(approval.signature);
    expect(
      await f.request(
        { action: "approve", id: sent.draft.id, expectedRevision: sent.revision, approval },
        f.member
      )
    ).toEqual(result);
    await expect(
      f.request(
        { action: "decline", id: sent.draft.id, expectedRevision: result.record!.revision },
        f.member
      )
    ).rejects.toMatchObject({ code: "already_decided" });
  });
  it("keeps earlier approval history while changed terms require a new sent revision", async () => {
    const f = fixture();
    const sent = await f.sent();
    const approval = await f.approve(sent.draft);
    const approved = (
      await f.request(
        { action: "approve", id: sent.draft.id, expectedRevision: sent.revision, approval },
        f.member
      )
    ).record!;
    const next = {
      ...sent.draft,
      sentAt: null,
      terms: { ...sent.draft.terms, revision: 2, replyBusinessDays: 3 },
    };
    const edited = (
      await f.request({
        action: "save",
        selection,
        draft: next,
        expectedRevision: approved.revision,
      })
    ).record!;
    expect(edited.approval).toBeNull();
    expect(edited.draft.sentAt).toBeNull();
    expect(edited.draft.changed).toEqual(["replyBusinessDays"]);
    const resent = (
      await f.request({ action: "send", id: next.id, expectedRevision: edited.revision })
    ).record!;
    await expect(
      f.request(
        { action: "approve", id: next.id, expectedRevision: resent.revision, approval },
        f.member
      )
    ).rejects.toMatchObject({ code: "approval_outdated" });
    expect(
      f.db
        .query("SELECT COUNT(*) AS count FROM service_issuer_draft_revisions WHERE id=?")
        .get(next.id)
    ).toMatchObject({ count: 5 });
    expect(createServiceIssuerDeskStore(f.db).get(next.id)).toEqual(resent);
  });
  it("allows only one competing edit and retries exact preparation without an extra revision", async () => {
    const f = fixture();
    const command = { action: "save" as const, selection, draft: f.draft, expectedRevision: null };
    const saved = (await f.request(command)).record!;
    expect((await f.request(command)).record).toEqual(saved);
    const edits = await Promise.allSettled(
      [2, 3].map((days) =>
        f.request({
          action: "save",
          selection,
          expectedRevision: saved.revision,
          draft: { ...f.draft, terms: { ...f.draft.terms, revision: 2, replyBusinessDays: days } },
        })
      )
    );
    expect(edits.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(f.store.get(f.draft.id)?.revision).toBe(1);
  });
  it("persists a member decline and refuses approval until a newly edited revision is sent", async () => {
    const f = fixture();
    const sent = await f.sent();
    const approval = await f.approve(sent.draft);
    const declined = (
      await f.request(
        { action: "decline", id: sent.draft.id, expectedRevision: sent.revision },
        f.member
      )
    ).record!;
    expect(declined.declinedAt).toBe(BigInt(now));
    await expect(
      f.request(
        { action: "approve", id: sent.draft.id, expectedRevision: declined.revision, approval },
        f.member
      )
    ).rejects.toMatchObject({ code: "approval_outdated" });
  });
});
