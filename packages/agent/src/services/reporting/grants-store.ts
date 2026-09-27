import type { GrantPolicy, GrantPurpose } from "@green-goods/shared/modules/agent-reporting";
import type { ReportingCore } from "./runtime";

/**
 * Kernel execution grants as the Agent tracks them. `active` means the chosen module's enforceable
 * validity was verified on chain, not that an HTTP call succeeded. An API pause stops the executor
 * immediately; only verified on-chain revocation or expiry removes the delegated key's authority.
 * Budgets are reserved atomically and never reset by retries.
 */
export type GrantState =
  | "proposed"
  | "owner_authorization_pending"
  | "enabling"
  | "reconciling_setup"
  | "active"
  | "paused"
  | "expired"
  | "revocation_pending"
  | "reconciling_revocation"
  | "revoked"
  | "failed";

export interface GrantRecord {
  id: string;
  purpose: GrantPurpose;
  participantId: string;
  accountBindingId: string;
  channelBindingId: string;
  identityEpoch: number;
  chainId: number;
  gardenAddress: string;
  moduleRef: string;
  permissionId: string | null;
  signerKeyRef: string;
  signerAddress: string;
  policyDigest: string;
  policy: GrantPolicy;
  revocationDescriptor: string | null;
  validAfter: number;
  validUntil: number;
  maxSubmissions: number;
  submissionsReserved: number;
  submissionsConsumed: number;
  gasCap: number;
  gasReserved: number;
  gasConsumed: number;
  version: number;
  state: GrantState;
}

interface GrantRow {
  id: string;
  purpose: GrantPurpose;
  participant_id: string;
  account_binding_id: string;
  channel_binding_id: string;
  identity_epoch: number;
  chain_id: number;
  garden_address: string;
  module_ref: string;
  permission_id: string | null;
  signer_key_ref: string;
  signer_address: string;
  policy_digest: string;
  policy_json: string;
  revocation_descriptor: string | null;
  valid_after: number;
  valid_until: number;
  max_submissions: number;
  submissions_reserved: number;
  submissions_consumed: number;
  gas_cap: number;
  gas_reserved: number;
  gas_consumed: number;
  version: number;
  state: GrantState;
}

function toGrant(row: GrantRow | null): GrantRecord | null {
  return row
    ? {
        id: row.id,
        purpose: row.purpose,
        participantId: row.participant_id,
        accountBindingId: row.account_binding_id,
        channelBindingId: row.channel_binding_id,
        identityEpoch: row.identity_epoch,
        chainId: row.chain_id,
        gardenAddress: row.garden_address,
        moduleRef: row.module_ref,
        permissionId: row.permission_id,
        signerKeyRef: row.signer_key_ref,
        signerAddress: row.signer_address,
        policyDigest: row.policy_digest,
        policy: JSON.parse(row.policy_json) as GrantPolicy,
        revocationDescriptor: row.revocation_descriptor,
        validAfter: row.valid_after,
        validUntil: row.valid_until,
        maxSubmissions: row.max_submissions,
        submissionsReserved: row.submissions_reserved,
        submissionsConsumed: row.submissions_consumed,
        gasCap: row.gas_cap,
        gasReserved: row.gas_reserved,
        gasConsumed: row.gas_consumed,
        version: row.version,
        state: row.state,
      }
    : null;
}

export function grantById(core: ReportingCore, id: string): GrantRecord | null {
  return toGrant(
    core.db.query("SELECT * FROM execution_grants WHERE id = $id").get({ id }) as GrantRow | null
  );
}

/** The live grant for an account, purpose and garden, whatever its lifecycle state. */
export function liveGrant(
  core: ReportingCore,
  input: { accountBindingId: string; purpose: GrantPurpose; chainId: number; gardenAddress: string }
): GrantRecord | null {
  return toGrant(
    core.db
      .query(
        `SELECT * FROM execution_grants
         WHERE account_binding_id = $account AND purpose = $purpose AND chain_id = $chain AND garden_address = $garden
           AND state IN ('proposed','owner_authorization_pending','enabling','reconciling_setup','active','paused')`
      )
      .get({
        account: input.accountBindingId,
        purpose: input.purpose,
        chain: input.chainId,
        garden: input.gardenAddress.toLowerCase(),
      }) as GrantRow | null
  );
}

export type GrantUnusable = "missing" | "not_active" | "expired" | "exhausted" | "epoch_changed";

/** Whether a grant can authorize one more delegated submission right now. */
export function grantUsability(
  grant: GrantRecord | null,
  input: { identityEpoch: number; now: number }
): GrantUnusable | null {
  if (!grant) return "missing";
  if (grant.state !== "active") return "not_active";
  if (input.now < grant.validAfter || input.now >= grant.validUntil) return "expired";
  if (grant.submissionsReserved + grant.submissionsConsumed >= grant.maxSubmissions)
    return "exhausted";
  if (grant.identityEpoch !== input.identityEpoch) return "epoch_changed";
  return null;
}
