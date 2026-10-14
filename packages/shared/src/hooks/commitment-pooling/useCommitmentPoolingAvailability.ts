import { getOntologyChainMaturity } from "../../ontology/query";
import { selectCommitmentPoolingAvailability } from "../../modules/commitment-pooling/selectors";

export function useCommitmentPoolingAvailability({ chainId }: { chainId: number }) {
  return selectCommitmentPoolingAvailability(
    getOntologyChainMaturity("entity:commitment-pool", chainId)
  );
}
