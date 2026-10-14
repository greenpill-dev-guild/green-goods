import { useCallback, useRef, useState } from "react";
import type { RecoveryStep } from "../../modules/agent-reporting/api-contract";
import { CeremonyClient, CeremonyError } from "../../modules/agent-reporting/ceremony-client";
import type { Address } from "../../types/domain";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { ceremonyFailure, type CeremonyFailure } from "./ceremony-storage";
import { type CeremonyAccount, useCeremonyAccount } from "./useCeremonyAccount";

/**
 * Moves an existing account to a new chat. The owner proves the account in this browser, types the
 * code the new chat received, and then confirms the move. The code and the confirmation only work
 * in the browser that proved the account; nothing moves until the final explicit confirmation.
 */
export type RecoveryStage =
  | "intro"
  | "opening"
  | "connect"
  | "proving"
  | "code"
  | "confirm"
  | "applying"
  | "applied"
  | "unavailable"
  | "unsupported";

export interface AgentReportingRecovery extends Omit<CeremonyAccount, "prove"> {
  stage: RecoveryStage;
  channelLabel: string | null;
  recoveredAccount: Address | null;
  error: CeremonyFailure | "wrong_code" | null;
  start: () => Promise<void>;
  prove: () => Promise<void>;
  confirmCode: (code: string) => Promise<void>;
  apply: () => Promise<void>;
}

function stageForStep(step: RecoveryStep): RecoveryStage {
  switch (step.state) {
    case "started":
      return "connect";
    case "account_verified":
      return "code";
    case "channel_verified":
    case "confirmed":
      return "confirm";
    case "applied":
      return "applied";
    default:
      return "unavailable";
  }
}

export function useAgentReportingRecovery(
  requestId: string,
  options: { client?: CeremonyClient } = {}
): AgentReportingRecovery {
  const [client] = useState(() => options.client ?? new CeremonyClient());
  const account = useCeremonyAccount();
  const challengeRef = useRef<string | null>(null);
  const [state, setState] = useState({
    stage: "intro" as RecoveryStage,
    channelLabel: null as string | null,
    recoveredAccount: null as Address | null,
    error: null as AgentReportingRecovery["error"],
  });
  const update = useCallback((next: Partial<typeof state>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  const showStep = useCallback(
    (step: RecoveryStep) =>
      update({ stage: stageForStep(step), recoveredAccount: step.account, error: null }),
    [update]
  );

  const failWith = useCallback(
    (error: unknown, stage: RecoveryStage) => {
      const failure = ceremonyFailure(error);
      update({
        error: failure,
        stage: failure === "expired" || failure === "not_yours" ? "unavailable" : stage,
      });
    },
    [update]
  );

  const start = useCallback(async () => {
    update({ stage: "opening", error: null });
    try {
      const challenge = await client.openChallenge(requestId);
      challengeRef.current = challenge.challengeId;
      update({ channelLabel: challenge.channelLabel });
      if (challenge.purpose !== "recovery") return update({ stage: "unsupported" });
      showStep(await client.recovery(challenge.challengeId));
    } catch (error) {
      failWith(error, "intro");
    }
  }, [client, failWith, requestId, showStep, update]);

  const prove = useCallback(async () => {
    const challengeId = challengeRef.current;
    if (!challengeId) return;
    update({ stage: "proving", error: null });
    try {
      await account.prove(client, challengeId);
      showStep(await client.recovery(challengeId));
    } catch (error) {
      if (isCancelledTxError(error)) return update({ stage: "connect", error: "declined" });
      failWith(error, "connect");
    }
  }, [account, client, failWith, showStep, update]);

  const confirmCode = useCallback(
    async (code: string) => {
      const challengeId = challengeRef.current;
      if (!challengeId) return;
      try {
        showStep(await client.confirmRecoveryCode(challengeId, code.trim()));
      } catch (error) {
        // A wrong code counts against a small attempt budget; the Agent decides when it ends.
        if (error instanceof CeremonyError && error.code === "forbidden") {
          return update({ error: "wrong_code" });
        }
        failWith(error, "code");
      }
    },
    [client, failWith, showStep, update]
  );

  const apply = useCallback(async () => {
    const challengeId = challengeRef.current;
    if (!challengeId) return;
    update({ stage: "applying", error: null });
    try {
      showStep(await client.applyRecovery(challengeId));
    } catch (error) {
      failWith(error, "confirm");
    }
  }, [client, failWith, showStep, update]);

  return {
    ...account,
    stage: state.stage,
    channelLabel: state.channelLabel,
    recoveredAccount: state.recoveredAccount,
    error: state.error,
    start,
    prove,
    confirmCode,
    apply,
  };
}
