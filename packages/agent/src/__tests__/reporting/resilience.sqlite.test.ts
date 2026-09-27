import type { ResourceView } from "@green-goods/shared/modules/agent-reporting";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { commitContentChange } from "../../services/reporting/coordinator/draft-commit";
import { processConversation } from "../../services/reporting/coordinator/turn";
import { inTransaction } from "../../services/reporting/database";
import { loadDraft } from "../../services/reporting/drafts";
import {
  backfillLookupAliases,
  missingCurrentAliases,
  resolveChannelSubject,
  retireLookupVersion,
} from "../../services/reporting/identity-store";
import {
  acquireConversationLease,
  holdsLease,
  renewConversationLease,
} from "../../services/reporting/leases";
import { TestBrowser } from "./support/browser";
import {
  adaAccount,
  confirmLinkAndPublish,
  latestLink,
  openSigningPage,
  reportOutcome,
  reportUntilSummary,
  reserve,
} from "./support/flows";
import { planting, snapshot, TAS } from "./support/fixtures";
import { ADA, Harness, type Person, summaryToken } from "./support/harness";

/**
 * Restart, fencing, stale model results, key rotation and platform neutrality on real SQLite.
 * Fake chain, scripted interpretation and fixture transports prove orchestration only.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

function one<T>(sql: string, params: Record<string, string | number> = {}): T {
  return harness.core.db.query(sql).get(params) as T;
}

function currentDraft() {
  const { id } = one<{ id: string }>("SELECT id FROM work_drafts");
  return loadDraft(harness.core, id);
}

const correction = {
  intent: "correction" as const,
  gardenKey: null,
  actionUID: null,
  facts: [
    { field: "details.seedlings" as const, value: 14, kind: "reported" as const, original: "14" },
  ],
  models: ["fixture-model"],
};

describe("stale work", () => {
  it("replans a model result computed for an older revision instead of writing it", async () => {
    await reportUntilSummary(harness);
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "stale model" });
    const before = currentDraft();
    harness.interpreter.responses = [correction, correction];
    harness.interpreter.duringCall = () => {
      // Another writer (a media job, say) commits while the model call is in flight.
      inTransaction(harness.core.db, () => {
        const draft = currentDraft();
        if (!draft) throw new Error("draft missing");
        const event = one<{ id: string }>(
          "SELECT id FROM inbox_events ORDER BY arrival_seq DESC LIMIT 1"
        );
        commitContentChange(harness.core, draft, {
          content: { ...draft.content, title: "Fence planting" },
          cause: "concurrent",
          sourceEventId: event.id,
        });
      });
    };
    const replies = await harness.say(ADA, "Actually it was 14 seedlings");

    const revisions = harness.interpreter.requests
      .slice(-2)
      .map((request) => request.draftRevision);
    expect(revisions).toEqual([before?.revision, (before?.revision ?? 0) + 1]);
    const after = currentDraft();
    expect(after?.content.title).toBe("Fence planting");
    // The gardener stated 12 earlier; a model reading never silently replaces it.
    expect(after?.content.details.seedlings).toBe(12);
    expect(after?.content.conflicts.map((conflict) => conflict.field)).toEqual([
      "details.seedlings",
    ]);
    expect(replies.at(-1)).toContain("14");
    expect(
      one<{ n: number }>(
        "SELECT count(*) AS n FROM source_entries WHERE kind = 'text' AND content_ciphertext IS NOT NULL"
      ).n
    ).toBeGreaterThan(0);
  });

  it("fences a stalled worker once another worker has taken over its conversation", async () => {
    await reportUntilSummary(harness);
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "fencing" });
    const before = currentDraft();
    const conversationId = before?.conversationId ?? "";
    harness.interpreter.responses = [correction, correction];
    harness.interpreter.duringCall = async () => {
      harness.clock.advance(harness.core.settings.conversationLeaseMs + 1);
      await processConversation(harness.deps(), conversationId, "worker-b");
    };
    await harness.post(harness.message(ADA, { text: "Actually it was 14 seedlings" }));
    await processConversation(harness.deps(), conversationId, "worker-a");
    await harness.drain();

    expect(currentDraft()?.revision).toBe((before?.revision ?? 0) + 1);
    expect(
      one<{ n: number }>(
        "SELECT count(*) AS n FROM inbox_events WHERE state = 'consumed' AND kind = 'message'"
      ).n
    ).toBe(one<{ n: number }>("SELECT count(*) AS n FROM inbox_events WHERE kind = 'message'").n);
  });

  it("treats lease ownership as a fence", async () => {
    await harness.say(ADA, "Hello");
    const { id } = one<{ id: string }>("SELECT id FROM conversations");
    const a = acquireConversationLease(harness.core, id, "worker-a");
    expect(a).not.toBeNull();
    expect(acquireConversationLease(harness.core, id, "worker-b")).toBeNull();
    harness.clock.advance(harness.core.settings.conversationLeaseMs + 1);
    const b = acquireConversationLease(harness.core, id, "worker-b");
    if (!a || !b) throw new Error("expected leases");
    expect(holdsLease(harness.core, a)).toBe(false);
    expect(renewConversationLease(harness.core, a)).toBe(false);
    expect(holdsLease(harness.core, b)).toBe(true);
  });

  it("resumes accepted intake after a restart and ignores a redelivery", async () => {
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    const event = harness.message(ADA, { text: "1" });
    expect((await harness.post(event)).status).toBe(202);
    harness.restart();
    expect((await harness.post(event)).status).toBe(200);
    const before = harness.transport.sent.length;
    await harness.drain();
    expect(harness.transport.sent.slice(before).map((sent) => sent.message.text)).toEqual([
      "Which activity in TAS best matches your work?\n1. Tree planting\n2. Weeding",
    ]);
    expect(
      one(
        "SELECT count(*) AS n FROM source_entries s JOIN inbox_events e ON e.id = s.inbox_event_id WHERE e.event_id = $id",
        {
          id: event.eventId,
        }
      )
    ).toEqual({ n: 1 });
  });
});

describe("identity under key rotation", () => {
  it("keeps one subject, participant and draft through rotation, backfill and retirement", async () => {
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    const participant = one<{ id: string }>("SELECT id FROM participants").id;

    harness.keys = {
      ...harness.keys,
      lookupKeys: `h2:${Buffer.alloc(32, 9).toString("base64")},${harness.keys.lookupKeys}`,
      currentLookupVersion: "h2",
    };
    harness.restart();
    expect((await harness.say(ADA, "1"))[0]).toContain("Which activity in TAS");
    expect(one("SELECT count(*) AS n FROM channel_subjects")).toEqual({ n: 1 });
    expect(one("SELECT count(*) AS n FROM participants")).toEqual({ n: 1 });

    inTransaction(harness.core.db, () => backfillLookupAliases(harness.core));
    expect(missingCurrentAliases(harness.core)).toBe(0);
    inTransaction(harness.core.db, () => retireLookupVersion(harness.core, "h1"));
    await harness.press(ADA, "Tree planting");
    expect(one<{ id: string }>("SELECT id FROM participants").id).toBe(participant);
    expect(one("SELECT count(*) AS n FROM work_drafts")).toEqual({ n: 1 });
  });

  it("resolves a racing insert of the same sender to the first writer's subject", () => {
    const core = harness.core;
    const original = core.ids.id.bind(core.ids);
    let raced = false;
    core.ids.id = () => {
      const id = original();
      if (!raced) {
        raced = true;
        // Another writer creates the same sender between our lookup and our insert.
        resolveChannelSubject(core, "synthetic:wefa", "+2340000000009", core.clock.now() + 1_000);
      }
      return id;
    };
    const winner = inTransaction(core.db, () =>
      resolveChannelSubject(core, "synthetic:wefa", "+2340000000009", core.clock.now() + 1_000)
    );
    core.ids.id = original;
    expect(winner.created).toBe(false);
    expect(one("SELECT count(*) AS n FROM channel_subjects")).toEqual({ n: 1 });
  });
});

describe("platform neutrality", () => {
  const WHATSAPP: Person = {
    realm: "whatsapp-fixture:wefa",
    chatId: "wa-1",
    subjectId: "+2340000000011",
  };
  const TELEGRAM: Person = { realm: "telegram-fixture:gg", chatId: "tg-1", subjectId: "4242" };

  it("runs the same report rules for WhatsApp and Telegram fixtures and keeps pairing channel-bound", async () => {
    const whatsappSummary = await reportUntilSummary(harness, WHATSAPP);
    const telegramSummary = await reportUntilSummary(harness, TELEGRAM);
    expect(whatsappSummary[0]?.replace(/\d{4}/, "")).toBe(telegramSummary[0]?.replace(/\d{4}/, ""));

    await harness.say(WHATSAPP, `CONFIRM ${summaryToken(whatsappSummary)}`);
    const browser = new TestBrowser(harness.app);
    const opened = await browser.open(latestLink(harness));
    expect(opened.body.channelLabel).toBe("WhatsApp");
    const proof = await browser.prove(adaAccount);
    // The code shown for the WhatsApp request cannot be redeemed from the Telegram chat.
    expect(await harness.say(TELEGRAM, `PAIR ${proof.body.pairingCode}`)).toEqual([
      "That code doesn't match an open verification. Check the code on the Green Goods page.",
    ]);
    expect((await harness.say(WHATSAPP, `PAIR ${proof.body.pairingCode}`))[0]).toContain(
      "is now linked"
    );
  });
});

describe("Kernel accounts and changing Actions", () => {
  const KERNEL = "0x00000000000000000000000000000000000000ca" as const;
  const KERNEL_PROOF = "0x6b65726e656c" as const;

  it("publishes from an existing Kernel account by UserOperation through the owner path", async () => {
    harness.chain.kernels.add(KERNEL);
    harness.chain.grantRole(TAS.address, KERNEL, { gardener: true });
    const summary = await reportUntilSummary(harness);
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    const linking = new TestBrowser(harness.app);
    await linking.open(latestLink(harness));
    const proof = await linking.proveAs(KERNEL, KERNEL_PROOF);
    const consent = await harness.say(ADA, `PAIR ${proof.body.pairingCode}`);
    const token = /PUBLISH (\d{4})/.exec(consent.join("\n"))?.[1];
    expect(await harness.say(ADA, `PUBLISH ${token}`)).toEqual([
      "Open this page to review and sign the exact publication with your passkey.",
    ]);

    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    await browser.proveAs(KERNEL, KERNEL_PROOF);
    const access = await browser.access();
    expect(access.body.accountKind).toBe("kernel");
    const draftId = (access.body.scope as { resourceId: string }).resourceId;
    const view = (await browser.request<ResourceView>("GET", `/messaging/drafts/${draftId}`)).body;
    const envelope = view.operation?.envelope;
    if (!envelope) throw new Error("expected an envelope");
    const attempt = await browser.request<{ attemptId: string }>(
      "POST",
      `/messaging/operations/${view.operation?.operationId}/attempts`,
      {
        body: {
          expectedAttemptVersion: 0,
          payloadDigest: envelope.payloadDigest,
          idempotencyKey: "kernel-attempt",
        },
      }
    );
    const sent = harness.chain.submitUserOperation({
      account: KERNEL,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    await browser.request("POST", `/messaging/operations/${view.operation?.operationId}/outcome`, {
      body: {
        attemptId: attempt.body.attemptId,
        idempotencyKey: "kernel-outcome",
        payloadDigest: envelope.payloadDigest,
        outcome: { kind: "broadcast", userOperationHash: sent.userOperationHash },
      },
    });
    await harness.drain();
    expect(one("SELECT state, transaction_hash FROM execution_operations")).toEqual({
      state: "published",
      transaction_hash: sent.transactionHash,
    });
    expect(one("SELECT attester FROM work_records")).toEqual({ attester: KERNEL });
  });

  it("keeps the confirmed Action snapshot when instructions change while the wallet is open", async () => {
    await confirmLinkAndPublish(harness);
    const { browser, view, envelope } = await openSigningPage(harness);
    const confirmedDigest = currentDraft()?.snapshot?.digest;
    // The registry publishes new instructions for the same Action mid-signature.
    harness.catalog.actions.set(TAS.key, [
      snapshot(planting({ title: "Tree planting v2" }), "bafy-v2", 200n),
    ]);
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
    expect(one("SELECT state FROM execution_operations")).toEqual({ state: "published" });
    expect(envelope.kind === "work" ? envelope.actionDefinitionDigest : null).toBe(confirmedDigest);
    expect(one("SELECT count(*) AS n FROM execution_attempts")).toEqual({ n: 1 });
  });
});
