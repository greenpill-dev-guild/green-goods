import type { CommitmentCycleRecord, PoolClaimRequestRow } from "@green-goods/shared";
import type { PoolSetupIntent } from "./SetupFlow";

/** Which setup or open flow is running, and over which cycle. */
export type FlowState = { intent: PoolSetupIntent; cycle?: CommitmentCycleRecord | null } | null;

/** The reasoned acts: each one pins its reason before the call. */
export type ReasonDialog =
  | { kind: "pause" }
  | { kind: "cancel-cycle"; cycle: CommitmentCycleRecord }
  | { kind: "decline-claim"; row: PoolClaimRequestRow }
  | null;

/** The blast-radius confirmations, which carry facts rather than a reason. */
export type ConfirmDialog = "close" | "compost" | "reopen" | null;
