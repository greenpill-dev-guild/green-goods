import type { ReportingCore } from "./runtime";

/**
 * What a person came to do, kept while something else has to happen first. An open report or an
 * open decision is its own record; this holds the one goal that has no record yet: a steward who
 * asked to review before their account was linked. It survives a restart, and is read only by the
 * identity that set it: a goal set before an account is recovered or replaced is forgotten.
 */
export type PendingGoal = "review";

/** As long as a draft waits for consent: a goal older than this is no longer what the chat is for. */
const GOAL_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function rememberGoal(
  core: ReportingCore,
  input: { conversationId: string; participantId: string; identityEpoch: number; goal: PendingGoal }
): void {
  const now = core.clock.now();
  core.db
    .query(
      `INSERT INTO dialogue_goals (conversation_id, participant_id, identity_epoch, goal, set_at, expires_at)
       VALUES ($conversation, $participant, $epoch, $goal, $now, $expires)
       ON CONFLICT (conversation_id) DO UPDATE SET participant_id = excluded.participant_id,
         identity_epoch = excluded.identity_epoch, goal = excluded.goal, set_at = excluded.set_at,
         expires_at = excluded.expires_at`
    )
    .run({
      conversation: input.conversationId,
      participant: input.participantId,
      epoch: input.identityEpoch,
      goal: input.goal,
      now,
      expires: now + GOAL_LIFETIME_MS,
    });
}

/** The goal this identity set in this conversation, while it still stands. */
export function pendingGoal(
  core: ReportingCore,
  input: { conversationId: string; participantId: string; identityEpoch: number }
): PendingGoal | null {
  const row = core.db
    .query(
      `SELECT goal FROM dialogue_goals
       WHERE conversation_id = $conversation AND participant_id = $participant
         AND identity_epoch = $epoch AND expires_at > $now`
    )
    .get({
      conversation: input.conversationId,
      participant: input.participantId,
      epoch: input.identityEpoch,
      now: core.clock.now(),
    }) as { goal: PendingGoal } | null;
  return row?.goal ?? null;
}

/** Called once the goal is met, and whenever consent or the linked account changes. */
export function forgetGoal(core: ReportingCore, conversationId: string): void {
  core.db
    .query("DELETE FROM dialogue_goals WHERE conversation_id = $conversation")
    .run({ conversation: conversationId });
}
