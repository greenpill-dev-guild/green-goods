import { describe, expect, it } from "vitest";
import {
  buildGardenJoinProofMessage,
  decodeGardenJoinAuthorization,
  encodeGardenJoinAuthorization,
  validateCreateGardenJoinRequest,
  validateGardenJoinProofEnvelope,
} from "../../public-contracts/join-requests";

const garden = "0x1111111111111111111111111111111111111111" as const;
const account = "0x2222222222222222222222222222222222222222" as const;
const issuedAt = 1_800_000_000;

const proof = {
  version: 1 as const,
  chainId: 11155111,
  gardenAddress: garden,
  accountAddress: account,
  action: "create" as const,
  nonce: `0x${"ab".repeat(32)}` as const,
  issuedAt,
  expiresAt: issuedAt + 300,
  signature: `0x${"cd".repeat(65)}` as const,
};

describe("garden join request public contract", () => {
  it("validates a required display name and optional note", () => {
    expect(
      validateCreateGardenJoinRequest({
        displayName: "  Maya  ",
        note: "I help with the weekly compost pickup.",
        requestedVia: "garden_detail",
      })
    ).toEqual({
      ok: true,
      value: {
        displayName: "Maya",
        note: "I help with the weekly compost pickup.",
        requestedVia: "garden_detail",
      },
    });

    expect(
      validateCreateGardenJoinRequest({ displayName: "   ", requestedVia: "garden_detail" })
    ).toMatchObject({ ok: false, error: { fieldErrors: { displayName: expect.any(String) } } });
  });

  it("binds the signed message to the garden, action, and request content", () => {
    const message = buildGardenJoinProofMessage(proof, {
      displayName: "Maya",
      note: "Compost pickup",
      requestedVia: "garden_detail",
    });

    expect(message).toContain(`Garden: ${garden}`);
    expect(message).toContain(`Account: ${account}`);
    expect(message).toContain("Action: create");
    expect(message).toContain("Display name: Maya");
    expect(message).toContain("Note: Compost pickup");
  });

  it("escapes line breaks and backslashes in signed user content", () => {
    const message = buildGardenJoinProofMessage(proof, {
      displayName: "Maya\\North",
      note: "First line\nAction: decline\r\nLast line",
      requestedVia: "garden_detail",
    });

    expect(message).toContain("Display name: Maya\\\\North");
    expect(message).toContain("Note: First line\\nAction: decline\\r\\nLast line");
    expect(message.match(/^Action:/gm)).toHaveLength(1);
  });

  it("round-trips the authorization envelope without placing signatures in a URL", () => {
    const authorization = encodeGardenJoinAuthorization(proof);
    expect(authorization.startsWith("GG-JoinProof ")).toBe(true);
    expect(decodeGardenJoinAuthorization(authorization)).toEqual(proof);
  });

  it("signs an explicit audience and bounded normalized content for status recovery", () => {
    const grant = {
      ...proof,
      readSelf: {
        audience: "https://greengoods.app",
        content: { displayName: "Maya", requestedVia: "garden_detail" as const },
      },
    };
    const message = buildGardenJoinProofMessage(grant, {
      displayName: "Maya",
      note: null,
      requestedVia: "garden_detail",
    });
    expect(buildGardenJoinProofMessage(grant)).toBe(message);
    expect(message).toContain("Also authorize: read own join-request status until proof expiry");
    expect(message).toContain("Audience: https://greengoods.app");
    expect(validateGardenJoinProofEnvelope(grant, { nowSeconds: issuedAt })).toMatchObject({
      ok: true,
      value: { readSelf: grant.readSelf },
    });
    expect(
      buildGardenJoinProofMessage(
        { ...grant, readSelf: undefined },
        { displayName: "Maya", note: null, requestedVia: "garden_detail" }
      )
    ).not.toBe(message);
  });
  it("rejects malformed, unsafe and non-create read grants", () => {
    const content = { displayName: "Maya", requestedVia: "garden_detail" };
    for (const readSelf of [
      null,
      {},
      { audience: "https://greengoods.app/path", content },
      { audience: "http://remote.example", content },
      { audience: "https://greengoods.app", content: { ...content, note: "x".repeat(501) } },
    ]) {
      expect(
        validateGardenJoinProofEnvelope({ ...proof, readSelf }, { nowSeconds: issuedAt })
      ).toMatchObject({ ok: false });
    }
    expect(
      validateGardenJoinProofEnvelope(
        {
          ...proof,
          action: "read_self",
          readSelf: { audience: "https://greengoods.app", content },
        },
        { nowSeconds: issuedAt }
      )
    ).toMatchObject({ ok: false });
  });

  it("rejects expired, overlong, and action-mismatched proofs", () => {
    expect(
      validateGardenJoinProofEnvelope(proof, {
        nowSeconds: issuedAt + 301,
        expectedAction: "create",
        allowedChainIds: [11155111],
      })
    ).toMatchObject({ ok: false, error: { errorCode: "signature_expired" } });

    expect(
      validateGardenJoinProofEnvelope(proof, {
        nowSeconds: issuedAt,
        expectedAction: "list",
        allowedChainIds: [11155111],
      })
    ).toMatchObject({ ok: false, error: { errorCode: "invalid_request" } });
  });

  it("rejects non-string request IDs and cursors without throwing", () => {
    expect(
      validateGardenJoinProofEnvelope({ ...proof, requestId: 42 } as unknown, {
        nowSeconds: issuedAt,
        expectedAction: "create",
        allowedChainIds: [11155111],
      })
    ).toMatchObject({ ok: false, error: { fieldErrors: { requestId: expect.any(String) } } });

    expect(
      validateGardenJoinProofEnvelope(
        { ...proof, action: "list", cursor: { page: 2 } } as unknown,
        { nowSeconds: issuedAt, expectedAction: "list", allowedChainIds: [11155111] }
      )
    ).toMatchObject({ ok: false, error: { fieldErrors: { cursor: expect.any(String) } } });
  });

  it("requires withdrawal proofs to identify the pending request revision", () => {
    expect(
      validateGardenJoinProofEnvelope(
        { ...proof, action: "withdraw" },
        {
          nowSeconds: issuedAt,
          expectedAction: "withdraw",
          allowedChainIds: [11155111],
        }
      )
    ).toMatchObject({ ok: false, error: { fieldErrors: { requestId: expect.any(String) } } });

    expect(
      validateGardenJoinProofEnvelope(
        { ...proof, action: "withdraw", requestId: "request-1", expectedRevision: 2 },
        {
          nowSeconds: issuedAt,
          expectedAction: "withdraw",
          allowedChainIds: [11155111],
        }
      )
    ).toMatchObject({
      ok: true,
      value: { requestId: "request-1", expectedRevision: 2 },
    });
  });
});
