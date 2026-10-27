import type { Address } from "../../types/domain";
import type { TransactionSender } from "../transactions/types";
import type { ServiceLiveSession } from "./service-access-live";
import type { ServiceLiveChain } from "./service-access-live-route";
import { sessionIdentity } from "./service-access-live-submission";

/** The pilot's member accounts: a member-owned wallet, or a passkey on the pilot's account profile. */
export const serviceActorAccountSupported = (
  session: Pick<ServiceLiveSession, "authMode" | "profile">
) =>
  session.authMode === "wallet" ||
  (session.authMode === "passkey" && session.profile === "kernel-0.3.3-pilot");

/** The same member/session rule protects buyer, issuer and holder operations. Roles stay domain-owned. */
export async function assertServiceActor(
  actor: Address,
  chainId: number,
  sourceChainId: number,
  session: () => ServiceLiveSession,
  sender: TransactionSender | null,
  chain: ServiceLiveChain,
  expected?: string
) {
  const before = session();
  const identity = sessionIdentity(before);
  const authMode = before.authMode;
  if (!before.online) throw new Error("Service actions require an online connection");
  if (
    !sender?.assertOwnership ||
    before.address?.toLowerCase() !== actor.toLowerCase() ||
    sender.authMode !== authMode ||
    !serviceActorAccountSupported(before) ||
    (expected && identity !== expected)
  )
    throw new Error("Service account or session changed; review again");
  await sender.assertOwnership(actor, chainId);
  if (authMode === "wallet") {
    const codes = await Promise.all([chain.code(sourceChainId, actor), chain.code(100, actor)]);
    if (codes.some((code) => code !== "0x"))
      throw new Error("The pilot wallet fallback requires the selected member-owned EOA");
  }
  const after = session();
  if (!after.online || sessionIdentity(after) !== identity)
    throw new Error("Service account or session changed; review again");
  return sender;
}
