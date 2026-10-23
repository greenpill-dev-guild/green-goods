import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { JsonRpcProvider } from "ethers";

export function assertIsolatedRpc(rpc: string): void {
  const parsed = new URL(rpc);
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    !parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("Fixture signing requires an isolated loopback Anvil RPC");
}

export async function startIsolatedFork(
  upstream: string,
  chainId: number,
): Promise<{
  rpc: string;
  process: ChildProcess;
  stop: () => Promise<void>;
  forkBlock: number;
  forkBlockHash: string;
}> {
  const source = new JsonRpcProvider(upstream);
  let forkBlock: number;
  let forkBlockHash: string;
  try {
    if (Number((await source.getNetwork()).chainId) !== chainId)
      throw new Error("Isolated fork upstream chain mismatch");
    forkBlock = await source.getBlockNumber();
    const block = await source.getBlock(forkBlock);
    if (!block?.hash) throw new Error("Cannot pin isolated fork block hash");
    forkBlockHash = block.hash;
  } finally {
    source.destroy();
  }
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  const child = spawn(
    "anvil",
    [
      "--fork-url",
      upstream,
      "--fork-block-number",
      String(forkBlock),
      "--chain-id",
      String(chainId),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--silent",
    ],
    { stdio: "ignore" },
  );
  const cleanupOnExit = () => {
    if (child.exitCode === null && child.pid) child.kill("SIGTERM");
  };
  process.once("exit", cleanupOnExit);
  child.once("exit", () => process.off("exit", cleanupOnExit));
  const rpc = `http://127.0.0.1:${port}`;
  assertIsolatedRpc(rpc);
  const stop = async () => {
    if (child.exitCode !== null || !child.pid) {
      process.off("exit", cleanupOnExit);
      return;
    }
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 2000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  };
  const provider = new JsonRpcProvider(rpc, { name: "isolated-fork", chainId }, { staticNetwork: true });
  let spawnError = false;
  child.once("error", () => {
    spawnError = true;
  });
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null || spawnError) throw new Error("Isolated Anvil fork could not start");
      try {
        const info = await provider.send("anvil_nodeInfo", []);
        if (Number(info.environment?.chainId) !== chainId || info.forkConfig?.forkBlockNumber !== forkBlock)
          throw new Error("Isolated fork chain or pinned block mismatch");
        const block = await provider.getBlock(forkBlock);
        if (block?.hash !== forkBlockHash) throw new Error("Isolated fork block hash mismatch");
        return { rpc, process: child, stop, forkBlock: info.forkConfig.forkBlockNumber, forkBlockHash };
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw new Error("Isolated fork did not become ready");
  } catch (error) {
    await stop();
    throw error;
  } finally {
    provider.destroy();
  }
}

export function maskImmutableRuntime(
  code: string,
  references: Record<string, Array<{ start: number; length: number }>> = {},
) {
  let bytes = code.slice(2);
  for (const offsets of Object.values(references))
    for (const { start, length } of offsets) {
      if (!Number.isInteger(start) || start < 0 || length !== 32 || start + length > bytes.length / 2)
        throw new Error("Invalid immutable reference in reviewed runtime");
      bytes = bytes.slice(0, start * 2) + "00".repeat(length) + bytes.slice((start + length) * 2);
    }
  return `0x${bytes}`;
}
export async function minedIsolatedReceipt(provider: JsonRpcProvider, hash: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Isolated transaction receipt remained unavailable after bounded polling");
}
