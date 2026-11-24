import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { JsonRpcProvider } from "ethers";

/** Process-owned synthetic upstream; callers must stop it in afterAll/finally. */
export async function createIsolatedSeed(chainId: number) {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const child = spawn(
    "anvil",
    ["--host", "127.0.0.1", "--port", String(port), "--chain-id", String(chainId), "--silent"],
    { stdio: "ignore" },
  );
  const url = `http://127.0.0.1:${port}`;
  const client = new JsonRpcProvider(url, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  const stop = async () => {
    client.destroy();
    if (child.exitCode !== null || !child.pid) return;
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
  let spawnError = false;
  child.once("error", () => {
    spawnError = true;
  });
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError || child.exitCode !== null) throw new Error("Synthetic seed Anvil unavailable");
      try {
        await client.send("anvil_nodeInfo", []);
        return { client, url, stop };
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    throw new Error("Synthetic seed startup timed out");
  } catch (error) {
    await stop();
    throw error;
  }
}
