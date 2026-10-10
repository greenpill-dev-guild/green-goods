import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { JsonRpcProvider } from "ethers";

export function reportingCompatibilityOptions(argv: string[]): void {
  if (argv.length !== 3 || argv[0] !== "--network" || argv[1] !== "arbitrum" || argv[2] !== "--simulate")
    throw new Error("Reporting Kernel verification supports only --network arbitrum --simulate");
}

export function assertReportingFixtureRpc(rpc: string): void {
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

export async function startReportingFork(
  upstream: string,
): Promise<{ rpc: string; process: ChildProcess; stop: () => Promise<void>; forkBlock: number }> {
  const source = new JsonRpcProvider(upstream);
  let forkBlock: number;
  try {
    if (Number((await source.getNetwork()).chainId) !== 42161)
      throw new Error("Reporting gate upstream is not Arbitrum");
    forkBlock = await source.getBlockNumber();
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
      "42161",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--silent",
    ],
    { stdio: "ignore" },
  );
  const rpc = `http://127.0.0.1:${port}`;
  assertReportingFixtureRpc(rpc);
  const stop = async () => {
    if (child.exitCode !== null) return;
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
  const provider = new JsonRpcProvider(rpc, { name: "arbitrum", chainId: 42161 }, { staticNetwork: true });
  let spawnError = false;
  child.once("error", () => {
    spawnError = true;
  });
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null || spawnError) throw new Error("Isolated Anvil fork could not start");
      try {
        const info = await provider.send("anvil_nodeInfo", []);
        if (Number(info.environment?.chainId) !== 42161 || info.forkConfig?.forkBlockNumber !== forkBlock)
          throw new Error("Reporting gate requires an actual Arbitrum fork");
        return { rpc, process: child, stop, forkBlock: info.forkConfig.forkBlockNumber };
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw new Error("Isolated Arbitrum fork did not become ready");
  } catch (error) {
    await stop();
    throw error;
  } finally {
    provider.destroy();
  }
}

export function reportingFixtureArtifact(contractsRoot: string, name: string) {
  const directory =
    name === "SingleAttestationPolicy" ? "SingleAttestationPolicy.sol" : "ReportingKernelFixtures.s.sol";
  const file = path.join(contractsRoot, ".generated/foundry/out/production", directory, `${name}.json`);
  const artifact = JSON.parse(readFileSync(file, "utf8"));
  if (!artifact.abi || !/^0x(?:[0-9a-fA-F]{2})+$/u.test(artifact.bytecode?.object ?? ""))
    throw new Error("Invalid compiled reporting fixture");
  return { abi: artifact.abi, bytecode: artifact.bytecode.object as `0x${string}` };
}
