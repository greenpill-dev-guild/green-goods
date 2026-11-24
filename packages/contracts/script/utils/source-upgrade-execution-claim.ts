import fs from "node:fs";
import path from "node:path";

export type SourceExecutionClaim = ReturnType<typeof readSourceExecutionFile>;
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Source execution store ${message}`);
}
export function assertSourceExecutionPath(file: string) {
  for (let current = file; current !== path.dirname(current); current = path.dirname(current)) {
    try {
      check(!fs.lstatSync(current).isSymbolicLink(), "symlink path refused");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
export function readSourceExecutionFile(file: string) {
  assertSourceExecutionPath(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    check(stat.isFile(), "regular file required");
    return { file, bytes: fs.readFileSync(fd, "utf8"), dev: stat.dev, ino: stat.ino };
  } finally {
    fs.closeSync(fd);
  }
}
function syncDirectory(file: string) {
  const fd = fs.openSync(
    path.dirname(file),
    fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW,
  );
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
export function assertSourceExecutionClaim(claim: SourceExecutionClaim) {
  const current = readSourceExecutionFile(claim.file);
  check(
    current.dev === claim.dev && current.ino === claim.ino && current.bytes === claim.bytes,
    "claim identity changed",
  );
}
export function releaseSourceExecutionClaim(claim: SourceExecutionClaim) {
  assertSourceExecutionClaim(claim);
  fs.unlinkSync(claim.file);
  syncDirectory(claim.file);
}
export function claimSourceExecutionFile(file: string, value: Record<string, unknown>): SourceExecutionClaim {
  assertSourceExecutionPath(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertSourceExecutionPath(file);
  const fd = fs.openSync(
    file,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
    0o600,
  );
  const bytes = `${JSON.stringify(value)}\n`;
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    const stat = fs.fstatSync(fd);
    syncDirectory(file);
    return { file, bytes, dev: stat.dev, ino: stat.ino };
  } finally {
    fs.closeSync(fd);
  }
}
export function assertSourceExecutionOwnerDead(pid: unknown) {
  check(Number.isSafeInteger(pid) && Number(pid) > 0, "lock PID missing");
  try {
    process.kill(pid as number, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
    throw error;
  }
  throw new Error("Source execution store lock owner is alive; recovery refused");
}
