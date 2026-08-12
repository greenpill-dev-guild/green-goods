import * as fs from "node:fs";
import * as path from "node:path";
import { solidityPackedKeccak256 } from "ethers";

/**
 * Shared, RPC-free logic for the Commitment Pooling release lane: the two additive EAS
 * registrations, the grouped upgrade keys, and the fail-closed preflights that every pooling
 * deploy or upgrade runs before it is allowed to touch a live proxy.
 */

/**
 * Rehearsal target: an Arbitrum One fork, not a testnet.
 *
 * Arbitrum Sepolia (421614) was evaluated and rejected as the rehearsal chain. Hats Protocol has
 * no deployment there, so a rehearsal would have to stand up a hand-rolled Hats tree and would
 * prove nothing about the real one. `test/fork/ArbitrumCommitmentPooling.t.sol` runs the same
 * runbook against live Hats, EAS, and the WorkApprovalResolver instead.
 *
 * If that decision is ever revisited, the published 421614 EAS v1.3.0 deployment — verified
 * against the EAS repository on 2026-08-06 — is EAS `0x2521021fc8BF070473E1e1801D3c7B4aB701E1dE`
 * and SchemaRegistry `0x45CB6Fa0870a8Af06796Ac15915619a0f22cd475`. Neither is shared with
 * Ethereum Sepolia; never copy an `11155111` address onto `421614`.
 */
export const POOLING_REHEARSAL_FORK_NETWORK = "arbitrum";

/** Existing proxies upgraded only after the net-new pooling pair is deployed and verified. */
export const POOLING_INTEGRATION_UPGRADE_KEYS = ["gardenToken", "workApprovalResolver"] as const;

/** Config keys appended for this lane. Order is the registration order. */
export const COMMITMENT_SCHEMA_KEYS = ["assessmentV3", "communityTestimony"] as const;

/**
 * The resolver configuration a deployed module needs before it is anything but inert, in
 * dependency order. Order is load-bearing: `setAssessmentV3SchemaUID` reverts
 * `AssessmentV2SchemaUIDRequired` while the v2 UID is zero — which is the live Arbitrum state — so
 * the v2 pin has to land first.
 *
 * The testimony resolver is deliberately not configured here. Its schema pin and module activation
 * belong to the ordered recovery lane in `DeployCommitmentSchemas` (contract-spec §6.4.4), which
 * must pin before any record exists and activate only after the record is proven exact.
 *
 * `workApprovalBridge` is the one that decides whether the release means anything: without it the
 * resolver never calls `onWorkDecision`, so approved work never earns commitment credit.
 */
export const POOLING_CONFIGURATION_STEP_KEYS = ["assessmentV2Pin", "assessmentV3", "workApprovalBridge"] as const;

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

export type PoolingConfigurationStepKey = (typeof POOLING_CONFIGURATION_STEP_KEYS)[number];

/** Everything the configuration run reads out of `deployments/{chainId}-latest.json`. */
export interface PoolingConfigurationTargets {
  assessmentResolver: string;
  testimonyResolver: string;
  workApprovalResolver: string;
  commitmentPoolingModule: string;
  assessmentSchemaUID: string;
  assessmentV3SchemaUID: string;
}

/** What the two configured resolver proxies currently hold on chain. */
export interface PoolingConfigurationState {
  assessmentSchemaUID: string;
  assessmentV3SchemaUID: string;
  workApprovalCommitmentModule: string;
}

export type PoolingConfigurationAction = "set" | "satisfied";

export interface PoolingConfigurationStep {
  key: PoolingConfigurationStepKey;
  /** Deployment-artifact key of the proxy this step calls. */
  target: keyof PoolingConfigurationTargets;
  address: string;
  signature: string;
  argument: string;
  action: PoolingConfigurationAction;
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

function isZeroOrMissing(value: unknown): boolean {
  return typeof value !== "string" || !value.startsWith("0x") || /^0x0+$/i.test(value);
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** Address keys read flat off the artifact root. */
const CONFIGURATION_ADDRESS_KEYS = [
  "assessmentResolver",
  "testimonyResolver",
  "workApprovalResolver",
  "commitmentPoolingModule",
] as const;

/** Schema UID keys read from the artifact's nested `schemas` block. */
const CONFIGURATION_SCHEMA_KEYS = ["assessmentSchemaUID", "assessmentV3SchemaUID"] as const;

/**
 * Pull the configuration inputs out of a deployment artifact, naming every missing key at once.
 *
 * Reported together rather than one at a time because they are produced by three different
 * earlier steps — core deploy, `deploy.ts commitment-schemas`,
 * `deploy.ts pooling` — and an operator holding the whole list can tell which one to re-run.
 */
export function readPoolingConfigurationTargets(deployment: Record<string, unknown>): PoolingConfigurationTargets {
  const schemas = (deployment.schemas ?? {}) as Record<string, unknown>;

  const missing = [
    ...CONFIGURATION_ADDRESS_KEYS.filter((key) => isZeroOrMissing(deployment[key])),
    ...CONFIGURATION_SCHEMA_KEYS.filter((key) => isZeroOrMissing(schemas[key])).map((key) => `schemas.${key}`),
  ];

  if (missing.length > 0) {
    throw new Error(
      `Pooling configuration cannot run until these deployment keys are non-zero: ${missing.join(", ")}. ` +
        "Run deploy.ts commitment-schemas (which deploys the testimony resolver and registers " +
        "AssessmentV3), then deploy.ts pooling, then retry.",
    );
  }

  return {
    assessmentResolver: deployment.assessmentResolver as string,
    testimonyResolver: deployment.testimonyResolver as string,
    workApprovalResolver: deployment.workApprovalResolver as string,
    commitmentPoolingModule: deployment.commitmentPoolingModule as string,
    assessmentSchemaUID: schemas.assessmentSchemaUID as string,
    assessmentV3SchemaUID: schemas.assessmentV3SchemaUID as string,
  };
}

/**
 * A value already on chain either matches what we intend to write — in which case the step is
 * already satisfied and re-running is a no-op — or it is something else, which is an operator
 * conflict this run must not paper over.
 */
function planStep(
  step: Omit<PoolingConfigurationStep, "action">,
  live: string,
  conflictDetail: string,
): PoolingConfigurationStep {
  if (isZeroOrMissing(live)) return { ...step, action: "set" };
  if (sameHex(live, step.argument)) return { ...step, action: "satisfied" };

  throw new Error(
    `Pooling configuration conflict on ${step.target}.${step.signature}: ` +
      `chain holds ${live}, this run would write ${step.argument}. ${conflictDetail}`,
  );
}

/**
 * Decide what a configuration run should do about each of the three resolver calls, given what the
 * two proxies currently hold. Returns every step in dependency order, each marked `set` or
 * `satisfied`, so a dry run reads the same as a broadcast and an interrupted run resumes exactly
 * where it stopped.
 *
 * Every divergence throws rather than overwriting. These are live proxies handling real Arbitrum
 * attestations: repointing a schema UID silently revalidates existing attestations against a
 * different schema, and repointing the work-approval bridge silently redirects credit to another
 * module. Both are deliberate operator acts, never a side effect of re-running a configure step.
 */
export function planPoolingConfiguration(
  targets: PoolingConfigurationTargets,
  state: PoolingConfigurationState,
): PoolingConfigurationStep[] {
  if (sameHex(targets.assessmentV3SchemaUID, targets.assessmentSchemaUID)) {
    throw new Error(
      `Assessment v3 UID ${targets.assessmentV3SchemaUID} equals the v2 UID; the resolver reverts ` +
        "SchemaUIDCollision. The artifact records the same UID twice — re-register the v3 schema.",
    );
  }

  return [
    planStep(
      {
        key: "assessmentV2Pin",
        target: "assessmentResolver",
        address: targets.assessmentResolver,
        signature: "setSchemaUID(bytes32)",
        argument: targets.assessmentSchemaUID,
      },
      state.assessmentSchemaUID,
      "The resolver is validating a schema this artifact does not record; reconcile before continuing.",
    ),
    planStep(
      {
        key: "assessmentV3",
        target: "assessmentResolver",
        address: targets.assessmentResolver,
        signature: "setAssessmentV3SchemaUID(bytes32)",
        argument: targets.assessmentV3SchemaUID,
      },
      state.assessmentV3SchemaUID,
      "Repointing a live assessmentV3SchemaUID revalidates existing attestations; resolve deliberately.",
    ),
    planStep(
      {
        key: "workApprovalBridge",
        target: "workApprovalResolver",
        address: targets.workApprovalResolver,
        signature: "setCommitmentModule(address)",
        argument: targets.commitmentPoolingModule,
      },
      state.workApprovalCommitmentModule,
      "Repointing the live work-approval bridge redirects commitment credit; resolve deliberately.",
    ),
  ];
}

/**
 * The distinct proxies a plan calls, each paired with its address.
 *
 * Derived from the plan rather than kept as a second list, so a step added to
 * `planPoolingConfiguration` is automatically covered by the owner preflight instead of silently
 * escaping it.
 */
export function configurationOwnerTargets(
  plan: PoolingConfigurationStep[],
): Array<{ label: keyof PoolingConfigurationTargets; address: string }> {
  const seen = new Map<keyof PoolingConfigurationTargets, string>();
  plan.forEach((step) => seen.set(step.target, step.address));
  return [...seen].map(([label, address]) => ({ label, address }));
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
