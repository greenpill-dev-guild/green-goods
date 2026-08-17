export const PINNED_POOLING_CONTRACTS_BY_CHAIN = new Map([
  [
    42161,
    new Map([
      ["CommitmentPoolingModule", "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a"],
      ["CommitmentRegistry", "0x66300da4d3749bfc9f7326db94e0deb47a7a3959"],
    ]),
  ],
]);

export function validatePinnedPoolingContracts(chains) {
  const errors = [];

  for (const [chainId, pinnedContracts] of PINNED_POOLING_CONTRACTS_BY_CHAIN) {
    const chain = chains.find((candidate) => Number(candidate?.id) === chainId);
    const chainContracts = Array.isArray(chain?.contracts) ? chain.contracts : [];

    for (const [name, expectedAddress] of pinnedContracts) {
      const matches = chainContracts.filter((contract) => contract?.name === name);
      if (matches.length > 1) {
        errors.push(`Chain ${chainId} contains duplicate ${name} entries`);
        continue;
      }

      const actualAddress = matches[0]?.address;
      if (!actualAddress) {
        errors.push(`Chain ${chainId} is missing pinned ${name}`);
      } else if (String(actualAddress).toLowerCase() !== expectedAddress) {
        errors.push(
          `Chain ${chainId} ${name} address changed: expected ${expectedAddress}, found ${actualAddress}`
        );
      }
    }
  }

  return errors;
}
