import type { GrantView, ResourceView } from "@green-goods/shared/modules/agent-reporting";
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
import {
  KERNEL,
  KERNEL_PROOF,
  confirmedKernelReport,
  prepareActivation,
} from "./support/activation";

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

  it("shows no first report until the owner asks for one, so the page can offer to prepare it", async () => {
    // The page reads a first report here as one being prepared and waits for it. Answered with the
    // report before Prepare First Report was pressed, it waited on "loading" with no button.
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    await browser.proveAs(KERNEL, KERNEL_PROOF);
    await browser.access();
    const proposed = await browser.request<{ grant: GrantView }>(
      "POST",
      "/messaging/execution-grants"
    );
    expect(proposed.status).toBe(201);
    const { grant } = proposed.body;
    const path = `/messaging/execution-grants/${grant.grantId}/activation`;

    expect((await browser.request("GET", path)).status).toBe(404);
    expect(row("SELECT count(*) AS operations FROM execution_operations")).toEqual({
      operations: 0,
    });

    const started = await browser.request<{ resource: ResourceView }>("POST", path, {
      body: { expectedVersion: grant.version, policyDigest: grant.policyDigest },
    });
    expect(started.status).toBe(200);
    const operationId = started.body.resource.operation?.operationId;
    expect(operationId).toBeTruthy();
    const restored = await browser.request<{ resource: ResourceView }>("GET", path);
    expect(restored.status).toBe(200);
    expect(restored.body.resource.operation?.operationId).toBe(operationId);
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
  it("releases a refused over-budget activation before any delegate signature is exposed", async () => {
    const p = await prepareActivation(harness);
    const refused = await p.browser.request("POST", `${p.path}/signature`, {
      body: {
        ...p.signatureBody,
        userOperation: { ...p.signatureBody.userOperation, verificationGasLimit: "0x40000" },
      },
    });
    expect(refused.status).toBe(403);
    expect(harness.sender.signed).toBe(0);
    const settled = await p.browser.request("POST", `${p.path}/outcome`, {
      body: {
        attemptId: p.signatureBody.attemptId,
        payloadDigest: p.signatureBody.payloadDigest,
        idempotencyKey: "activation-over-budget",
        outcome: { kind: "preparation_failed", reason: "activation_unavailable" },
      },
    });
    expect(settled.status).toBe(200);
    expect(row("SELECT state FROM execution_grants")).toEqual({ state: "failed" });
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "failed" });
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

describe("an Allow reporting in chat link that expires unused", () => {
  const LINK_EXPIRED =
    "Your publishing link expired before anything was sent, so nothing was published. Your report is saved; reply RETRY for a new link.";
  const sent = () => harness.transport.sent.map((reply) => reply.message.text);

  /** Opens the permission page and proves the account; it proposes the permission and returns. */
  async function openPermissionPage() {
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    await browser.proveAs(KERNEL, KERNEL_PROOF);
    await browser.access();
    const proposed = await browser.request<{ grant: GrantView }>(
      "POST",
      "/messaging/execution-grants"
    );
    expect(proposed.status).toBe(201);
    return { browser, grant: proposed.body.grant };
  }

  it("says so once, and RETRY asks again so a fresh page can propose its own permission", async () => {
    // The page proposes the permission and is closed before the first report is prepared.
    await openPermissionPage();
    harness.clock.advance(harness.core.settings.browserSessionTtlMs);
    await harness.drain();
    expect(sent().filter((text) => text === LINK_EXPIRED)).toHaveLength(1);
    expect(await harness.say(ADA, "STATUS")).toEqual([LINK_EXPIRED]);

    const asked = await harness.say(ADA, "RETRY");
    expect(asked[0]).toContain("1. Allow reporting in chat\n2. Publish this report only");
    expect(await harness.say(ADA, "STATUS")).toEqual([
      "Your report for TAS is waiting for you to choose how to publish it.",
    ]);
    await harness.press(ADA, "Allow reporting in chat");
    // The closed page's permission was never authorized, so it no longer blocks the new page's.
    const fresh = await prepareActivation(harness);
    expect(fresh.operation.envelope).not.toBeNull();
    expect(
      harness.core.db.query("SELECT state FROM execution_grants ORDER BY created_at").all()
    ).toEqual([{ state: "expired" }, { state: "owner_authorization_pending" }]);
  });

  it("says the link expired once a first report prepared after its page closed is ready", async () => {
    const { browser, grant } = await openPermissionPage();
    // Prepare First Report is pressed, but preparation can't finish while the catalog is down.
    harness.catalog.unavailable = true;
    const started = await browser.request(
      "POST",
      `/messaging/execution-grants/${grant.grantId}/activation`,
      { body: { expectedVersion: grant.version, policyDigest: grant.policyDigest } }
    );
    expect(started.status).toBe(200);
    await harness.drain();
    // The page closes while the report is still being prepared, which is not yet a lapsed link.
    harness.clock.advance(harness.core.settings.browserSessionTtlMs);
    await harness.drain();
    expect(sent()).not.toContain(LINK_EXPIRED);

    // Preparation finishes with nothing left to sign it, so the chat hears that now.
    harness.catalog.unavailable = false;
    harness.clock.advance(60_000);
    await harness.drain();
    expect(sent().filter((text) => text === LINK_EXPIRED)).toHaveLength(1);
    expect(await harness.say(ADA, "STATUS")).toEqual([LINK_EXPIRED]);
  });

  it("ends the earlier page's unused permission when the owner picks this report only instead", async () => {
    const { browser, grant } = await openPermissionPage();
    await harness.say(ADA, "RETRY");
    await harness.press(ADA, "Publish this report only");
    // The page still open from the first choice can no longer install that permission.
    const stale = await browser.request(
      "POST",
      `/messaging/execution-grants/${grant.grantId}/activation`,
      { body: { expectedVersion: grant.version, policyDigest: grant.policyDigest } }
    );
    expect(stale.status).toBe(409);
    expect(harness.core.db.query("SELECT state FROM execution_grants").all()).toEqual([
      { state: "expired" },
    ]);
  });

  it("refuses a proposal from the earlier page that finishes after the owner picked again", async () => {
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    await browser.proveAs(KERNEL, KERNEL_PROOF);
    await browser.access();
    const token = browser.cookies.get("gg_msg_session")!;
    const session = sessionFromToken(harness.core, token, browser.csrf!)!;
    const result = await proposeGrant(
      {
        core: harness.core,
        chain: harness.chain,
        ...harness.grantDeps(),
        // While the page waits on this lookup, the owner asks again and picks the permission anew.
        permissionIdFor: async () => {
          await harness.say(ADA, "RETRY");
          await harness.press(ADA, "Allow reporting in chat");
          return harness.permissionId;
        },
      },
      session,
      TAS.address
    );
    expect(result).toEqual({ ok: false, errorCode: "forbidden" });
    // The page from the new link proposes its own permission and prepares the first report.
    const fresh = await prepareActivation(harness);
    expect(fresh.operation.envelope).not.toBeNull();
  });

  it("does not wait on a revoked permission page before saying the new link expired", async () => {
    // The permission page stays open while the owner asks again and picks this report only.
    await openPermissionPage();
    await harness.say(ADA, "RETRY");
    await harness.press(ADA, "Publish this report only");
    expect(sent().at(-1)).toContain(
      "Open this page to review and sign the exact publication with your passkey."
    );
    // The new link expires unused; the permission page is still open but can't sign anything.
    harness.clock.advance(harness.core.settings.linkChallengeTtlMs);
    await harness.drain();
    expect(sent().filter((text) => text === LINK_EXPIRED)).toHaveLength(1);
  });

  it("answers STATUS with the lapsed link when a page moved the report on past an open question", async () => {
    // The owner asks again, then goes back to the open permission page and prepares from there.
    const { browser, grant } = await openPermissionPage();
    await harness.say(ADA, "RETRY");
    const started = await browser.request(
      "POST",
      `/messaging/execution-grants/${grant.grantId}/activation`,
      { body: { expectedVersion: grant.version, policyDigest: grant.policyDigest } }
    );
    expect(started.status).toBe(200);
    await harness.drain();
    harness.clock.advance(harness.core.settings.browserSessionTtlMs);
    await harness.drain();
    expect(sent().filter((text) => text === LINK_EXPIRED)).toHaveLength(1);
    expect(await harness.say(ADA, "STATUS")).toEqual([LINK_EXPIRED]);
  });

  it("after the first report is prepared, RETRY sends a page to sign that report with the passkey", async () => {
    // Prepare First Report is pressed, then the page is closed before anything is sent.
    const { browser, grant } = await openPermissionPage();
    const started = await browser.request(
      "POST",
      `/messaging/execution-grants/${grant.grantId}/activation`,
      { body: { expectedVersion: grant.version, policyDigest: grant.policyDigest } }
    );
    expect(started.status).toBe(200);
    await harness.drain();
    harness.clock.advance(harness.core.settings.browserSessionTtlMs);
    await harness.drain();
    expect(sent().filter((text) => text === LINK_EXPIRED)).toHaveLength(1);

    const fresh = await harness.say(ADA, "RETRY");
    expect(fresh[0]).toContain(
      "Open this page to review and sign the exact publication with your passkey."
    );
    const signing = new TestBrowser(harness.app);
    await signing.open(latestLink(harness));
    await signing.proveAs(KERNEL, KERNEL_PROOF);
    const access = await signing.access();
    const { resourceId } = access.body.scope as { resourceId: string };
    const view = (await signing.request<ResourceView>("GET", `/messaging/drafts/${resourceId}`))
      .body;
    expect(view.operation?.state).toBe("prepared");
    const reserved = await signing.request(
      "POST",
      `/messaging/operations/${view.operation?.operationId}/attempts`,
      {
        body: {
          expectedAttemptVersion: view.operation?.attemptVersion ?? 0,
          payloadDigest: view.operation?.envelope?.payloadDigest,
          idempotencyKey: "owner-after-expiry",
        },
      }
    );
    expect(reserved.status).toBe(200);
  });
});
