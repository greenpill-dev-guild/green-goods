import { indexer } from "envio";

import { handleCycleEvent, handlePoolEvent } from "./commitment-pool-aggregates";
import { handleAccepted, handleClaimEvent, handleExchange } from "./commitment-pool-claims";
import { handleContributorEvent } from "./commitment-pool-contributors";
import { handleCommitmentCreated, handleCommitmentTerms } from "./commitment-pool-creation";
import { handleLifecycle, handleMiscCommitment } from "./commitment-pool-lifecycle";
import { enqueuePendingLifecycle } from "./commitment-pool-pending";
import { handleRegistryEvent } from "./commitment-pool-registry";
import {
  COMMITMENT_POOLING_EVENT_NAMES,
  COMMITMENT_REGISTRY_EVENT_NAMES,
  type PoolingContext,
  type RuntimeEvent,
  putAudit,
} from "./commitment-pool-runtime";
import { handleSeriesEvent } from "./commitment-pool-series";
import { handleEvidence, handleWorkEvent } from "./commitment-pool-work";

const MODULE_EVENT_NAMES = new Set<string>(COMMITMENT_POOLING_EVENT_NAMES);
const REGISTRY_EVENT_NAMES = new Set<string>(COMMITMENT_REGISTRY_EVENT_NAMES);
const AUDIT_ONLY_MODULE_EVENTS = new Set([
  "ModuleDependencyUpdated",
  "ModuleSchemaUIDUpdated",
  "ModulePauseStatusChanged",
]);

export async function routeEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const registeredEvents =
    event.contractName === "CommitmentPoolingModule"
      ? MODULE_EVENT_NAMES
      : event.contractName === "CommitmentRegistry"
        ? REGISTRY_EVENT_NAMES
        : undefined;
  if (!registeredEvents?.has(event.eventName)) {
    throw new Error(`Unrouted commitment pooling event: ${event.contractName}.${event.eventName}`);
  }
  if (!(await putAudit(event, context))) return;
  if (event.contractName === "CommitmentRegistry") {
    await handleRegistryEvent(event, context);
    return;
  }
  if (event.eventName.startsWith("Pool")) {
    await handlePoolEvent(event, context);
    return;
  }
  if (event.eventName.startsWith("Cycle")) {
    await handleCycleEvent(event, context);
    return;
  }
  if (event.eventName.startsWith("CommitmentSeries")) {
    await handleSeriesEvent(event, context);
    return;
  }
  if (await enqueuePendingLifecycle(event, context)) return;
  if (event.eventName === "CommitmentCreated") {
    await handleCommitmentCreated(event, context);
    return;
  }
  if (["ConsiderationDeclared", "ValueDeclared", "ConfirmerRuleSet"].includes(event.eventName)) {
    await handleCommitmentTerms(event, context);
    return;
  }
  if (["ClaimRequested", "ClaimDeclined"].includes(event.eventName)) {
    await handleClaimEvent(event, context);
    return;
  }
  if (event.eventName === "CommitmentAccepted") {
    await handleAccepted(event, context);
    return;
  }
  if (event.eventName === "ExchangeAccepted") {
    await handleExchange(event, context);
    return;
  }
  if (event.eventName.startsWith("Contributor") && event.eventName !== "ContributorRosterFrozen") {
    await handleContributorEvent(event, context);
    return;
  }
  if (
    ["WorkLinked", "WorkUnlinked", "ApprovedWorkCounted", "ApprovedWorkReversed"].includes(
      event.eventName
    )
  ) {
    await handleWorkEvent(event, context);
    return;
  }
  if (event.eventName === "EvidenceAttached") {
    await handleEvidence(event, context);
    return;
  }
  if (
    [
      "CommitmentReadyForConfirmation",
      "CommitmentFulfilled",
      "CommitmentCancelled",
      "CommitmentExpired",
      "CommitmentDisputed",
      "DisputeResolved",
    ].includes(event.eventName)
  ) {
    await handleLifecycle(event, context);
    return;
  }
  if (
    [
      "ContributorRosterFrozen",
      "AssessmentAttached",
      "ConfirmationRecorded",
      "ConsiderationPaid",
    ].includes(event.eventName)
  ) {
    await handleMiscCommitment(event, context);
    return;
  }
  if (AUDIT_ONLY_MODULE_EVENTS.has(event.eventName)) return;
  throw new Error(`Unrouted commitment pooling event: ${event.contractName}.${event.eventName}`);
}

for (const eventName of COMMITMENT_POOLING_EVENT_NAMES) {
  indexer.onEvent(
    { contract: "CommitmentPoolingModule", event: eventName },
    async ({ event, context }) => {
      await routeEvent(event as unknown as RuntimeEvent, context as unknown as PoolingContext);
    }
  );
}

for (const eventName of COMMITMENT_REGISTRY_EVENT_NAMES) {
  indexer.onEvent(
    { contract: "CommitmentRegistry", event: eventName },
    async ({ event, context }) => {
      await routeEvent(event as unknown as RuntimeEvent, context as unknown as PoolingContext);
    }
  );
}
