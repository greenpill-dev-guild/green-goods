import { describe, expect, it } from "vitest";
import {
  assertExplorationNavigation,
  explorationEnsRejection,
  workExplorationCases,
} from "./work-exploration";

describe("bounded work exploration", () => {
  it("replays the same plan and keeps the caller's seed", () => {
    expect(workExplorationCases("42")).toEqual(workExplorationCases("42"));
    expect(workExplorationCases("42")).not.toEqual(workExplorationCases("43"));
  });
  it("rejects unreplayable seeds", () => {
    for (const seed of ["0", "-1", "1.5", "4294967296", "random", " 17"]) {
      expect(() => workExplorationCases(seed)).toThrow(/seed/);
    }
  });
  it("keeps all generated actions read-only and includes recovery for boundary seeds", () => {
    for (const seed of ["1", "17", "42", "4294967295"]) {
      const cases = workExplorationCases(seed);
      expect(cases.map((item) => item.recovery)).toEqual([false, true]);
      for (const item of cases) {
        expect(["steward", "user"]).toContain(item.role);
        expect([390, 768, 1280]).toContain(item.viewport.width);
        expect(item.actions).toEqual(
          item.recovery ? ["open", "recover", "inspect", "reload"] : ["open", "inspect", "reload"]
        );
      }
    }
  });
  it("allows the chosen route but rejects other routes and remote origins", () => {
    expect(() =>
      assertExplorationNavigation(
        "http://localhost:3001/home/work?presentation=pwa",
        "http://localhost:3001",
        "/home/work"
      )
    ).not.toThrow();
    for (const url of ["https://greengoods.app/home/work", "http://localhost:3001/home/login"]) {
      expect(() => assertExplorationNavigation(url, "http://localhost:3001", "/home/work")).toThrow(
        /Out-of-scope/
      );
    }
  });
});

describe("exploration ENS transport boundary", () => {
  const request = {
    jsonrpc: "2.0",
    id: 7,
    method: "eth_call",
    params: [
      { to: "0xeeeeeeee14d718c2b47d9923deab1335e144eeee", data: "0xb7d6ca640000" },
      "latest",
    ] as const,
  };
  it.each([
    "https://eth-mainnet.g.alchemy.com/v2/test",
    "https://ethereum-rpc.publicnode.com",
  ])("substitutes the same declared read on %s", (url) => {
    expect(explorationEnsRejection(url, "POST", JSON.stringify(request))).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: 3, message: "No reverse ENS name in this scenario" },
    });
  });
  it("leaves unknown providers to the exploration's rejecting network gate", () => {
    for (const url of [
      "https://evil.test/eth-mainnet.g.alchemy.com",
      "https://ethereum-rpc.publicnode.com.evil.test",
    ]) {
      expect(explorationEnsRejection(url, "POST", JSON.stringify(request))).toBeNull();
    }
  });
  it("rejects transaction writes instead of simulating success", () => {
    for (const method of ["eth_sendRawTransaction", "eth_sendTransaction"]) {
      expect(() =>
        explorationEnsRejection(
          "https://ethereum-rpc.publicnode.com",
          "POST",
          JSON.stringify({ ...request, method })
        )
      ).toThrow(/Unsupported/);
    }
  });
  it("rejects unknown reads, blocks, HTTP methods and malformed payloads", () => {
    for (const params of [
      [{ ...request.params[0], to: "0x0000000000000000000000000000000000000001" }, "latest"],
      [{ ...request.params[0], data: "0xdeadbeef" }, "latest"],
      [request.params[0], "pending"],
      [],
    ]) {
      expect(() =>
        explorationEnsRejection(
          "https://ethereum-rpc.publicnode.com",
          "POST",
          JSON.stringify({ ...request, params })
        )
      ).toThrow(/Unsupported/);
    }
    for (const body of ["null", "[]", "{}", "not JSON"]) {
      expect(() =>
        explorationEnsRejection("https://ethereum-rpc.publicnode.com", "POST", body)
      ).toThrow();
    }
    expect(() =>
      explorationEnsRejection("https://ethereum-rpc.publicnode.com", "GET", JSON.stringify(request))
    ).toThrow(/Unsupported/);
    expect(() =>
      explorationEnsRejection("http://ethereum-rpc.publicnode.com", "POST", JSON.stringify(request))
    ).toThrow(/Unsupported/);
  });
});
