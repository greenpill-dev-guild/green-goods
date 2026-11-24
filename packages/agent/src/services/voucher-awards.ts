import {
  buildVoucherAwardMessage,
  parseVoucherAwardRequest,
  type VoucherAwardInput,
  type VoucherAwardRecord,
  type VoucherAwardResponse,
  type VoucherAwardSafe,
} from "@green-goods/shared/public-contracts";
import type { Address } from "@green-goods/shared/types";
import type { AccountSignatureVerifier } from "./account-signatures";
import type { VoucherAwardStore } from "./db/voucher-awards";

export class VoucherAwardError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400
  ) {
    super(code);
  }
}
export interface VoucherAwardChain {
  canPrepare(reserve: Address, actor: Address): Promise<boolean>;
  prepare(award: VoucherAwardInput): Promise<VoucherAwardSafe>;
  nonceMatches(record: VoucherAwardRecord): Promise<boolean>;
  reconcile(
    record: VoucherAwardRecord,
    hash: `0x${string}`
  ): Promise<{
    status: "submitted" | "confirmed" | "transaction_reverted" | "safe_execution_failed";
    transactionHash: `0x${string}`;
  }>;
}
export function createVoucherAwardService(deps: {
  store: VoucherAwardStore;
  chain: VoucherAwardChain;
  verify: AccountSignatureVerifier;
  now?: () => number;
}) {
  return {
    async request(value: unknown, audience: string): Promise<VoucherAwardResponse> {
      let proof;
      try {
        proof = parseVoucherAwardRequest(
          value,
          deps.now?.() ?? Math.floor(Date.now() / 1000),
          audience
        );
      } catch {
        throw new VoucherAwardError("invalid_request");
      }
      if (
        !(await deps.verify({
          chainId: 100,
          address: proof.actor,
          message: buildVoucherAwardMessage(proof),
          signature: proof.signature,
        }))
      )
        throw new VoucherAwardError("signature_invalid", 401);
      const command = proof.command;
      if (command.action === "received") {
        const records = deps.store.received(proof.actor);
        return { ok: true, records, limit: 200, partial: records.length === 200 };
      }
      const reserve = command.action === "prepare" ? command.award.reserve : command.reserve;
      if (!(await deps.chain.canPrepare(reserve, proof.actor)))
        throw new VoucherAwardError("not_authorized", 403);
      if (command.action === "list") {
        const records = deps.store.list(reserve);
        return { ok: true, records, limit: 200, partial: records.length === 200 };
      }
      const awardId = command.action === "prepare" ? command.award.awardId : command.awardId;
      const existing = deps.store.get(reserve, awardId);
      if (command.action === "prepare") {
        if (existing) {
          if (JSON.stringify(existing.award) !== JSON.stringify(command.award))
            throw new VoucherAwardError("award_conflict", 409);
          return { ok: true, record: existing };
        }
        const safe = await deps.chain.prepare(command.award);
        const at = new Date((deps.now?.() ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
        return {
          ok: true,
          record: deps.store.claim({
            version: 1,
            award: command.award,
            safe,
            state: "awaiting_authorization",
            transactionHash: null,
            failure: null,
            createdBy: proof.actor,
            createdAt: at,
            updatedAt: at,
            revision: 0,
          }),
        };
      }
      if (!existing) throw new VoucherAwardError("not_found", 404);
      if (existing.state === "confirmed") return { ok: true, record: existing };
      if (command.action === "read") {
        if (
          (existing.state === "awaiting_authorization" ||
            existing.failure === "transaction_reverted") &&
          !(await deps.chain.nonceMatches(existing))
        ) {
          return {
            ok: true,
            record: deps.store.update(
              {
                ...existing,
                state: "needs_reconciliation",
                failure: "safe_nonce_changed",
                updatedAt: new Date(
                  (deps.now?.() ?? Math.floor(Date.now() / 1000)) * 1000
                ).toISOString(),
              },
              existing.revision
            ),
          };
        }
        return { ok: true, record: existing };
      }
      const outcome = await deps.chain.reconcile(existing, command.transactionHash);
      if (
        existing.state === "submitted" &&
        existing.transactionHash !== outcome.transactionHash &&
        outcome.status !== "confirmed" &&
        outcome.status !== "safe_execution_failed"
      )
        throw new VoucherAwardError("submission_unresolved", 409);
      const failure =
        outcome.status === "transaction_reverted" || outcome.status === "safe_execution_failed"
          ? outcome.status
          : null;
      const record = deps.store.update(
        {
          ...existing,
          state: failure ? "failed" : (outcome.status as "submitted" | "confirmed"),
          transactionHash: outcome.transactionHash,
          failure,
          updatedAt: new Date((deps.now?.() ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        },
        existing.revision
      );
      return { ok: true, record };
    },
  };
}
export type VoucherAwardService = ReturnType<typeof createVoucherAwardService>;
