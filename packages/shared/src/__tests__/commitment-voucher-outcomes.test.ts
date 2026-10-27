import { describe, expect, it } from "vitest";
import { createServiceRehearsalAdapter } from "../modules/commitment-pooling/demo/demo-service-access";
import { PILOT_ASSETS, PILOT_ISSUERS } from "../modules/commitment-pooling/demo/demo-service-pilot";
import { REHEARSAL_VOUCHER_ISSUERS } from "../modules/commitment-pooling/demo/demo-service-wallet";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";
import {
  selectCommitmentVoucherOutcomes,
  selectVoucherOutcomesReader,
} from "../modules/commitment-pooling/voucher-outcomes";
import type { Address } from "../types/domain";

const key = (commitmentId: bigint): ServiceAccessKey => ({
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  commitmentId,
  buyer: "0x0000000000000000000000000000000000000200",
});
const { greenGoods, techAndSun } = REHEARSAL_VOUCHER_ISSUERS;

describe("a promise's voucher outcomes for its stewards", () => {
  it("reads a request as the member who took it up, and an offer as the steward viewing", () => {
    const member = "0x00000000000000000000000000000000000000a1" as Address;
    const steward = "0x00000000000000000000000000000000000000a3" as Address;
    const request = { direction: "REQUEST", leadProvider: member, counterparty: member } as const;

    // The member's own promise page reads the same rewards with the same buyer.
    expect(selectVoucherOutcomesReader(request, steward)).toBe(member);
    expect(
      selectVoucherOutcomesReader(
        { direction: "OFFER", leadProvider: null, counterparty: null },
        steward
      )
    ).toBe(steward);
    // A request nobody has taken up has nobody's rewards to read.
    expect(
      selectVoucherOutcomesReader({ ...request, leadProvider: null, counterparty: null }, steward)
    ).toBeNull();
    expect(selectVoucherOutcomesReader(null, steward)).toBeNull();
  });

  it("keeps a request's two rewards apart, the vouchers named by their issuer", async () => {
    const adapter = createServiceRehearsalAdapter();
    const both = key(1026n);
    await adapter.execute(both, { action: "observePilotRole", observation: "work-fulfilled" });
    await adapter.execute(both, { action: "deliverPilotReward", asset: "voucher" });
    await adapter.execute(both, { action: "deliverPilotReward", asset: "gd" });
    // The directory may spell the issuer's account in another case; it still names it.
    const directory = [
      { ...greenGoods, account: greenGoods.account.replace("fa02", "FA02") as Address },
    ];

    const outcomes = selectCommitmentVoucherOutcomes(await adapter.read(both), directory);

    expect(outcomes).toMatchObject({ workFulfilled: true, payment: null });
    expect(
      outcomes!.rewards.map(({ kind, status, shortOf, issuer }) => ({
        kind,
        status,
        shortOf,
        issuer,
      }))
    ).toEqual([
      {
        kind: "voucher",
        status: "waiting",
        shortOf: "reserve",
        issuer: { name: "Green Goods", gender: "masculine" },
      },
      { kind: "gd", status: "received", shortOf: null, issuer: null },
    ]);
  });

  it("reads an offer's voucher payment under its terms version, and pays it no reward", async () => {
    const adapter = createServiceRehearsalAdapter();
    const hubDay = await adapter.read(key(1023n));

    expect(selectCommitmentVoucherOutcomes(hubDay, [techAndSun])).toEqual({
      rewards: [],
      workFulfilled: false,
      payment: {
        asset: PILOT_ASSETS.b,
        issuer: { name: "Tech and Sun", gender: "feminine" },
        issuerAccount: PILOT_ISSUERS.b,
        units: 1_000_000n,
        revision: 1n,
      },
    });
    // An issuer the directory doesn't list stays unnamed rather than borrowing another's name.
    expect(selectCommitmentVoucherOutcomes(hubDay, [greenGoods])!.payment!.issuer).toBeNull();
  });

  it("shows nothing for a promise that pays no reward and takes no vouchers", async () => {
    const adapter = createServiceRehearsalAdapter();

    expect(
      selectCommitmentVoucherOutcomes(await adapter.read(key(1022n)), [techAndSun])
    ).toBeNull();
    expect(selectCommitmentVoucherOutcomes(undefined)).toBeNull();
  });
});
