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
