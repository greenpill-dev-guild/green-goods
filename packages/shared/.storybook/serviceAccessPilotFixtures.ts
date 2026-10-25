import { createServiceRehearsalAdapter } from "../src/modules/commitment-pooling/demo/demo-service-access";
import type { ServiceAccessKey } from "../src/modules/commitment-pooling/service-access-types";

/** Storybook-only composition: real DEV adapter, fictional accounts, no RPC or signing. */
export function createServiceAccessPilotStory() {
  const key: ServiceAccessKey = {
    sourceChainId: 42161,
    coreModule: "0x000000000000000000000000000000000000f100",
    commitmentId: 1026n,
    buyer: "0x000000000000000000000000000000000000f101",
  };
  return { key, adapter: createServiceRehearsalAdapter() };
}
