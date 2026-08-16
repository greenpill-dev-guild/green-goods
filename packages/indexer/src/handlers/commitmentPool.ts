import { indexer } from "envio";

import { handleCycleEvent, handlePoolEvent } from "./commitment-pool-aggregates";
import { handleAccepted, handleClaimEvent, handleExchange } from "./commitment-pool-claims";
import { handleContributorEvent } from "./commitment-pool-contributors";
import { handleCommitmentCreated, handleCommitmentTerms } from "./commitment-pool-creation";
import { handleLifecycle, handleMiscCommitment } from "./commitment-pool-lifecycle";
import { enqueuePendingLifecycle } from "./commitment-pool-pending";
import { handleRegistryEvent } from "./commitment-pool-registry";
import { type PoolingContext, type RuntimeEvent, putAudit } from "./commitment-pool-runtime";
import { handleSeriesEvent } from "./commitment-pool-series";
import { handleEvidence, handleWorkEvent } from "./commitment-pool-work";

async function routeEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
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
  }
}

const POOLING_EVENTS = [
  "PoolRegistered",
  "PoolCharterUpdated",
  "PoolReady",
  "PoolOpened",
  "PoolPaused",
  "PoolResumed",
  "PoolClosed",
  "PoolComposted",
  "PoolReopened",
  "CycleSeeded",
  "CycleOpened",
  "CycleClosed",
  "CycleComposted",
  "CycleCancelled",
  "CommitmentSeriesCreated",
  "CommitmentSeriesMetadataUpdated",
  "CommitmentSeriesRested",
  "CommitmentSeriesResumed",
  "CommitmentSeriesRetired",
  "CommitmentCreated",
  "ConsiderationDeclared",
  "ValueDeclared",
  "ConfirmerRuleSet",
  "ClaimRequested",
  "ClaimDeclined",
  "CommitmentAccepted",
  "ExchangeAccepted",
  "ContributorAdded",
  "ContributorRemoved",
  "ContributorRequirementAssigned",
  "ContributorRosterFrozen",
  "WorkLinked",
  "WorkUnlinked",
  "ApprovedWorkCounted",
  "ApprovedWorkReversed",
  "EvidenceAttached",
  "AssessmentAttached",
  "CommitmentReadyForConfirmation",
  "ConfirmationRecorded",
  "CommitmentFulfilled",
  "CommitmentCancelled",
  "CommitmentExpired",
  "CommitmentDisputed",
  "DisputeResolved",
  "ConsiderationPaid",
  "ModuleDependencyUpdated",
  "ModuleSchemaUIDUpdated",
  "ModulePauseStatusChanged",
] as const;

const REGISTRY_EVENTS = [
  "ModuleUpdated",
  "ClassRegistered",
  "ProviderOpenCommitmentCapUpdated",
  "UnitsCommitted",
  "UnitsReleased",
  "UnitsFulfilled",
] as const;

for (const eventName of POOLING_EVENTS) {
  indexer.onEvent(
    { contract: "CommitmentPoolingModule", event: eventName },
    async ({ event, context }) => {
      await routeEvent(event as unknown as RuntimeEvent, context as unknown as PoolingContext);
    }
  );
}

for (const eventName of REGISTRY_EVENTS) {
  indexer.onEvent(
    { contract: "CommitmentRegistry", event: eventName },
    async ({ event, context }) => {
      await routeEvent(event as unknown as RuntimeEvent, context as unknown as PoolingContext);
    }
  );
}
