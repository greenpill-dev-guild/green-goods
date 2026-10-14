import type { Hono } from "hono";
import * as z from "zod";
import { acceptInboundEvent } from "../../../services/reporting/inbox";
import type { ReportingCore } from "../../../services/reporting/runtime";
import type { NormalizedInboundEvent } from "../../../services/reporting/transport";

/**
 * Synthetic ingress for the test harness and the loopback development driver only. It is never
 * mounted by `createServer`, and it accepts only fixture realms, so it cannot stand in for a real
 * provider's signed webhook.
 */
const SYNTHETIC_REALM = /^(synthetic|telegram-fixture|whatsapp-fixture):[a-z0-9-]+$/;

const EventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    providerRealm: z.string().regex(SYNTHETIC_REALM),
    eventId: z.string().min(1).max(128),
    providerMessageId: z.string().min(1).max(128),
    chat: z.object({
      externalChatId: z.string().min(1),
      threadId: z.string().optional(),
      kind: z.enum(["direct", "group"]),
    }),
    sender: z.object({ externalSubjectId: z.string().min(1) }),
    sentAt: z.number().int(),
    text: z.string().max(4_000).optional(),
    replyId: z.string().max(200).optional(),
    media: z
      .array(
        z.object({
          providerMediaId: z.string(),
          declaredMime: z.string().optional(),
          declaredName: z.string().optional(),
          declaredSize: z.number().optional(),
        })
      )
      .max(10)
      .optional(),
    locale: z.string().max(10).optional(),
  }),
  z.object({
    kind: z.literal("delivery_status"),
    providerRealm: z.string().regex(SYNTHETIC_REALM),
    eventId: z.string().min(1).max(128),
    providerMessageId: z.string().min(1),
    status: z.enum(["sent", "delivered", "read", "failed"]),
    errorCode: z.string().optional(),
    occurredAt: z.number().int(),
  }),
]);

export function mountSyntheticIngress(app: Hono, core: () => ReportingCore): void {
  app.post("/__synthetic/events", async (c) => {
    const parsed = EventSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_event" }, 400);
    const result = acceptInboundEvent(core(), parsed.data as NormalizedInboundEvent);
    return c.json(result, result.status === "accepted" ? 202 : 200);
  });
}
