import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { Wallet } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { withKeystorePassword } from "./keystore-session";

describe("operator keystore password lifetime", () => {
  it("rejects an empty password before running any operation", async () => {
    const run = vi.fn(async () => {});
    await expect(withKeystorePassword(run, { readPassword: async () => "" })).rejects.toThrow("may not be empty");
    expect(run).not.toHaveBeenCalled();
  });
  it("unlocks 23 real Cast calls from one password entry and removes the private lease", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "password-session-fixture-"));
    const wallet = new Wallet("0x" + "11".repeat(32)); // Public synthetic fixture; never funded.
    const keystore = path.join(directory, "synthetic-keystore");
    const password = "public-fixture-password";
    const readPassword = vi.fn(async () => password);
    let leasePath = "";
    try {
      const encrypted = JSON.parse(await wallet.encrypt(password));
      encrypted.crypto = encrypted.Crypto;
      delete encrypted.Crypto;
      fs.writeFileSync(keystore, JSON.stringify(encrypted), { mode: 0o600 });
      await withKeystorePassword(
        async (environment) => {
          leasePath = environment.ETH_PASSWORD!;
          expect(fs.statSync(leasePath).mode & 0o777).toBe(0o600);
          expect(fs.statSync(path.dirname(leasePath)).mode & 0o777).toBe(0o700);
          expect(environment.ETH_PASSWORD).not.toBe(password);
          for (let i = 0; i < 23; i++) {
            const address = execFileSync("cast", ["wallet", "address", "--keystore", keystore], {
              env: environment,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"],
            }).trim();
            expect(address.toLowerCase()).toBe(wallet.address.toLowerCase());
          }
        },
        { readPassword, temporaryRoot: directory, environment: { PATH: process.env.PATH } },
      );
      expect(readPassword).toHaveBeenCalledTimes(1);
      expect(fs.existsSync(leasePath)).toBe(false);
      expect(fs.existsSync(path.dirname(leasePath))).toBe(false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }, 60_000);

  it("cleans the lease and signal handlers when a boundary fails", async () => {
    const counts = ["exit", "SIGINT", "SIGTERM"].map((signal) => process.listenerCount(signal));
    let leasePath = "";
    await expect(
      withKeystorePassword(
        async (environment) => {
          leasePath = environment.ETH_PASSWORD!;
          throw new Error("boundary failed");
        },
        { readPassword: async () => "public-fixture-password" },
      ),
    ).rejects.toThrow("boundary failed");
    expect(fs.existsSync(leasePath)).toBe(false);
    expect(["exit", "SIGINT", "SIGTERM"].map((signal) => process.listenerCount(signal))).toEqual(counts);
  });

  it("removes the lease when its operator process receives SIGTERM", async () => {
    const module = path.resolve(__dirname, "keystore-session.ts");
    const script = `import {withKeystorePassword} from ${JSON.stringify(module)};
      await withKeystorePassword(async (environment, signal) => {
        console.log(environment.ETH_PASSWORD);
        await new Promise(resolve => {
          const interval = setInterval(() => {}, 1000);
          signal.addEventListener("abort", () => {clearInterval(interval); resolve()},{once:true});
        });
      }, {readPassword: async () => "public-fixture-password"});`;
    const child = spawn("bun", ["--no-env-file", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    let leasePath = "";
    try {
      leasePath = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Fixture lease did not become ready")), 5000);
        child.stdout.once("data", (data) => {
          clearTimeout(timeout);
          resolve(String(data).trim());
        });
        child.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        child.once("exit", () => {
          clearTimeout(timeout);
          reject(new Error("Fixture exited before lease readiness"));
        });
      });
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exited;
      expect(child.exitCode).toBe(1);
      expect(fs.existsSync(leasePath)).toBe(false);
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      if (leasePath && fs.existsSync(path.dirname(leasePath)))
        fs.rmSync(path.dirname(leasePath), { recursive: true, force: true });
    }
  }, 10_000);
});
