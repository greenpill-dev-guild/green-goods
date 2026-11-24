import type { GraphQLReader } from "../data/graphql-client";
import type { ServiceAccessKey, ServiceAccessSnapshot } from "./service-access-types";
import {
  serviceAddress,
  serviceFlag,
  serviceHash,
  serviceTuple,
  serviceUint,
  SERVICE_ZERO_ADDRESS,
  SERVICE_ZERO_HASH,
} from "./service-access-chain-values";

/** A positive indexed opt-in can suppress an unsafe generic control; absence is never an unbound proof. */
export async function readIndexedEarnedOptIn(key: ServiceAccessKey, reader: GraphQLReader) {
  const result = await reader.query<{ EarnedVoucherRevision: unknown[] }>(
    `query MemberEarnedVoucherBinding($chain: Int!, $core: String!, $commitment: numeric!) {
    EarnedVoucherRevision(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $core}, commitmentId: {_eq: $commitment}}, order_by: {revision: desc}, limit: 1) {
      id chainId moduleAddress commitmentId revision module termsHash boundSeen acceptedSeen
    }
  }`,
    {
      chain: key.sourceChainId,
      core: key.coreModule.toLowerCase(),
      commitment: key.commitmentId.toString(),
    },
    "readIndexedEarnedOptIn"
  );
  if (result.error) throw result.error;
  if (!Array.isArray(result.data.EarnedVoucherRevision))
    throw new Error("Missing earned observations");
  const value = result.data.EarnedVoucherRevision[0];
  if (!value) return null;
  const r = serviceTuple(value, [
    "id",
    "chainId",
    "moduleAddress",
    "commitmentId",
    "revision",
    "module",
    "termsHash",
    "boundSeen",
    "acceptedSeen",
  ]);
  const decimal = (v: unknown, bits = 256) => {
    if (typeof v !== "string" || !/^(0|[1-9]\d*)$/.test(v))
      throw new Error("Invalid indexed earned integer");
    return serviceUint(BigInt(v), bits);
  };
  const revision = decimal(r.revision, 64),
    module = serviceAddress(r.module),
    termsHash = serviceHash(r.termsHash);
  if (
    r.chainId !== key.sourceChainId ||
    serviceAddress(r.moduleAddress) !== key.coreModule.toLowerCase() ||
    decimal(r.commitmentId) !== key.commitmentId ||
    r.id !==
      `${key.sourceChainId}-${key.coreModule.toLowerCase()}-${key.commitmentId}-${revision}` ||
    revision === 0n ||
    module === SERVICE_ZERO_ADDRESS ||
    termsHash === SERVICE_ZERO_HASH ||
    (!serviceFlag(r.boundSeen) && !serviceFlag(r.acceptedSeen))
  )
    throw new Error("Invalid indexed earned binding");
  return { module, revision, termsHash };
}

export function retainIndexedEarnedOptIn(
  snapshot: ServiceAccessSnapshot,
  binding: Awaited<ReturnType<typeof readIndexedEarnedOptIn>>
) {
  if (!binding || snapshot.acceptancePolicy.earned.status !== "unknown") return;
  Object.assign(snapshot.acceptancePolicy.earned, { ...binding, status: "bound" });
  Object.assign(snapshot.acceptancePolicy, {
    knownOptIn: true,
    blockGenericMemberAcceptance: true,
    kind: snapshot.knownService ? "service" : "earned",
  });
  snapshot.capabilities.reasons = [...snapshot.capabilities.reasons, "earned-consent-unavailable"];
  // Full issuer terms and exact canonical account consent still require authoritative reads.
  if (snapshot.mode === "legacy" || snapshot.mode === "unavailable") snapshot.complete = false;
}
