export const PINNED_POOLING_CONTRACTS_BY_CHAIN = new Map([
  [
    42161,
    new Map([
      [
        "CommitmentPoolingModule",
        {
          address: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
          deploymentBlock: 493_952_807,
        },
      ],
      [
        "CommitmentRegistry",
        {
          address: "0x66300da4d3749bfc9f7326db94e0deb47a7a3959",
          deploymentBlock: 493_952_893,
        },
      ],
      [
        "SettlementModule",
        {
          address: "0x15c8f6cf25aba2161cc04719b4c4a93c4146935d",
          deploymentBlock: 493_971_677,
        },
      ],
      [
        "CreditRegistry",
        {
          address: "0xcff1fdc12bf130897db0c9c74fb094c956196a34",
          deploymentBlock: 493_971_794,
        },
      ],
    ]),
  ],
  [
    42220,
    new Map([
      [
        "CeloSettlementExecutor",
        {
          address: "0xb8a7f3c3dfa407c45e05b7b2381233101938a84f",
          deploymentBlock: 74_691_430,
        },
      ],
    ]),
  ],
]);

export function validatePinnedPoolingContracts(chains) {
  const errors = [];

  for (const [chainId, pinnedContracts] of PINNED_POOLING_CONTRACTS_BY_CHAIN) {
    const chain = chains.find((candidate) => Number(candidate?.id) === chainId);
    const chainContracts = Array.isArray(chain?.contracts) ? chain.contracts : [];

    for (const [name, pin] of pinnedContracts) {
      const matches = chainContracts.filter((contract) => contract?.name === name);
      if (matches.length > 1) {
        errors.push(`Chain ${chainId} contains duplicate ${name} entries`);
        continue;
      }

      const actualAddress = matches[0]?.address;
      if (!actualAddress) {
        errors.push(`Chain ${chainId} is missing pinned ${name}`);
      } else if (String(actualAddress).toLowerCase() !== pin.address) {
        errors.push(
          `Chain ${chainId} ${name} address changed: expected ${pin.address}, found ${actualAddress}`
        );
      }

      const startBlock = Number(chain?.start_block);
      if (!Number.isSafeInteger(startBlock) || startBlock > pin.deploymentBlock) {
        errors.push(
          `Chain ${chainId} start_block must be at or before ${name} deployment block ${pin.deploymentBlock}, found ${chain?.start_block ?? "missing"}`
        );
      }
    }
  }

  return errors;
}
