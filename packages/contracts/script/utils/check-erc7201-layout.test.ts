import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  extractAnnotatedStructMembers,
  extractUniqueStructMembers,
  resolveProjectSourcePath,
} from "./check-erc7201-layout";

describe("ERC-7201 source extraction", () => {
  test("binds an annotation to its own same-named struct", () => {
    const source = `
contract Earlier {
  struct State {
    uint256 wrong;
  }
}

/// @custom:storage-location erc7201:test.namespace
struct State {
  address correct;
}
`;

    expect(extractAnnotatedStructMembers(source, "fixture.sol", "test.namespace", "State")).toEqual([
      "address correct",
    ]);
  });

  test("rejects an intervening declaration after the annotation", () => {
    const source = `
/// @custom:storage-location erc7201:test.namespace
uint256 intervening;
struct State {
  address wrongBinding;
}
`;

    expect(() => extractAnnotatedStructMembers(source, "fixture.sol", "test.namespace", "State")).toThrow(
      "must be the next declaration",
    );
  });

  test("supports long NatSpec comments between the annotation and struct", () => {
    const source = `
/// @custom:storage-location erc7201:test.namespace
/// ${"x".repeat(400)}
struct State {
  address correct;
  uint256 value;
}
`;

    expect(extractAnnotatedStructMembers(source, "fixture.sol", "test.namespace", "State")).toEqual([
      "address correct",
      "uint256 value",
    ]);
  });

  test("rejects ambiguous referenced structs and paths outside the project", () => {
    const duplicateSource = `
struct Relationship {
  address first;
}
struct Relationship {
  address second;
}
`;

    expect(() => extractUniqueStructMembers(duplicateSource, "fixture.sol", "Relationship")).toThrow(
      "multiple structs named Relationship",
    );
    expect(() => resolveProjectSourcePath("../outside.sol")).toThrow("must stay within");
    expect(() => resolveProjectSourcePath(path.resolve("/tmp/outside.sol"))).toThrow("must be relative");
    expect(resolveProjectSourcePath("src/interfaces/ISettlementModule.sol")).toContain(
      path.join("packages", "contracts", "src", "interfaces", "ISettlementModule.sol"),
    );
  });
});
