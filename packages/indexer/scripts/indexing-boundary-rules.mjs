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

export const KARMA_GAP_MODULE_ADDRESS = "0x0fc2be8d57595b16af0953cb2d711118f34563fe";
export const WORK_APPROVAL_RESOLVER_ADDRESS = "0x166732ed81ab200a099215cf33f6a712309b69f7";

export function validateKarmaGapBoundary(chains) {
  const errors = [];

  for (const chain of chains) {
    const chainId = Number(chain?.id);
    const contracts = Array.isArray(chain?.contracts) ? chain.contracts : [];
    const matches = contracts.filter((contract) => contract?.name === "KarmaGAPModule");
    const resolverMatches = contracts.filter(
      (contract) => contract?.name === "WorkApprovalResolver"
    );

    if (chainId === 42161) {
      if (matches.length === 0) {
        errors.push("Chain 42161 is missing pinned KarmaGAPModule");
      } else if (matches.length > 1) {
        errors.push("Chain 42161 contains duplicate KarmaGAPModule entries");
      } else if (String(matches[0]?.address ?? "").toLowerCase() !== KARMA_GAP_MODULE_ADDRESS) {
        errors.push(
          `Chain 42161 KarmaGAPModule address changed: expected ${KARMA_GAP_MODULE_ADDRESS}, found ${matches[0]?.address ?? "missing"}`
        );
      }
      if (resolverMatches.length === 0) {
        errors.push("Chain 42161 is missing pinned WorkApprovalResolver");
      } else if (resolverMatches.length > 1) {
        errors.push("Chain 42161 contains duplicate WorkApprovalResolver entries");
      } else if (
        String(resolverMatches[0]?.address ?? "").toLowerCase() !==
        WORK_APPROVAL_RESOLVER_ADDRESS
      ) {
        errors.push(
          `Chain 42161 WorkApprovalResolver address changed: expected ${WORK_APPROVAL_RESOLVER_ADDRESS}, found ${resolverMatches[0]?.address ?? "missing"}`
        );
      }
    } else if (matches.length > 0) {
      errors.push(`Chain ${chainId} must not register KarmaGAPModule`);
    } else if (resolverMatches.length > 0) {
      errors.push(`Chain ${chainId} must not register WorkApprovalResolver`);
    }
  }

  return errors;
}

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
