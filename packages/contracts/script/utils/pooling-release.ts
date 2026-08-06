import * as fs from "node:fs";
import * as path from "node:path";
import { solidityPackedKeccak256 } from "ethers";

/**
 * Shared, RPC-free logic for the Commitment Pooling release lane: the Arbitrum Sepolia
 * rehearsal target, the two additive EAS registrations, and the fail-closed preflights that
 * every pooling deploy or upgrade runs before it is allowed to touch a live proxy.
 */

/** Arbitrum Sepolia. Deliberately distinct from Ethereum Sepolia — the two share no addresses. */
export const ARBITRUM_SEPOLIA_CHAIN_ID = "421614";
export const ARBITRUM_SEPOLIA_NETWORK = "arbitrum-sepolia";

/** Artifact keys the pooling lane owns in `deployments/{chainId}-latest.json`. */
export const POOLING_UPGRADE_KEYS = ["commitmentPoolingModule", "commitmentRegistry"] as const;

/** Config keys appended for this lane. Order is the registration order. */
export const COMMITMENT_SCHEMA_KEYS = ["assessmentV3", "communityTestimony"] as const;

export type CommitmentSchemaKey = (typeof COMMITMENT_SCHEMA_KEYS)[number];

export interface SchemaField {
  name: string;
  type: string;
}

export interface CommitmentSchemaDefinition {
  key: CommitmentSchemaKey;
  name: string;
  description: string;
  revocable: boolean;
  fields: SchemaField[];
}

export interface SchemaRegistrationInput {
  key: string;
  schema: string;
  resolver: string;
  revocable: boolean;
}

export interface OnChainSchemaRecord {
  uid: string;
  schema: string;
  resolver: string;
  revocable: boolean;
}

export type SchemaPlanAction = "register" | "reconcile";

export interface SchemaRegistrationPlan {
  key: string;
  uid: string;
  action: SchemaPlanAction;
}

export interface ProxyOwnerObservation {
  label: string;
  address: string;
  /** `null` when the live `owner()` call produced no readable address. */
  owner: string | null;
}

function schemasConfigPath(): string {
  return path.join(__dirname, "../../config/schemas.json");
}

/**
 * Read the two additive registrations from the canonical schema config, in registration order.
 * The config file — not this module — is the single source of truth for the field lists.
 */
export function loadCommitmentSchemas(): CommitmentSchemaDefinition[] {
  const configPath = schemasConfigPath();
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    schemas?: Record<string, Omit<CommitmentSchemaDefinition, "key">>;
  };

  return COMMITMENT_SCHEMA_KEYS.map((key) => {
    const definition = config.schemas?.[key];
    if (!definition) {
      throw new Error(`Schema config is missing the "${key}" entry required by the pooling lane: ${configPath}`);
    }
    return { key, ...definition };
  });
}

/** EAS canonical schema string: comma-separated `type name` pairs, no spaces around commas. */
export function schemaString(fields: SchemaField[]): string {
  return fields.map((field) => `${field.type} ${field.name}`).join(",");
}

/**
 * The UID EAS will assign, computed exactly as `SchemaRegistry._getUID`
 * (`keccak256(abi.encodePacked(schema, resolver, revocable))`). Knowing it in advance is what
 * makes registration resumable: a run interrupted after `register` but before artifact
 * persistence can read the same UID back and reconcile instead of registering a duplicate.
 */
export function computeSchemaUID(schema: string, resolver: string, revocable: boolean): string {
  return solidityPackedKeccak256(["string", "address", "bool"], [schema, resolver, revocable]);
}

/**
 * Decide what a run should do about one schema, given what the registry currently holds under
 * its deterministic UID. An exact match reconciles; anything else under that UID is a conflict
 * the operator must resolve, never something to overwrite.
 */
export function planSchemaRegistration(
  definition: SchemaRegistrationInput,
  existing: OnChainSchemaRecord | null,
): SchemaRegistrationPlan {
  const uid = computeSchemaUID(definition.schema, definition.resolver, definition.revocable);

  if (!existing || existing.uid.toLowerCase() !== uid.toLowerCase()) {
    return { key: definition.key, uid, action: "register" };
  }

  const matches =
    existing.schema === definition.schema &&
    existing.resolver.toLowerCase() === definition.resolver.toLowerCase() &&
    existing.revocable === definition.revocable;

  if (!matches) {
    throw new Error(
      `Schema "${definition.key}" already exists at ${uid} with a different record ` +
        `(schema="${existing.schema}", resolver=${existing.resolver}, revocable=${existing.revocable}). ` +
        "EAS schemas are immutable; resolve the conflict before continuing.",
    );
  }

  return { key: definition.key, uid, action: "reconcile" };
}

/**
 * Prove the live `owner()` of every proxy this run would upgrade is the declared sender, before
 * any transaction is built. A broadcast by a non-owner reverts anyway; failing here turns that
 * into a readable preflight instead of a burnt nonce, and catches the more dangerous case where
 * ownership moved to a Safe and the operator is about to sign with the wrong account.
 */
export function assertProxyOwnership(observations: ProxyOwnerObservation[], sender: string | undefined): void {
  if (!sender) {
    throw new Error("Live owner preflight requires --sender (or SENDER_ADDRESS) to compare each proxy owner against");
  }

  const unreadable = observations.filter((observation) => !observation.owner);
  if (unreadable.length > 0) {
    throw new Error(
      `Live owner preflight could not read owner() for: ${unreadable
        .map((observation) => `${observation.label} (${observation.address})`)
        .join(", ")}`,
    );
  }

  const mismatched = observations.filter(
    (observation) => (observation.owner as string).toLowerCase() !== sender.toLowerCase(),
  );
  if (mismatched.length > 0) {
    throw new Error(
      `Live owner preflight failed — ${sender} does not own: ${mismatched
        .map((observation) => `${observation.label} (${observation.address}) owned by ${observation.owner}`)
        .join(", ")}`,
    );
  }
}
