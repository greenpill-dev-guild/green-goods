// Runner: drives clean-room Chromium with a virtual passkey through the rig, then checks the
// resulting signatures against the deployed Kernel WebAuthn validator on Arbitrum One with a
// read-only eth_call (state override, no transaction).
import { createRequire } from "node:module";
import { resolve } from "node:path";

const RIG = import.meta.dir;
const REPO = resolve(RIG, "../../../../..");
const CERTS = process.env.RIG_CERT_DIR;
if (!CERTS) throw new Error("Set RIG_CERT_DIR to the folder holding key.pem, cert.pem and spki.txt");
// Results go where RIG_RESULTS points, so a rerun never rewrites the dated copy by accident.
const RESULTS = process.env.RIG_RESULTS ?? `${CERTS}/results.json`;
const rootRequire = createRequire(`${REPO}/package.json`);
const sharedRequire = createRequire(`${REPO}/packages/shared/package.json`);
const { chromium } = rootRequire("@playwright/test");
const viem = sharedRequire("viem");
const { toWebAuthnAccount, entryPoint07Address } = sharedRequire("viem/account-abstraction");
const { toKernelSmartAccount } = sharedRequire("permissionless/accounts");
const { arbitrum } = sharedRequire("viem/chains");

const SPKI = (await Bun.file(`${CERTS}/spki.txt`).text()).trim();
const CONTROL = "http://127.0.0.1:47081";
const PROXY = "http://127.0.0.1:47080";
const VALIDATOR = "0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd";
const RPC_URLS = (process.env.RIG_RPC_URLS ?? "https://arb1.arbitrum.io/rpc,https://arbitrum-one-rpc.publicnode.com")
  .split(",")
  .map((url) => url.trim());

const control = async (path: string) => (await fetch(`${CONTROL}${path}`)).json();
const randomHash = () => viem.toHex(crypto.getRandomValues(new Uint8Array(32)));

type Result<T> = { failed: false; value: T } | { failed: true; name: string; message: string };

async function browserSession() {
  const browser = await chromium.launch({
    headless: true,
    proxy: { server: PROXY },
    args: [`--ignore-certificate-errors-spki-list=${SPKI}`],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    version: browser.version(),
    async open(host: string) {
      await page.goto(`https://${host}/`);
      await page.waitForFunction(() => document.body?.dataset.rigReady === "true");
    },
    call<T>(fn: string, ...args: unknown[]): Promise<Result<T>> {
      return page.evaluate(
        ([name, values]: [string, unknown[]]) => (window as any).rig[name](...values),
        [fn, args]
      );
    },
    async passkeys() {
      const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
      return credentials.map((credential: { rpId: string; isResidentCredential: boolean }) => ({
        rpId: credential.rpId,
        resident: credential.isResidentCredential,
      }));
    },
    close: () => browser.close(),
  };
}

type Signer = { id: string; publicKey: `0x${string}`; signingId?: string };
type Entry = { id: string; publicKey: `0x${string}`; rpId: string };

function must<T>(label: string, result: Result<T>): T {
  if (result.failed) throw new Error(`${label} failed: ${result.name}: ${result.message}`);
  return result.value;
}

const results: Record<string, unknown> = {};
await control("/reset");

// ── A. A host-bound beta passkey, used from www and admin through Related Origin Requests ──
await control("/mode?ror=on");
let betaEntry: Entry;
const signatures: { label: string; hash: `0x${string}`; signature: `0x${string}`; publicKey: `0x${string}` }[] = [];
{
  const s = await browserSession();
  results.chromium = s.version;
  await s.open("beta.greengoods.app");
  const created = must("create on beta", await s.call<{ id: string; publicKey: `0x${string}`; rawIdHex: string }>("createHostBound", "beta-tester"));
  betaEntry = { id: created.id, publicKey: created.publicKey, rpId: "beta.greengoods.app" };
  const homeSignIn = await s.call<Signer & { rpId: string }>("signIn", "beta-tester", [betaEntry]);
  // The same passkey listed under the hex form of its ID, as the hosted server stores some IDs.
  const homeSignInHexId = await s.call("signIn", "beta-tester", [{ ...betaEntry, id: created.rawIdHex }]);
  const homeHash = randomHash();
  const homeSig = must("sign on beta", await s.call<`0x${string}`>("signHash", must("sign in on beta", homeSignIn), betaEntry.rpId, homeHash));
  signatures.push({ label: "beta passkey, signed on beta", hash: homeHash, signature: homeSig, publicKey: created.publicKey });

  await s.open("www.greengoods.app");
  const wwwSignIn = await s.call<Signer & { rpId: string }>("signIn", "beta-tester", [betaEntry]);
  const wwwSignInHexId = await s.call<Signer & { rpId: string }>("signIn", "beta-tester", [{ ...betaEntry, id: created.rawIdHex }]);
  const wwwHash = randomHash();
  const wwwSig = must("sign on www", await s.call<`0x${string}`>("signHash", must("sign in on www", wwwSignIn), betaEntry.rpId, wwwHash));
  signatures.push({ label: "beta passkey, signed on www through related origins", hash: wwwHash, signature: wwwSig, publicKey: created.publicKey });
  const offSiteAdoption = await s.call("adoptEntry", "beta-tester", betaEntry);

  await s.open("admin.greengoods.app");
  const adminSignIn = await s.call<Signer & { rpId: string }>("signIn", "beta-tester", [betaEntry]);

  results.A_related_origins = {
    passkeysOnDevice: await s.passkeys(),
    signInOnBeta: homeSignIn,
    signInOnBetaWithHexStoredId: homeSignInHexId,
    signInOnWww: wwwSignIn,
    signInOnWwwWithHexStoredId: wwwSignInHexId,
    signInOnAdmin: adminSignIn,
    adoptionAttemptFromWww: offSiteAdoption,
    wellKnownFetches: (await control("/log")).wellKnownHits,
  };
  await s.close();
}

// ── A′. Controls: the same passkey on www without the file, and with www missing from it ──
for (const mode of ["off", "admin-only"] as const) {
  await control(`/mode?ror=${mode}`);
  const s = await browserSession();
  await s.open("beta.greengoods.app");
  const created = must("create on beta", await s.call<{ id: string; publicKey: `0x${string}` }>("createHostBound", "control"));
  await s.open("www.greengoods.app");
  results[`A_control_${mode}`] = {
    signInOnWww: await s.call("signIn", "control", [{ id: created.id, publicKey: created.publicKey, rpId: "beta.greengoods.app" }]),
  };
  await s.close();
}

// ── C. An app-made apex passkey from before August, adopted on www, used on admin and beta ──
await control("/mode?ror=off");
let legacy: { id: string; publicKey: `0x${string}`; storedRpId: string | null };
let adoptedSignIn: Signer & { rpId: string };
{
  const s = await browserSession();
  await s.open("www.greengoods.app");
  legacy = must("legacy create", await s.call("createLegacyLocal", "legacy-gardener"));
  const adoption = await s.call<{ first: unknown; replay: unknown }>("adoptStored", "legacy-gardener");
  const wrongKey = await s.call("adoptStored", "legacy-gardener-2", { publicKey: betaEntry.publicKey });
  const sameNameAgain = await s.call("adoptStored", "legacy-gardener");

  await s.open("admin.greengoods.app");
  const rememberedOnAdmin = await s.call("readStored");
  const adminSignIn = await s.call<Signer & { rpId: string }>("signIn", "legacy-gardener");
  if (adminSignIn.failed || !adminSignIn.value) {
    console.log(JSON.stringify({ partial: results, legacy, adoption, wrongKey, sameNameAgain, rememberedOnAdmin, adminSignIn, log: await control("/log") }, null, 2));
    process.exit(2);
  }
  adoptedSignIn = must("sign in on admin", adminSignIn);
  const adminHash = randomHash();
  const adminSig = must("sign on admin", await s.call<`0x${string}`>("signHash", adoptedSignIn, adoptedSignIn.rpId, adminHash));
  signatures.push({ label: "adopted apex passkey, signed on admin", hash: adminHash, signature: adminSig, publicKey: legacy.publicKey });

  await s.open("beta.greengoods.app");
  const betaSignIn = await s.call("signIn", "legacy-gardener");

  results.C_adoption = {
    passkeysOnDevice: await s.passkeys(),
    legacyStoredRpId: legacy.storedRpId,
    adoption,
    adoptionWithWrongKey: wrongKey,
    adoptionOfTakenName: sameNameAgain,
    rememberedOnAdmin,
    signInOnAdmin: adminSignIn,
    signInOnBeta: betaSignIn,
  };
  await s.close();
}

// ── D. Same account? Kernel 0.3.1 address from the stored credential vs the adopted entry ──
async function withRpc<T>(work: (client: any, url: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const url of RPC_URLS) {
    try {
      const client = viem.createPublicClient({ chain: arbitrum, transport: viem.http(url) });
      return await work(client, url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function kernelAddress(client: any, credential: { id: string; publicKey: `0x${string}` }) {
  const account = await toKernelSmartAccount({
    client,
    version: "0.3.1",
    owners: [toWebAuthnAccount({ credential, rpId: "greengoods.app" })],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });
  return account.address as `0x${string}`;
}

const addresses = await withRpc(async (client, url) => ({
  rpc: new URL(url).host,
  fromStoredCredential: await kernelAddress(client, { id: legacy.id, publicKey: legacy.publicKey }),
  fromAdoptedEntry: await kernelAddress(client, { id: adoptedSignIn.id, publicKey: adoptedSignIn.publicKey }),
}));
results.D_same_account = { ...addresses, equal: addresses.fromStoredCredential === addresses.fromAdoptedEntry };

// ── E. Would the deployed validator accept each signature? ──
const validatorAbi = viem.parseAbi([
  "function isValidSignatureWithSender(address sender, bytes32 hash, bytes data) view returns (bytes4)",
]);

function keyCoordinates(publicKey: `0x${string}`) {
  const hex = publicKey.replace(/^0x/, "");
  const xy = hex.length === 130 && hex.startsWith("04") ? hex.slice(2) : hex;
  return { x: `0x${xy.slice(0, 64)}` as `0x${string}`, y: `0x${xy.slice(64, 128)}` as `0x${string}` };
}

async function validatorSays(client: any, account: `0x${string}`, hash: `0x${string}`, signature: `0x${string}`, publicKey: `0x${string}`) {
  const { x, y } = keyCoordinates(publicKey);
  const slot = viem.keccak256(viem.encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [account, 0n]));
  const nextSlot = viem.toHex(BigInt(slot) + 1n, { size: 32 });
  const { data } = await client.call({
    account,
    to: VALIDATOR,
    data: viem.encodeFunctionData({ abi: validatorAbi, functionName: "isValidSignatureWithSender", args: [account, hash, signature] }),
    stateOverride: [{ address: VALIDATOR, stateDiff: [{ slot, value: x }, { slot: nextSlot, value: y }] }],
  });
  return viem.decodeFunctionResult({ abi: validatorAbi, functionName: "isValidSignatureWithSender", data });
}

results.E_validator = await withRpc(async (client, url) => {
  const account = "0x00000000000000000000000000000000000a11ce" as `0x${string}`;
  const rows = [];
  for (const entry of signatures) {
    rows.push({
      label: entry.label,
      result: await validatorSays(client, account, entry.hash, entry.signature, entry.publicKey),
      // Control: the same signature over a different hash must fail.
      tamperedHash: await validatorSays(client, account, randomHash(), entry.signature, entry.publicKey),
    });
  }
  return { rpc: new URL(url).host, magicValue: "0x1626ba7e", rows };
});

await Bun.write(RESULTS, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
