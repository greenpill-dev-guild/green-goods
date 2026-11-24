import { indexer, type StewardRoleMirror, type StewardRoleSource } from "envio";
import { cursorWins } from "./commitment-pool-projections";
import {
  cosmoId,
  cursor,
  flag,
  identity,
  integer,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { sameFacts } from "./voucher-service-projections";

/** Publisher observations: a deferred revision above the dispatched one still awaits a send. */
export async function projectStewardRoleSource(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const p = event.params;
  const account = text(p, "account");
  const revision = integer(p, "revision");
  const id = cosmoId(event.chainId, event.srcAddress, account);
  const row: StewardRoleSource = (await context.StewardRoleSource.get(id)) ?? {
    ...identity(event, account),
    account,
    queuedRevision: undefined,
    queuedEligible: undefined,
    dispatchedRevision: undefined,
    dispatchedEligible: undefined,
    lastMessageId: undefined,
    deferredRevision: undefined,
    ...cursor("queued"),
    ...cursor("dispatch"),
    ...cursor("deferred"),
    ...times(event),
  };
  if (event.eventName === "StewardQueued") {
    const queuedEligible = flag(p, "eligible");
    if (row.queuedRevision !== undefined && revision <= row.queuedRevision) {
      if (revision === row.queuedRevision)
        sameFacts(row, { queuedEligible }, "queued steward revision");
      return;
    }
    await context.StewardRoleSource.set({
      ...row,
      queuedRevision: revision,
      queuedEligible,
      ...cursor("queued", event),
      ...times(event, row),
    });
  } else if (event.eventName === "StewardDispatched") {
    const dispatchedEligible = flag(p, "eligible");
    if (row.dispatchedRevision !== undefined && revision < row.dispatchedRevision) return;
    if (revision === row.dispatchedRevision) {
      sameFacts(row, { dispatchedEligible }, "dispatched steward revision");
    }
    // A paid resend repeats a revision under a new message; keep the latest send.
    if (
      !cursorWins(event.block.number, event.logIndex, row.dispatchBlockNumber, row.dispatchLogIndex)
    )
      return;
    await context.StewardRoleSource.set({
      ...row,
      dispatchedRevision: revision,
      dispatchedEligible,
      lastMessageId: text(p, "messageId"),
      ...cursor("dispatch", event),
      ...times(event, row),
    });
  } else if (event.eventName === "DispatchDeferred") {
    if (
      !cursorWins(event.block.number, event.logIndex, row.deferredBlockNumber, row.deferredLogIndex)
    )
      return;
    await context.StewardRoleSource.set({
      ...row,
      deferredRevision: revision,
      ...cursor("deferred", event),
      ...times(event, row),
    });
  } else {
    throw new Error("Unrouted steward publisher event");
  }
}

/** Finalization is one-way on the receiver; later receivers without a bootstrap never emit it. */
export async function projectStewardSafeBootstrap(
  event: Omit<CosmoEvent, "params">,
  context: CosmoContext
): Promise<void> {
  const observed = { ...event, params: {} };
  const id = cosmoId(event.chainId, event.srcAddress);
  const state = (await context.StewardSafeReceiverState.get(id)) ?? {
    ...identity(observed),
    bootstrapFinalized: false,
    ...cursor("finalized"),
    ...times(observed),
  };
  if (state.bootstrapFinalized) return;
  await context.StewardSafeReceiverState.set({
    ...state,
    bootstrapFinalized: true,
    ...cursor("finalized", observed),
    ...times(observed, state),
  });
}

/** Receiver observations. A reconciliation older than the mirrored revision is stale. */
export async function projectStewardRoleMirror(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const p = event.params;
  const account = text(p, "account");
  const id = cosmoId(event.chainId, event.srcAddress, account);
  const row: StewardRoleMirror = (await context.StewardRoleMirror.get(id)) ?? {
    ...identity(event, account),
    account,
    revision: undefined,
    eligible: undefined,
    reconciledEligible: undefined,
    reconciliationDeferred: false,
    ...cursor("mirrored"),
    ...cursor("reconcile"),
    ...times(event),
  };
  if (event.eventName === "StewardMirrored") {
    const revision = integer(p, "revision");
    const eligible = flag(p, "eligible");
    if (row.revision !== undefined && revision <= row.revision) {
      if (revision === row.revision) sameFacts(row, { eligible }, "mirrored steward revision");
      return;
    }
    await context.StewardRoleMirror.set({
      ...row,
      revision,
      eligible,
      ...cursor("mirrored", event),
      ...times(event, row),
    });
  } else if (
    event.eventName === "StewardReconciled" ||
    event.eventName === "ReconciliationDeferred"
  ) {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        row.reconcileBlockNumber,
        row.reconcileLogIndex
      )
    )
      return;
    const reconciled = event.eventName === "StewardReconciled";
    await context.StewardRoleMirror.set({
      ...row,
      reconciledEligible: reconciled ? flag(p, "eligible") : row.reconciledEligible,
      reconciliationDeferred: !reconciled,
      ...cursor("reconcile", event),
      ...times(event, row),
    });
  } else {
    throw new Error("Unrouted steward receiver event");
  }
}

for (const event of ["StewardQueued", "StewardDispatched", "DispatchDeferred"] as const) {
  indexer.onEvent({ contract: "StewardRolePublisher", event }, async ({ event, context }) => {
    await projectStewardRoleSource(event, context);
  });
}
for (const event of ["StewardMirrored", "StewardReconciled", "ReconciliationDeferred"] as const) {
  indexer.onEvent({ contract: "StewardSafeReceiver", event }, async ({ event, context }) => {
    await projectStewardRoleMirror(event, context);
  });
}
indexer.onEvent(
  { contract: "StewardSafeReceiver", event: "BootstrapFinalized" },
  async ({ event, context }) => {
    await projectStewardSafeBootstrap(event, context);
  }
);
