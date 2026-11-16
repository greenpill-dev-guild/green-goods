import { JsonRpcProvider } from "ethers";
import { expect, it } from "vitest";
import { createIsolatedSeed } from "./isolated-fork.fixtures";
import { startIsolatedFork } from "./isolated-fork";

it("reads current synthetic upstream code when its pinned block has not advanced", async () => {
  const chainId = 31338;
  const account = "0x1111111111111111111111111111111111111111";
  const codes = ["0x60016000f3", "0x60026000f3"];
  const first = await createIsolatedSeed(chainId);
  try {
    await first.client.send("evm_mine", []);
    for (const code of codes) {
      await first.client.send("anvil_setCode", [account, code]);
      expect(await first.client.getCode(account)).toBe(code);
      expect(await first.client.getBlockNumber()).toBe(1);
      const fork = await startIsolatedFork(first.url, chainId);
      const client = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
      try {
        expect(await client.getCode(account)).toBe(code);
      } finally {
        client.destroy();
        await fork.stop();
      }
    }
    expect(await first.client.getCode(account)).toBe(codes[1]);
  } finally {
    await first.stop();
  }
});
