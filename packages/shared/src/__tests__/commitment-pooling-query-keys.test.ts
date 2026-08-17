import { describe, expect, it } from "vitest";

import { queryKeys } from "../config/query-keys";

const ACCOUNT = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD";
const OTHER = "0x1111111111111111111111111111111111111111";

describe("commitment pooling query keys", () => {
  it("keeps every pooling key under a chain-scoped invalidation prefix", () => {
    const prefix = queryKeys.commitmentPooling.all(42161);
    const keys = [
      queryKeys.commitmentPooling.availability(42161),
      queryKeys.commitmentPooling.pools(42161, ACCOUNT),
      queryKeys.commitmentPooling.pool(42161, 9n),
      queryKeys.commitmentPooling.cycles(42161, 9n, { state: "OPEN" }),
      queryKeys.commitmentPooling.cycle(42161, 10n),
      queryKeys.commitmentPooling.commitments(42161, { poolId: 9n }),
      queryKeys.commitmentPooling.commitment(42161, 11n),
      queryKeys.commitmentPooling.requirements(42161, 11n),
      queryKeys.commitmentPooling.contributors(42161, 11n),
      queryKeys.commitmentPooling.claims(42161, 11n, "PENDING"),
      queryKeys.commitmentPooling.seriesList(42161, { holder: ACCOUNT }),
      queryKeys.commitmentPooling.series(42161, 12n),
      queryKeys.commitmentPooling.need(42161, "0xABCD"),
      queryKeys.commitmentPooling.exchange(42161, 9n, 11n, 12n),
      queryKeys.commitmentPooling.hypercertBundle(42161, 13n),
      queryKeys.commitmentPooling.funding(42161, 11n, ACCOUNT),
      queryKeys.commitmentPooling.settlementConfiguration(42161),
      queryKeys.commitmentPooling.settlementAccount(42161, ACCOUNT),
      queryKeys.commitmentPooling.settlementSubject(42161, false, 14n),
      queryKeys.commitmentPooling.payoutPlan(42161, 15n),
      queryKeys.commitmentPooling.memberHistory(42161, 9n, ACCOUNT, OTHER),
      queryKeys.commitmentPooling.participationSummary(42161, 9n),
      queryKeys.commitmentPooling.activity(42161, { commitmentId: 11n }),
    ];

    for (const key of keys) expect(key.slice(0, prefix.length)).toEqual(prefix);
    expect(queryKeys.commitmentPooling.all(42220)).not.toEqual(prefix);
  });

  it("canonicalizes filter order, addresses, bigint values, and omitted values", () => {
    const left = queryKeys.commitmentPooling.commitments(42161, {
      state: undefined,
      account: ACCOUNT,
      poolId: 9n,
    });
    const right = queryKeys.commitmentPooling.commitments(42161, {
      poolId: 9n,
      account: ACCOUNT.toLowerCase(),
    });

    expect(left).toEqual(right);
    expect(left.at(-1)).toBe(
      '{"account":"0xabcdefabcdefabcdefabcdefabcdefabcdefabcd","poolId":"9"}'
    );
  });

  it("does not collide distinct entities, filters, viewers, or settlement subject kinds", () => {
    const keys = [
      queryKeys.commitmentPooling.pool(42161, 9n),
      queryKeys.commitmentPooling.pool(42161, 10n),
      queryKeys.commitmentPooling.commitments(42161, { poolId: 9n }),
      queryKeys.commitmentPooling.commitments(42161, { poolId: 10n }),
      queryKeys.commitmentPooling.memberHistory(42161, 9n, ACCOUNT, ACCOUNT),
      queryKeys.commitmentPooling.memberHistory(42161, 9n, ACCOUNT, OTHER),
      queryKeys.commitmentPooling.settlementSubject(42161, false, 9n),
      queryKeys.commitmentPooling.settlementSubject(42161, true, 9n),
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(keys.length);
  });

  it("normalizes exact identity fields without normalizing unrelated identifiers", () => {
    expect(queryKeys.commitmentPooling.need(42161, "0xABCD")).toEqual(
      queryKeys.commitmentPooling.need(42161, "0xabcd")
    );
    expect(queryKeys.commitmentPooling.pools(42161, ACCOUNT)).toEqual(
      queryKeys.commitmentPooling.pools(42161, ACCOUNT.toLowerCase())
    );
    expect(queryKeys.savedOffers.record(42161, "Offer-A")).not.toEqual(
      queryKeys.savedOffers.record(42161, "offer-a")
    );
    expect(queryKeys.savedOffers.list(42161).slice(0, 3)).toEqual(queryKeys.savedOffers.all(42161));
  });
});
