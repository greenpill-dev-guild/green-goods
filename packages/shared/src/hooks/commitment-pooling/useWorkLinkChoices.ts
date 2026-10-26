import { useQuery } from "@tanstack/react-query";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { getCommitmentDetail, getCommitments } from "../../modules/commitment-pooling/data";
import type {
  WorkablePromise,
  WorkLinkChoice,
} from "../../modules/commitment-pooling/work-link-intent";
import { getJsonByHash } from "../../modules/data/ipfs/resolve";
import type { Address } from "../../types/domain";
import { canLinkWork, selectCommitmentActKind } from "../../modules/commitment-pooling/acts";
import { selectCommitmentSeat } from "../../modules/commitment-pooling/selectors";
import type { CommitmentDetail } from "../../modules/commitment-pooling/types-relations";

export function isEligibleWorkLinkDetail(detail: CommitmentDetail, account: Address): boolean {
  const normalized = account.toLowerCase();
  const activeContributor = detail.contributors.some(
    (row) => row.active && row.contributor.toLowerCase() === normalized
  );
  if (!activeContributor) return false;
  const seat =
    detail.commitment.leadProvider?.toLowerCase() === normalized ? "provider" : "contributor";
  return canLinkWork({
    commitment: detail.commitment,
    seat,
    linkedCount: detail.workAttributions.filter((row) => row.linked).length,
  });
}

export function workLinkReturnTo(returnGarden: Address, commitmentId: bigint): string {
  return `/home/${returnGarden}/commitments/${commitmentId}`;
}

/**
 * What the account can do on one promise in the work garden: link work to each requirement
 * (`isEligibleWorkLinkDetail`), add evidence (the promise's Add Proof act), or neither, when the
 * promise is not one it can work on.
 */
export function workablePromiseOf(
  detail: CommitmentDetail,
  input: { account: Address; workGarden: Address; returnGarden: Address; title: string }
): WorkablePromise | null {
  const { commitment } = detail;
  const seat = selectCommitmentSeat({
    commitment,
    contributors: detail.contributors.filter((row) => row.active).map((row) => row.contributor),
    viewer: input.account,
  });
  const takesEvidence = selectCommitmentActKind({ commitment, seat }) === "addProof";
  const linkable = isEligibleWorkLinkDetail(detail, input.account);
  if (!linkable && !takesEvidence) return null;
  const returnTo = workLinkReturnTo(input.returnGarden, commitment.commitmentId);
  return {
    commitmentId: commitment.commitmentId,
    title: input.title,
    direction: commitment.direction,
    state: commitment.derivedState,
    dueDate: commitment.dueDate ?? null,
    targetUnits: commitment.targetUnits,
    unitLabel: commitment.unitLabel ?? null,
    takesEvidence,
    choices: linkable
      ? detail.requirements.map(
          (requirement): WorkLinkChoice => ({
            commitmentId: commitment.commitmentId,
            requirementIndex: requirement.requirementIndex,
            actionUID: Number(requirement.actionUID),
            garden: input.workGarden,
            commitmentTitle: input.title,
            requirementLabel: String(requirement.requirementIndex + 1),
            approvedCount: requirement.approvedCount,
            requiredCount: requirement.requiredCount,
            dueDate: commitment.dueDate,
            direction: commitment.direction,
            returnTo,
          })
        )
      : [],
  };
}

async function titleFor(metadataCID: string | null | undefined, commitmentId: bigint) {
  if (!metadataCID) return `Commitment ${commitmentId}`;
  try {
    const metadata = await getJsonByHash<Record<string, unknown>>(metadataCID);
    return typeof metadata.title === "string" && metadata.title.trim()
      ? metadata.title.trim()
      : `Commitment ${commitmentId}`;
  } catch {
    return `Commitment ${commitmentId}`;
  }
}

interface WorkablePromisesInput {
  chainId: number;
  account?: Address | null;
  workGarden?: Address | null;
  returnGarden?: Address | null;
}

/** One read of the account's taken-up promises in the work garden, shared by both hooks below. */
function workablePromisesQuery(input: WorkablePromisesInput) {
  return {
    queryKey: commitmentPoolingKeys.workablePromises(
      input.chainId,
      input.account ?? undefined,
      input.workGarden ?? undefined,
      input.returnGarden ?? undefined
    ),
    staleTime: STALE_TIME_MEDIUM,
    queryFn: async (): Promise<WorkablePromise[]> => {
      const account = input.account as Address;
      const workGarden = input.workGarden as Address;
      const commitments = await getCommitments({
        chainId: input.chainId,
        account,
        state: "ACCEPTED",
      });
      const details = await Promise.all(
        commitments
          .filter((row) => row.providerGarden?.toLowerCase() === workGarden.toLowerCase())
          .map((row) => getCommitmentDetail(input.chainId, row.commitmentId))
      );
      const promises = await Promise.all(
        details.map(async (detail): Promise<WorkablePromise | null> => {
          if (!detail) return null;
          // Checked before the title is fetched, so a promise it cannot work on costs no read.
          const preview = workablePromiseOf(detail, {
            account,
            workGarden,
            returnGarden: input.returnGarden as Address,
            title: "",
          });
          if (!preview) return null;
          const title = await titleFor(
            detail.commitment.metadataCID,
            detail.commitment.commitmentId
          );
          return {
            ...preview,
            title,
            choices: preview.choices.map((choice) => ({ ...choice, commitmentTitle: title })),
          };
        })
      );
      return promises.filter((promise): promise is WorkablePromise => promise !== null);
    },
  };
}

const hasWorkGarden = (input: WorkablePromisesInput) =>
  Boolean(input.account && input.workGarden && input.returnGarden);

/**
 * The account's promises in the work garden that it can work on (DL-131): the Start step lists
 * them, and the link check below reads its choices from the same query.
 */
export function useWorkablePromises(input: WorkablePromisesInput) {
  return useQuery({ ...workablePromisesQuery(input), enabled: hasWorkGarden(input) });
}

/** The requirements the account can link work for one action to, from the same read. */
export function useWorkLinkChoices(input: WorkablePromisesInput & { actionUID: number | null }) {
  const { actionUID } = input;
  const query = useQuery({
    ...workablePromisesQuery(input),
    enabled: hasWorkGarden(input) && actionUID !== null,
    select: (promises: WorkablePromise[]) =>
      promises.flatMap((promise) =>
        promise.choices.filter((choice) => choice.actionUID === actionUID)
      ),
  });
  return { ...query, choices: query.data ?? [] };
}
