import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  zeroHash,
  type Abi,
  type Address,
  type Hex,
} from "viem";

interface FixtureDeployment {
  work: { schema: string; schemaUID: Hex };
  review: { schema: string; schemaUID: Hex };
}

/** Exact production schemas with public fixture evidence; no resolver/role claims. */
export function reportingFixtureEvidence(
  deployment: FixtureDeployment,
  eas: { address: Address; abi: Abi },
  garden: Hex,
) {
  const workData = encodeAbiParameters(parseAbiParameters(deployment.work.schema), [
    1n,
    "fork report",
    "fixture regenerative work",
    "ipfs://fixture",
    [],
  ]);
  const attest = (recipient: Hex = garden, schema: Hex = deployment.work.schemaUID, data: Hex = workData) => ({
    to: eas.address,
    value: 0n,
    data: encodeFunctionData({
      abi: eas.abi,
      functionName: "attest",
      args: [{ schema, data: { recipient, expirationTime: 0n, revocable: false, refUID: zeroHash, data, value: 0n } }],
    }),
  });
  const review = (workUID: Hex) =>
    attest(
      garden,
      deployment.review.schemaUID,
      encodeAbiParameters(parseAbiParameters(deployment.review.schema), [
        1n,
        workUID,
        true,
        "fixture review",
        90,
        0,
        "ipfs://fixture-review",
      ]),
    );
  return { attest, review };
}
