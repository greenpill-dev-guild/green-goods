import type { ActionDefinitionSnapshot } from "@green-goods/shared/modules/agent-reporting";
import type { EnabledGarden } from "./runtime";

/**
 * The eligible Actions of one enabled garden, each frozen as a definition snapshot. An unreadable
 * or untrusted catalog (including one that only has built-in fallback instructions) is reported
 * as unavailable: the conversation keeps the draft and asks again later, and never invents an
 * Action or accepts an unpublished template.
 */
export type CatalogResult =
  | { ok: true; actions: ActionDefinitionSnapshot[] }
  | { ok: false; reason: "unavailable" };

export interface ReportingCatalog {
  eligibleActions(garden: EnabledGarden, nowMs: number): Promise<CatalogResult>;
}

/** Candidate list used by prompts, ordered deterministically by title then UID. */
export function orderActions(
  actions: readonly ActionDefinitionSnapshot[]
): ActionDefinitionSnapshot[] {
  return [...actions].sort(
    (left, right) =>
      left.definition.title.localeCompare(right.definition.title) ||
      left.definition.actionUID - right.definition.actionUID
  );
}
