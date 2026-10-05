import { describe, expect, it } from "vitest";
import { assertExplorationNavigation, workExplorationCases } from "./work-exploration";

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
