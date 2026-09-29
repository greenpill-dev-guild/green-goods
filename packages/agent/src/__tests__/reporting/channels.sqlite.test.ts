import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeChannels, type TransportAdapter } from "../../runtime/reporting-startup";
import { channelControl, type ReportingChannel } from "../../services/reporting/channels";
import { setControl } from "../../services/reporting/controls";
import { acceptChannelEvent } from "../../services/reporting/inbox";
import type { InboundMessageEvent, OutboundRequest } from "../../services/reporting/transport";
import { RecordingTransport } from "./support/fixtures";
import { Harness } from "./support/harness";

/** Chat channels: each takes reports only while an operator has its control on. */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

const message = (eventId: string, providerRealm = "telegram:bot-1"): InboundMessageEvent => ({
  kind: "message",
  providerRealm,
  eventId,
  providerMessageId: eventId,
  chat: { externalChatId: "chat-1", kind: "direct" },
  sender: { externalSubjectId: "person-1" },
  sentAt: 0,
  text: "Today I planted twelve baobab seedlings by the fence",
});

describe("chat channels", () => {
  it("takes a channel's messages only while its control is on, and delivery statuses always", () => {
    expect(acceptChannelEvent(harness.core, message("m1"))).toEqual({ status: "channel_closed" });
    expect(harness.core.db.query("SELECT count(*) AS n FROM inbox_events").get()).toEqual({ n: 0 });
    expect(
      acceptChannelEvent(harness.core, {
        kind: "delivery_status",
        providerRealm: "telegram:bot-1",
        eventId: "s1",
        providerMessageId: "out-1",
        status: "delivered",
        occurredAt: 0,
      })
    ).toMatchObject({ status: "accepted" });

    setControl(harness.core, channelControl("telegram"), true, {
      actor: "operator",
      reason: "pilot",
    });
    expect(acceptChannelEvent(harness.core, message("m2"))).toMatchObject({ status: "accepted" });
    expect(acceptChannelEvent(harness.core, message("m3", "whatsapp:15550001"))).toEqual({
      status: "channel_closed",
    });
    expect(acceptChannelEvent(harness.core, message("m4", "sms:15550002"))).toEqual({
      status: "channel_closed",
    });
  });

  it("sends each reply through the adapter of the channel its realm names", async () => {
    const whatsapp = new RecordingTransport();
    const adapters = new Map<ReportingChannel, TransportAdapter>([
      [
        "whatsapp",
        { transport: whatsapp, mediaFetcher: { fetch: async () => ({ bytes: new Uint8Array() }) } },
      ],
    ]);
    const routed = routeChannels(adapters);
    const reply: OutboundRequest = {
      providerRealm: "whatsapp:15550001",
      externalChatId: "chat-1",
      message: { text: "Thank you!" },
      idempotencyKey: "reply-1",
    };
    expect(await routed.transport.send(reply)).toMatchObject({ status: "accepted" });
    expect(whatsapp.texts()).toEqual(["Thank you!"]);
    expect(await routed.transport.send({ ...reply, providerRealm: "telegram:bot-1" })).toEqual({
      status: "terminal",
      errorCode: "channel_unavailable",
    });
  });
});
