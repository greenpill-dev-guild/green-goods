import { describe, expect, it } from "vitest";

import { formatAddress, formatEnsNameForDisplay } from "../../utils/app/text";

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
