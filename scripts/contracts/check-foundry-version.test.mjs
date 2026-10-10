import assert from "node:assert/strict";
import test from "node:test";
import {
  foundryVersionMatches,
  parseForgeVersion,
  parsePinnedFoundryVersion,
} from "./check-foundry-version.mjs";

test("reads an exact Foundry version from mise", () => {
  assert.equal(parsePinnedFoundryVersion('[tools]\nnode = "22"\nfoundry = "1.7.1"\n'), "1.7.1");
});

test("accepts a v-prefixed exact Foundry pin", () => {
  assert.equal(parsePinnedFoundryVersion('[tools]\nfoundry = "v1.7.1"\n'), "1.7.1");
});

test("rejects floating or missing Foundry pins", () => {
  assert.throws(() => parsePinnedFoundryVersion('[tools]\nfoundry = "stable"\n'), /exact x\.y\.z/);
  assert.throws(() => parsePinnedFoundryVersion('[tools]\nnode = "22"\n'), /exact x\.y\.z/);
});

test("parses Forge release output with and without a stable suffix", () => {
  assert.equal(parseForgeVersion("forge Version: 1.7.1"), "1.7.1");
  assert.equal(parseForgeVersion("forge Version: 1.7.1-stable"), "1.7.1");
});

test("requires the installed Forge version to match exactly", () => {
  assert.equal(foundryVersionMatches("forge Version: 1.7.1", "1.7.1"), true);
  assert.equal(foundryVersionMatches("forge Version: 1.5.1-stable", "1.7.1"), false);
});
