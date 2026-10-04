import type { ReportingCore } from "./runtime";

/**
 * Per-conversation processing leases with fencing. Each acquisition increments the fence, and a
 * turn may commit only while its fence is still current, so a worker that stalled past expiry
 * (a slow model call, a restart) cannot write after another worker has taken over.
 */
export interface ConversationLease {
  conversationId: string;
  holder: string;
  fence: number;
}

export function acquireConversationLease(
  core: ReportingCore,
  conversationId: string,
  holder: string
): ConversationLease | null {
  const now = core.clock.now();
  const row = core.db
    .query(
      `UPDATE conversation_leases
       SET holder = $holder, fence = fence + 1, expires_at = $expires
       WHERE conversation_id = $id AND (holder IS NULL OR expires_at <= $now)
       RETURNING fence`
    )
    .get({ id: conversationId, holder, now, expires: now + core.settings.conversationLeaseMs }) as {
    fence: number;
  } | null;
  return row ? { conversationId, holder, fence: row.fence } : null;
}

/** Call inside the commit transaction; false means another worker owns the conversation now. */
export function holdsLease(core: ReportingCore, lease: ConversationLease): boolean {
  const row = core.db
    .query("SELECT holder, fence FROM conversation_leases WHERE conversation_id = $id")
    .get({ id: lease.conversationId }) as { holder: string | null; fence: number } | null;
  return row?.holder === lease.holder && row.fence === lease.fence;
}

export function renewConversationLease(core: ReportingCore, lease: ConversationLease): boolean {
  const result = core.db
    .query(
      `UPDATE conversation_leases SET expires_at = $expires
       WHERE conversation_id = $id AND holder = $holder AND fence = $fence`
    )
    .run({
      id: lease.conversationId,
      holder: lease.holder,
      fence: lease.fence,
      expires: core.clock.now() + core.settings.conversationLeaseMs,
    });
  return result.changes === 1;
}

export function releaseConversationLease(core: ReportingCore, lease: ConversationLease): void {
  core.db
    .query(
      `UPDATE conversation_leases SET holder = NULL, expires_at = 0
       WHERE conversation_id = $id AND holder = $holder AND fence = $fence`
    )
    .run({ id: lease.conversationId, holder: lease.holder, fence: lease.fence });
}
