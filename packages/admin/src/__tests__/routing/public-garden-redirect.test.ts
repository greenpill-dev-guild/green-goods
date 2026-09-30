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

  // The edge redirect in vercel.json used to hardcode https://greengoods.app,
  // so admin on any non-production host sent people to the production client.
  // This route owns the hop now, and falls back to the paired client host.
  it("pairs each admin host with its own client host when no base URL is set", () => {
    const pairs: Array<[string, string]> = [
      ["admin.greengoods.app", "https://greengoods.app/gardens"],
      ["beta-admin.greengoods.app", "https://beta.greengoods.app/gardens"],
      ["staging-admin.greengoods.app", "https://staging.greengoods.app/gardens"],
    ];
    for (const [hostname, expected] of pairs) {
      expect(buildClientGardenRedirectUrl(undefined, "", "", undefined, "", hostname)).toBe(
        expected
      );
    }
  });

  it("falls back to production for hosts with no derivable pair", () => {
    expect(buildClientGardenRedirectUrl(undefined, "", "", undefined, "", "localhost")).toBe(
      "https://greengoods.app/gardens"
    );
  });

  it("prefers an explicit base URL over the host pairing", () => {
    expect(
      buildClientGardenRedirectUrl(
        undefined,
        "",
        "",
        "https://beta.greengoods.app",
        "",
        "admin.greengoods.app"
      )
    ).toBe("https://beta.greengoods.app/gardens");
  });

  it("builds nested public garden redirects", () => {
    expect(
      buildClientGardenRedirectUrl(
        "0xGarden",
        "?utm_source=admin",
        "#evidence",
        "https://greengoods.app/",
        "work/soil sample"
      )
    ).toBe("https://greengoods.app/gardens/0xGarden/work/soil%20sample?utm_source=admin#evidence");
  });
});
