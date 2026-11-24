import {
  buildVoucherAwardMessage,
  parseVoucherAwardInput,
  VOUCHER_AWARDS_ROUTE,
  type VoucherAwardCommand,
  type VoucherAwardProof,
  type VoucherAwardRecord,
  type VoucherAwardResponse,
} from "../../public-contracts/voucher-awards";
import type { Address } from "../../types/domain";
import { assertVoucherAwardSafe } from "./voucher-award-safe";

function parseRecord(value: unknown): VoucherAwardRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid award response");
  const record = value as VoucherAwardRecord;
  if (
    record.version !== 1 ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    ![
      "awaiting_authorization",
      "submitted",
      "confirmed",
      "failed",
      "needs_reconciliation",
    ].includes(record.state) ||
    ![null, "transaction_reverted", "safe_execution_failed", "safe_nonce_changed"].includes(
      record.failure
    ) ||
    !/^0x[a-f\d]{40}$/i.test(record.createdBy) ||
    !Number.isFinite(Date.parse(record.createdAt)) ||
    !Number.isFinite(Date.parse(record.updatedAt)) ||
    (record.transactionHash !== null && !/^0x[a-f\d]{64}$/i.test(record.transactionHash)) ||
    (record.state === "confirmed" && (!record.transactionHash || record.failure !== null))
  )
    throw new Error("Invalid award response");
  parseVoucherAwardInput(record.award);
  assertVoucherAwardSafe(record);
  return record;
}
export function createVoucherAwardClient(input: {
  account: Address;
  sign: (message: string) => Promise<`0x${string}`>;
  assertCurrent: () => void;
  fetch?: typeof fetch;
  baseUrl?: string;
  audience?: string;
  now?: () => number;
}) {
  const readProofs = new Map<string, { proof: VoucherAwardProof; signature: `0x${string}` }>();
  return {
    async request(command: VoucherAwardCommand): Promise<VoucherAwardResponse> {
      input.assertCurrent();
      if (typeof navigator !== "undefined" && !navigator.onLine)
        throw new Error("Award connection unavailable");
      let proof: VoucherAwardProof = {
        version: 1,
        chainId: 100,
        actor: input.account as VoucherAwardProof["actor"],
        issuedAt: Math.floor((input.now?.() ?? Date.now()) / 1000),
        audience: input.audience ?? window.location.origin,
        command: structuredClone(command),
      };
      const readOnly = ["read", "list", "received"].includes(command.action);
      const cacheKey = buildVoucherAwardMessage({ ...proof, issuedAt: 0 });
      const cached = readOnly ? readProofs.get(cacheKey) : undefined;
      const age = cached ? proof.issuedAt - cached.proof.issuedAt : Infinity;
      let signature: `0x${string}`;
      if (cached && age >= 0 && age < 60) {
        proof = cached.proof;
        signature = cached.signature;
      } else {
        signature = await input.sign(buildVoucherAwardMessage(proof));
        input.assertCurrent();
        if (readOnly) {
          if (readProofs.size >= 5) readProofs.clear();
          readProofs.set(cacheKey, { proof, signature });
        }
      }
      input.assertCurrent();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const base =
          input.baseUrl ??
          import.meta.env.VITE_API_BASE_URL ??
          (import.meta.env.DEV ? "http://localhost:3000" : "https://agent.greengoods.app");
        const response = await (input.fetch ?? fetch)(
          `${base.replace(/\/$/, "")}${VOUCHER_AWARDS_ROUTE}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...proof, signature }),
            signal: controller.signal,
          }
        );
        const body = (await response.json()) as {
          ok?: unknown;
          errorCode?: unknown;
          record?: unknown;
          records?: unknown;
          limit?: unknown;
        };
        input.assertCurrent();
        if (!response.ok || body.ok !== true)
          throw new Error(
            typeof body.errorCode === "string" ? body.errorCode : "award_request_failed"
          );
        if (command.action === "list" || command.action === "received") {
          if (!Array.isArray(body.records) || body.records.length > 200 || body.limit !== 200)
            throw new Error("Invalid award response");
          const records = body.records.map(parseRecord);
          if (
            records.some((r) =>
              command.action === "received"
                ? r.award.recipient.toLowerCase() !== input.account.toLowerCase() ||
                  r.state !== "confirmed"
                : r.award.reserve.toLowerCase() !== command.reserve.toLowerCase()
            )
          )
            throw new Error("Award response scope changed");
          return { ok: true, records, limit: 200, partial: records.length === 200 };
        }
        const record = parseRecord(body.record);
        const expected = command.action === "prepare" ? command.award : command;
        if (
          record.award.reserve.toLowerCase() !== expected.reserve.toLowerCase() ||
          record.award.awardId !== expected.awardId
        )
          throw new Error("Award response scope changed");
        if (
          command.action === "prepare" &&
          JSON.stringify(parseVoucherAwardInput(command.award)) !== JSON.stringify(record.award)
        )
          throw new Error("Award response terms changed");
        return { ok: true, record };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
export type VoucherAwardClient = ReturnType<typeof createVoucherAwardClient>;
