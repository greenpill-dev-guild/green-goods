import {
  buildEnvelope,
  envelopeIssues,
  type WorkEnvelope,
} from "@green-goods/shared/modules/agent-reporting";
import { privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { TestBrowser } from "./support/browser";
import {
  adaAccount,
  bolaAccount,
  confirmLinkAndPublish,
  latestLink,
  openSigningPage,
  reportOutcome,
  reserve,
} from "./support/flows";
import { TAS } from "./support/fixtures";
import { ADA, Harness, summaryToken } from "./support/harness";

/**
 * Owner signing through the browser ceremony: real EOA proofs, the frozen envelope, attempt
 * reservation, typed outcomes and independent receipt reconciliation against a fake chain that
 * decodes the real EAS calldata. This is orchestration proof, not wallet or live-chain proof.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

function sentTexts(): string[] {
  return harness.transport.sent.map((sent) => sent.message.text);
}

function row<T>(sql: string, params: Record<string, string | number> = {}): T {
  return harness.core.db.query(sql).get(params) as T;
}

describe("switching account after cancelling", () => {
  it("lets the chat disconnect once a report waiting for a signature is cancelled", async () => {
    await confirmLinkAndPublish(harness);
    await harness.drain();
    // The report has a prepared operation waiting for the owner's signature.
    expect((await harness.say(ADA, "DISCONNECT"))[0]).toContain("can't disconnect it yet");
    expect((await harness.say(ADA, "CANCEL"))[0]).toContain("Report cancelled");
    // The cancelled report's operation stays in the table; it no longer holds the account.
    expect((await harness.say(ADA, "SWITCH"))[0]).toContain("This chat is no longer connected to");
  });
});

describe("owner publication", () => {
  it("links an account in chat, publishes the exact envelope and verifies the receipt", async () => {
    await confirmLinkAndPublish(harness);
    expect(sentTexts().at(-1)).toContain(
      "Open this page to review and sign the exact publication with your wallet."
    );

    const { browser, view, envelope } = await openSigningPage(harness);
    expect(view).toMatchObject({ state: "awaitingWallet", gardenLabel: "TAS" });
    expect(view.operation).toMatchObject({ state: "prepared", authorizationMode: "owner" });
    expect(
      envelopeIssues(envelope, {
        deployment: harness.chain.deployment,
        account: adaAccount.address,
      })
    ).toEqual([]);
    // Evidence and metadata go to public storage only after confirmation and consent.
    expect(harness.uploader.uploads.map((upload) => upload.name)).toEqual(["metadata.json"]);

    const attempt = await reserve(browser, view, envelope);
    expect(attempt.status).toBe(200);
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    const outcome = await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    expect(outcome.body).toEqual({
      ok: true,
      operationState: "reconciling",
      attemptState: "broadcast",
    });
    // A lost acknowledgement is retried with the same key and gets the first answer back.
    const replay = await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    expect(replay.body).toEqual(outcome.body);
    const changed = await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "rejected_before_send",
      reason: "user_rejected",
    });
    expect(changed.status).toBe(409);

    await harness.drain();
    const published = row<{ state: string; attestation_uid: string; transaction_hash: string }>(
      "SELECT state, attestation_uid, transaction_hash FROM execution_operations"
    );
    expect(published).toMatchObject({ state: "published", transaction_hash: hash });
    expect(sentTexts().at(-1)).toBe(
      `Your report is published ✅\nWork: ${published.attestation_uid}\nTransaction: https://arbiscan.io/tx/${hash}`
    );
    // The link opens the attestation's own record, which exists from the moment it is published.
    // Nothing is signed there, so it carries no advice about browsers and no link to copy.
    expect(harness.transport.sent.at(-1)?.message.link).toEqual({
      url: `https://arbitrum.easscan.org/attestation/view/${published.attestation_uid}`,
      label: "View your report",
    });
    // Attribution is the gardener's own account, never the Agent or a relayer.
    expect(row("SELECT attester, garden_address FROM work_records")).toEqual({
      attester: adaAccount.address.toLowerCase(),
      garden_address: TAS.address.toLowerCase(),
    });
    expect(harness.chain.works.get(published.attestation_uid as `0x${string}`)).toMatchObject({
      gardenerAddress: adaAccount.address.toLowerCase(),
      title: envelope.kind === "work" ? envelope.fields.title : "",
    });
  });

  it("returns a rejected signature for explicit reconfirmation without another publication", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const rejected = await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "rejected_before_send",
      reason: "user_rejected",
    });
    expect(rejected.body).toEqual({
      ok: true,
      operationState: "failed",
      attemptState: "rejected_before_send",
    });
    await harness.drain();
    const texts = sentTexts();
    expect(texts.at(-2)).toContain("The signature was declined, so nothing was published.");
    expect(row("SELECT count(*) AS n FROM confirmations WHERE invalidated_at IS NULL")).toEqual({
      n: 0,
    });
    // The old page cannot reserve again: the report needs a new confirmation first.
    expect((await reserve(browser, view, envelope, "attempt-key-2")).status).toBe(409);

    await harness.say(ADA, `CONFIRM ${summaryToken(texts.slice(-1))}`);
    const again = await openSigningPage(harness);
    expect(again.view.operation?.operationId).toBe(view.operation?.operationId);
    expect(again.view.operation?.attemptVersion).toBe(1);
    const second = await reserve(again.browser, again.view, again.envelope, "attempt-key-3");
    expect(second.status).toBe(200);
    expect(row("SELECT count(*) AS n FROM execution_attempts")).toEqual({ n: 2 });
  });

  it("finds a publication by event scan when the wallet callback never arrives", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });

    harness.clock.advance(harness.core.settings.walletResponseWindowMs);
    await harness.drain();
    expect(row("SELECT state, reason_code FROM execution_attempts")).toEqual({
      state: "confirmed",
      reason_code: "callback_missing",
    });
    expect(sentTexts().slice(-2)).toEqual([
      "I didn't hear back from your wallet, so I can't tell yet whether it was sent. I won't send it again; I'm checking the chain and will tell you what I find.",
      expect.stringContaining("Your report is published ✅"),
    ]);
    // A late failure hint cannot rewrite a verified publication.
    const late = await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "rejected_before_send",
      reason: "user_rejected",
    });
    expect(late.status).toBe(409);
  });

  it("accepts a late transaction hash for the same attempt after the callback window", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    harness.clock.advance(harness.core.settings.walletResponseWindowMs);
    await harness.drain();
    expect(row("SELECT state, reason_code FROM execution_attempts")).toEqual({
      state: "uncertain",
      reason_code: "callback_missing",
    });

    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    const late = await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    expect(late.body).toEqual({
      ok: true,
      operationState: "reconciling",
      attemptState: "broadcast",
    });
    await harness.drain();
    expect(row("SELECT state, transaction_hash FROM execution_operations")).toEqual({
      state: "published",
      transaction_hash: hash,
    });
    expect(row("SELECT count(*) AS n FROM execution_attempts")).toEqual({ n: 1 });
  });

  it("keeps an uncertain no-hash attempt reserved until the chain proves an outcome", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "uncertain",
      reason: "wallet_timeout",
    });
    await harness.drain();
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "reconciling" });
    expect(
      row("SELECT state, last_error_code FROM processing_jobs WHERE kind = 'reconcile_operation'")
    ).toEqual({
      state: "pending",
      last_error_code: "receipt_pending",
    });
    // No fresh attempt is possible while the first one may still land.
    expect((await reserve(browser, view, envelope, "attempt-key-2")).status).toBe(409);

    harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    harness.clock.advance(30_000);
    await harness.drain();
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "published" });
  });

  it("waits for a reported hash that is not mined yet instead of calling it a conflict", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    harness.chain.hidden.add(hash);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    expect(row("SELECT state, failure_code FROM execution_operations")).toEqual({
      state: "reconciling",
      failure_code: null,
    });
    expect(
      row("SELECT last_error_code FROM processing_jobs WHERE kind = 'reconcile_operation'")
    ).toEqual({ last_error_code: "receipt_pending" });

    harness.chain.hidden.delete(hash);
    harness.clock.advance(30_000);
    await harness.drain();
    expect(row("SELECT state, transaction_hash FROM execution_operations")).toEqual({
      state: "published",
      transaction_hash: hash,
    });
  });

  it("treats a reported hash that carries another payload as a conflict, never as publication", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    if (envelope.kind !== "work") throw new Error("Expected a work envelope");
    // A genuine attestation from the same account to the same garden, but with other content.
    const unrelated = buildEnvelope<WorkEnvelope>(harness.chain.deployment, {
      ...envelope,
      fields: { ...envelope.fields, title: "Something else" },
    });
    const other = harness.chain.submit({
      attester: adaAccount.address,
      to: unrelated.call.to,
      data: unrelated.call.data,
    });
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: other,
    });
    await harness.drain();
    expect(row("SELECT state, failure_code FROM execution_operations")).toEqual({
      state: "reconciling",
      failure_code: "receipt_mismatch",
    });
    expect(sentTexts().some((text) => text.includes("published ✅"))).toBe(false);
  });

  it("never counts the same payload attested by another account as the gardener's publication", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    harness.chain.grantRole(TAS.address, bolaAccount.address, { gardener: true });
    const copy = harness.chain.submit({
      attester: bolaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: copy,
    });
    await harness.drain();
    expect(row("SELECT state, failure_code FROM execution_operations")).toEqual({
      state: "reconciling",
      failure_code: "receipt_mismatch",
    });
  });

  it("reports a definitive revert and asks for renewed intent", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
      revert: true,
    });
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    expect(row("SELECT state, failure_code FROM execution_operations")).toEqual({
      state: "failed",
      failure_code: "reverted",
    });
    expect(sentTexts().at(-2)).toBe(
      "The publication failed on chain. Your report is saved; check it and confirm again to retry."
    );
    expect(sentTexts().at(-1)).toContain("CONFIRM");
  });

  it("refuses to reserve while publication is paused and keeps the confirmed report", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    setControl(harness.core, "publication", false, { actor: "operator", reason: "test pause" });
    expect((await reserve(browser, view, envelope)).status).toBe(423);
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "prepared" });
  });

  it("denies reservation when the garden role was removed after confirmation", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    harness.chain.grantRole(TAS.address, adaAccount.address, {});
    expect((await reserve(browser, view, envelope)).status).toBe(403);
    expect(row("SELECT count(*) AS n FROM execution_attempts")).toEqual({ n: 0 });
  });
});

describe("browser ceremony boundaries", () => {
  it("never lets a forwarded link publish for someone who cannot prove the bound account", async () => {
    await confirmLinkAndPublish(harness);
    const url = latestLink(harness);
    const other = new TestBrowser(harness.app);
    expect((await other.open(url)).status).toBe(201);
    const stranger = privateKeyToAccount(
      "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
    );
    expect((await other.prove(stranger)).status).toBe(403);
    expect((await other.access()).status).toBe(401);
    // The owner's own browser is not locked out by the stranger's attempt.
    const owner = await openSigningPage(harness);
    expect(owner.view.operation?.state).toBe("prepared");
  });

  it("requires the exact Origin and the session's CSRF token for mutations", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const path = `/messaging/operations/${view.operation?.operationId}/attempts`;
    const body = {
      expectedAttemptVersion: 0,
      payloadDigest: envelope.payloadDigest,
      idempotencyKey: "attempt-key-1",
    };
    expect(
      (await browser.request("POST", path, { body, origin: "https://evil.test" })).status
    ).toBe(401);
    expect((await browser.request("POST", path, { body, csrf: null })).status).toBe(401);
    expect((await browser.request("POST", path, { body, csrf: "not-the-token" })).status).toBe(401);
    expect((await browser.request("POST", path, { body })).status).toBe(200);
  });

  it("serves only the session's own draft and keeps private responses out of caches", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view } = await openSigningPage(harness);
    const own = await browser.request("GET", `/messaging/drafts/${view.resourceId}`);
    expect(own.headers.get("cache-control")).toBe("no-store");
    expect(own.headers.get("referrer-policy")).toBe("no-referrer");
    const foreign = await browser.request("GET", "/messaging/drafts/some-other-draft");
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ ok: false, errorCode: "unavailable" });
  });

  it("does not consume a link when a preview fetches the page without the bootstrap header", async () => {
    await confirmLinkAndPublish(harness);
    const url = latestLink(harness);
    const requestId = url.split("/").at(-1);
    const preview = await harness.app.request("/messaging/challenges", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://greengoods.test" },
      body: JSON.stringify({ requestId }),
    });
    expect(preview.status).toBe(403);
    expect(
      row(
        "SELECT count(*) AS n FROM browser_challenges WHERE request_id IN (SELECT id FROM continuation_requests WHERE purpose = 'publish_work')"
      )
    ).toEqual({ n: 0 });
  });
});
