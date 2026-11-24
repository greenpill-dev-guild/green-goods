import { describe, expect, it, vi } from "vitest";
import { createVoucherAwardClient } from "../modules/commitment-pooling/voucher-award-client";
import { voucherAwardSafeEnvelope } from "../modules/commitment-pooling/voucher-award-safe";
import {
  buildVoucherAwardMessage,
  type VoucherAwardRecord,
} from "../public-contracts/voucher-awards";

const account = "0x4444444444444444444444444444444444444444";
const award = {
  awardId: "past-21",
  reserve: "0x1111111111111111111111111111111111111111",
  token: "0x2222222222222222222222222222222222222222",
  recipient: account,
  amount: "3",
  reason: "Past work",
  reference: null,
} as const;
function fixture() {
  let now = 1_800_000_000_000;
  const record: VoucherAwardRecord = {
    version: 1,
    award,
    safe: voucherAwardSafeEnvelope(award, 7n, 1),
    state: "awaiting_authorization",
    transactionHash: null,
    failure: null,
    createdBy: account,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    revision: 0,
  };
  const sign = vi.fn(async () => "0x1234" as const);
  const assertCurrent = vi.fn();
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true, record }));
  const client = createVoucherAwardClient({
    account,
    sign,
    assertCurrent,
    fetch,
    baseUrl: "https://agent.example",
    audience: "https://greengoods.app",
    now: () => now,
  });
  return {
    client,
    record,
    sign,
    fetch,
    assertCurrent,
    tick: (ms: number) => {
      now += ms;
    },
  };
}
describe("award API client", () => {
  it("signs the exact body and reuses only an identical recent read proof", async () => {
    const f = fixture();
    const command = { action: "read" as const, reserve: award.reserve, awardId: award.awardId };
    expect((await f.client.request(command)).record).toEqual(f.record);
    const body = JSON.parse(f.fetch.mock.calls[0][1]!.body as string);
    const { signature, ...proof } = body;
    expect(signature).toBe("0x1234");
    expect(f.sign).toHaveBeenCalledWith(buildVoucherAwardMessage(proof));
    await f.client.request(command);
    expect(f.sign).toHaveBeenCalledOnce();
    f.tick(61_000);
    await f.client.request(command);
    expect(f.sign).toHaveBeenCalledTimes(2);
    await f.client.request({ action: "prepare", award });
    await f.client.request({ action: "prepare", award });
    expect(f.sign).toHaveBeenCalledTimes(4);
  });
  it("rejects changed award terms and noncanonical Safe envelopes", async () => {
    const f = fixture();
    f.fetch.mockResolvedValueOnce(
      Response.json({ ok: true, record: { ...f.record, award: { ...award, amount: "4" } } })
    );
    await expect(f.client.request({ action: "prepare", award })).rejects.toThrow(
      "transaction changed"
    );
    f.fetch.mockResolvedValueOnce(
      Response.json({ ok: true, record: { ...f.record, safe: { ...f.record.safe, threshold: 0 } } })
    );
    await expect(
      f.client.request({ action: "read", reserve: award.reserve, awardId: award.awardId })
    ).rejects.toThrow("Invalid Safe");
  });
  it("rejects another recipient's receipts and propagates explicit server conflict codes", async () => {
    const f = fixture();
    f.fetch.mockResolvedValueOnce(Response.json({ ok: true, records: [f.record], limit: 200 }));
    await expect(f.client.request({ action: "received" })).rejects.toThrow("scope changed");
    f.fetch.mockResolvedValueOnce(
      Response.json({ ok: false, errorCode: "safe_nonce_claimed" }, { status: 409 })
    );
    await expect(f.client.request({ action: "prepare", award })).rejects.toThrow(
      "safe_nonce_claimed"
    );
  });
  it("abandons a signed action when the authenticated session changed before sending", async () => {
    const f = fixture();
    f.sign.mockImplementation(async () => {
      f.assertCurrent.mockImplementation(() => {
        throw new Error("account changed");
      });
      return "0x1234";
    });
    await expect(f.client.request({ action: "prepare", award })).rejects.toThrow("account changed");
    expect(f.fetch).not.toHaveBeenCalled();
  });
});
