import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createChainImportsPlugin } from "../../../vite/chain-imports";

type Transform = (
  this: { resolve: (source: string, importer: string) => Promise<{ id: string } | null> },
  code: string,
  id: string
) => Promise<{ code: string; map: unknown } | undefined>;

describe("chain imports", () => {
  it("splits named application imports while preserving aliases, types and unknown exports", async () => {
    const directory = await mkdtemp(join(tmpdir(), "chain-imports-"));
    try {
      const barrel = join(directory, "index.js");
      await writeFile(barrel, "export { mainnet } from './definitions/mainnet.js';");
      const plugin = createChainImportsPlugin();
      const transform = plugin.transform as Transform;
      const result = await transform.call(
        { resolve: vi.fn().mockResolvedValue({ id: barrel }) },
        "import { mainnet as network, type Chain, futureChain } from 'viem/chains';\nexport const chain: Chain = network;",
        "/repo/packages/shared/src/config/chains.ts"
      );
      expect(result?.code).toContain(
        `import { mainnet as network } from "${directory}/definitions/mainnet.js"`
      );
      expect(result?.code).toMatch(
        /import \{ type Chain, futureChain \} from ['"]viem\/chains['"]/
      );
      expect(result?.code).toContain("export const chain: Chain = network");
      expect(result?.map).toBeTruthy();
      expect(plugin.apply).toBe("build");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("leaves SDK imports and unrelated application modules alone", async () => {
    const transform = createChainImportsPlugin().transform as Transform;
    const resolve = vi.fn();
    expect(
      await transform.call(
        { resolve },
        "import * as chains from 'viem/chains';",
        "/repo/node_modules/wallet/index.js"
      )
    ).toBeUndefined();
    expect(
      await transform.call(
        { resolve },
        "export const value = 1;",
        "/repo/packages/client/src/main.tsx"
      )
    ).toBeUndefined();
    expect(resolve).not.toHaveBeenCalled();
  });
});
