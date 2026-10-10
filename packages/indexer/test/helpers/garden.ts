import type { Garden, TestIndexer } from "envio";
import type { Address } from "viem";

import { createDefaultGarden } from "../../src/handlers/entity-defaults";
import { addr, CHAINS } from "./events";

export function seedGarden(
  mockDb: TestIndexer,
  gardenAddress: Address,
  overrides: Partial<Garden> = {}
): TestIndexer {
  mockDb.Garden.set({
    ...createDefaultGarden(gardenAddress, CHAINS.arbitrum, 1_000),
    tokenAddress: addr(1),
    tokenID: 1n,
    name: "Test Garden",
    initialized: true,
    ...overrides,
  });
  return mockDb;
}
