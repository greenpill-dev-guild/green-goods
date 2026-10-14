import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, http, type Hex } from "viem";
import { getChain } from "../../config/chains";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import {
  type RevocationDescriptor,
  revocationDescriptorIssues,
} from "../../modules/agent-reporting/grants";
import {
  createPermissionReader,
  invalidatePermissionCall,
  KERNEL_REVOCATION_PIN,
  permissionStorageKey as storageKey,
  type KernelPermissionView,
  type PermissionReader,
} from "../../modules/agent-reporting/permission-management";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useCeremonyAccount } from "./useCeremonyAccount";

type PermissionStage =
  | "idle"
  | "inspecting"
  | "ready"
  | "revoking"
  | "submitted"
  | "revoked"
  | "failed";
type PermissionError =
  | "unsupported_account"
  | "invalid_descriptor"
  | "wrong_account"
  | "dependency_unavailable"
  | "declined"
  | "outcome_unknown"
  | "remaining_permissions";
interface SavedPermissions {
  descriptors: RevocationDescriptor[];
  pendingGeneration?: number;
  transactionHash?: Hex;
}
function saved(account: string): SavedPermissions {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(account)) ?? "{}");
    return {
      descriptors: Array.isArray(value.descriptors)
        ? value.descriptors.filter((d: unknown) => revocationDescriptorIssues(d).length === 0)
        : [],
      ...(Number.isSafeInteger(value.pendingGeneration)
        ? { pendingGeneration: value.pendingGeneration }
        : {}),
      ...(typeof value.transactionHash === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(value.transactionHash)
        ? { transactionHash: value.transactionHash }
        : {}),
    };
  } catch {
    return { descriptors: [] };
  }
}

/** Owner recovery uses public RPC and the existing owner sender; never an Agent request or signer. */
export function useAgentReportingPermissions(options: { reader?: PermissionReader } = {}) {
  const owner = useCeremonyAccount();
  const sender = useTransactionSender();
  const [reader] = useState(
    () =>
      options.reader ??
      createPermissionReader(
        createPublicClient({
          chain: getChain(KERNEL_REVOCATION_PIN.chainId),
          transport: http(getRpcUrl(KERNEL_REVOCATION_PIN.chainId)),
        }) as unknown as Parameters<typeof createPermissionReader>[0]
      )
  );
  const [state, setState] = useState({
    stage: "idle" as PermissionStage,
    permissions: [] as KernelPermissionView[],
    descriptors: [] as RevocationDescriptor[],
    error: null as PermissionError | null,
    transactionHash: null as Hex | null,
  });
  const accountRef = useRef(owner.account);
  accountRef.current = owner.account;
  useEffect(() => {
    const record = owner.account ? saved(owner.account) : { descriptors: [] };
    setState({
      stage: record.pendingGeneration === undefined ? "idle" : "submitted",
      permissions: [],
      descriptors: record.descriptors,
      error: null,
      transactionHash: record.transactionHash ?? null,
    });
  }, [owner.account]);

  const scan = useCallback(async () => {
    const account = owner.account;
    if (!account) return;
    setState((s) => ({ ...s, stage: "inspecting", error: null }));
    try {
      await reader.assertKernel(account);
      const record = saved(account);
      const ids = new Set([
        ...(await reader.discover(account)),
        ...record.descriptors.map((d) => d.permissionId),
      ]);
      const permissions = await Promise.all(
        [...ids].map(async (id) => ({
          ...(await reader.permission(account, id)),
          descriptor: record.descriptors.find((d) => d.permissionId === id) ?? null,
        }))
      );
      const generation = await reader.generations(account);
      const revoked =
        record.pendingGeneration !== undefined && generation.validFrom >= record.pendingGeneration;
      const remaining = revoked && permissions.some((permission) => permission.active);
      if (accountRef.current !== account) return;
      if (revoked)
        localStorage.setItem(
          storageKey(account),
          JSON.stringify({ descriptors: record.descriptors })
        );
      setState((s) => ({
        ...s,
        permissions,
        stage: remaining
          ? "ready"
          : revoked
            ? "revoked"
            : record.pendingGeneration !== undefined
              ? "submitted"
              : "ready",
        error: remaining ? "remaining_permissions" : null,
      }));
    } catch (error) {
      if (accountRef.current === account)
        setState((s) => ({
          ...s,
          stage: "failed",
          error:
            error instanceof Error && error.message === "unsupported_account"
              ? "unsupported_account"
              : "dependency_unavailable",
        }));
    }
  }, [owner.account, reader]);

  const importDescriptor = useCallback(
    (json: string) => {
      const account = owner.account;
      try {
        const parsed: unknown = JSON.parse(json);
        const values = Array.isArray(parsed) ? parsed : [parsed];
        if (
          !account ||
          values.length > 100 ||
          values.some((d) => revocationDescriptorIssues(d).length !== 0)
        )
          throw new Error("invalid_descriptor");
        const descriptors = values as RevocationDescriptor[];
        if (descriptors.some((d) => d.account.toLowerCase() !== account.toLowerCase()))
          throw new Error("wrong_account");
        const record = saved(account);
        const unique = new Map(
          [...record.descriptors, ...descriptors].map((d) => [d.permissionId, d])
        );
        const next = [...unique.values()];
        localStorage.setItem(storageKey(account), JSON.stringify({ ...record, descriptors: next }));
        setState((s) => ({ ...s, descriptors: next, error: null }));
        return true;
      } catch (error) {
        setState((s) => ({
          ...s,
          error:
            error instanceof Error && error.message === "wrong_account"
              ? "wrong_account"
              : "invalid_descriptor",
        }));
        return false;
      }
    },
    [owner.account]
  );

  const revoke = useCallback(async () => {
    const account = owner.account;
    if (!account || !sender || saved(account).pendingGeneration !== undefined) return;
    setState((s) => ({ ...s, stage: "revoking", error: null }));
    let attempted = false;
    let knownReference: Hex | null = null;
    try {
      await reader.assertKernel(account);
      const generation = await reader.generations(account);
      const call = invalidatePermissionCall(account, generation.current);
      const record = saved(account);
      const pending = { ...record, pendingGeneration: generation.current + 1 };
      const result = await sender.sendContractCall(call, {
        assertOwnership: () => sender.assertOwnership?.(account, call.chainId),
        onBeforeBroadcast: async (reference) => {
          attempted = true;
          knownReference = reference?.hash ?? null;
          localStorage.setItem(
            storageKey(account),
            JSON.stringify({
              ...pending,
              ...(knownReference ? { transactionHash: knownReference } : {}),
            })
          );
        },
        onBroadcastReference: async (reference) => {
          knownReference = reference.hash;
          localStorage.setItem(
            storageKey(account),
            JSON.stringify({ ...pending, transactionHash: reference.hash })
          );
          if (accountRef.current === account)
            setState((s) => ({ ...s, stage: "submitted", transactionHash: reference.hash }));
        },
      });
      if (!knownReference) {
        localStorage.setItem(
          storageKey(account),
          JSON.stringify({ ...pending, transactionHash: result.hash })
        );
        if (accountRef.current === account)
          setState((s) => ({ ...s, stage: "submitted", transactionHash: result.hash }));
      }
      await scan();
    } catch (error) {
      if (accountRef.current !== account) return;
      if (isCancelledTxError(error) && !knownReference) {
        const record = saved(account);
        delete record.pendingGeneration;
        delete record.transactionHash;
        localStorage.setItem(storageKey(account), JSON.stringify(record));
        setState((s) => ({ ...s, stage: "ready", error: "declined" }));
      } else
        setState((s) => ({
          ...s,
          stage: attempted ? "submitted" : "failed",
          error: attempted ? "outcome_unknown" : "dependency_unavailable",
        }));
    }
  }, [owner.account, reader, scan, sender]);
  return {
    ...owner,
    ...state,
    scan,
    importDescriptor,
    exportDescriptors: () => JSON.stringify(state.descriptors, null, 2),
    revoke,
  };
}
