import type { Address } from "@green-goods/shared/types/domain";
import type { ReportingCore } from "./runtime";

/**
 * The garden and activity of an account's last published report, offered as a suggestion when it
 * starts the next one. Nothing about the report is copied here: the suggestion is read from the
 * publication record the Agent already keeps as a receipt, and only for the account that published
 * it. What this store holds is the person's own say over that: a switch that turns suggestions
 * off, and a line in time before which reports are no longer used.
 *
 * The retention rule (RESR-88) lives in this file: a report older than `SUGGESTION_LIFETIME_MS` is
 * not suggested, STOP and DELETE forget everything published before them, and a different linked
 * account never sees another's.
 */
const SUGGESTION_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export interface LastReport {
  gardenAddress: string;
  actionUID: number;
}

interface Owner {
  participantId: string;
  chainId: number;
  account: Address;
}

function settings(
  core: ReportingCore,
  owner: Owner
): { disabled: number; forgotten_before: number } {
  const row = core.db
    .query(
      `SELECT disabled, forgotten_before FROM report_suggestions
       WHERE participant_id = $participant AND chain_id = $chain AND account_address = $account`
    )
    .get({
      participant: owner.participantId,
      chain: owner.chainId,
      account: owner.account.toLowerCase(),
    }) as { disabled: number; forgotten_before: number } | null;
  return row ?? { disabled: 0, forgotten_before: 0 };
}

/** The last report this account published from this person's chats, while it may be suggested. */
export function lastReport(core: ReportingCore, owner: Owner): LastReport | null {
  const { disabled, forgotten_before: forgotten } = settings(core, owner);
  if (disabled) return null;
  const row = core.db
    .query(
      `SELECT w.garden_address, w.action_uid FROM work_records w
       JOIN work_drafts d ON d.id = w.draft_id
       WHERE w.chain_id = $chain AND w.attester = $account AND d.participant_id = $participant
         AND w.observed_at > $since
       ORDER BY w.observed_at DESC LIMIT 1`
    )
    .get({
      chain: owner.chainId,
      account: owner.account.toLowerCase(),
      participant: owner.participantId,
      since: Math.max(forgotten, core.clock.now() - SUGGESTION_LIFETIME_MS),
    }) as { garden_address: string; action_uid: string } | null;
  return row
    ? { gardenAddress: row.garden_address.toLowerCase(), actionUID: Number(row.action_uid) }
    : null;
}

function save(core: ReportingCore, owner: Owner, change: "disable" | "forget"): void {
  const now = core.clock.now();
  core.db
    .query(
      `INSERT INTO report_suggestions (participant_id, chain_id, account_address, disabled, forgotten_before, updated_at)
       VALUES ($participant, $chain, $account, $disabled, $forgotten, $now)
       ON CONFLICT (participant_id, chain_id, account_address) DO UPDATE SET
         disabled = MAX(disabled, excluded.disabled),
         forgotten_before = MAX(forgotten_before, excluded.forgotten_before), updated_at = $now`
    )
    .run({
      participant: owner.participantId,
      chain: owner.chainId,
      account: owner.account.toLowerCase(),
      disabled: change === "disable" ? 1 : 0,
      forgotten: change === "forget" ? now : 0,
      now,
    });
}

/** The person asked not to be offered their last report again. */
export function disableSuggestions(core: ReportingCore, owner: Owner): void {
  save(core, owner, "disable");
}

/** STOP and DELETE: nothing published before now is suggested again, for any account of theirs. */
export function forgetLastReports(core: ReportingCore, participantId: string): void {
  const accounts = core.db
    .query(
      "SELECT DISTINCT chain_id, account_address FROM account_bindings WHERE participant_id = $id"
    )
    .all({ id: participantId }) as Array<{ chain_id: number; account_address: Address }>;
  for (const { chain_id: chainId, account_address: account } of accounts)
    save(core, { participantId, chainId, account }, "forget");
}
