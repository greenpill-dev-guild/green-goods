/**
 * @vitest-environment node
 */

import { config as loadEnv } from "dotenv";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import { AAVE_V3_POOL_ABI, rayToApy } from "../../../utils/blockchain/aave";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../../../../.env") });

const ARBITRUM_AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const ARBITRUM_WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const ARBITRUM_DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1";
const RUN_LIVE_RPC_TESTS =
  process.env.RUN_LIVE_RPC_TESTS === "true" && Boolean(process.env.ARBITRUM_RPC_URL);

const describeLive = RUN_LIVE_RPC_TESTS ? describe : describe.skip;

async function postJsonRpc(url: string, body: Record<string, unknown>) {
  const target = new URL(url);
  const requestImpl = target.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<any>((resolvePromise, rejectPromise) => {
    const req = requestImpl(
      target,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(responseBody);
            if (parsed.error) {
              rejectPromise(new Error(parsed.error.message ?? "JSON-RPC request failed"));
              return;
            }
            resolvePromise(parsed.result);
          } catch (error) {
            rejectPromise(error);
          }
        });
      }
    );

    req.on("error", rejectPromise);
    req.write(JSON.stringify(body));
    req.end();
  });
}

describeLive("Aave reserve live reads", () => {
  it("reads finite APY values for Arbitrum WETH and DAI", async () => {
    const rpcUrl = process.env.ARBITRUM_RPC_URL!;

    for (const asset of [ARBITRUM_WETH, ARBITRUM_DAI] as const) {
      const calldata = encodeFunctionData({
        abi: AAVE_V3_POOL_ABI,
        functionName: "getReserveData",
        args: [asset],
      });
      const result = await postJsonRpc(rpcUrl, {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          {
            to: ARBITRUM_AAVE_V3_POOL,
            data: calldata,
          },
          "latest",
        ],
      });
      const reserveData = decodeFunctionResult({
        abi: AAVE_V3_POOL_ABI,
        functionName: "getReserveData",
        data: result,
      });

      const apy = rayToApy(reserveData.currentLiquidityRate);

      expect(reserveData.currentLiquidityRate > 0n).toBe(true);
      expect(Number.isFinite(apy)).toBe(true);
      expect(apy).toBeGreaterThan(0);
      expect(apy).toBeLessThan(100);
    }
  });
});
