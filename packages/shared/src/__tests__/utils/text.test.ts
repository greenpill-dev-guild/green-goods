import { describe, expect, it } from "vitest";

import {
  chosenPasskeyUsername,
  formatAddress,
  formatEnsNameForDisplay,
} from "../../utils/app/text";

describe("ENS display formatting", () => {
  it("shows Green Goods ENS names as usernames", () => {
    expect(formatEnsNameForDisplay("river.greengoods.eth")).toBe("river");
    expect(formatEnsNameForDisplay("River.GreenGoods.eth")).toBe("River");
  });

  it("keeps non-Green Goods ENS names intact", () => {
    expect(formatEnsNameForDisplay("river.eth")).toBe("river.eth");
  });

  it("uses the username when formatAddress receives a Green Goods ENS name", () => {
    expect(
      formatAddress("0x1234567890abcdef1234567890abcdef12345678", {
        ensName: "river.greengoods.eth",
      })
    ).toBe("river");
    expect(formatAddress("river.greengoods.eth")).toBe("river");
  });
});

describe("the username an account chose", () => {
  it.each([
    ["a chosen passkey username", "passkey", "maya", "maya"],
    ["a generated passkey username", "passkey", "user_1726850000", null],
    // Auth keeps the last passkey username after a switch to a wallet.
    ["a wallet account that still carries one", "wallet", "maya", null],
    ["no username", "passkey", null, null],
  ] as const)("reads %s", (_label, authMode, userName, expected) => {
    expect(chosenPasskeyUsername(authMode, userName)).toBe(expected);
  });
});
