import {
  communitySectionForMode,
  resolveCommunityMode,
} from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import { describe, expect, it } from "vitest";

describe("community mode resolution", () => {
  it("keeps garden cookie jars scoped to the payouts Community mode", () => {
    expect(resolveCommunityMode("/community/payouts")).toBe("payouts");
    expect(communitySectionForMode("payouts")).toBe("payouts");
  });
});
