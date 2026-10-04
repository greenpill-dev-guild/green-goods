import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueContinuation, requestById } from "../../services/reporting/continuations";
import { proposeGrant } from "../../services/reporting/grant-proposal";
import { sessionFromToken, revokeParticipantSessions } from "../../services/reporting/sessions";
import { inTransaction } from "../../services/reporting/database";
import { latestLink } from "./support/flows";
import { TestBrowser } from "./support/browser";
import { setControl } from "../../services/reporting/controls";
import { TAS } from "./support/fixtures";
import { ADA, Harness } from "./support/harness";
import { KERNEL, confirmedKernelReport, prepareActivation } from "./support/activation";

let harness: Harness;
beforeEach(async () => {
  harness = new Harness();
  harness.chain.kernels.add(KERNEL);
  harness.chain.grantRole(TAS.address, KERNEL, { gardener: true });
  harness.delegationModules.push({
    moduleRef: "kernel-0.3.1-permission-v0.0.4",
    chainId: 42161,
    validatorAddress: "0x0000000000000000000000000000000000007a11",
    validatorCodeHash: `0x${"ab".repeat(32)}`,
  });
  await confirmedKernelReport(harness);
  await harness.press(ADA, "Allow reporting in chat");
});
afterEach(() => harness.close());
const row = (sql: string) => harness.core.db.query(sql).get();

describe("first-report activation authority", () => {
  it("persists an exposed signature, replays exact bytes, and refuses changed bytes and release hints", async () => {
    const p = await prepareActivation(harness);
    const sign = () => p.browser.request("POST", `${p.path}/signature`, { body: p.signatureBody });
    const first = await sign();
    expect(first.status).toBe(200);
    harness.restart();
    expect((await sign()).body).toEqual(first.body);
    expect(harness.sender.signed).toBe(1);
    expect(row("SELECT authorization_mode, state, reason_code FROM execution_attempts")).toEqual({
      authorization_mode: "activation",
      state: "uncertain",
      reason_code: "grant_activation_signed",
    });
    expect(
      (
        await p.browser.request("POST", `${p.path}/signature`, {
          body: {
            ...p.signatureBody,
            userOperation: { ...p.signatureBody.userOperation, nonce: "0x2" },
          },
        })
      ).status
    ).toBe(409);
    expect(
      (
        await p.browser.request("POST", `${p.path}/outcome`, {
          body: {
            attemptId: p.signatureBody.attemptId,
            payloadDigest: p.signatureBody.payloadDigest,
            idempotencyKey: "forged-release",
            outcome: { kind: "rejected_before_send", reason: "wallet_rejected" },
          },
        })
      ).status
    ).toBe(409);
    expect(row("SELECT submissions_reserved, submissions_consumed FROM execution_grants")).toEqual({
      submissions_reserved: 1,
      submissions_consumed: 0,
    });
  });

  it("recovers a lost browser callback only from the first receipt plus effective permission, without another send", async () => {
    const p = await prepareActivation(harness);
    expect(
      (await p.browser.request("POST", `${p.path}/signature`, { body: p.signatureBody })).status
    ).toBe(200);
    await harness.drain();
    expect(row("SELECT state FROM execution_grants")).toEqual({ state: "enabling" });
    const hash = [...harness.sender.activationOperations.keys()][0]!;
    await harness.sender.submit(harness.sender.activationOperations.get(hash)!);
    harness.restart();
    harness.clock.advance(30_000);
    await harness.drain();
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "published" });
    expect(row("SELECT state FROM execution_grants")).toEqual({ state: "enabling" });
    harness.chain.permissions.add(`${KERNEL}:${harness.permissionId}`);
    harness.clock.advance(30_000);
    await harness.drain();
    expect(
      row("SELECT state, submissions_reserved, submissions_consumed FROM execution_grants")
    ).toEqual({ state: "active", submissions_reserved: 0, submissions_consumed: 1 });
    const late = await p.browser.request("POST", `${p.path}/outcome`, {
      body: {
        attemptId: p.signatureBody.attemptId,
        payloadDigest: p.signatureBody.payloadDigest,
        idempotencyKey: "late-after-receipt",
        outcome: { kind: "broadcast", userOperationHash: hash },
      },
    });
    const restored = await p.browser.request<{ grant: { state: string } }>(
      "POST",
      "/messaging/execution-grants"
    );
    expect(restored.status).toBe(201);
    expect(restored.body.grant.state).toBe("active");
    expect(late.status).toBe(200);
    expect(late.body).toMatchObject({ operationState: "published", attemptState: "confirmed" });
    const published = await p.browser.request<{
      resource: { state: string; lines: unknown[]; evidence: unknown[] };
    }>("GET", p.path);
    expect(published.status).toBe(200);
    expect(published.body.resource).toMatchObject({ state: "published", lines: [], evidence: [] });
    expect(harness.sender.signed).toBe(1);
    expect(harness.sender.submitted).toBe(1);
  });

  it("rejects owner signatures and factories at the HTTP boundary before accessing the signer", async () => {
    const p = await prepareActivation(harness);
    for (const extra of [{ signature: "0xfeed" }, { factory: KERNEL }, { factoryData: "0x01" }]) {
      expect(
        (
          await p.browser.request("POST", `${p.path}/signature`, {
            body: {
              ...p.signatureBody,
              userOperation: { ...p.signatureBody.userOperation, ...extra },
            },
          })
        ).status
      ).toBe(400);
    }
    expect(
      (
        await p.browser.request("POST", `${p.path}/signature`, {
          body: {
            ...p.signatureBody,
            userOperation: { ...p.signatureBody.userOperation, callGasLimit: "0x1000000" },
          },
        })
      ).status
    ).toBe(403);
    expect(harness.sender.signed).toBe(0);
  });

  it("rolls back the owner attempt and operation when the grant has no gas budget", async () => {
    await prepareActivation(harness, {
      beforeReserve: () => harness.core.db.query("UPDATE execution_grants SET gas_cap = 1").run(),
      expectedReservationStatus: 409,
    });
    expect(row("SELECT count(*) AS count FROM execution_attempts")).toEqual({ count: 0 });
    expect(row("SELECT state, attempt_version FROM execution_operations")).toEqual({
      state: "prepared",
      attempt_version: 0,
    });
    expect(row("SELECT submissions_reserved, gas_reserved FROM execution_grants")).toEqual({
      submissions_reserved: 0,
      gas_reserved: 0,
    });
  });

  it("rechecks publication after the signer awaits and exposes no signature under a changed permit", async () => {
    const p = await prepareActivation(harness);
    const sign = harness.sender.signActivation.bind(harness.sender);
    harness.sender.signActivation = async (input) => {
      const result = await sign(input);
      setControl(harness.core, "publication", false, {
        actor: "operator",
        reason: "awaited pause",
      });
      return result;
    };
    expect(
      (await p.browser.request("POST", `${p.path}/signature`, { body: p.signatureBody })).status
    ).toBe(423);
    expect(row("SELECT state, user_operation_hash FROM execution_attempts")).toEqual({
      state: "wallet_pending",
      user_operation_hash: null,
    });
    expect(row("SELECT state FROM execution_grants")).toEqual({
      state: "owner_authorization_pending",
    });
  });

  it("rejects a direct installation approval that has no first-report attempt", async () => {
    const p = await prepareActivation(harness);
    harness.chain.permissions.add(`${KERNEL}:${harness.permissionId}`);
    expect(
      (
        await p.browser.request("POST", `/messaging/execution-grants/${p.grant.grantId}/approval`, {
          body: {
            expectedVersion: p.grant.version + 1,
            policyDigest: p.grant.policyDigest,
            enableReference: `0x${"cd".repeat(32)}`,
          },
        })
      ).status
    ).toBe(403);
    expect(row("SELECT state FROM execution_grants")).toEqual({
      state: "owner_authorization_pending",
    });
  });
  it("refuses cached signatures while publication is paused or the grant is paused", async () => {
    const p = await prepareActivation(harness);
    const sign = () => p.browser.request("POST", `${p.path}/signature`, { body: p.signatureBody });
    expect((await sign()).status).toBe(200);
    setControl(harness.core, "publication", false, {
      actor: "operator",
      reason: "pause after exposure",
    });
    expect((await sign()).status).toBe(423);
    setControl(harness.core, "publication", true, { actor: "operator", reason: "resume" });
    harness.core.db.query("UPDATE execution_grants SET state = 'paused'").run();
    const result = await p.browser.request("POST", `${p.path}/signature`, {
      body: { ...p.signatureBody, permitVersion: p.signatureBody.permitVersion + 2 },
    });
    expect(result.status).toBe(403);
    expect(harness.sender.signed).toBe(1);
  });

  it("does not transfer activation authority to a different continuation for the same confirmed resource", async () => {
    const p = await prepareActivation(harness);
    const original = harness.core.db
      .query("SELECT id FROM continuation_requests WHERE purpose = 'grant_reporting'")
      .get() as { id: string };
    const request = requestById(harness.core, original.id)!;
    const link = issueContinuation(harness.core, { ...request });
    const other = new TestBrowser(harness.app);
    await other.open(link.url);
    await other.proveAs(KERNEL, "0x6b65726e656c");
    await other.access();
    expect((await other.request("POST", "/messaging/execution-grants")).status).toBe(403);
    expect((await other.request("GET", p.path)).status).toBe(404);
    expect(
      (await other.request("POST", `${p.path}/signature`, { body: p.signatureBody })).status
    ).toBe(404);
    expect(harness.sender.signed).toBe(0);
  });

  it("rechecks identity inside the atomic attempt reservation after the awaited block read", async () => {
    await prepareActivation(harness, {
      beforeReserve: () => {
        const block = harness.chain.blockNumber.bind(harness.chain);
        harness.chain.blockNumber = async () => {
          const number = await block();
          harness.core.db
            .query("UPDATE participants SET identity_epoch = identity_epoch + 1")
            .run();
          return number;
        };
      },
      expectedReservationStatus: 403,
    });
    expect(row("SELECT count(*) AS count FROM execution_attempts")).toEqual({ count: 0 });
    expect(row("SELECT submissions_reserved, gas_reserved FROM execution_grants")).toEqual({
      submissions_reserved: 0,
      gas_reserved: 0,
    });
  });
  it("releases only a proven rejection before delegate signature exposure and ends that unused grant", async () => {
    const p = await prepareActivation(harness);
    const rejected = await p.browser.request("POST", `${p.path}/outcome`, {
      body: {
        attemptId: p.signatureBody.attemptId,
        payloadDigest: p.signatureBody.payloadDigest,
        idempotencyKey: "wallet-rejected-before-signing",
        outcome: { kind: "rejected_before_send", reason: "owner_rejected" },
      },
    });
    expect(rejected.status).toBe(200);
    expect(row("SELECT state, user_operation_hash FROM execution_attempts")).toEqual({
      state: "rejected_before_send",
      user_operation_hash: null,
    });
    expect(row("SELECT state, submissions_reserved, gas_reserved FROM execution_grants")).toEqual({
      state: "failed",
      submissions_reserved: 0,
      gas_reserved: 0,
    });
    expect(harness.sender.signed).toBe(0);
    expect(
      (await p.browser.request("POST", `${p.path}/signature`, { body: p.signatureBody })).status
    ).toBe(404);
  });
  it("refuses a proposal when recovery commits during its awaited permission lookup", async () => {
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    await browser.proveAs(KERNEL, "0x6b65726e656c");
    await browser.access();
    const token = browser.cookies.get("gg_msg_session")!;
    const session = sessionFromToken(harness.core, token, browser.csrf!)!;
    expect(session).not.toBeNull();
    let permissionLookupReached = false;
    const result = await proposeGrant(
      {
        core: harness.core,
        chain: harness.chain,
        ...harness.grantDeps(),
        permissionIdFor: async () => {
          permissionLookupReached = true;
          await Promise.resolve();
          inTransaction(harness.core.db, () => {
            harness.core.db
              .query("UPDATE participants SET identity_epoch = identity_epoch + 1 WHERE id = $id")
              .run({ id: session.participantId });
            revokeParticipantSessions(harness.core, session.participantId);
          });
          return harness.permissionId;
        },
      },
      session,
      TAS.address
    );
    expect(permissionLookupReached).toBe(true);
    expect(result).toEqual({ ok: false, errorCode: "forbidden" });
    expect(row("SELECT count(*) AS count FROM execution_grants")).toEqual({ count: 0 });
    expect(sessionFromToken(harness.core, token, browser.csrf!)).toBeNull();
    expect(harness.sender.signed).toBe(0);
  });
});
