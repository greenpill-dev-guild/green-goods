import { useQuery } from "@tanstack/react-query";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { getCommitmentDetail, getCommitments } from "../../modules/commitment-pooling/data";
import type { WorkLinkChoice } from "../../modules/commitment-pooling/work-link-intent";
import { getJsonByHash } from "../../modules/data/ipfs/resolve";
import type { Address } from "../../types/domain";
import { canLinkWork } from "../../modules/commitment-pooling/acts";
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

export function useWorkLinkChoices(input: {
  chainId: number;
  account?: Address | null;
  workGarden?: Address | null;
  returnGarden?: Address | null;
  actionUID: number | null;
}) {
  const query = useQuery({
    queryKey: commitmentPoolingKeys.workLinkChoices(
      input.chainId,
      input.account ?? undefined,
      input.workGarden ?? undefined,
      input.returnGarden ?? undefined,
      input.actionUID
    ),
    enabled: Boolean(
      input.account && input.workGarden && input.returnGarden && input.actionUID !== null
    ),
    staleTime: STALE_TIME_MEDIUM,
    queryFn: async (): Promise<WorkLinkChoice[]> => {
      const commitments = await getCommitments({
        chainId: input.chainId,
        account: input.account as Address,
        state: "ACCEPTED",
      });
      const workGarden = (input.workGarden as Address).toLowerCase();
      const details = await Promise.all(
        commitments
          .filter(
            (row) => row.providerGarden?.toLowerCase() === workGarden && !row.contributorsFrozen
          )
          .map((row) => getCommitmentDetail(input.chainId, row.commitmentId))
      );
      const choices = await Promise.all(
        details
          .filter((detail): detail is NonNullable<typeof detail> => {
            if (!detail || !input.account) return false;
            return isEligibleWorkLinkDetail(detail, input.account);
          })
          .flatMap((detail) =>
            detail.requirements
              .filter((row) => Number(row.actionUID) === input.actionUID)
              .map(async (requirement): Promise<WorkLinkChoice> => {
                const title = await titleFor(
                  detail.commitment.metadataCID,
                  detail.commitment.commitmentId
                );
                const ordinal = requirement.requirementIndex + 1;
                return {
                  commitmentId: detail.commitment.commitmentId,
                  requirementIndex: requirement.requirementIndex,
                  actionUID: Number(requirement.actionUID),
                  garden: input.workGarden as Address,
                  commitmentTitle: title,
                  requirementLabel: String(ordinal),
                  returnTo: workLinkReturnTo(
                    input.returnGarden as Address,
                    detail.commitment.commitmentId
                  ),
                };
              })
          )
      );
      return choices;
    },
  });
  return { ...query, choices: query.data ?? [] };
}
