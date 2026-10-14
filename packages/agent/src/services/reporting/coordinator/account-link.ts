import type { Address } from "@green-goods/shared/types/domain";
import { issueContinuation } from "../continuations";
import { conversationRealm } from "../notify";
import type { ParticipantBinding } from "../participants";
import type { ConversationWriter } from "./writer";

/**
 * The link on which an account is proven for this chat. Naming an account limits the link to it:
 * a proof from any other account is refused.
 */
export function accountLink(
  writer: ConversationWriter,
  binding: ParticipantBinding,
  expectedAccount: Address | null
): string {
  const { core, target } = writer;
  return issueContinuation(core, {
    purpose: "link_account",
    participantId: binding.participantId,
    subjectId: target.subjectId,
    bindingId: binding.bindingId,
    conversationId: target.conversationId,
    providerRealm: conversationRealm(core, target.conversationId),
    resourceKind: "account",
    resourceId: null,
    resourceRevision: null,
    resourceDigest: `account:${binding.participantId}`,
    expectedAccount,
    identityEpoch: binding.identityEpoch,
  }).url;
}
