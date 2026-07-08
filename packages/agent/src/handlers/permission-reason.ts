import { agentMessage, type AgentMessageKey } from "../i18n";

const SAFE_PERMISSION_REASON_MESSAGES: Record<string, AgentMessageKey> = {
  "Address is not an operator for this garden": "permission.reason.notOperator",
  "Address is not a gardener in this garden": "permission.reason.notGardener",
  "Garden contract not found at this address": "permission.reason.gardenNotFound",
};

export function publicPermissionReason(locale: string | undefined, reason: string | undefined) {
  if (!reason) return agentMessage(locale, "error.authorization");
  const messageKey = SAFE_PERMISSION_REASON_MESSAGES[reason];
  return agentMessage(locale, messageKey ?? "error.authorization");
}
