import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAllowedOperatorCommand,
  createPasswordLease,
  parseSessionOptions,
  tokenizeOperatorCommand,
} from "./release-operator";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("release operator session", () => {
  it("requires the exact pinned candidate commit before unlocking", () => {
    expect(() => parseSessionOptions([])).toThrow(/requires --commit/);
    expect(() => parseSessionOptions(["--commit", "abc"])).toThrow(/requires --commit/);
    expect(parseSessionOptions(["--commit", "a".repeat(40)])).toEqual({ commit: "a".repeat(40), help: false });
    expect(parseSessionOptions(["--help"])).toEqual({ help: true });
  });

  it("accepts only allowlisted Bun wrappers and never credential or RPC overrides", () => {
    const tokens = tokenizeOperatorCommand(
      'run pooling:schemas:arbitrum --step 2 --expected-nonce 123 --artifact "reviewed plan.json"',
    );
    expect(assertAllowedOperatorCommand(tokens)).toEqual({
      script: "pooling:schemas:arbitrum",
      args: ["--step", "2", "--expected-nonce", "123", "--artifact", "reviewed plan.json"],
    });
    expect(() => assertAllowedOperatorCommand(tokenizeOperatorCommand("run test"))).toThrow(/not allowlisted/);
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:module:deploy:arbitrum --private-key 0x1234"),
      ),
    ).toThrow(/controlled by the frozen release session/);
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:module:deploy:arbitrum --network celo --step 1"),
      ),
    ).toThrow(/controlled by the frozen release session/);
    expect(() =>
      assertAllowedOperatorCommand(
        tokenizeOperatorCommand("run settlement:module:deploy:arbitrum --sender 0x1234 --step 1"),
      ),
    ).toThrow(/controlled by the frozen release session/);
    expect(() =>
      assertAllowedOperatorCommand(tokenizeOperatorCommand("run pooling:deploy:arbitrum --artifact plan.json")),
    ).toThrow(/not allowlisted/);
    expect(() => assertAllowedOperatorCommand(tokenizeOperatorCommand("run pooling:deploy:arbitrum --step"))).toThrow(
      /requires a value/,
    );
    expect(() => tokenizeOperatorCommand("run 'unterminated")).toThrow(/Unclosed quote/);
  });

  it("uses a private 0600 password file and removes it when the session closes", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "release-operator-test-"));
    temporaryDirectories.push(temporaryRoot);
    const lease = createPasswordLease("dummy-password", temporaryRoot);
    expect(fs.readFileSync(lease.filePath, "utf8")).toBe("dummy-password\n");
    expect(fs.statSync(lease.filePath).mode & 0o777).toBe(0o600);
    const directory = path.dirname(lease.filePath);
    lease.close();
    expect(fs.existsSync(lease.filePath)).toBe(false);
    expect(fs.existsSync(directory)).toBe(false);
    expect(() => lease.close()).not.toThrow();
  });
});
