// Browser side of the rig. Every passkey step goes through the app's own modules, so the proof
// exercises the code that ships: the directory sign-in, the local signature check, the signing
// owner, and Kernel's signature encoding.
import { createWebAuthnCredential } from "viem/account-abstraction";
import { bytesToHex } from "viem";
import { signMessage as kernelSignMessage } from "../../../../../packages/shared/node_modules/permissionless/_esm/accounts/kernel/utils/signMessage.js";
import { buildPasskeyRecoveryContext, createPasskey } from "../../../../../packages/shared/src/config/passkeyServer.ts";
import { verifyPasskeyAssertion } from "../../../../../packages/shared/src/modules/auth/passkey-assertion.ts";
import {
  getPasskeyRequestIds,
  getStoredCredential,
  getStoredRpId,
} from "../../../../../packages/shared/src/modules/auth/session.ts";
import { createPasskeyOwner } from "../../../../../packages/shared/src/workflows/auth-passkey-adapters.ts";
import { signInWithDirectory } from "../../../../../packages/shared/src/workflows/auth-passkey-directory.ts";

type Entry = { id: string; publicKey: `0x${string}`; rpId: string };
type Signer = { id: string; publicKey: `0x${string}`; signingId?: string };

function toB64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

/** The JSON shape @simplewebauthn/server reads, built from a browser assertion. */
function assertionJson(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toB64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toB64url(response.clientDataJSON),
      authenticatorData: toB64url(response.authenticatorData),
      signature: toB64url(response.signature),
      userHandle: response.userHandle ? toB64url(response.userHandle) : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

async function post(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return response.json();
}

/** The directory as `signInWithDirectory` sees it: the rig server, or a fixed list of entries. */
function directory(entries?: Entry[]) {
  return {
    getCredentials: async ({ context }: { context: { userName: string } }) =>
      entries ?? (await post("/__dir/lookup", { userName: context.userName })).entries,
  };
}

/** Only the adapters `signInWithDirectory` calls, each the app's own implementation. */
function adapters(entries?: Entry[]) {
  return {
    createDirectoryClient: () => directory(entries),
    buildRecoveryContext: buildPasskeyRecoveryContext,
    randomChallenge: () => crypto.getRandomValues(new Uint8Array(32)),
    getWebAuthnCredential: (options: CredentialRequestOptions) => navigator.credentials.get(options),
    verifyAssertion: (input: Parameters<typeof verifyPasskeyAssertion>[0]) =>
      verifyPasskeyAssertion({ ...input, origin: window.location.origin }),
    session: { getStoredCredential },
  } as unknown as Parameters<typeof signInWithDirectory>[0];
}

async function getAssertion(signer: Signer, rpId: string, challenge: Uint8Array) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId,
      userVerification: "required",
      allowCredentials: getPasskeyRequestIds(signer).map((id) => ({ id, type: "public-key" })),
      timeout: 60_000,
    },
  });
  if (!credential) throw new Error("no assertion");
  return assertionJson(credential as PublicKeyCredential);
}

function describe(error: unknown) {
  return error instanceof Error
    ? { failed: true, name: error.name, message: error.message.slice(0, 240) }
    : { failed: true, name: "unknown", message: String(error).slice(0, 240) };
}

async function guarded<T>(work: () => Promise<T>) {
  try {
    return { failed: false, value: await work() };
  } catch (error) {
    return describe(error);
  }
}

const rig = {
  /** A passkey for this page's own host, as the hosted server issued them. */
  createHostBound: (name: string) =>
    guarded(async () => {
      const credential = await createWebAuthnCredential({
        name,
        rp: { id: window.location.hostname, name: "Green Goods" },
      });
      return {
        id: credential.id,
        publicKey: credential.publicKey,
        rawIdHex: bytesToHex(new Uint8Array(credential.raw.rawId)).slice(2),
      };
    }),

  /** The app's local-only creation path, which made the January to August passkeys. */
  createLegacyLocal: (name: string) =>
    guarded(async () => {
      const credential = await createPasskey(name);
      return { id: credential.id, publicKey: credential.publicKey, storedRpId: getStoredRpId() };
    }),

  readStored: () => ({ credential: getStoredCredential(), rpId: getStoredRpId() }),

  /** Adoption as designed: prove possession of the remembered passkey over a server challenge. */
  adoptStored: (userName: string, overrides: { publicKey?: `0x${string}` } = {}) =>
    guarded(async () => {
      const credential = getStoredCredential();
      const rpId = getStoredRpId();
      if (!credential || !rpId) throw new Error("This browser remembers no passkey");
      const { challenge } = await post("/__dir/challenge", {});
      const response = await getAssertion(credential, rpId, fromB64url(challenge));
      const body = {
        userName,
        credentialId: credential.id,
        publicKey: overrides.publicKey ?? credential.publicKey,
        rpId,
        response,
      };
      const first = await post("/__dir/adopt", body);
      // A copy of the same answer must be refused: a challenge answers one adoption.
      const replay = await post("/__dir/adopt", { ...body, userName: `${userName}-again` });
      return { first, replay };
    }),

  /** Adoption attempted for a passkey this page's host cannot use without a related origin. */
  adoptEntry: (userName: string, entry: Entry) =>
    guarded(async () => {
      const { challenge } = await post("/__dir/challenge", {});
      const response = await getAssertion(entry, entry.rpId, fromB64url(challenge));
      return post("/__dir/adopt", {
        userName,
        credentialId: entry.id,
        publicKey: entry.publicKey,
        rpId: entry.rpId,
        response,
      });
    }),

  /** The app's directory sign-in, against the rig server or a fixed entry list. */
  signIn: (userName: string, entries?: Entry[]) =>
    guarded(async () => {
      const result = await signInWithDirectory(adapters(entries), userName);
      if (!result) return null;
      return {
        id: result.credential.id,
        signingId: result.credential.signingId,
        publicKey: result.credential.publicKey,
        rpId: result.rpId,
      };
    }),

  /** A user-operation signature exactly as the app's Kernel account encodes it. */
  signHash: (signer: Signer, rpId: string, hash: `0x${string}`) =>
    guarded(async () => {
      const owner = createPasskeyOwner(
        { id: signer.id, publicKey: signer.publicKey, signingId: signer.signingId ?? signer.id } as Parameters<
          typeof createPasskeyOwner
        >[0],
        rpId
      );
      return kernelSignMessage({
        owner,
        message: { raw: hash },
        accountAddress: "0x0000000000000000000000000000000000000000",
        kernelVersion: "0.3.1",
        chainId: 42161,
        eip7702: false,
      } as Parameters<typeof kernelSignMessage>[0]);
    }),
};

Object.assign(window, { rig });
document.body.dataset.rigReady = "true";
