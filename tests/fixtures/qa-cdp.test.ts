import { describe, expect, it } from "vitest";
import { assertLoopbackEndpoint, loadQaProfile, pickAppWindow, writeReason } from "./qa-cdp";

describe("QA browser connection", () => {
  it("keeps the debugging endpoint on loopback", () => {
    expect(assertLoopbackEndpoint("http://127.0.0.1:9333").port).toBe("9333");
    expect(assertLoopbackEndpoint("http://localhost:9333").hostname).toBe("localhost");
    expect(() => assertLoopbackEndpoint("http://192.0.2.10:9333")).toThrow(/loopback/);
    expect(() => assertLoopbackEndpoint("http://0.0.0.0:9333")).toThrow(/loopback/);
    expect(() => assertLoopbackEndpoint("https://127.0.0.1:9333")).toThrow(/loopback/);
    expect(() => assertLoopbackEndpoint("http://127.0.0.1")).toThrow(/port/);
  });

  it("needs an endpoint and lets the environment name it", () => {
    expect(() => loadQaProfile({})).toThrow(/GREEN_GOODS_PWA_CDP_ENDPOINT/);
    const profile = loadQaProfile({ GREEN_GOODS_PWA_CDP_ENDPOINT: "http://127.0.0.1:9333" });
    expect(profile.appOrigin).toBe("https://greengoods.app");
  });
});

describe("finding the installed app window", () => {
  const origin = "https://greengoods.app";
  const page = (name: string, url: string, standalone: boolean) => ({
    page: name,
    facts: { url, standalone },
  });

  it("picks the standalone window and keeps same-origin tabs apart", () => {
    const choice = pickAppWindow(
      [
        page("tab", `${origin}/`, false),
        page("app", `${origin}/home`, true),
        page("hub", "https://hub.greengoods.app/", false),
        page("other-app", "https://example.org/", true),
      ],
      origin
    );
    expect(choice.app).toBe("app");
    expect(choice.tabs).toEqual(["tab"]);
  });

  it("refuses to guess when no window or several windows are installed", () => {
    expect(() => pickAppWindow([page("tab", `${origin}/home`, false)], origin)).toThrow(
      /No installed/
    );
    expect(() =>
      pickAppWindow(
        [page("a", `${origin}/home`, true), page("b", `${origin}/home/x`, true)],
        origin
      )
    ).toThrow(/exactly one/);
  });
});

describe("telling reads from writes", () => {
  const rpc = (method: string) => JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] });

  it("treats reads as reads", () => {
    expect(writeReason({ method: "GET", url: "https://greengoods.app/home" })).toBeNull();
    expect(
      writeReason({ method: "POST", url: "https://arb1.example/rpc", postData: rpc("eth_call") })
    ).toBeNull();
    expect(
      writeReason({
        method: "POST",
        url: "https://indexer.example/v1/graphql",
        postData: JSON.stringify({ query: "query Gardens { gardens { id } }" }),
      })
    ).toBeNull();
  });

  it("names sends, signatures, mutations and unknown writes", () => {
    expect(
      writeReason({
        method: "POST",
        url: "https://arb1.example/rpc",
        postData: rpc("eth_sendRawTransaction"),
      })
    ).toMatch(/eth_sendRawTransaction/);
    expect(
      writeReason({
        method: "POST",
        url: "https://bundler.example/",
        postData: JSON.stringify([
          JSON.parse(rpc("eth_chainId")),
          JSON.parse(rpc("eth_sendUserOperation")),
        ]),
      })
    ).toMatch(/eth_sendUserOperation/);
    expect(
      writeReason({
        method: "POST",
        url: "https://indexer.example/v1/graphql",
        postData: JSON.stringify({ query: "mutation { x }" }),
      })
    ).toMatch(/mutation/);
    expect(
      writeReason({ method: "POST", url: "https://upload.example/", postData: "binary" })
    ).toMatch(/not JSON/);
    expect(writeReason({ method: "PUT", url: "https://upload.example/file" })).toMatch(/PUT/);
  });
});
