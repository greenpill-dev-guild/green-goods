import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

/**
 * The QA app's wallet sign-in, exercised end to end with a throwaway keypair.
 *
 * The browser half — `window.ethereum.request({ method: "personal_sign" })` —
 * cannot be tested here and is not the risky half. Everything a forged or
 * replayed request would have to defeat is server-side and is covered below,
 * signed with a real key so the signature path is genuinely exercised rather
 * than mocked into agreement with itself.
 */

import {
  isAllowed,
  issueNonce,
  issueSession,
  nonceError,
  parseAllowlist,
  parseSiweMessage,
  readCookie,
  readSession,
  siweMessage,
  verifySignIn,
} from "../../packages/qa/auth";

const SECRET = "test-secret-that-is-long-enough-to-pass-the-length-check";
const TESTER = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const OUTSIDER = privateKeyToAccount("0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba");
const NOW = 1_788_000_000_000;
const DOMAIN = "qa.greengoods.app";

const ALLOWLIST = parseAllowlist(JSON.stringify([TESTER.address]));

async function signedRequest(
  account: typeof TESTER,
  overrides: Partial<{ nonce: string; domain: string; address: string }> = {},
) {
  const nonce = overrides.nonce ?? (await issueNonce(SECRET, NOW, "0011223344556677"));
  const message = siweMessage({
    domain: overrides.domain ?? DOMAIN,
    address: overrides.address ?? account.address,
    uri: `https://${DOMAIN}`,
    nonce,
    issuedAt: new Date(NOW).toISOString(),
  });
  return { message, signature: await account.signMessage({ message }) };
}

const verify = (input: { message: string; signature: string }, now = NOW) =>
  verifySignIn({ ...input, secret: SECRET, allowlist: ALLOWLIST, expectedDomain: DOMAIN, now });

describe("QA allowlist", () => {
  it("admits an address case-insensitively, and nobody else", () => {
    expect(isAllowed(ALLOWLIST, TESTER.address.toUpperCase())).toBe(true);
    expect(isAllowed(ALLOWLIST, OUTSIDER.address)).toBe(false);
  });

  it("holds addresses only — a name would be a second thing to keep in sync", () => {
    expect(() => parseAllowlist(JSON.stringify({ [TESTER.address]: "Afo" }))).toThrow(/array of addresses/);
  });

  it("refuses to load a malformed allowlist rather than admitting nobody silently", () => {
    expect(() => parseAllowlist("[not json")).toThrow(/valid JSON/);
    expect(() => parseAllowlist('["0xabc"]')).toThrow(/not an address/);
    expect(() => parseAllowlist("[42]")).toThrow(/not an address/);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});

describe("QA nonce", () => {
  it("accepts one it issued", async () => {
    expect(await nonceError(SECRET, await issueNonce(SECRET, NOW), NOW)).toBeNull();
  });

  it("rejects an expired one", async () => {
    const nonce = await issueNonce(SECRET, NOW);
    expect(await nonceError(SECRET, nonce, NOW + 6 * 60 * 1000)).toMatch(/expired/);
  });

  it("rejects one signed with a different secret", async () => {
    const forged = await issueNonce("a-completely-different-secret-value-here", NOW);
    expect(await nonceError(SECRET, forged, NOW)).toMatch(/not issued by this server/);
  });

  it("rejects a hand-made value and a tampered one", async () => {
    expect(await nonceError(SECRET, "deadbeef", NOW)).toMatch(/malformed/);
    const nonce = await issueNonce(SECRET, NOW);
    const tampered = `${nonce.slice(0, 59)}${nonce.endsWith("a") ? "b" : "a"}`;
    expect(await nonceError(SECRET, tampered, NOW)).toMatch(/not issued by this server/);
  });
});

describe("SIWE message", () => {
  it("round-trips the fields verification depends on", async () => {
    const nonce = await issueNonce(SECRET, NOW);
    const message = siweMessage({
      domain: DOMAIN,
      address: TESTER.address,
      uri: `https://${DOMAIN}`,
      nonce,
      issuedAt: new Date(NOW).toISOString(),
    });
    expect(parseSiweMessage(message)).toEqual({
      domain: DOMAIN,
      address: TESTER.address,
      nonce,
      issuedAt: new Date(NOW).toISOString(),
    });
  });

  it("rejects text that is not a sign-in message", () => {
    expect(parseSiweMessage("please sign this")).toBeNull();
  });
});

describe("QA sign-in verification", () => {
  it("admits an allowlisted tester who signed the message", async () => {
    const result = await verify(await signedRequest(TESTER));
    expect(result).toEqual({ address: TESTER.address.toLowerCase() });
  });

  it("refuses an address that is not on the allowlist", async () => {
    const result = await verify(await signedRequest(OUTSIDER));
    expect(result).toEqual({ error: "this address is not on the QA allowlist" });
  });

  it("refuses a signature captured for another site", async () => {
    const result = await verify(await signedRequest(TESTER, { domain: "evil.example" }));
    expect(result).toEqual({ error: "sign-in was issued for another site" });
  });

  it("refuses a message claiming an address it was not signed by", async () => {
    // The outsider signs, but the message names the allowlisted tester.
    const result = await verify(await signedRequest(OUTSIDER, { address: TESTER.address }));
    expect(result).toEqual({ error: "signature does not match the stated address" });
  });

  it("refuses a replay after the nonce window closes", async () => {
    const request = await signedRequest(TESTER);
    expect(await verify(request)).toHaveProperty("address");
    const late = await verify(request, NOW + 6 * 60 * 1000);
    expect(late).toEqual({ error: "nonce expired — reload and sign in again" });
  });

  it("refuses a mangled signature", async () => {
    const request = await signedRequest(TESTER);
    const result = await verify({ ...request, signature: `${request.signature.slice(0, -2)}00` });
    expect(result).toHaveProperty("error");
    expect(result).not.toHaveProperty("address");
  });
});

describe("QA session token", () => {
  it("round-trips the address that signed in", async () => {
    const token = await issueSession(SECRET, TESTER.address, NOW);
    expect(await readSession(SECRET, token, NOW)).toEqual({ address: TESTER.address.toLowerCase() });
  });

  it("expires, and cannot be extended by editing the expiry", async () => {
    const token = await issueSession(SECRET, TESTER.address, NOW);
    expect(await readSession(SECRET, token, NOW + 13 * 60 * 60 * 1000)).toBeNull();
    const [address, , signature] = token.split(".");
    const extended = `${address}.${NOW + 999_999_999}.${signature}`;
    expect(await readSession(SECRET, extended, NOW)).toBeNull();
  });

  it("cannot be minted without the secret, or swapped to another address", async () => {
    const forged = await issueSession("some-other-secret-value-long-enough-x", TESTER.address, NOW);
    expect(await readSession(SECRET, forged, NOW)).toBeNull();

    const token = await issueSession(SECRET, TESTER.address, NOW);
    const [, expiry, signature] = token.split(".");
    expect(await readSession(SECRET, `${OUTSIDER.address.toLowerCase()}.${expiry}.${signature}`, NOW)).toBeNull();
  });

  it("treats absent and malformed tokens as signed out", async () => {
    expect(await readSession(SECRET, null, NOW)).toBeNull();
    expect(await readSession(SECRET, "nonsense", NOW)).toBeNull();
  });
});

describe("cookie reading", () => {
  it("finds the session among other cookies, and tolerates none", () => {
    expect(readCookie("a=1; qa_session=abc.def.ghi; b=2", "qa_session")).toBe("abc.def.ghi");
    expect(readCookie("a=1", "qa_session")).toBeNull();
    expect(readCookie(null, "qa_session")).toBeNull();
  });
});
