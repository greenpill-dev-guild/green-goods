import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DraftContentUnavailableError, loadDraft } from "../../services/reporting/drafts";
import { enqueueJob } from "../../services/reporting/jobs";
import { operationById } from "../../services/reporting/operations";
import { scheduleRetentionSweep } from "../../services/reporting/retention";
import {
  adaAccount,
  confirmLinkAndPublish,
  openSigningPage,
  reportOutcome,
  reserve,
} from "./support/flows";
import { ADA, Harness } from "./support/harness";

/**
 * Consent, withdrawal and retention through the real stores: what is removed, what survives as a
 * tombstone or receipt, and that withdrawal reaches the send and signing boundaries.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

const DAY = 24 * 60 * 60 * 1000;

function one<T>(sql: string, params: Record<string, string | number> = {}): T {
  return harness.core.db.query(sql).get(params) as T;
}

async function sweep(): Promise<void> {
  harness.core.db.transaction(() => scheduleRetentionSweep(harness.core, 60_000)).immediate();
  await harness.drain();
}

function draftId(): string {
  return one<{ id: string }>("SELECT id FROM work_drafts ORDER BY created_at LIMIT 1").id;
}

describe("retention", () => {
  it("expires unconsented intake after 24 hours without reading it", async () => {
    await harness.say(ADA, "Here is my report about the fence planting");
    harness.clock.advance(DAY + 1);
    await sweep();
    expect(
      one("SELECT state, payload_ciphertext FROM inbox_events WHERE kind = 'message'")
    ).toEqual({
      state: "expired",
      payload_ciphertext: null,
    });
    expect(one("SELECT count(*) AS n FROM participants")).toEqual({ n: 0 });
  });

  it("expires a draft seven days after the gardener's last action, not after background work", async () => {
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    harness.clock.advance(6 * DAY);
    // Agent-side work (an authority check, a retry) is not participant activity.
    harness.core.db
      .transaction(() =>
        enqueueJob(harness.core, {
          kind: "resolve_authority",
          subjectId: draftId(),
          dedupeKey: "background",
        })
      )
      .immediate();
    await harness.drain();
    harness.clock.advance(DAY);
    await sweep();

    expect(
      one("SELECT lifecycle, content_deleted_at IS NOT NULL AS purged FROM work_drafts")
    ).toEqual({
      lifecycle: "expired",
      purged: 1,
    });
    expect(() => loadDraft(harness.core, draftId())).toThrow(DraftContentUnavailableError);
    expect(
      one("SELECT count(*) AS n FROM source_entries WHERE content_ciphertext IS NOT NULL")
    ).toEqual({
      n: 0,
    });
    expect(harness.transport.sent.at(-1)?.message.text).toBe(
      "Your unfinished report expired after 7 days without activity, so its private content was removed."
    );
  });

  it("removes a published report's private content and keeps its receipt and envelope", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const attempt = await reserve(browser, view, envelope);
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
      kind: "broadcast",
      transactionHash: hash,
    });
    await harness.drain();

    expect(
      one("SELECT count(*) AS n FROM draft_revisions WHERE content_ciphertext IS NOT NULL")
    ).toEqual({
      n: 0,
    });
    expect(
      one("SELECT count(*) AS n FROM source_entries WHERE content_ciphertext IS NOT NULL")
    ).toEqual({
      n: 0,
    });
    // Tombstones and receipts survive: the published work, digests and the frozen envelope.
    expect(one("SELECT count(*) AS n FROM work_records")).toEqual({ n: 1 });
    expect(
      one<{ n: number }>(
        "SELECT count(*) AS n FROM draft_revisions WHERE content_digest IS NOT NULL"
      ).n
    ).toBeGreaterThan(0);
    const operation = operationById(harness.core, view.operation?.operationId ?? "");
    expect(operation?.envelope?.payloadDigest).toBe(envelope.payloadDigest);
    // The browser can no longer read private draft content.
    expect((await browser.request("GET", `/messaging/drafts/${view.resourceId}`)).status).toBe(404);
  });
});

describe("withdrawal", () => {
  it("STOP cancels and cleans the current report; DELETE removes all unpublished content", async () => {
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    expect((await harness.say(ADA, "STOP"))[0]).toContain("stopped");
    expect(
      one("SELECT lifecycle, content_deleted_at IS NOT NULL AS purged FROM work_drafts")
    ).toEqual({
      lifecycle: "cancelled",
      purged: 1,
    });

    expect((await harness.say(ADA, "START"))[0]).toContain("Do you agree?");
    await harness.press(ADA, "I agree");
    await harness.say(ADA, "Weeded the beds this morning");
    await harness.say(ADA, "DELETE");
    expect(one("SELECT count(*) AS n FROM work_drafts WHERE content_deleted_at IS NULL")).toEqual({
      n: 0,
    });
    expect(
      one("SELECT count(*) AS n FROM source_entries WHERE content_ciphertext IS NOT NULL")
    ).toEqual({
      n: 0,
    });
  });

  it("suppresses queued replies at send time once processing consent is withdrawn", async () => {
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    harness.core.db
      .query("UPDATE operating_controls SET enabled = 0 WHERE name = 'outbound_messages'")
      .run();
    await harness.say(ADA, "1");
    await harness.say(ADA, "STOP");
    harness.core.db
      .query("UPDATE operating_controls SET enabled = 1 WHERE name = 'outbound_messages'")
      .run();
    const before = harness.transport.sent.length;
    await harness.drain();
    expect(harness.transport.sent.slice(before).map((sent) => sent.message.text)).toEqual([
      expect.stringContaining("stopped"),
    ]);
    expect(
      one<{ n: number }>(
        "SELECT count(*) AS n FROM delivery_outbox WHERE last_error_code = 'consent_withdrawn'"
      ).n
    ).toBeGreaterThan(0);
  });

  it("blocks signing after consent is withdrawn even with a valid browser session", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    await harness.say(ADA, "STOP");
    expect((await reserve(browser, view, envelope)).status).toBe(409);
    expect(one("SELECT count(*) AS n FROM execution_attempts")).toEqual({ n: 0 });
  });
});
