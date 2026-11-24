import {
  buildCommunityViewActions,
  communitySectionForMode,
  resolveCommunityMode,
} from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const GARDEN = "0x1111111111111111111111111111111111111111";

describe("community mode resolution", () => {
  it("keeps garden cookie jars scoped to the payouts Community mode", () => {
    expect(resolveCommunityMode("/community/payouts")).toBe("payouts");
    expect(communitySectionForMode("payouts")).toBe("payouts");
  });
});

describe("Community header dialogs", () => {
  afterEach(() => vi.unstubAllGlobals());

  const addressBar = (search: string) =>
    vi.stubGlobal("window", { location: { pathname: "/community/endowment", search, hash: "" } });

  it.each([
    ["add-member", "add-member"],
    ["fund-payout-jar", "fund-jar"],
  ])("takes a double press on %s once, so one close leaves the dialog (DL-140)", (id, item) => {
    const navigate = vi.fn();
    const press = () =>
      buildCommunityViewActions("endowment", true, true, true, navigate, { gardenAddress: GARDEN })
        .find((action) => action.id === id)
        ?.onClick();
    const search = `?gardenId=${GARDEN}&item=${item}`;

    addressBar(`?gardenId=${GARDEN}`);
    press();
    expect(navigate).toHaveBeenCalledWith(`/community/endowment${search}`);

    // The first press has reached the address bar; the dialog is not up yet.
    addressBar(search);
    press();
    expect(navigate).toHaveBeenCalledTimes(1);

    // An IPFS build keeps the route in the hash, behind the gateway's own path.
    vi.stubGlobal("window", {
      location: { pathname: "/ipfs/cid/", search: "", hash: `#/community/endowment${search}` },
    });
    press();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
