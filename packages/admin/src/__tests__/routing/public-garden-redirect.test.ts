import { describe, expect, it } from "vitest";
import { buildClientGardenRedirectUrl } from "@/routes/PublicGardenRedirect";

describe("public garden redirects", () => {
  it("builds the public garden gallery redirect", () => {
    expect(buildClientGardenRedirectUrl(undefined, "", "", "https://greengoods.app")).toBe(
      "https://greengoods.app/gardens"
    );
  });

  it("builds the public garden detail redirect and preserves search/hash", () => {
    expect(
      buildClientGardenRedirectUrl(
        "0xGarden/Season One",
        "?utm_source=admin",
        "#impact",
        "https://greengoods.app/"
      )
    ).toBe("https://greengoods.app/gardens/0xGarden%2FSeason%20One?utm_source=admin#impact");
  });
});
