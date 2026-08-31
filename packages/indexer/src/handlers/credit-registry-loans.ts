import { indexer } from "envio";

import { cursorWins } from "./commitment-pool-projections";
import {
  actorUpdate,
  lifecycleUpdate,
  loanRail,
  projection,
  putLoanEvent,
  reconcileProjection,
} from "./credit-registry-projections";
import { normalizeAddress } from "./shared";

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanRequested" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_REQUESTED",
        poolId: event.params.poolId,
        loanId: event.params.loanId,
        actor: event.params.requestedBy,
        amount: event.params.principal,
        data: {
          borrower: event.params.borrower,
          commitmentId: event.params.commitmentId,
          token: event.params.token,
          dueDate: event.params.dueDate,
          installmentsTotal: event.params.installmentsTotal,
          termsCID: event.params.termsCID,
        },
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = actorUpdate(current, event, event.params.requestedBy);
    current = lifecycleUpdate(current, event, "REQUESTED");
    current = {
      ...current,
      requestSeen: true,
      poolId: event.params.poolId,
      borrower: normalizeAddress(event.params.borrower),
      requestedBy: normalizeAddress(event.params.requestedBy),
      commitmentId: event.params.commitmentId === 0n ? undefined : event.params.commitmentId,
      token: normalizeAddress(event.params.token),
      principal: event.params.principal,
      dueDate: event.params.dueDate,
      installmentsTotal: Number(event.params.installmentsTotal),
      termsCID: event.params.termsCID,
      createdAt: event.block.timestamp,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    };
    await reconcileProjection(context, current);
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanApproved" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_APPROVED",
        loanId: event.params.loanId,
        actor: event.params.approvedBy,
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = lifecycleUpdate(
      actorUpdate(current, event, event.params.approvedBy),
      event,
      "APPROVED"
    );
    await reconcileProjection(context, {
      ...current,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanDisbursed" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_DISBURSED",
        loanId: event.params.loanId,
        actor: event.params.recordedBy,
        amount: event.params.amount,
        data: {
          rail: event.params.rail,
          token: event.params.token,
          disbursementId: event.params.disbursementId,
          executionRef: event.params.executionRef,
        },
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = actorUpdate(current, event, event.params.recordedBy);
    current = lifecycleUpdate(current, event, "DISBURSED");
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        current.disbursementBlockNumber,
        current.disbursementLogIndex
      )
    ) {
      current = {
        ...current,
        rail: loanRail(event.params.rail),
        disbursementId:
          event.params.disbursementId === 0n ? undefined : event.params.disbursementId,
        issuedAmount: event.params.amount,
        outstanding: current.repaymentBlockNumber ? current.outstanding : event.params.amount,
        executionRef: event.params.executionRef,
        disbursementBlockNumber: BigInt(event.block.number),
        disbursementLogIndex: event.logIndex,
      };
    }
    await reconcileProjection(context, {
      ...current,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "RepaymentRecorded" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "REPAYMENT_RECORDED",
        loanId: event.params.loanId,
        actor: event.params.recordedBy,
        amount: event.params.amount,
        data: {
          repaidAmount: event.params.repaidAmount,
          newOutstanding: event.params.newOutstanding,
          installmentsPaid: event.params.installmentsPaid,
          executionRef: event.params.executionRef,
        },
      }))
    )
      return;
    let current = actorUpdate(
      await projection(context, event, event.params.loanId),
      event,
      event.params.recordedBy
    );
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        current.repaymentBlockNumber,
        current.repaymentLogIndex
      )
    ) {
      current = {
        ...current,
        repaidAmount: event.params.repaidAmount,
        outstanding: event.params.newOutstanding,
        installmentsPaid: Number(event.params.installmentsPaid),
        executionRef: event.params.executionRef,
        repaymentBlockNumber: BigInt(event.block.number),
        repaymentLogIndex: event.logIndex,
      };
    }
    await reconcileProjection(context, {
      ...current,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent({ contract: "CreditRegistry", event: "LoanRepaid" }, async ({ event, context }) => {
  if (
    !(await putLoanEvent(context, event, {
      eventType: "LOAN_REPAID",
      loanId: event.params.loanId,
      actor: event.params.recordedBy,
      data: { recoveredFromDefault: event.params.recoveredFromDefault },
    }))
  )
    return;
  let current = await projection(context, event, event.params.loanId);
  current = lifecycleUpdate(actorUpdate(current, event, event.params.recordedBy), event, "REPAID");
  await reconcileProjection(context, {
    ...current,
    recoveredFromDefault: event.params.recoveredFromDefault,
    updatedAt: Math.max(current.updatedAt, event.block.timestamp),
  });
});

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanDefaulted" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_DEFAULTED",
        loanId: event.params.loanId,
        actor: event.params.markedBy,
        data: { reasonCID: event.params.reasonCID },
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = lifecycleUpdate(
      actorUpdate(current, event, event.params.markedBy),
      event,
      "DEFAULTED"
    );
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        current.defaultBlockNumber,
        current.defaultLogIndex
      )
    ) {
      current = {
        ...current,
        reasonCID: event.params.reasonCID,
        defaultReasonCID: event.params.reasonCID,
        defaultedAt: event.block.timestamp,
        defaultBlockNumber: BigInt(event.block.number),
        defaultLogIndex: event.logIndex,
      };
    }
    await reconcileProjection(context, {
      ...current,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanCancelled" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_CANCELLED",
        loanId: event.params.loanId,
        actor: event.params.cancelledBy,
        data: { reasonCID: event.params.reasonCID },
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = lifecycleUpdate(
      actorUpdate(current, event, event.params.cancelledBy),
      event,
      "CANCELLED"
    );
    await reconcileProjection(context, {
      ...current,
      reasonCID: event.params.reasonCID,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);
