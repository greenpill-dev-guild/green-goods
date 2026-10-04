import { useQuery } from "@tanstack/react-query";
import {
  readGrantActivationState,
  resumeGrantInstallation,
  useGrantInstallation,
} from "./useGrantInstallation";
import { useCallback, useRef, useState } from "react";
import type {
  AccessResponse,
  AttemptOutcome,
  ChallengeResponse,
  OperationView,
  ResourceView,
  GrantView,
} from "../../modules/agent-reporting/api-contract";
import { CeremonyClient, CeremonyError } from "../../modules/agent-reporting/ceremony-client";
import {
  EnvelopeRejectedError,
  type EnvelopeSendResult,
  sendPreparedEnvelope,
} from "../../modules/agent-reporting/ceremony-send";
import { resolveReportingDeployment } from "../../modules/agent-reporting/envelope";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useAsyncEffect } from "../utils/useAsyncEffect";
import {
  ceremonyFailure,
  type CeremonyFailure,
  clearCeremony,
  readCeremony,
  writeCeremony,
} from "./ceremony-storage";
import {
  type AgentReportingCeremony,
  type CeremonyStage,
  ceremonyPollKey,
  issuesFor,
  PURPOSES,
  settlesUnknownOutcome,
  shouldPollCeremony,
  stageForOperation,
} from "./ceremony-stage";
import { useCeremonyAccount } from "./useCeremonyAccount";

export type { AgentReportingCeremony } from "./ceremony-stage";

const POLL_MS = 3_000;

interface CeremonyOptions {
  client?: CeremonyClient;
  /** How often pairing and publication status are checked while waiting. */
  pollMs?: number;
}

export function useAgentReportingCeremony(
  requestId: string,
  options: CeremonyOptions = {}
): AgentReportingCeremony {
  const [client] = useState(() => options.client ?? new CeremonyClient());
  const account = useCeremonyAccount();
  const sender = useTransactionSender();
  const challengeRef = useRef<string | null>(null);
  const [state, setState] = useState({
    stage: "intro" as CeremonyStage,
    purpose: null as ChallengeResponse["purpose"] | null,
    channelLabel: null as string | null,
    pairingCode: null as string | null,
    access: null as AccessResponse | null,
    resource: null as ResourceView | null,
    operation: null as OperationView | null,
    grant: null as GrantView | null,
    error: null as CeremonyFailure | null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const update = useCallback((next: Partial<typeof state>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  const fail = useCallback(
    (error: unknown) => {
      const failure = ceremonyFailure(error);
      const terminal = failure === "expired" || failure === "not_yours";
      update({ error: failure, ...(terminal ? { stage: "unavailable" as const } : {}) });
    },
    [update]
  );

  const showResource = useCallback(
    (view: ResourceView) =>
      update({
        resource: view,
        operation: view.operation,
        stage: stageForOperation(view.operation),
      }),
    [update]
  );

  const loadResource = useCallback(
    async (access: AccessResponse) => {
      const { purpose, resourceKind, resourceId } = access.scope;
      update({ access, purpose, error: null, resource: null, operation: null, grant: null });
      if (purpose === "grant_reporting" || purpose === "grant_review") {
        try {
          const grant = await client.proposeGrant();
          return update(await readGrantActivationState(client, requestId, grant));
        } catch (error) {
          if (error instanceof CeremonyError && error.code === "unsupported_scope")
            return update({ stage: "unsupported" });
          throw error;
        }
      }
      if (!resourceId || (resourceKind !== "draft" && resourceKind !== "review")) {
        return update({ stage: "unavailable" });
      }
      update({ stage: "loading" });
      showResource(
        resourceKind === "review" ? await client.review(resourceId) : await client.draft(resourceId)
      );
    },
    [client, requestId, showResource, update]
  );

  const openAccess = useCallback(
    async (challengeId: string) => {
      const access = await client.access(challengeId);
      writeCeremony(requestId, { accessId: access.accessId });
      await loadResource(access);
    },
    [client, loadResource, requestId]
  );

  const afterChallenge = useCallback(
    async (challenge: ChallengeResponse) => {
      challengeRef.current = challenge.challengeId;
      update({ purpose: challenge.purpose, channelLabel: challenge.channelLabel, error: null });
      if (!PURPOSES.has(challenge.purpose)) return update({ stage: "unsupported" });
      switch (challenge.state) {
        case "issued":
          return update({ stage: "connect" });
        case "proof_verified":
          return update({ stage: "pairing", pairingCode: challenge.pairingCode ?? null });
        case "paired":
          if (challenge.purpose === "link_account") return update({ stage: "linked" });
          return openAccess(challenge.challengeId);
        default:
          return update({ stage: "unavailable", error: "expired" });
      }
    },
    [openAccess, update]
  );

  // A refreshed tab resumes its own session; nothing is requested for a link opened fresh.
  useAsyncEffect(
    async ({ isMounted }) => {
      const stored = readCeremony(requestId);
      if (!stored?.accessId) return;
      try {
        const access = await client.currentAccess();
        if (!isMounted()) return;
        if (access.accessId !== stored.accessId) return clearCeremony(requestId);
        const pending = stored.pendingReport;
        const unresolvedGrant = await resumeGrantInstallation(client, requestId, stored);
        if (unresolvedGrant) {
          if (isMounted()) update({ access, purpose: access.scope.purpose, ...unresolvedGrant });
          return;
        }
        if (pending) {
          // Same idempotency key and body: a replay is safe, a conflict means it already landed.
          await client
            .reportOutcome(pending.operationId, pending.request)
            .catch(() => undefined)
            .finally(() => writeCeremony(requestId, { accessId: stored.accessId }));
        }
        if (isMounted()) await loadResource(access);
      } catch {
        if (stored.pendingGrant || stored.pendingGrantActivation) {
          if (isMounted()) update({ stage: "grant_submitted", error: "outcome_unknown" });
        } else clearCeremony(requestId);
      }
    },
    [client, requestId]
  );

  useQuery({
    queryKey: ceremonyPollKey(state, challengeRef.current),
    enabled: shouldPollCeremony(state),
    refetchInterval: options.pollMs ?? POLL_MS,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      if (stateRef.current.stage === "pairing" && challengeRef.current) {
        const challenge = await client.challenge(challengeRef.current);
        if (challenge.state !== "proof_verified") await afterChallenge(challenge);
        return challenge.state;
      }
      if (stateRef.current.grant) {
        const grant = await client.grant(stateRef.current.grant.grantId);
        update(await readGrantActivationState(client, requestId, grant));
        return grant.state;
      }
      const operationId = stateRef.current.operation?.operationId;
      if (!operationId) return null;
      const operation = await client.operation(operationId);
      const stage = stageForOperation(operation);
      const settled = settlesUnknownOutcome(stage);
      update({
        operation,
        stage,
        ...(settled && stateRef.current.error === "outcome_unknown" ? { error: null } : {}),
      });
      return operation.state;
    },
  });

  const start = useCallback(async () => {
    update({ stage: "opening", error: null });
    try {
      await afterChallenge(await client.openChallenge(requestId));
    } catch (error) {
      update({ stage: "intro" });
      fail(error);
    }
  }, [afterChallenge, client, fail, requestId, update]);

  const prove = useCallback(async () => {
    const challengeId = challengeRef.current;
    if (!challengeId) return;
    update({ stage: "proving", error: null });
    try {
      await afterChallenge(await account.prove(client, challengeId));
    } catch (error) {
      if (isCancelledTxError(error)) return update({ stage: "connect", error: "declined" });
      // A proof from another account leaves the challenge open: switch accounts and try again.
      if (error instanceof CeremonyError && error.code === "forbidden") {
        return update({ stage: "connect", error: "wrong_account" });
      }
      update({ stage: "connect" });
      fail(error);
    }
  }, [account, afterChallenge, client, fail, update]);

  const publish = useCallback(async () => {
    const { operation, access } = stateRef.current;
    const envelope = operation?.envelope;
    if (!operation || !envelope || !access || !sender) return;
    if (issuesFor(operation).length > 0) return update({ error: "envelope_mismatch" });
    if (account.account?.toLowerCase() !== envelope.accountAddress.toLowerCase()) {
      return update({ error: "wrong_account" });
    }
    update({ stage: "signing", error: null });
    let attemptId: string;
    try {
      const attempt = await client.reserveAttempt(operation.operationId, {
        expectedAttemptVersion: operation.attemptVersion,
        payloadDigest: envelope.payloadDigest,
        idempotencyKey: crypto.randomUUID(),
      });
      attemptId = attempt.attemptId;
    } catch (error) {
      // Another tab may already be sending this publication; show what the Agent knows.
      await loadResource(access).catch(() => undefined);
      return fail(error);
    }
    const request = (outcome: AttemptOutcome) => ({
      attemptId,
      idempotencyKey: `${attemptId}:${outcome.kind}`,
      payloadDigest: envelope.payloadDigest,
      outcome,
    });
    let result: EnvelopeSendResult;
    try {
      result = await sendPreparedEnvelope(sender, envelope, {
        deployment: resolveReportingDeployment(envelope.chainId),
        onReference: async (outcome) => {
          await client.reportOutcome(operation.operationId, request(outcome));
          return true;
        },
      });
    } catch (error) {
      // The independent check refused the envelope before the wallet was asked.
      if (!(error instanceof EnvelopeRejectedError)) throw error;
      result = {
        outcome: { kind: "preparation_failed", reason: "envelope_mismatch" },
        reported: false,
      };
    }
    if (!result.reported) {
      await client.reportOutcome(operation.operationId, request(result.outcome)).catch(() =>
        writeCeremony(requestId, {
          accessId: access.accessId,
          pendingReport: {
            operationId: operation.operationId,
            request: request(result.outcome),
          },
        })
      );
    }
    const { kind } = result.outcome;
    update({
      stage:
        kind === "rejected_before_send"
          ? "not_sent"
          : kind === "preparation_failed"
            ? "failed"
            : "submitted",
      error: kind === "uncertain" ? "outcome_unknown" : null,
    });
  }, [account.account, client, fail, loadResource, requestId, sender, update]);

  const leave = useCallback(async () => {
    const access = stateRef.current.access;
    clearCeremony(requestId);
    if (access) await client.endAccess(access.accessId).catch(() => undefined);
    update({ stage: "intro", access: null, resource: null, operation: null, grant: null });
  }, [client, requestId, update]);

  const installGrant = useGrantInstallation({
    account: account.account,
    client,
    requestId,
    sender,
    stateRef,
    update,
  });

  return {
    ...account,
    stage: state.stage,
    purpose: state.purpose,
    channelLabel: state.channelLabel,
    pairingCode: state.pairingCode,
    sessionAccount: state.access?.account ?? null,
    resource: state.resource,
    operation: state.operation,
    grant: state.grant,
    issues: issuesFor(state.operation),
    error: state.error,
    start,
    prove,
    publish,
    installGrant,
    leave,
  };
}
