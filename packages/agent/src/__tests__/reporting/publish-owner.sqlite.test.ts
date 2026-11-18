import {
  buildEnvelope,
  envelopeIssues,
  type WorkEnvelope,
} from "@green-goods/shared/modules/agent-reporting";
import { privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { replayFailedJob } from "../../services/reporting/jobs";
import { reconcileOperation } from "../../services/reporting/reconciliation";
import { drain } from "../../services/reporting/worker";
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

const CHECK_STOPPED =
  "I've checked the chain and still can't find your report, so I've stopped checking. I won't send it again. If it doesn't show in the garden, write to contact@greengoods.app.";
const ATTESTATION_UNREAD =
  "The transaction is confirmed, but I still can't read its attestation details, so I've stopped checking. You don't need to sign or send anything again. If your report doesn't show in the garden, write to contact@greengoods.app.";
const STILL_CONFIRMING =
  "Your report was sent and is still being confirmed, which can take a few minutes. You can leave this chat; I'll message you when it's published. You don't need to send it again.";
const LINK_EXPIRED =
  "Your publishing link expired before anything was sent, so nothing was published. Your report is saved; reply RETRY for a new link.";
const AWAITING_SIGNATURE = "Your report for TAS is waiting for your signature.";

function count(text: string): number {
  return sentTexts().filter((sent) => sent === text).length;
}

/** The page sends the frozen report as the gardener; the transaction is mined unless hidden. */
function send(envelope: { call: { to: `0x${string}`; data: `0x${string}` } }): `0x${string}` {
  return harness.chain.submit({
    attester: adaAccount.address,
    to: envelope.call.to,
    data: envelope.call.data,
  });
}

/** Every pass of the chain check finds nothing, until the job has no attempts left. */
async function exhaustChainCheck(): Promise<void> {
  for (let pass = 0; pass < 45; pass += 1) {
    harness.clock.advance(30_000);
    await harness.drain();
  }
}

describe("switching account after cancelling", () => {
  it("lets the chat disconnect once a report waiting for a signature is cancelled", async () => {
    await confirmLinkAndPublish(harness);
    await harness.drain();
    // The report has a prepared operation waiting for the owner's signature.
    expect((await harness.say(ADA, "DISCONNECT"))[0]).toContain("can't disconnect it yet");
    expect((await harness.say(ADA, "CANCEL"))[0]).toContain("Report canceled");
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
    const metadata = JSON.parse(new TextDecoder().decode(harness.uploader.uploads[0].bytes));
    expect(metadata.uploadConsent).toMatchObject({
      policyVersion: "2026-11-05",
      uploaderAddress: adaAccount.address.toLowerCase(),
      permissionsConfirmed: true,
      locale: "en",
    });

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
    // A policy update must not prevent reconciliation of a transaction already sent.
    harness.core.db.query("UPDATE consent_records SET notice_version = 'previous-policy'").run();
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
    // Both identifiers are 32 bytes, so only their values tell a swapped pair of links apart.
    expect(published.attestation_uid).not.toBe(hash);
    const result = harness.transport.sent.at(-1)?.message;
    expect(result?.text).toBe("Your report is published ✅");
    // The attestation leads and the transaction follows, each on its own explorer. Nothing is
    // signed at either, so the result carries no advice about browsers and no link to copy.
    expect(result?.records).toEqual([
      {
        url: `https://arbitrum.easscan.org/attestation/view/${published.attestation_uid}`,
        label: "View attestation",
      },
      { url: `https://arbiscan.io/tx/${hash}`, label: "View transaction" },
    ]);
    expect(result?.link).toBeUndefined();
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

  it("reopens a saved report for fresh confirmation when the upload terms change", async () => {
    setControl(harness.core, "publication", false, { actor: "operator", reason: "test pause" });
    await confirmLinkAndPublish(harness);
    expect(harness.uploader.uploads).toHaveLength(0);
    const db = harness.core.db;
    db.query("UPDATE consent_records SET notice_version = 'previous-policy'").run();
    setControl(harness.core, "publication", true, { actor: "operator", reason: "test resume" });
    harness.clock.advance(5 * 60_000);
    await harness.drain();
    expect(row("SELECT state, failure_code FROM execution_operations")).toEqual({
      state: "preparation_failed",
      failure_code: "policy_changed",
    });
    expect(harness.uploader.uploads).toHaveLength(0);

    await harness.say(ADA, "RETRY");
    const accepted = await harness.press(ADA, "I agree");
    const summary = accepted.some((text) => /CONFIRM \d{4}/.test(text))
      ? accepted
      : await harness.say(ADA, "RETRY");
    expect(summary.join("\n")).toContain("baobab");
    expect(harness.uploader.uploads).toHaveLength(0);
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    expect(harness.uploader.uploads.map(({ name }) => name)).toEqual(["metadata.json"]);
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "prepared" });
  });

  it("renews a prepared report before letting the owner reserve a send", async () => {
    await confirmLinkAndPublish(harness);
    const previous = await openSigningPage(harness);
    expect(harness.uploader.uploads).toHaveLength(1);
    harness.core.db.query("UPDATE consent_records SET notice_version = 'previous-policy'").run();
    expect((await reserve(previous.browser, previous.view, previous.envelope)).status).toBe(403);

    await harness.say(ADA, "RETRY");
    const accepted = await harness.press(ADA, "I agree");
    const summary = accepted.some((text) => /CONFIRM \d{4}/.test(text))
      ? accepted
      : await harness.say(ADA, "RETRY");
    expect(harness.uploader.uploads).toHaveLength(1);
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);

    const updated = await openSigningPage(harness);
    expect(updated.envelope.payloadDigest).not.toBe(previous.envelope.payloadDigest);
    expect(harness.uploader.uploads).toHaveLength(2);
    expect((await reserve(updated.browser, updated.view, updated.envelope)).status).toBe(200);
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
    // A report that is being sent has no garden question to ask, so GARDEN says so without
    // waiting on a read of the garden list.
    harness.clock.advance(10_000);
    const reads = harness.gardens.reads;
    expect((await harness.say(ADA, "GARDEN"))[0]).toContain("so I can't change it now");
    expect(harness.gardens.reads).toBe(reads);

    harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    harness.clock.advance(30_000);
    await harness.drain();
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "published" });
  });

  it("says so once when the chain check stops without finding the report", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    await reserve(browser, view, envelope);
    // The page is closed before it reports: the wallet window ends and the chain check begins.
    harness.clock.advance(harness.core.settings.walletResponseWindowMs);
    await harness.drain();
    expect(sentTexts().at(-1)).toContain("I'm checking the chain and will tell you what I find.");

    // Nothing ever lands, so every check comes back empty until the job has no attempts left.
    await exhaustChainCheck();
    expect(row("SELECT state FROM processing_jobs WHERE kind = 'reconcile_operation'")).toEqual({
      state: "failed",
    });
    expect(sentTexts().filter((text) => text === CHECK_STOPPED)).toHaveLength(1);
    // The chat already said it was checking, so it never adds that the send is still confirming.
    expect(sentTexts()).not.toContain(STILL_CONFIRMING);
    // Stopping the check sends nothing: the one attempt keeps its reservation.
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "reconciling" });
    expect(row("SELECT count(*) AS n FROM execution_attempts")).toEqual({ n: 1 });
    // From now on every reply says what happened instead of "being published".
    expect(await harness.say(ADA, "STATUS")).toEqual([CHECK_STOPPED]);
    expect(await harness.say(ADA, "CANCEL")).toEqual([CHECK_STOPPED]);
    expect(await harness.say(ADA, "We also weeded the beds")).toEqual([CHECK_STOPPED]);
  });

  it("says nothing about a stop when a crash cuts off the check's last pass before it is parked", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    await reserve(browser, view, envelope);
    harness.clock.advance(harness.core.settings.walletResponseWindowMs);
    await harness.drain();

    // The last pass finds nothing, then the process dies before the worker parks the job.
    let died = false;
    let freeze!: () => void;
    const frozen = new Promise<void>((resolve) => {
      freeze = resolve;
    });
    const deps = harness.deps({
      reconcile_operation: async (job) => {
        const outcome = await reconcileOperation(
          { core: harness.core, chain: harness.chain, scanWindowBlocks: 10_000n },
          job
        );
        if (job.attempts < job.maxAttempts) return outcome;
        died = true;
        freeze();
        return new Promise<never>(() => undefined);
      },
    });
    while (!died) {
      harness.clock.advance(30_000);
      await Promise.race([drain(deps), frozen]);
    }
    harness.restart();
    harness.clock.advance(5 * 60 * 1000 + 1);

    // The report lands after all, and the rerun of that last pass finds it.
    harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    await harness.drain();
    expect(row("SELECT state FROM execution_operations")).toEqual({ state: "published" });
    expect(sentTexts()).not.toContain(CHECK_STOPPED);
  });

  it("keeps a stopped check to its own attempt, so a retry after a revert is checked afresh", async () => {
    await confirmLinkAndPublish(harness);
    const first = await openSigningPage(harness);
    const attempt = await reserve(first.browser, first.view, first.envelope);
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: first.envelope.call.to,
      data: first.envelope.call.data,
      revert: true,
    });
    harness.chain.hidden.add(hash);
    await reportOutcome(first.browser, first.view, first.envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    await exhaustChainCheck();
    expect(sentTexts().filter((text) => text === CHECK_STOPPED)).toHaveLength(1);

    // An operator replays the check once the transaction shows: it reverted, so the report reopens.
    harness.chain.hidden.delete(hash);
    const job = row<{ id: string }>(
      "SELECT id FROM processing_jobs WHERE kind = 'reconcile_operation'"
    );
    expect(replayFailedJob(harness.core, job.id)).toBe(true);
    await harness.drain();
    expect(sentTexts()).toContain(
      "The publication failed on chain. Your report is saved; check it and confirm again to retry."
    );

    // The same report goes out again as a second attempt, and its page is closed too.
    await harness.say(ADA, `CONFIRM ${summaryToken(sentTexts().slice(-1))}`);
    await harness.drain();
    const second = await openSigningPage(harness);
    await reserve(second.browser, second.view, second.envelope, "attempt-key-2");
    harness.clock.advance(harness.core.settings.walletResponseWindowMs);
    await harness.drain();
    expect(row("SELECT attempt_version, state FROM execution_operations")).toEqual({
      attempt_version: 2,
      state: "reconciling",
    });
    // The first attempt's stop says nothing about this one, which is still being checked.
    expect(await harness.say(ADA, "STATUS")).not.toEqual([CHECK_STOPPED]);

    // When this check runs out too, the person hears about it as well.
    await exhaustChainCheck();
    expect(sentTexts().filter((text) => text === CHECK_STOPPED)).toHaveLength(2);
  });

  it("says the check stopped only once every check on the report has run out", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    harness.clock.advance(harness.core.settings.walletResponseWindowMs);
    await harness.drain();
    // A minute into the first check, the page's late report starts a second one beside it.
    for (let pass = 0; pass < 2; pass += 1) {
      harness.clock.advance(30_000);
      await harness.drain();
    }
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    harness.chain.hidden.add(hash);
    const late = await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    expect(late.status).toBe(200);
    const checks = () =>
      harness.core.db
        .query(
          "SELECT state FROM processing_jobs WHERE kind = 'reconcile_operation' ORDER BY created_at"
        )
        .all() as Array<{ state: string }>;
    for (let pass = 0; pass < 60 && checks()[0]?.state !== "failed"; pass += 1) {
      harness.clock.advance(30_000);
      await harness.drain();
    }
    // The first check has run out, but the second is still looking: nothing is said yet.
    expect(checks()).toEqual([{ state: "failed" }, { state: "pending" }]);
    expect(sentTexts()).not.toContain(CHECK_STOPPED);
    expect(await harness.say(ADA, "STATUS")).not.toEqual([CHECK_STOPPED]);

    await exhaustChainCheck();
    expect(checks()).toEqual([{ state: "failed" }, { state: "failed" }]);
    expect(sentTexts().filter((text) => text === CHECK_STOPPED)).toHaveLength(1);
  });

  it("lets chain evidence that a replayed check finds override its earlier stop, and says when that check stops too", async () => {
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
    await exhaustChainCheck();
    expect(await harness.say(ADA, "STATUS")).toEqual([CHECK_STOPPED]);

    // An operator replays the check: the transaction is mined now, its attestation not read yet.
    harness.chain.hidden.delete(hash);
    harness.chain.attestationsUnread = true;
    const job = row<{ id: string }>(
      "SELECT id FROM processing_jobs WHERE kind = 'reconcile_operation'"
    );
    expect(replayFailedJob(harness.core, job.id)).toBe(true);
    await harness.drain();
    // A replay gets one pass. It found the transaction, so its stop says that, with the link, and
    // makes no promise of an attestation link just before stopping.
    expect(sentTexts().at(-1)).toBe(ATTESTATION_UNREAD);
    expect(harness.transport.sent.at(-1)?.message.records).toEqual([
      { url: `https://arbiscan.io/tx/${hash}`, label: "View transaction" },
    ]);
    expect(sentTexts().filter((text) => text.startsWith("The transaction is confirmed."))).toEqual(
      []
    );
    // STATUS agrees with the chat: the report was found, so it no longer says it can't be found.
    expect(await harness.say(ADA, "STATUS")).toEqual([ATTESTATION_UNREAD]);
  });

  it("says once when the check stops with the transaction mined and its attestation still unread", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = send(envelope);
    harness.chain.attestationsUnread = true;
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    expect(sentTexts().at(-1)).toContain("The transaction is confirmed.");

    // The attestation is never read back, so the check runs out with the transaction mined.
    await exhaustChainCheck();
    expect(row("SELECT state FROM processing_jobs WHERE kind = 'reconcile_operation'")).toEqual({
      state: "failed",
    });
    const stops = harness.transport.sent.filter((sent) => sent.message.text === ATTESTATION_UNREAD);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.message.records).toEqual([
      { url: `https://arbiscan.io/tx/${hash}`, label: "View transaction" },
    ]);
    // It was found, so nothing says it can't be found, and nothing is sent again.
    expect(sentTexts()).not.toContain(CHECK_STOPPED);
    expect(row("SELECT count(*) AS n FROM execution_attempts")).toEqual({ n: 1 });
    expect(await harness.say(ADA, "STATUS")).toEqual([ATTESTATION_UNREAD]);
    expect(await harness.say(ADA, "CANCEL")).toEqual([ATTESTATION_UNREAD]);
  });

  it.each([
    ["a later read loses the receipt", (hash: `0x${string}`) => harness.chain.hidden.add(hash)],
    [
      "later chain reads fail",
      (_hash: `0x${string}`) => {
        harness.chain.transactionReceipt = async () => {
          throw new Error("RPC unavailable");
        };
      },
    ],
  ])("never ends by saying it can't find a report whose transaction it already called confirmed, when %s", async (_trigger, loseTheRead) => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = send(envelope);
    harness.chain.attestationsUnread = true;
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    expect(sentTexts().at(-1)).toContain("The transaction is confirmed.");

    // Every later pass reads nothing it can use, so the check's last pass sees nothing at all.
    loseTheRead(hash);
    await exhaustChainCheck();
    expect(sentTexts()).not.toContain(CHECK_STOPPED);
    expect(sentTexts()).not.toContain(STILL_CONFIRMING);
    const stops = harness.transport.sent.filter((sent) => sent.message.text === ATTESTATION_UNREAD);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.message.records).toEqual([
      { url: `https://arbiscan.io/tx/${hash}`, label: "View transaction" },
    ]);
    expect(await harness.say(ADA, "STATUS")).toEqual([ATTESTATION_UNREAD]);
  });

  it("does not say a send is still confirming on the pass that ends the check", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = send(envelope);
    harness.chain.hidden.add(hash);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    // The check gets one more pass, two minutes in, as an operator replay does.
    harness.core.db
      .query(
        "UPDATE processing_jobs SET max_attempts = attempts + 1 WHERE kind = 'reconcile_operation'"
      )
      .run();
    harness.clock.advance(120_000);
    await harness.drain();
    expect(sentTexts()).toContain(CHECK_STOPPED);
    expect(sentTexts()).not.toContain(STILL_CONFIRMING);
  });

  it("still tells a person who stopped the assistant how a send already made ended", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = send(envelope);
    harness.chain.attestationsUnread = true;
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    expect(sentTexts().at(-1)).toContain("The transaction is confirmed.");
    await harness.say(ADA, "STOP");
    await exhaustChainCheck();
    expect(sentTexts()).toContain(ATTESTATION_UNREAD);
  });

  it("says once, two minutes into the check, that a reported send is still confirming", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = send(envelope);
    harness.chain.hidden.add(hash);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    const pass = async () => {
      harness.clock.advance(30_000);
      await harness.drain();
    };
    // A minute and a half in, the chat has said nothing since the page sent the report.
    const sentBefore = sentTexts().length;
    for (let n = 0; n < 3; n += 1) await pass();
    expect(sentTexts()).toHaveLength(sentBefore);
    await pass();
    expect(sentTexts().slice(sentBefore)).toEqual([STILL_CONFIRMING]);
    // It is said once, and STATUS still answers that the report is being published.
    for (let n = 0; n < 4; n += 1) await pass();
    expect(count(STILL_CONFIRMING)).toBe(1);
    expect(await harness.say(ADA, "STATUS")).toEqual(["Your report for TAS is being published."]);

    harness.chain.hidden.delete(hash);
    await pass();
    expect(sentTexts().at(-1)).toBe("Your report is published ✅");
    expect(count(STILL_CONFIRMING)).toBe(1);
    expect(sentTexts().some((text) => /fail/i.test(text))).toBe(false);
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

  it("reports a mined transaction whose attestation is unread as confirmed, then sends the result unasked", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    harness.chain.attestationsUnread = true;
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();
    // A wait, not a conflict: the receipt names an attestation the node has not returned yet.
    expect(row("SELECT state, failure_code FROM execution_operations")).toEqual({
      state: "reconciling",
      failure_code: null,
    });
    expect(
      row("SELECT last_error_code FROM processing_jobs WHERE kind = 'reconcile_operation'")
    ).toEqual({ last_error_code: "attestation_pending" });
    const waiting = harness.transport.sent.at(-1)?.message;
    expect(waiting?.text).toBe(
      "The transaction is confirmed. I'm checking the attestation details and will send the link when I have it. You don't need to sign or send anything again."
    );
    // No attestation link and no claim of publication until the record matches this report.
    expect(waiting?.records).toEqual([
      { url: `https://arbiscan.io/tx/${hash}`, label: "View transaction" },
    ]);

    // Another pass in the same state adds nothing to the chat.
    harness.clock.advance(30_000);
    await harness.drain();
    expect(harness.transport.sent.at(-1)?.message).toEqual(waiting);

    harness.chain.attestationsUnread = false;
    harness.clock.advance(30_000);
    await harness.drain();
    expect(row("SELECT state, transaction_hash FROM execution_operations")).toEqual({
      state: "published",
      transaction_hash: hash,
    });
    expect(sentTexts().slice(-2)).toEqual([waiting?.text, "Your report is published ✅"]);
    expect(harness.transport.sent.at(-1)?.message.records?.map((record) => record.label)).toEqual([
      "View attestation",
      "View transaction",
    ]);
    // The same attempt throughout: nothing was signed or sent a second time.
    expect(row("SELECT count(*) AS n FROM execution_attempts")).toEqual({ n: 1 });
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

describe("signing links", () => {
  it("says once when a signing link expires unused, and RETRY sends a fresh one", async () => {
    await confirmLinkAndPublish(harness);
    const expired = latestLink(harness);
    expect(await harness.say(ADA, "STATUS")).toEqual([AWAITING_SIGNATURE]);

    harness.clock.advance(harness.core.settings.linkChallengeTtlMs);
    await harness.drain();
    expect(sentTexts().at(-1)).toBe(LINK_EXPIRED);
    harness.clock.advance(60 * 60_000);
    await harness.drain();
    expect(count(LINK_EXPIRED)).toBe(1);
    expect(await harness.say(ADA, "STATUS")).toEqual([LINK_EXPIRED]);

    const fresh = await harness.say(ADA, "RETRY");
    expect(fresh[0]).toContain(
      "Open this page to review and sign the exact publication with your wallet."
    );
    expect(latestLink(harness)).not.toBe(expired);
    expect(await harness.say(ADA, "STATUS")).toEqual([AWAITING_SIGNATURE]);

    // The fresh link signs the report already prepared: nothing is uploaded again.
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    expect(attempt.status).toBe(200);
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: send(envelope),
    });
    await harness.drain();
    expect(sentTexts().at(-1)).toBe("Your report is published ✅");
    expect(harness.uploader.uploads.map(({ name }) => name)).toEqual(["metadata.json"]);
    // The fresh link's own expiry comes after the send, so it says nothing.
    const said = count(LINK_EXPIRED);
    harness.clock.advance(
      harness.core.settings.linkChallengeTtlMs + harness.core.settings.browserSessionTtlMs
    );
    await harness.drain();
    expect(count(LINK_EXPIRED)).toBe(said);
  });

  it("says the link expired once when STATUS asks before the expiry notice goes out", async () => {
    await confirmLinkAndPublish(harness);
    harness.clock.advance(harness.core.settings.linkChallengeTtlMs);
    // A turn runs before the jobs in the same pass, so STATUS answers before the watcher runs.
    expect(await harness.say(ADA, "STATUS")).toEqual([LINK_EXPIRED]);
    harness.clock.advance(60_000);
    await harness.drain();
    expect(count(LINK_EXPIRED)).toBe(1);
  });

  it("waits for a signing page that is still open before saying its link expired", async () => {
    await confirmLinkAndPublish(harness);
    // The page opens a minute before its link expires, and is closed before it sends anything.
    harness.clock.advance(harness.core.settings.linkChallengeTtlMs - 60_000);
    await openSigningPage(harness);
    harness.clock.advance(60_000);
    await harness.drain();
    expect(sentTexts()).not.toContain(LINK_EXPIRED);
    expect(await harness.say(ADA, "STATUS")).toEqual([AWAITING_SIGNATURE]);

    // Once that page can no longer send either, the chat hears it.
    harness.clock.advance(harness.core.settings.browserSessionTtlMs);
    await harness.drain();
    expect(count(LINK_EXPIRED)).toBe(1);
    expect(await harness.say(ADA, "STATUS")).toEqual([LINK_EXPIRED]);
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
