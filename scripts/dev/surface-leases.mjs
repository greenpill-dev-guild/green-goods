import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const STORE_VERSION = 1;
const SAFE_IDENTIFIER = /^[A-Za-z0-9._:@/-]+$/;

export const DEFAULT_LEASE_PATH = path.join(projectRoot, ".cache", "dev-surface-leases.json");

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function emptyStore() {
  return { version: STORE_VERSION, claims: {} };
}

function assertIdentifier(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 160 ||
    !SAFE_IDENTIFIER.test(value)
  ) {
    throw new Error(`${label} must be a non-empty safe identifier.`);
  }
}

function assertPort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid dev-surface port: ${port}`);
  }
}

function assertClaim(claim, portKey) {
  if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
    throw new Error(`Invalid lease claim for port ${portKey}.`);
  }
  assertPort(claim.port);
  if (`${claim.port}` !== portKey) {
    throw new Error(`Lease claim key ${portKey} does not match port ${claim.port}.`);
  }
  assertIdentifier(claim.service, "service");
  assertIdentifier(claim.compatibilityKey, "compatibilityKey");
  assertIdentifier(claim.ownerId, "ownerId");
  if (!Number.isInteger(claim.ownerPid) || claim.ownerPid <= 0) {
    throw new Error(`Invalid owner PID for port ${portKey}.`);
  }
  if (!Number.isFinite(claim.createdAt) || claim.createdAt < 0) {
    throw new Error(`Invalid creation time for port ${portKey}.`);
  }
}

export function readLeaseStore(leasePath = DEFAULT_LEASE_PATH) {
  if (!fs.existsSync(leasePath)) return emptyStore();

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(leasePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read dev-surface leases at ${leasePath}: ${error.message}`);
  }

  if (parsed?.version !== STORE_VERSION || !parsed.claims || typeof parsed.claims !== "object") {
    throw new Error(`Unsupported dev-surface lease store at ${leasePath}.`);
  }

  for (const [portKey, claim] of Object.entries(parsed.claims)) {
    assertClaim(claim, portKey);
  }
  return parsed;
}

function writeLeaseStore(leasePath, store) {
  fs.mkdirSync(path.dirname(leasePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${leasePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, leasePath);
}

function removeStaleLock(lockPath) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (!Number.isInteger(lock.pid) || lock.pid <= 0) return false;
    if (isProcessAlive(lock.pid)) return false;
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

function withLeaseLock(leasePath, callback) {
  fs.mkdirSync(path.dirname(leasePath), { recursive: true, mode: 0o700 });
  const lockPath = `${leasePath}.lock`;
  let descriptor;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      descriptor = fs.openSync(lockPath, "wx", 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, createdAt: Date.now() })}\n`);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST" || attempt > 0 || !removeStaleLock(lockPath)) {
        throw new Error(`Dev-surface lease store is busy: ${leasePath}`);
      }
    }
  }

  const unlock = () => {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // A missing lock after our callback is harmless; ownership remains in the lease file.
    }
  };
  let result;
  try {
    result = callback();
  } catch (error) {
    unlock();
    throw error;
  }
  if (result && typeof result.then === "function") return result.finally(unlock);
  unlock();
  return result;
}

// Serialize recovery, claims, and PM2 startup across competing launchers. Lease
// mutations retain their separate short lock, so they can run inside this one.
export function withStartupLock(callback, leasePath = DEFAULT_LEASE_PATH) {
  return withLeaseLock(`${leasePath}.startup`, callback);
}

export function inspectSurface({
  leasePath = DEFAULT_LEASE_PATH,
  port,
  portLive,
  isProcessAlive: processAlive = isProcessAlive,
}) {
  assertPort(port);
  const claim = readLeaseStore(leasePath).claims[`${port}`];

  if (!claim) {
    return { state: portLive ? "external-listener" : "free", claim: null };
  }

  const ownerAlive = processAlive(claim.ownerPid);
  if (ownerAlive) {
    return { state: portLive ? "owned-live" : "claimed-starting", claim };
  }
  return { state: portLive ? "stale-owner-live" : "stale", claim };
}

export function claimSurface({
  leasePath = DEFAULT_LEASE_PATH,
  port,
  service,
  compatibilityKey,
  ownerId,
  ownerPid = process.pid,
  portLive,
  now = Date.now(),
  isProcessAlive: processAlive = isProcessAlive,
}) {
  assertPort(port);
  assertIdentifier(service, "service");
  assertIdentifier(compatibilityKey, "compatibilityKey");
  assertIdentifier(ownerId, "ownerId");
  if (!Number.isInteger(ownerPid) || ownerPid <= 0) throw new Error("ownerPid must be positive.");

  return withLeaseLock(leasePath, () => {
    const store = readLeaseStore(leasePath);
    const portKey = `${port}`;
    const existing = store.claims[portKey];
    let staleRemoved = false;

    if (existing) {
      const ownerAlive = processAlive(existing.ownerPid);
      if (!ownerAlive && !portLive) {
        delete store.claims[portKey];
        staleRemoved = true;
      } else if (!ownerAlive) {
        return { status: "conflict", reason: "stale-owner-live-port", claim: existing };
      } else if (existing.compatibilityKey !== compatibilityKey) {
        return { status: "conflict", reason: "incompatible-claim", claim: existing };
      } else if (portLive) {
        return {
          status: existing.ownerId === ownerId ? "owned-live" : "reused",
          claim: existing,
        };
      } else if (existing.ownerId === ownerId && existing.ownerPid === ownerPid) {
        return { status: "owned", claim: existing };
      } else {
        return { status: "conflict", reason: "claim-pending", claim: existing };
      }
    }

    if (portLive) {
      return { status: "conflict", reason: "external-listener", claim: null };
    }

    const claim = {
      port,
      service,
      compatibilityKey,
      ownerId,
      ownerPid,
      createdAt: now,
    };
    store.claims[portKey] = claim;
    writeLeaseStore(leasePath, store);
    return { status: "claimed", claim, staleRemoved };
  });
}

export function releaseSurface({ leasePath = DEFAULT_LEASE_PATH, port, ownerId }) {
  assertPort(port);
  assertIdentifier(ownerId, "ownerId");

  return withLeaseLock(leasePath, () => {
    const store = readLeaseStore(leasePath);
    const portKey = `${port}`;
    const existing = store.claims[portKey];
    if (!existing) return { status: "absent", claim: null };
    if (existing.ownerId !== ownerId) return { status: "not-owner", claim: existing };

    delete store.claims[portKey];
    writeLeaseStore(leasePath, store);
    return { status: "released", claim: existing };
  });
}

export function releaseOwnerClaims({ leasePath = DEFAULT_LEASE_PATH, ownerId }) {
  assertIdentifier(ownerId, "ownerId");

  return withLeaseLock(leasePath, () => {
    const store = readLeaseStore(leasePath);
    const released = [];
    for (const [portKey, claim] of Object.entries(store.claims)) {
      if (claim.ownerId !== ownerId) continue;
      released.push(claim);
      delete store.claims[portKey];
    }
    if (released.length > 0) writeLeaseStore(leasePath, store);
    return released.sort((left, right) => left.port - right.port);
  });
}
