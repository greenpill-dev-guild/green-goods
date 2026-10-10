import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface ArtifactMergeOptions {
  canonicalPath: string;
  sidePath: string;
  ownedKeys: readonly string[];
  beforeRename?: (temporaryPath: string) => void;
  removeSideFile?: boolean;
}

export interface ArtifactMergeResult {
  changed: boolean;
  merged: Record<string, unknown>;
  previous: Record<string, unknown>;
  promoted: Record<string, unknown>;
}

function readObject(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) throw new Error(`Artifact file not found: ${filePath}`);
  const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`Artifact must contain one JSON object: ${filePath}`);
  }
  return value as Record<string, unknown>;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (typeof left === "string" && typeof right === "string" && left.startsWith("0x") && right.startsWith("0x")) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return stable(left) === stable(right);
}

function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (typeof value === "string" && /^0x0+$/iu.test(value));
}

function getPath(value: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function setPath(value: Record<string, unknown>, dottedPath: string, incoming: unknown): void {
  const segments = dottedPath.split(".");
  let current = value;
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    const child = current[segment];
    if (!child || typeof child !== "object" || Array.isArray(child)) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  }
  current[segments.at(-1) as string] = incoming;
}

export function writeReleaseJsonAtomic(
  filePath: string,
  value: unknown,
  beforeRename?: (temporaryPath: string) => void,
) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  let fileDescriptor: number | undefined;
  try {
    fileDescriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(fileDescriptor, payload, "utf8");
    fs.fsyncSync(fileDescriptor);
    fs.closeSync(fileDescriptor);
    fileDescriptor = undefined;
    beforeRename?.(temporaryPath);
    fs.renameSync(temporaryPath, filePath);
    const directoryDescriptor = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  } catch (error) {
    if (fileDescriptor !== undefined) fs.closeSync(fileDescriptor);
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }
}

/**
 * Promotes only explicitly owned top-level keys. Existing unrelated history is byte-for-byte
 * represented in the parsed object and cannot be removed by a sparse side artifact.
 */
export function mergeReleaseArtifact(options: ArtifactMergeOptions): ArtifactMergeResult {
  const previous = readObject(options.canonicalPath);
  const side = readObject(options.sidePath);
  const owned = new Set(options.ownedKeys);
  const unexpected = Object.keys(side).filter(
    (key) => !owned.has(key) && !options.ownedKeys.some((ownedPath) => ownedPath.startsWith(`${key}.`)),
  );
  if (unexpected.length > 0) {
    throw new Error(`Release side artifact contains unowned keys: ${unexpected.join(", ")}`);
  }

  const promoted: Record<string, unknown> = {};
  for (const key of options.ownedKeys) {
    const incoming = getPath(side, key);
    if (isUnset(incoming)) throw new Error(`Release side artifact is missing required owned key: ${key}`);
    const current = getPath(previous, key);
    if (!isUnset(current) && !sameValue(current, incoming)) {
      throw new Error(
        `Conflicting canonical release key ${key}; refuse to overwrite ${stable(current)} with ${stable(incoming)}`,
      );
    }
    setPath(promoted, key, incoming);
  }

  const changed = options.ownedKeys.some((key) => !sameValue(getPath(previous, key), getPath(promoted, key)));
  const merged = structuredClone(previous);
  for (const key of options.ownedKeys) setPath(merged, key, getPath(promoted, key));
  if (changed) writeReleaseJsonAtomic(options.canonicalPath, merged, options.beforeRename);
  if (options.removeSideFile !== false && fs.existsSync(options.sidePath)) fs.unlinkSync(options.sidePath);
  return { changed, merged, previous, promoted };
}

/** Runs the exact merge implementation against disposable copies and proves the canonical file did not change. */
export function simulateReleaseArtifactMerge(options: ArtifactMergeOptions): ArtifactMergeResult {
  const canonicalBefore = fs.readFileSync(options.canonicalPath);
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "green-goods-release-"));
  const temporaryCanonical = path.join(temporaryDirectory, path.basename(options.canonicalPath));
  const temporarySide = path.join(temporaryDirectory, path.basename(options.sidePath));
  fs.copyFileSync(options.canonicalPath, temporaryCanonical);
  fs.copyFileSync(options.sidePath, temporarySide);
  try {
    const result = mergeReleaseArtifact({
      ...options,
      canonicalPath: temporaryCanonical,
      sidePath: temporarySide,
      beforeRename: undefined,
    });
    const canonicalAfter = fs.readFileSync(options.canonicalPath);
    if (!canonicalBefore.equals(canonicalAfter))
      throw new Error("Simulation mutated the canonical deployment artifact");
    return result;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

/** Reconstructs the normal side artifact from independently verified live values, then promotes it normally. */
export function recoverReleaseArtifact(
  options: Omit<ArtifactMergeOptions, "sidePath"> & { sidePath: string },
  verifiedLiveValues: Record<string, unknown>,
): ArtifactMergeResult {
  const recovery: Record<string, unknown> = {};
  for (const key of options.ownedKeys) {
    const value = getPath(verifiedLiveValues, key);
    if (isUnset(value)) throw new Error(`Verified recovery value missing for ${key}`);
    setPath(recovery, key, value);
  }
  writeReleaseJsonAtomic(options.sidePath, recovery);
  return mergeReleaseArtifact(options);
}
