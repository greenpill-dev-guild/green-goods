import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  claimSurface,
  inspectSurface,
  readLeaseStore,
  releaseSurface,
} from "./surface-leases.mjs";

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "green-goods-surface-leases-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, "leases.json");
}

const livePids = (...pids) => {
  const live = new Set(pids);
  return (pid) => live.has(pid);
};

test("claims a free surface", (t) => {
  const leasePath = fixture(t);
  const result = claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-a",
    ownerPid: 101,
    portLive: false,
    now: 1_000,
    isProcessAlive: livePids(101),
  });

  assert.equal(result.status, "claimed");
  assert.deepEqual(readLeaseStore(leasePath).claims["3001"], {
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-a",
    ownerPid: 101,
    createdAt: 1_000,
  });
});

test("reuses a compatible live surface without taking ownership", (t) => {
  const leasePath = fixture(t);
  claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-a",
    ownerPid: 101,
    portLive: false,
    now: 1_000,
    isProcessAlive: livePids(101),
  });

  const result = claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-b",
    ownerPid: 202,
    portLive: true,
    now: 2_000,
    isProcessAlive: livePids(101, 202),
  });

  assert.equal(result.status, "reused");
  assert.equal(result.claim.ownerId, "agent-a");
  assert.equal(readLeaseStore(leasePath).claims["3001"].ownerId, "agent-a");
});

test("rejects an incompatible live claim", (t) => {
  const leasePath = fixture(t);
  claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-a",
    ownerPid: 101,
    portLive: false,
    now: 1_000,
    isProcessAlive: livePids(101),
  });

  const result = claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:prod",
    ownerId: "agent-b",
    ownerPid: 202,
    portLive: true,
    now: 2_000,
    isProcessAlive: livePids(101, 202),
  });

  assert.equal(result.status, "conflict");
  assert.equal(result.reason, "incompatible-claim");
  assert.equal(readLeaseStore(leasePath).claims["3001"].compatibilityKey, "client:local");
});

test("replaces a stale claim only when its owner and listener are both gone", (t) => {
  const leasePath = fixture(t);
  claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-a",
    ownerPid: 101,
    portLive: false,
    now: 1_000,
    isProcessAlive: livePids(101),
  });

  const result = claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-b",
    ownerPid: 202,
    portLive: false,
    now: 2_000,
    isProcessAlive: livePids(202),
  });

  assert.equal(result.status, "claimed");
  assert.equal(result.staleRemoved, true);
  assert.equal(readLeaseStore(leasePath).claims["3001"].ownerId, "agent-b");
  assert.equal(
    inspectSurface({
      leasePath,
      port: 3001,
      portLive: false,
      isProcessAlive: livePids(202),
    }).state,
    "claimed-starting"
  );
});

test("keeps a stale-owner claim when its listener is still live", (t) => {
  const leasePath = fixture(t);
  claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-a",
    ownerPid: 101,
    portLive: false,
    now: 1_000,
    isProcessAlive: livePids(101),
  });

  const result = claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-b",
    ownerPid: 202,
    portLive: true,
    now: 2_000,
    isProcessAlive: livePids(202),
  });

  assert.equal(result.status, "conflict");
  assert.equal(result.reason, "stale-owner-live-port");
  assert.equal(readLeaseStore(leasePath).claims["3001"].ownerId, "agent-a");
});

test("wrong owner cannot release a claim", (t) => {
  const leasePath = fixture(t);
  claimSurface({
    leasePath,
    port: 3001,
    service: "client",
    compatibilityKey: "client:local",
    ownerId: "agent-a",
    ownerPid: 101,
    portLive: false,
    now: 1_000,
    isProcessAlive: livePids(101),
  });

  const denied = releaseSurface({ leasePath, port: 3001, ownerId: "agent-b" });
  assert.equal(denied.status, "not-owner");
  assert.equal(readLeaseStore(leasePath).claims["3001"].ownerId, "agent-a");

  const released = releaseSurface({ leasePath, port: 3001, ownerId: "agent-a" });
  assert.equal(released.status, "released");
  assert.equal(readLeaseStore(leasePath).claims["3001"], undefined);
});
