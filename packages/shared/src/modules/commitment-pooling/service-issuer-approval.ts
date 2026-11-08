import type { TransactionSender } from "../transactions/types";
import type { ServiceLiveSession } from "./service-access-live";
import type { ServiceLiveChain } from "./service-access-live-route";
import { sessionIdentity } from "./service-access-live-submission";
import { assertServiceActor } from "./service-actor-session";
import {
  serviceIssuerTermsDigest,
  serviceIssuerApprovalTypedData,
} from "./service-issuer-approval-terms";
import type {
  ServiceIssuerDraft,
  ServiceIssuerSignedApproval,
} from "../../public-contracts/service-issuer-desk";
export type {
  ServiceIssuerTerms,
  ServiceIssuerTermsSetting,
  ServiceIssuerDraft,
  ServiceIssuerSignedApproval,
  ServiceIssuerDraftRecord,
} from "../../public-contracts/service-issuer-desk";
export {
  serviceIssuerTermsDigest,
  serviceIssuerApprovalTypedData,
  serviceIssuerApprovalProvenance,
  serviceIssuerDraftApproval,
} from "./service-issuer-approval-terms";
const APPROVAL_CHAIN_ID = 100;

interface ApprovalDependencies {
  session(): ServiceLiveSession;
  sender(): TransactionSender | null;
  chain: ServiceLiveChain;
  /** Seconds; the time the approval records. */
  now(): bigint;
}

/**
 * The member approves the exact terms from their own account. A steward, a Safe or any other
 * signed-in account is refused before anything is signed, and nothing is sent or issued.
 */
export async function signServiceIssuerApproval(
  deps: ApprovalDependencies,
  draft: ServiceIssuerDraft
): Promise<ServiceIssuerSignedApproval> {
  if (draft.version !== 1 || !draft.id || draft.sentAt === null)
    throw new Error("Only a sent draft can be approved");
  const pool = draft.terms.exchangePool;
  if (
    !pool ||
    pool.chainId !== 100 ||
    !pool.id.trim() ||
    !/^0x(?!0{40}$)[a-f0-9]{40}$/i.test(pool.address)
  )
    throw new Error("New issuer approval requires the exact intended exchange pool");
  const identity = sessionIdentity(deps.session());
  const assertMember = () =>
    assertServiceActor(
      draft.member,
      APPROVAL_CHAIN_ID,
      draft.sourceChainId,
      deps.session,
      deps.sender(),
      deps.chain,
      identity
    );
  const sender = await assertMember();
  if (!sender.signTypedData) throw new Error("This account can't sign a service approval");
  const unsigned = {
    version: 1 as const,
    draftId: draft.id,
    revision: draft.terms.revision,
    member: draft.member,
    service: draft.terms.service.title,
    termsDigest: serviceIssuerTermsDigest(draft),
    signedAt: deps.now(),
  };
  const signature = await sender.signTypedData(
    {
      account: draft.member,
      chainId: APPROVAL_CHAIN_ID,
      data: serviceIssuerApprovalTypedData(unsigned),
    },
    {
      assertOwnership: async () => {
        await assertMember();
      },
    }
  );
  await assertMember();
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(signature) || signature.length < 132)
    throw new Error("The account returned no usable approval signature");
  return { ...unsigned, signature };
}
