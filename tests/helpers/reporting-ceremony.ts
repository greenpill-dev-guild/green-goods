/**
 * What stands behind the reporting ceremony's Account step in a browser run.
 *
 * Real: the compiled dev client, Chromium's WebAuthn ceremony on a virtual authenticator, the
 * app's own check of a passkey against the directory's key, and the Agent's reporting core behind
 * `/api/messaging`, served by its loopback driver.
 *
 * Stand-ins, each answering only what this step asks for: the chat (synthetic events in, recorded
 * replies out), the passkey directory, the hosted passkey server and the chain. Any other request
 * that leaves the client fails the test, so a run never waits on a network.
 */
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { type APIRequestContext, expect, type Page, type Route } from "@playwright/test";
import { type Hex, keccak256 } from "viem";
import { PUBLIC_AGENT_ROUTES } from "../../packages/shared/src/public-contracts/routes";
import { REPORTING_DRIVER_URL } from "../fixtures/playwright-services";
import { TEST_URLS } from "./test-utils";

interface ChatReply {
  chat: string;
  choices: Array<{ id: string; label: string }>;
  link: { url: string } | null;
}

async function say(request: APIRequestContext, chat: string, text: string, replyId?: string) {
  const id = randomUUID();
  const accepted = await request.post(`${REPORTING_DRIVER_URL}/__synthetic/events`, {
    data: {
      kind: "message",
      providerRealm: "telegram-fixture:wefa",
      eventId: id,
      providerMessageId: `in-${id}`,
      chat: { externalChatId: chat, kind: "direct" },
      sender: { externalSubjectId: chat },
      sentAt: Date.now(),
      text,
      ...(replyId ? { replyId } : {}),
    },
  });
  expect(accepted.status(), `the driver takes "${text}"`).toBe(202);
}

/** The bot's reply in this chat that fits. Its worker answers within a moment of the message. */
async function replyIn(
  request: APIRequestContext,
  chat: string,
  fits: (reply: ChatReply) => boolean
): Promise<ChatReply> {
  let found: ChatReply | undefined;
  await expect(async () => {
    const outbox = await request.get(`${REPORTING_DRIVER_URL}/__driver/outbox`);
    found = ((await outbox.json()) as ChatReply[]).find(
      (reply) => reply.chat === chat && fits(reply)
    );
    expect(found, `a reply in ${chat}`).toBeDefined();
  }).toPass({ timeout: 15_000 });
  return found as ChatReply;
}

/**
 * The link that joins a new chat to an account, as the bot sends it. A new chat is asked to agree
 * to message handling before anything else, so the link follows "I agree".
 */
export async function requestAccountLink(request: APIRequestContext): Promise<string> {
  const chat = `account-step-${randomUUID()}`;
  await say(request, chat, "CONNECT");
  const notice = await replyIn(request, chat, (reply) => reply.choices.length > 0);
  const agree = notice.choices.find((choice) => choice.label === "I agree");
  expect(agree, "the consent notice offers I agree").toBeDefined();
  await say(request, chat, "I agree", agree?.id);
  const sent = await replyIn(request, chat, (reply) => reply.link !== null);
  const link = sent.link?.url ?? "";
  // The driver serves one origin and refuses a page on any other.
  expect(new URL(link).origin, "the link opens on the client under test").toBe(TEST_URLS.client);
  return link;
}

const RP_ID = "localhost";
const DIRECTORY_URL = `http://localhost:3005${PUBLIC_AGENT_ROUTES.passkeyDirectory}`;
const CHAIN_HOSTS = ["eth-sepolia.g.alchemy.com", "ethereum-sepolia.publicnode.com"];
/** Telemetry and remote configuration the wallet runtime asks for unprompted. */
const VENDOR_HOSTS = [
  "api.web3modal.org",
  "api.web3modal.com",
  "pulse.walletconnect.org",
  "cca-lite.coinbase.com",
  "us.i.posthog.com",
  "eu.i.posthog.com",
  "us-assets.i.posthog.com",
  "eu-assets.i.posthog.com",
];

interface DirectoryEntry {
  id: string;
  publicKey: Hex;
  rpId: string;
}

/** A P-256 public key as the x and y the app stores and derives an account from. */
function coordinates(publicKey: KeyObject): Hex {
  const { x = "", y = "" } = publicKey.export({ format: "jwk" });
  const hex = (part: string) => Buffer.from(part, "base64url").toString("hex");
  return `0x${hex(x)}${hex(y)}`;
}

async function answer(
  route: Route,
  respond: (method: string, params: unknown[]) => unknown | Promise<unknown>
) {
  const {
    id,
    method,
    params = [],
  } = route.request().postDataJSON() as {
    id: number;
    method: string;
    params?: unknown[];
  };
  await route.fulfill({ json: { jsonrpc: "2.0", id, result: await respond(method, params) } });
}

/**
 * Puts a virtual authenticator on the page and stands in for everything the Account step reaches
 * beyond the client and the driver. Call it before the page opens its link.
 */
export async function standInBehindAccountStep(page: Page) {
  const cdp = await page.context().newCDPSession(page);
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
  const passkeys = async () =>
    (await cdp.send("WebAuthn.getCredentials", { authenticatorId })).credentials;

  const names = new Map<string, DirectoryEntry>();
  let linkOpenings = 0;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const directory = async (method: string, params: unknown[]) => {
    const [first, second] = params as [{ userName?: string; id?: string }, { userName: string }];
    if (method === "pks_getCredentials") {
      const held = names.get(first.userName ?? "");
      return held ? [held] : [];
    }
    if (method === "pks_startRegistration") {
      const userName = first.userName ?? "";
      return {
        attestation: "none",
        challenge: randomBytes(32).toString("base64"),
        rp: { id: RP_ID, name: "Green Goods test" },
        user: {
          id: Buffer.from(userName).toString("base64"),
          name: userName,
          displayName: userName,
        },
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "required",
        },
        timeout: 20_000,
      };
    }
    if (method === "pks_verifyRegistration") {
      // The directory keeps the key the passkey really has, because the app checks every later
      // sign-in against it and derives the account from it.
      const made = (await passkeys()).find(
        (passkey) => Buffer.from(passkey.credentialId, "base64").toString("base64url") === first.id
      );
      if (!made || !first.id) {
        throw new Error("The page registered a passkey the authenticator does not hold");
      }
      const privateKey = createPrivateKey({
        key: Buffer.from(made.privateKey, "base64"),
        format: "der",
        type: "pkcs8",
      });
      const entry = {
        id: first.id,
        publicKey: coordinates(createPublicKey(privateKey)),
        rpId: RP_ID,
      };
      names.set(second.userName, entry);
      return { success: true, ...entry, userName: second.userName };
    }
    throw new Error(`Unexpected passkey directory call: ${method}`);
  };

  // Every account in a run is made through the directory, so the hosted server knows no name.
  const hostedServer = (method: string) => {
    if (method === "pks_getCredentials") return [];
    throw new Error(`Unexpected hosted passkey server call: ${method}`);
  };

  /**
   * The one chain read on this step: the address an account will have, asked for by simulating a
   * helper contract's deployment. The stand-in derives an address from that call's data, so one
   * passkey always has one address and two passkeys never share one. It is not the address a
   * chain would give.
   */
  const chain = (method: string, params: unknown[]) => {
    const [call] = params as [{ to?: string; data?: Hex } | undefined];
    if (method !== "eth_call" || call?.to || !call?.data) {
      throw new Error(`Unexpected chain call: ${method} ${JSON.stringify(params).slice(0, 200)}`);
    }
    return `0x${keccak256(call.data).slice(-40).padStart(64, "0")}`;
  };

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === TEST_URLS.client) {
      // The page opens its link with this call: once per mount of the app.
      if (request.method() === "POST" && url.pathname === "/api/messaging/challenges") {
        linkOpenings += 1;
      }
      return route.continue();
    }
    if (url.href === DIRECTORY_URL) return answer(route, directory);
    if (url.hostname === "api.pimlico.io") return answer(route, hostedServer);
    if (CHAIN_HOSTS.includes(url.hostname)) return answer(route, chain);
    if (url.hostname === "fonts.googleapis.com") {
      return route.fulfill({ contentType: "text/css", body: "" });
    }
    if (url.hostname === "fonts.reown.com") return route.abort("blockedbyclient");
    if (VENDOR_HOSTS.includes(url.hostname)) return route.fulfill({ json: {} });
    throw new Error(`Unexpected request on the Account step: ${request.method()} ${url.origin}`);
  });

  return {
    directory: {
      /** Another account already has this name. */
      takeName(name: string) {
        names.set(name, {
          id: randomBytes(16).toString("base64url"),
          publicKey: coordinates(generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey),
          rpId: RP_ID,
        });
      },
      holds: (name: string) => names.has(name),
    },
    /** How many passkeys the authenticator holds. */
    passkeys: async () => (await passkeys()).length,
    /** Whether a passkey prompt closes with no passkey, as a dismissed or timed-out one does. */
    async closePrompts(closed: boolean) {
      await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: !closed });
    },
    linkOpenings: () => linkOpenings,
    pageErrors,
  };
}
