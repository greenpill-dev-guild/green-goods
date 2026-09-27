/**
 * Loopback development driver for agent reporting.
 *
 * It composes the production reporting runtime (real SQLite, keyring, coordinator, worker, browser
 * ceremony routes and operator routes) with fixture ports: an in-memory chain that decodes real
 * EAS calldata, a fixture Action catalog, a recorded outbound transport and fixture wallets. It is
 * explicit test composition: it binds to 127.0.0.1 only, refuses production, and its synthetic
 * ingress and signing helpers exist nowhere in `createServer`. Nothing it shows is live proof of a
 * provider, wallet or chain.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReportingProofMessage } from "@green-goods/shared/modules/agent-reporting";
import { Hono } from "hono";
import sharp from "sharp";
import { verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as z from "zod";
import { registerMessagingRoutes } from "../../../api/routes/messaging";
import { registerReportingOpsRoutes } from "../../../api/routes/reporting-ops";
import { createReportingRuntime, type ReportingRuntime } from "../../../runtime/reporting";
import { challengeById, proofFields } from "../../../services/reporting/browser-access";
import { requestById } from "../../../services/reporting/continuations";
import type { ReportingConfig } from "../../../services/reporting/config";
import { FixtureUploader } from "../support/browser";
import { FakeChain } from "../support/fake-chain";
import { AIYELOJA, FixtureCatalog, RecordingTransport, TAS } from "../support/fixtures";
import { FixtureMediaFetcher } from "../support/media";
import { mountSyntheticIngress } from "../support/synthetic";

/** Well-known development keys; they hold nothing and exist only for this driver and the tests. */
export const WALLETS = {
  ada: privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"),
  steward: privateKeyToAccount(
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
  ),
} as const;

export const DRIVER_API_TOKEN = "driver-local-token";

export interface Driver {
  url: string;
  runtime: ReportingRuntime;
  chain: FakeChain;
  transport: RecordingTransport;
  stop(): Promise<void>;
}

function key(): string {
  return randomBytes(32).toString("base64");
}

/**
 * `origin` is the browser origin the ceremony runs on. By default the driver serves its own API
 * under `/api/messaging`, as the Vercel proxy does; a local client dev server can instead proxy
 * `/api/messaging` here and pass its own origin.
 */
export async function startDriver(
  options: { port?: number; dataDir?: string; origin?: string } = {}
): Promise<Driver> {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("The reporting driver never runs in production");
  }
  let app: Hono | null = null;
  // Loopback only; port 0 picks a free port for tests.
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port ?? 8787,
    fetch: (request) => (app ? app.fetch(request) : new Response("starting", { status: 503 })),
  });
  const origin = options.origin ?? `http://127.0.0.1:${server.port}`;
  const dataDir = options.dataDir ?? mkdtempSync(join(tmpdir(), "gg-reporting-driver-"));
  const chain = new FakeChain();
  const transport = new RecordingTransport();
  const media = new Map<string, Uint8Array>();
  chain.grantRole(TAS.address, WALLETS.ada.address, { gardener: true });
  chain.grantRole(TAS.address, WALLETS.steward.address, { operator: true });

  const config: ReportingConfig = {
    dbPath: join(dataDir, "reporting.db"),
    mediaDir: join(dataDir, "media"),
    keys: {
      encryptionKeys: `d1:${key()}`,
      currentEncryptionVersion: "d1",
      lookupKeys: `l1:${key()}`,
      currentLookupVersion: "l1",
    },
    browserOrigin: origin,
    gardens: [TAS, AIYELOJA],
    supportContact: null,
    initialControls: {
      intake: true,
      model_processing: false,
      publication: true,
      outbound_messages: true,
    },
    interpretation: { provider: "none" },
    openai: null,
    pinata: null,
    bundlerRpcUrl: null,
    voiceEnabled: false,
    documentsEnabled: false,
    conversionEnabled: false,
    workerIntervalMs: 250,
  };
  const runtime = createReportingRuntime({
    config,
    chainId: 42161,
    chain,
    catalog: new FixtureCatalog(),
    interpreter: null,
    uploader: new FixtureUploader(),
    verifier: async ({ address, message, signature }) =>
      verifyMessage({ address, message, signature }),
    transport,
    mediaFetcher: new FixtureMediaFetcher(media),
    secureCookies: false,
    workerId: "driver",
  });

  app = new Hono();
  mountSyntheticIngress(app, () => runtime.core);
  const api = new Hono();
  registerMessagingRoutes(api, runtime.messaging);
  app.route("/api", api);
  registerReportingOpsRoutes(app, { botApiToken: DRIVER_API_TOKEN }, () => runtime.core);

  app.get("/__driver/outbox", (c) => {
    const since = Number(c.req.query("since") ?? 0);
    return c.json(
      transport.sent.slice(since).map((sent, index) => ({
        index: since + index,
        chat: sent.externalChatId,
        text: sent.message.text,
        choices: sent.message.choices ?? [],
        link: sent.message.link ?? null,
      }))
    );
  });

  app.put("/__driver/media/:id", async (c) => {
    media.set(c.req.param("id"), new Uint8Array(await c.req.arrayBuffer()));
    return c.json({ ok: true });
  });

  app.post("/__driver/media/:id/sample-photo", async (c) => {
    const photo = await sharp({
      create: { width: 320, height: 240, channels: 3, background: "#40916c" },
    })
      .withExif({ IFD0: { Artist: "sample", Copyright: "fixture" } })
      .jpeg()
      .toBuffer();
    media.set(c.req.param("id"), new Uint8Array(photo));
    return c.json({ ok: true, bytes: photo.byteLength });
  });

  // Signs the exact proof message the Agent will rebuild for this challenge, as a wallet would.
  app.post("/__driver/wallets/:name/prove", async (c) => {
    const wallet = WALLETS[c.req.param("name") as keyof typeof WALLETS];
    const body = z
      .object({ challengeId: z.string() })
      .safeParse(await c.req.json().catch(() => null));
    if (!wallet || !body.success) return c.json({ error: "unknown wallet or challenge" }, 400);
    const core = runtime.core;
    const challenge = challengeById(core, body.data.challengeId);
    const request = challenge ? requestById(core, challenge.requestId) : null;
    if (!challenge || !request) return c.json({ error: "unknown challenge" }, 404);
    const fields = proofFields(core, request, challenge);
    const signature = await wallet.signMessage({
      message: buildReportingProofMessage(fields, wallet.address),
    });
    return c.json({ account: wallet.address, signature });
  });

  // Includes a wallet's EAS call in the fixture chain, as if the wallet had sent it.
  app.post("/__driver/chain/submit", async (c) => {
    const body = z
      .object({
        wallet: z.enum(["ada", "steward"]),
        to: z.string(),
        data: z.string().startsWith("0x"),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid submission" }, 400);
    const hash = chain.submit({
      attester: WALLETS[body.data.wallet].address,
      to: body.data.to,
      data: body.data.data as `0x${string}`,
    });
    return c.json({ transactionHash: hash });
  });

  app.post("/__driver/tick", async (c) => c.json(await runtime.tickOnce()));

  runtime.start();
  return {
    url: `http://127.0.0.1:${server.port}`,
    runtime,
    chain,
    transport,
    async stop() {
      server.stop(true);
      await runtime.stop();
    },
  };
}

if (import.meta.main) {
  const port = Number(process.env.REPORTING_DRIVER_PORT ?? 8787);
  const driver = await startDriver({
    port,
    ...(process.env.REPORTING_DRIVER_ORIGIN ? { origin: process.env.REPORTING_DRIVER_ORIGIN } : {}),
  });
  console.log(`Reporting driver listening on ${driver.url} (fixture chain, recorded transport)`);
  console.log(`Operator token for /reporting/ops/*: Bearer ${DRIVER_API_TOKEN}`);
  process.on("SIGINT", () => void driver.stop().then(() => process.exit(0)));
}
