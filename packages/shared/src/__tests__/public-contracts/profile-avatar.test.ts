import { describe, expect, it } from "vitest";
import {
  buildProfileAvatarMessage,
  isCanonicalProfileAvatarUri,
  validateProfileAvatarMutation,
  validateProfileAvatarRequest,
} from "../../public-contracts/profile-avatar";

const address = "0x1234567890abcdef1234567890abcdef12345678";
const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const uri = `ipfs://${cid}`;

describe("profile avatar public contract", () => {
  it("builds the exact signed message with a normalized address", () => {
    expect(
      buildProfileAvatarMessage({
        chainId: 42161,
        address: address.toUpperCase(),
        avatarUri: uri,
        expectedVersion: 3,
        issuedAt: 1_753_777_600,
      })
    ).toBe(
      `Green Goods Profile Avatar\nVersion: 1\nChain ID: 42161\nAddress: ${address}\nAction: set\nAvatar URI: ${uri}\nExpected Version: 3\nIssued At: 1753777600`
    );
  });

  it("uses clear and none for a tombstone", () => {
    expect(
      buildProfileAvatarMessage({
        chainId: 1,
        address,
        avatarUri: null,
        expectedVersion: 0,
        issuedAt: 1,
      })
    ).toContain("Action: clear\nAvatar URI: none");
  });

  it("only accepts canonical bare-CID ipfs URIs", () => {
    expect(isCanonicalProfileAvatarUri(uri)).toBe(true);
    expect(
      isCanonicalProfileAvatarUri("ipfs://QmYwAPJzv5CZsnAzt8auVZRn6Hf3ABoZt48iAJsK6X1XbR")
    ).toBe(true);
    expect(isCanonicalProfileAvatarUri("ipfs://bafybeigdyrzt5q")).toBe(false);
    expect(isCanonicalProfileAvatarUri("ipfs://bafy/path")).toBe(false);
    expect(isCanonicalProfileAvatarUri("https://gateway/ipfs/bafy")).toBe(false);
  });

  it("rejects malformed mutation boundaries", () => {
    const result = validateProfileAvatarMutation({
      avatarUri: "ipfs://bafy/path",
      expectedVersion: -1,
      issuedAt: 1.5,
      signature: "not-a-signature",
    });

    expect(result.ok).toBe(false);
  });

  it("uses protocol error codes for expired signatures and unsupported chains", () => {
    const expired = validateProfileAvatarMutation(
      { avatarUri: null, expectedVersion: 0, issuedAt: 1, signature: "0x12" },
      { now: () => 1_000 }
    );
    const unsupported = validateProfileAvatarRequest(
      10,
      address,
      { avatarUri: null, expectedVersion: 0, issuedAt: 1_000, signature: "0x12" },
      { now: () => 1_000, allowedChainIds: [42161] }
    );
    expect(expired.ok ? null : expired.error.errorCode).toBe("signature_expired");
    expect(unsupported.ok ? null : unsupported.error.errorCode).toBe("chain_unsupported");
  });
});
