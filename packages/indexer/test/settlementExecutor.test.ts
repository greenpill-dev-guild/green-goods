import assert from "node:assert/strict";
import { addr, CHAINS, mockEvent } from "./helpers/events";
import { settlementMessage } from "./helpers/settlement-messages";
import { CeloSettlementExecutor, createTestIndexer, processEvents, SettlementModule } from "./v3";

const SOURCE_CHAIN = CHAINS.arbitrum;
const EXECUTOR_CHAIN = CHAINS.celo;

function executorEvent(timestamp: number) {
  return mockEvent(EXECUTOR_CHAIN, timestamp);
}

function sourceEvent(timestamp: number) {
  return mockEvent(SOURCE_CHAIN, timestamp);
}

async function pinExecutor(db: ReturnType<typeof createTestIndexer>, timestamp = 1) {
  const event = CeloSettlementExecutor.ExecutorDeploymentPinned.createMockEvent({
    ccipRouter: addr(92),
    gDollarToken: addr(91),
    remoteChainSelector: 4_949_039_107_694_359_620n,
    localChainSelector: 1_346_049_177_634_351_622n,
    sourceEvmChainId: BigInt(SOURCE_CHAIN),
    mockEventData: executorEvent(timestamp),
  });
  return CeloSettlementExecutor.ExecutorDeploymentPinned.processEvent({ event, mockDb: db });
}

async function pinSource(db: ReturnType<typeof createTestIndexer>, timestamp = 1) {
  const event = SettlementModule.SettlementDeploymentPinned.createMockEvent({
    ccipRouter: addr(92),
    localChainSelector: 4_949_039_107_694_359_620n,
    remoteEvmChainId: BigInt(EXECUTOR_CHAIN),
    mockEventData: sourceEvent(timestamp),
  });
  return SettlementModule.SettlementDeploymentPinned.processEvent({ event, mockDb: db });
}

type Scenario = {
  name: string;
  mutation: string;
  run: () => Promise<void>;
};

const SCENARIOS: Scenario[] = [
  {
    name: "ignores a stored execution before deployment pinning",
    mutation: "remove the remote-chain configuration guard",
    run: async () => {
      const message = settlementMessage(1_000, { subjectId: 10n });
      const event = CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
        ...message.executor.stored,
        mockEventData: executorEvent(2),
      });
      const db = await CeloSettlementExecutor.SettlementExecutionStored.processEvent({
        event,
        mockDb: createTestIndexer(),
      });
      assert.equal(
        await db.SettlementExecution.get(`${EXECUTOR_CHAIN}-${message.ids.executionKey}`),
        undefined
      );
    },
  },
  {
    name: "ignores a duplicate before its execution exists",
    mutation: "create duplicate message rows without an execution",
    run: async () => {
      const message = settlementMessage(1_020, { subjectId: 11n });
      let db = await pinExecutor(createTestIndexer());
      const event = CeloSettlementExecutor.DuplicateSettlementMessage.createMockEvent({
        ...message.executor.duplicate,
        mockEventData: executorEvent(2),
      });
      db = await CeloSettlementExecutor.DuplicateSettlementMessage.processEvent({
        event,
        mockDb: db,
      });
      assert.equal(
        await db.SettlementMessage.get(
          `${EXECUTOR_CHAIN}-${message.ids.duplicateCommandMessageId}`
        ),
        undefined
      );
    },
  },
  {
    name: "deduplicates the same duplicate message id and records DUPLICATE",
    mutation: "append duplicate message ids without the includes guard",
    run: async () => {
      const message = settlementMessage(1_040, { subjectId: 12n });
      let db = await pinExecutor(createTestIndexer());
      const stored = CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
        ...message.executor.stored,
        mockEventData: executorEvent(2),
      });
      const duplicate = CeloSettlementExecutor.DuplicateSettlementMessage.createMockEvent({
        ...message.executor.duplicate,
        mockEventData: executorEvent(3),
      });
      db = await processEvents(db, [stored, duplicate, duplicate]);
      const execution = await db.SettlementExecution.get(
        `${EXECUTOR_CHAIN}-${message.ids.executionKey}`
      );
      const duplicateRow = await db.SettlementMessage.get(
        `${EXECUTOR_CHAIN}-${message.ids.duplicateCommandMessageId}`
      );
      assert.deepEqual(execution?.duplicateMessageIds, [message.ids.duplicateCommandMessageId]);
      assert.equal(duplicateRow?.status, "DUPLICATE");
    },
  },
  {
    name: "stores re-execution attempt two under a fresh execution key",
    mutation: "key executions by subject instead of execution key",
    run: async () => {
      const first = settlementMessage(1_060, { subjectId: 13n });
      const retry = settlementMessage(1_070, { subjectId: 13n, attempt: 2n });
      let db = await pinExecutor(createTestIndexer());
      db = await processEvents(db, [
        CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
          ...first.executor.stored,
          mockEventData: executorEvent(2),
        }),
        CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
          ...retry.executor.stored,
          mockEventData: executorEvent(3),
        }),
      ]);
      assert.equal(
        (await db.SettlementExecution.get(`${EXECUTOR_CHAIN}-${first.ids.executionKey}`))?.attempt,
        0
      );
      assert.equal(
        (await db.SettlementExecution.get(`${EXECUTOR_CHAIN}-${retry.ids.executionKey}`))?.attempt,
        2
      );
    },
  },
  {
    name: "moves a deferred acknowledgment to sent",
    mutation: "leave the deferral code set after acknowledgment send",
    run: async () => {
      const message = settlementMessage(1_080, { subjectId: 14n });
      let db = await pinExecutor(createTestIndexer());
      db = await processEvents(db, [
        CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
          ...message.executor.stored,
          mockEventData: executorEvent(2),
        }),
        CeloSettlementExecutor.AcknowledgmentDeferred.createMockEvent({
          ...message.executor.deferred,
          mockEventData: executorEvent(3),
        }),
        CeloSettlementExecutor.AcknowledgmentSent.createMockEvent({
          ...message.executor.acknowledgmentSent,
          reserveFunded: false,
          mockEventData: executorEvent(4),
        }),
      ]);
      const execution = await db.SettlementExecution.get(
        `${EXECUTOR_CHAIN}-${message.ids.executionKey}`
      );
      assert.equal(execution?.acknowledgmentSent, true);
      assert.equal(execution?.acknowledgmentDeferralCode, "NONE");
    },
  },
  {
    name: "clamps fee reserve at zero and marks it low",
    mutation: "subtract an acknowledgment fee below zero",
    run: async () => {
      const message = settlementMessage(1_100, { subjectId: 15n });
      let db = await pinExecutor(createTestIndexer());
      db = await processEvents(db, [
        CeloSettlementExecutor.AcknowledgmentFeeReserveMinimumUpdated.createMockEvent({
          previousMinimum: 0n,
          minimum: 10n,
          mockEventData: executorEvent(2),
        }),
        CeloSettlementExecutor.AcknowledgmentFeeReserveFunded.createMockEvent({
          funder: addr(10),
          amount: 3n,
          mockEventData: executorEvent(3),
        }),
        CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
          ...message.executor.stored,
          mockEventData: executorEvent(4),
        }),
        CeloSettlementExecutor.AcknowledgmentSent.createMockEvent({
          ...message.executor.acknowledgmentSent,
          fee: 5n,
          reserveFunded: true,
          mockEventData: executorEvent(5),
        }),
      ]);
      const config = await db.SettlementConfiguration.get(`${EXECUTOR_CHAIN}-settlement-config`);
      assert.equal(config?.nativeFeeBalance, 0n);
      assert.equal(config?.feeReserveLow, true);
    },
  },
  {
    name: "ignores an acknowledgment for an unknown execution key",
    mutation: "create sent acknowledgment rows without an execution",
    run: async () => {
      const message = settlementMessage(1_120, { subjectId: 16n });
      let db = await pinExecutor(createTestIndexer());
      const event = CeloSettlementExecutor.AcknowledgmentSent.createMockEvent({
        ...message.executor.acknowledgmentSent,
        mockEventData: executorEvent(2),
      });
      db = await CeloSettlementExecutor.AcknowledgmentSent.processEvent({ event, mockDb: db });
      assert.equal(
        await db.SettlementMessage.get(`${EXECUTOR_CHAIN}-${message.ids.acknowledgmentMessageId}`),
        undefined
      );
    },
  },
  {
    name: "keeps source and executor identities aligned from one fixture",
    mutation: "derive executor command ids independently from source ids",
    run: async () => {
      const message = settlementMessage(1_140, { subjectId: 17n });
      let db = await pinSource(createTestIndexer());
      db = await pinExecutor(db, 2);
      db = await processEvents(db, [
        SettlementModule.SettlementCommandDispatched.createMockEvent({
          ...message.source.dispatched,
          mockEventData: sourceEvent(3),
        }),
        CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
          ...message.executor.stored,
          mockEventData: executorEvent(4),
        }),
      ]);
      const source = await db.SettlementCommandIndex.get(
        `${SOURCE_CHAIN}-${message.ids.executionKey}`
      );
      const executor = await db.SettlementExecution.get(
        `${EXECUTOR_CHAIN}-${message.ids.executionKey}`
      );
      assert.equal(source?.commandMessageId, executor?.commandMessageId);
      assert.equal(source?.subjectId, executor?.settlementId);
    },
  },
  {
    name: "retains a documented cross-chain attempt mismatch",
    mutation: "silently coerce executor attempt to source attempt",
    run: async () => {
      const sourceMessage = settlementMessage(1_160, { subjectId: 18n, attempt: 1n });
      const executorMessage = settlementMessage(1_160, { subjectId: 18n, attempt: 2n });
      let db = await pinSource(createTestIndexer());
      db = await pinExecutor(db, 2);
      db = await processEvents(db, [
        SettlementModule.SettlementCommandDispatched.createMockEvent({
          ...sourceMessage.source.dispatched,
          mockEventData: sourceEvent(3),
        }),
        CeloSettlementExecutor.SettlementExecutionStored.createMockEvent({
          ...executorMessage.executor.stored,
          mockEventData: executorEvent(4),
        }),
      ]);
      const source = await db.SettlementCommandIndex.get(
        `${SOURCE_CHAIN}-${sourceMessage.ids.executionKey}`
      );
      const executor = await db.SettlementExecution.get(
        `${EXECUTOR_CHAIN}-${executorMessage.ids.executionKey}`
      );
      assert.equal(source?.attempt, 1);
      assert.equal(executor?.attempt, 2);
    },
  },
];

describe("Celo settlement executor redelivery", () => {
  for (const { name, mutation, run } of SCENARIOS) {
    it(name, async () => {
      assert.ok(mutation, "each scenario records its named mutation");
      await run();
    });
  }
});
