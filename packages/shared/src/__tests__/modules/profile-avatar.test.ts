import { openDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyProfileAvatarFailure,
  clearProfileAvatarDraft,
  createProfileAvatarSigner,
  loadProfileAvatarDraft,
  normalizeProfileAvatarFile,
  type ProfileAvatarPublishDependencies,
  ProfileAvatarTransportError,
  publishProfileAvatar,
  resolveProfileAvatar,
  resolveProfileAvatarFactoryArgs,
  saveProfileAvatarDraft,
} from "../../modules/profile-avatar";
import type { Address } from "../../types/domain";

const address = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const avatarUri = `ipfs://${cid}`;
const record = (version: number, avatarUri: string | null = null) => ({
  chainId: 42161,
  address: address as `0x${string}`,
  avatarUri,
  version,
  updatedAt: null,
});
const file = (name = "picked.png", type = "image/png") => new File(["source"], name, { type });

function workflow(overrides: Partial<ProfileAvatarPublishDependencies> = {}) {
  const normalized = file("profile-avatar.webp", "image/webp");
  const dependencies: ProfileAvatarPublishDependencies = {
    get: vi.fn().mockResolvedValue(record(0)),
    save: vi.fn().mockResolvedValue(record(1, avatarUri)),
    normalize: vi.fn().mockResolvedValue(normalized),
    upload: vi.fn().mockResolvedValue({ cid }),
    sign: vi.fn().mockResolvedValue("0xsignature"),
    saveDraft: vi.fn().mockResolvedValue(undefined),
    clearDraft: vi.fn().mockResolvedValue(undefined),
    now: () => 1_000_000,
    ...overrides,
  };
  return { dependencies, normalized };
}

describe("profile avatar resolution", () => {
  it("prefers the app pointer over ENS and a caller fallback", () => {
    const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    const resolved = resolveProfileAvatar(
      `ipfs://${cid}`,
      "https://ens.example/avatar",
      "fallback.png"
    );
    expect(resolved.source).toBe("app");
    expect(resolved.avatarUri).not.toBe(`ipfs://${cid}`);
    expect(resolved.avatarUri).toContain(`/ipfs/${cid}`);
  });

  it("uses ENS, then caller fallback, when the app pointer is absent", () => {
    expect(resolveProfileAvatar(null, "https://ens.example/avatar", "fallback.png")).toEqual({
      avatarUri: "https://ens.example/avatar",
      source: "ens",
    });
    expect(resolveProfileAvatar(null, null, "fallback.png")).toEqual({
      avatarUri: "fallback.png",
      source: "fallback",
    });
  });

  it("does not label an unresolved app pointer as an app avatar", () => {
    expect(
      resolveProfileAvatar("invalid-avatar-pointer", "https://ens.example/avatar", "fallback.png")
    ).toEqual({
      avatarUri: "https://ens.example/avatar",
      source: "ens",
    });
    expect(resolveProfileAvatar("invalid-avatar-pointer", null, "fallback.png")).toEqual({
      avatarUri: "fallback.png",
      source: "fallback",
    });
  });
});

describe("profile avatar normalization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("center-crops to a 512px WebP under 1 MB", async () => {
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback) =>
      callback(new Blob(["webp"], { type: "image/webp" }))
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1000, height: 500, close: vi.fn() })
    );
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
      tag === "canvas"
        ? ({
            width: 0,
            height: 0,
            getContext: () => ({ drawImage }),
            toBlob,
          } as unknown as HTMLElement)
        : document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            tag
          )) as typeof document.createElement);

    const result = await normalizeProfileAvatarFile(file());

    expect(result.type).toBe("image/webp");
    expect(result.name).toBe("profile-avatar.webp");
    expect(result.size).toBeLessThanOrEqual(1_000_000);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 250, 0, 500, 500, 0, 0, 512, 512);
  });

  it("rejects unsupported MIME types and undecodable files", async () => {
    await expect(normalizeProfileAvatarFile(file("wrong.gif", "image/gif"))).rejects.toThrow(
      "JPEG, PNG, or WebP"
    );
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode")));
    await expect(normalizeProfileAvatarFile(file())).rejects.toThrow("could not be decoded");
  });

  it("rejects browsers that fall back from WebP encoding", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() })
    );
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
      tag === "canvas"
        ? ({
            getContext: () => ({ drawImage: vi.fn() }),
            toBlob: (callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" })),
          } as unknown as HTMLElement)
        : document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            tag
          )) as typeof document.createElement);
    await expect(normalizeProfileAvatarFile(file())).rejects.toThrow("encode the image as WebP");
  });
});

describe("profile avatar failure classification", () => {
  it("only reports offline for offline or ambiguous transport failures", () => {
    expect(classifyProfileAvatarFailure(new Error("bad image"), true)).toBe("error");
    expect(
      classifyProfileAvatarFailure(new ProfileAvatarTransportError("Bad request", 400), true)
    ).toBe("error");
    expect(
      classifyProfileAvatarFailure(
        new ProfileAvatarTransportError("Unknown", undefined, undefined, true),
        true
      )
    ).toBe("offline");
    expect(classifyProfileAvatarFailure(new Error("anything"), false)).toBe("offline");
  });
});

describe("profile avatar drafts", () => {
  it("restores and discards only serialized unsigned draft data", async () => {
    await saveProfileAvatarDraft(42161, address, {
      file: file("normalized.webp", "image/webp"),
      action: "set",
      cid,
    });
    const restored = await loadProfileAvatarDraft(42161, address);
    expect(restored?.file?.type).toBe("image/webp");
    expect(restored?.cid).toBe(cid);
    expect(restored).not.toHaveProperty("signature");
    const db = await openDB("green-goods-profile-avatar-drafts", 1);
    const stored = await db.get("drafts", `42161:${address}`);
    expect(stored).not.toHaveProperty("signature");
    await clearProfileAvatarDraft(42161, address);
    await expect(loadProfileAvatarDraft(42161, address)).resolves.toBeNull();
  });
});

describe("explicit profile avatar publish workflow", () => {
  it("normalizes and persists a WebP before every network boundary", async () => {
    const { dependencies, normalized } = workflow();
    await publishProfileAvatar(42161, address, { file: file(), action: "set" }, dependencies);
    expect(dependencies.normalize).toHaveBeenCalledBefore(
      dependencies.get as ReturnType<typeof vi.fn>
    );
    expect(dependencies.saveDraft).toHaveBeenNthCalledWith(1, { action: "set", file: normalized });
    expect(dependencies.saveDraft).toHaveBeenNthCalledWith(2, {
      action: "set",
      file: normalized,
      cid,
    });
  });

  it("persists an offline clear before fetching, signing, or posting", async () => {
    const { dependencies } = workflow();
    await publishProfileAvatar(42161, address, { action: "clear" }, dependencies);
    expect(dependencies.saveDraft).toHaveBeenCalledWith({ action: "clear" });
    expect(dependencies.saveDraft).toHaveBeenCalledBefore(
      dependencies.get as ReturnType<typeof vi.fn>
    );
    expect(dependencies.upload).not.toHaveBeenCalled();
  });

  it("reuses a persisted CID without a second normalize or upload", async () => {
    const { dependencies } = workflow();
    await publishProfileAvatar(42161, address, { action: "set", cid }, dependencies);
    expect(dependencies.normalize).not.toHaveBeenCalled();
    expect(dependencies.upload).not.toHaveBeenCalled();
    expect(dependencies.saveDraft).toHaveBeenCalledWith({ action: "set", cid });
  });

  it("does not overwrite a divergent record after a version conflict", async () => {
    const { dependencies } = workflow();
    (dependencies.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(record(1))
      .mockResolvedValueOnce(record(2, "ipfs://concurrent-avatar"));
    const conflict = new ProfileAvatarTransportError("Conflict", 409, "version_conflict");
    (dependencies.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(conflict);

    await expect(
      publishProfileAvatar(42161, address, { file: file(), action: "set" }, dependencies)
    ).rejects.toBe(conflict);

    expect(dependencies.sign).toHaveBeenCalledOnce();
    expect(dependencies.save).toHaveBeenCalledOnce();
    expect(dependencies.clearDraft).not.toHaveBeenCalled();
    expect(dependencies.save).toHaveBeenNthCalledWith(
      1,
      42161,
      address,
      expect.objectContaining({ expectedVersion: 1 })
    );
  });

  it("treats a matching version-conflict refresh as idempotent success", async () => {
    const { dependencies } = workflow();
    (dependencies.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(record(1))
      .mockResolvedValueOnce(record(2, avatarUri));
    (dependencies.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ProfileAvatarTransportError("Conflict", 409, "version_conflict")
    );

    await expect(
      publishProfileAvatar(42161, address, { file: file(), action: "set" }, dependencies)
    ).resolves.toEqual(record(2, avatarUri));
    expect(dependencies.sign).toHaveBeenCalledOnce();
    expect(dependencies.save).toHaveBeenCalledOnce();
    expect(dependencies.clearDraft).toHaveBeenCalledOnce();
  });

  it("recovers an ambiguous POST if the refreshed record already matches", async () => {
    const { dependencies } = workflow();
    (dependencies.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(record(0))
      .mockResolvedValueOnce(record(1, avatarUri));
    (dependencies.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ProfileAvatarTransportError("Unknown", undefined, undefined, true)
    );
    await publishProfileAvatar(42161, address, { file: file(), action: "set" }, dependencies);
    expect(dependencies.sign).toHaveBeenCalledOnce();
    expect(dependencies.save).toHaveBeenCalledOnce();
    expect(dependencies.clearDraft).toHaveBeenCalledOnce();
  });

  it("re-signs and retries once when an ambiguous POST refresh does not match", async () => {
    const { dependencies } = workflow();
    (dependencies.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(record(0))
      .mockResolvedValueOnce(record(2, null));
    (dependencies.save as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new ProfileAvatarTransportError("Unknown", undefined, undefined, true))
      .mockResolvedValueOnce(record(3, avatarUri));
    await publishProfileAvatar(42161, address, { file: file(), action: "set" }, dependencies);
    expect(dependencies.sign).toHaveBeenCalledTimes(2);
    expect(dependencies.save).toHaveBeenCalledTimes(2);
  });

  it("keeps an uploaded CID when a later signing or POST step fails", async () => {
    const { dependencies, normalized } = workflow({
      sign: vi.fn().mockRejectedValue(new Error("cancelled")),
    });
    await expect(
      publishProfileAvatar(42161, address, { file: file(), action: "set" }, dependencies)
    ).rejects.toThrow("cancelled");
    expect(dependencies.saveDraft).toHaveBeenLastCalledWith({
      action: "set",
      file: normalized,
      cid,
    });
  });

  it("includes paired passkey factory arguments in the signed mutation", async () => {
    const { dependencies } = workflow({
      getFactoryArgs: vi.fn().mockResolvedValue({ factory: address, factoryData: "0x1234" }),
    });
    await publishProfileAvatar(42161, address, { action: "clear" }, dependencies);
    const saveDraftOrder = (dependencies.saveDraft as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const factoryArgsOrder = (dependencies.getFactoryArgs as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    expect(saveDraftOrder).toBeLessThan(factoryArgsOrder);
    expect(dependencies.save).toHaveBeenCalledWith(
      42161,
      address,
      expect.objectContaining({ factory: address, factoryData: "0x1234" })
    );
  });

  it("persists a passkey draft before factory argument resolution can fail", async () => {
    const { dependencies } = workflow({
      getFactoryArgs: vi.fn().mockRejectedValue(new Error("factory unavailable")),
    });

    await expect(
      publishProfileAvatar(42161, address, { action: "clear" }, dependencies)
    ).rejects.toThrow("factory unavailable");

    expect(dependencies.saveDraft).toHaveBeenCalledWith({ action: "clear" });
  });
});

describe("profile avatar signer selection", () => {
  it("uses the wagmi signer for wallet and embedded accounts", async () => {
    const signMessage = vi.fn().mockResolvedValue("0xwallet");
    await expect(
      createProfileAvatarSigner({ authMode: "wallet", signMessage })("message")
    ).resolves.toBe("0xwallet");
    await expect(
      createProfileAvatarSigner({ authMode: "embedded", signMessage })("message")
    ).resolves.toBe("0xwallet");
    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("uses passkey signing and obtains paired counterfactual factory arguments", async () => {
    const account = {
      signMessage: vi.fn().mockResolvedValue("0xpasskey"),
      getFactoryArgs: vi.fn().mockResolvedValue({ factory: address, factoryData: "0x1234" }),
    };
    const signMessage = vi.fn();
    await expect(
      createProfileAvatarSigner({ authMode: "passkey", signMessage, account })("message")
    ).resolves.toBe("0xpasskey");
    await expect(resolveProfileAvatarFactoryArgs(account)).resolves.toEqual({
      factory: address,
      factoryData: "0x1234",
    });
    expect(signMessage).not.toHaveBeenCalled();
  });
});
