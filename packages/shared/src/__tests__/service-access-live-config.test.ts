import arbitrumLatest from "@green-goods/contracts/deployments/42161-latest.json";
import arbitrumPilot from "@green-goods/contracts/deployments/42161-pilot-downstream.json";
import gnosisPilot from "@green-goods/contracts/deployments/100-pilot-downstream.json";
import { describe, expect, it } from "vitest";
import { SERVICE_LIVE_ROUTES } from "../modules/commitment-pooling/service-access-live-config";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
type PilotRecord = typeof gnosisPilot | typeof arbitrumPilot;

/** A recorded contract and the deployer's CREATE receipt for it: the record lists both in send order. */
function recorded(record: PilotRecord, address: string) {
  const index = record.contracts.findIndex((c) => same(c.address, address));
  expect(index).toBeGreaterThanOrEqual(0);
  return { contract: record.contracts[index]!, receipt: record.receipts[index]! };
}

describe("the pilot's live service route", () => {
  const route = SERVICE_LIVE_ROUTES[0]!;

  it("is the one route, named for the deployment it pins", () => {
    expect(SERVICE_LIVE_ROUTES).toHaveLength(1);
    expect(route.id).toBe(gnosisPilot.releaseId);
    expect(route.id).toBe(arbitrumPilot.releaseId);
    expect(same(route.core.address, arbitrumLatest.commitmentPoolingModule)).toBe(true);
    expect(same(route.core.owner, arbitrumPilot.endpointOwner)).toBe(true);
  });

  it.each([
    ["source", arbitrumPilot],
    ["destination", gnosisPilot],
  ] as const)("pins the recorded %s proxy, implementation, receipt and authorities", (name, record) => {
    const pin = route[name];
    const proxy = recorded(record, pin.address);
    const implementation = recorded(record, pin.implementation.address);
    expect(proxy.contract.contract).toBe(implementation.contract.contract);
    expect(pin.runtimeCodeHash).toBe(proxy.contract.runtimeHash);
    expect(pin.implementation.runtimeCodeHash).toBe(implementation.contract.runtimeHash);
    expect(proxy.receipt.status).toBe(1);
    expect(pin.receipt).toEqual({
      transactionHash: proxy.receipt.transactionHash,
      blockNumber: BigInt(proxy.receipt.blockNumber),
      blockHash: proxy.receipt.blockHash,
    });
    expect(same(pin.owner, record.endpointOwner)).toBe(true);
    expect(same(pin.guardian, record.pauseGuardian)).toBe(true);
  });

  it("pins the two recorded voucher tokens with the Safe that issues each", () => {
    const issuers: Record<string, string> = {
      greenGoodsToken: gnosisPilot.endpointOwner,
      techAndSunToken: gnosisPilot.techAndSunBootstrap.safe,
    };
    expect(route.assets).toHaveLength(2);
    for (const asset of route.assets) {
      const { contract } = recorded(gnosisPilot, asset.token);
      expect(asset.runtimeCodeHash).toBe(contract.runtimeHash);
      expect(same(asset.issuer, issuers[contract.contract]!)).toBe(true);
    }
  });
});
