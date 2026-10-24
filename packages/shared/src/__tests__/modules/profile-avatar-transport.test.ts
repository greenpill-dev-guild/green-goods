import { afterEach, describe, expect, it, vi } from "vitest";
import { profileAvatarTransport } from "../../modules/profile-avatar";
import type { Address } from "../../types/domain";

const address = "0x1234567890abcdef1234567890abcdef12345678" as Address;

function installHangingFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("The operation was aborted.", "AbortError")),
          { once: true }
        );
      });
    })
  );
}

describe("profile avatar transport timeouts", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(["get", "save"] as const)("bounds a hung %s request", async (method) => {
    vi.useFakeTimers();
    installHangingFetch();

    const request =
      method === "get"
        ? profileAvatarTransport.get(42161, address, "https://agent.example")
        : profileAvatarTransport.save(
            42161,
            address,
            {
              avatarUri: null,
              expectedVersion: 0,
              issuedAt: 1,
              signature: "0x12",
            },
            "https://agent.example"
          );
    const expectation = expect(request).rejects.toMatchObject({ isAmbiguous: true });

    await vi.advanceTimersByTimeAsync(10_000);
    await expectation;
  });
});

describe("profile avatar list reads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const record = (address: string) => ({
    chainId: 42161,
    address,
    avatarUri: null,
    version: 0,
    updatedAt: null,
  });

  it("sends the reads a list makes in one task together, 50 addresses to a request", async () => {
    const people = Array.from(
      { length: 60 },
      (_, index) => `0x${(index + 1).toString(16).padStart(40, "0")}` as Address
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const listed = new URL(String(input)).searchParams.get("addresses")?.split(",") ?? [];
      return new Response(JSON.stringify({ ok: true, records: listed.map(record) }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const records = await Promise.all(
      people.map((person) =>
        profileAvatarTransport.getListed(42161, person, "https://agent.example")
      )
    );

    const sizes = fetchMock.mock.calls.map(
      ([input]) => new URL(String(input)).searchParams.get("addresses")?.split(",").length
    );
    expect(sizes.sort()).toEqual([10, 50]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      /^https:\/\/agent\.example\/public\/profile-avatars\/42161\?addresses=/
    );
    expect(records.map((entry) => entry.address)).toEqual(people);
  });

  it("fails each read of a batch the agent refuses, so each row keeps its glyph", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 429 }))
    );

    const reads = [address, "0x2222222222222222222222222222222222222222"].map((person) =>
      profileAvatarTransport.getListed(42161, person, "https://agent.example")
    );

    for (const read of reads) await expect(read).rejects.toMatchObject({ status: 429 });
  });
});
