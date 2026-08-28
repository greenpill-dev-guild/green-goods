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
});
