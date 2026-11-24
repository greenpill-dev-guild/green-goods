import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface PasswordLease {
  filePath: string;
  close: () => void;
}

export function createPasswordLease(password: string, temporaryRoot = os.tmpdir()): PasswordLease {
  if (!password) throw new Error("Deployer password may not be empty");
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "green-goods-release-"));
  fs.chmodSync(directory, 0o700);
  const filePath = path.join(directory, "foundry-password");
  fs.writeFileSync(filePath, `${password}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  let closed = false;
  return {
    filePath,
    close: () => {
      if (closed) return;
      closed = true;
      if (fs.existsSync(filePath)) {
        const size = fs.statSync(filePath).size;
        if (size > 0) fs.writeFileSync(filePath, Buffer.alloc(size), { flag: "r+" });
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(directory)) fs.rmdirSync(directory);
    },
  };
}

export async function readHiddenPassword(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode)
    throw new Error("Release operator password entry requires an interactive TTY");
  process.stdout.write("Foundry deployer password: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") return finish(new Error("Release operator session interrupted"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

/** Only a private file path reaches child environments; the password stays out of arguments and logs. */
export async function withKeystorePassword<T>(
  run: (environment: NodeJS.ProcessEnv, signal: AbortSignal) => Promise<T>,
  options: { readPassword?: () => Promise<string>; temporaryRoot?: string; environment?: NodeJS.ProcessEnv } = {},
): Promise<T> {
  const lease = createPasswordLease(await (options.readPassword ?? readHiddenPassword)(), options.temporaryRoot);
  const cleanup = () => lease.close();
  const controller = new AbortController();
  // Child runners also receive these signals. Let them terminate and settle before closing the lease.
  const interrupt = () => controller.abort(new Error("Keystore session interrupted"));
  const terminate = () => controller.abort(new Error("Keystore session terminated"));
  process.once("exit", cleanup);
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    const result = await run(
      { ...(options.environment ?? process.env), ETH_PASSWORD: lease.filePath },
      controller.signal,
    );
    controller.signal.throwIfAborted();
    return result;
  } finally {
    cleanup();
    process.off("exit", cleanup);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}
