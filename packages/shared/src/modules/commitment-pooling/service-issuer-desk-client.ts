import type { Address } from "../../types/domain";
import type {
  ServiceIssuerDeskCommand,
  ServiceIssuerDeskProof,
  ServiceIssuerDeskRecord,
  ServiceIssuerDeskResponse,
} from "../../public-contracts/service-issuer-desk";
import {
  decodeServiceIssuerDesk,
  encodeServiceIssuerDesk,
  parseServiceIssuerApproval,
  parseServiceIssuerDraft,
  SERVICE_ISSUER_DESK_POOLS,
  SERVICE_ISSUER_DESK_ROUTE,
  serviceIssuerDeskMessage,
} from "./service-issuer-desk-protocol";

function record(value: unknown): ServiceIssuerDeskRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid desk response");
  const r = value as ServiceIssuerDeskRecord;
  const draft = parseServiceIssuerDraft(r.draft);
  const pool = SERVICE_ISSUER_DESK_POOLS.find(
    (p) => p.routeId === r.context?.routeId && p.poolId === r.context?.poolId
  );
  if (
    !pool ||
    r.context.chainId !== 100 ||
    r.context.sourceChainId !== pool.sourceChainId ||
    r.context.garden.toLowerCase() !== pool.garden.toLowerCase() ||
    draft.sourceChainId !== pool.sourceChainId ||
    draft.terms.exchangePool?.id !== pool.poolId ||
    draft.terms.exchangePool.address.toLowerCase() !== pool.deployment.address.toLowerCase() ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 0 ||
    !/^0x[a-f\d]{40}$/i.test(r.createdBy) ||
    !Number.isFinite(Date.parse(r.updatedAt)) ||
    (r.declinedAt !== null && (typeof r.declinedAt !== "bigint" || r.declinedAt <= 0n))
  )
    throw new Error("Invalid desk response");
  if (r.approval !== null) parseServiceIssuerApproval(r.approval);
  return r;
}
export function createServiceIssuerDeskClient(input: {
  account: Address;
  sign(message: string): Promise<`0x${string}`>;
  assertCurrent(): void;
  fetch?: typeof fetch;
  baseUrl?: string;
  audience?: string;
  now?: () => number;
}) {
  const reads = new Map<string, { proof: ServiceIssuerDeskProof; signature: `0x${string}` }>();
  return {
    async request(command: ServiceIssuerDeskCommand): Promise<ServiceIssuerDeskResponse> {
      input.assertCurrent();
      if (typeof navigator !== "undefined" && !navigator.onLine)
        throw new Error("Desk connection unavailable");
      let proof: ServiceIssuerDeskProof = {
        version: 1,
        chainId: 100,
        actor: input.account,
        issuedAt: Math.floor((input.now?.() ?? Date.now()) / 1000),
        audience: input.audience ?? window.location.origin,
        command: encodeServiceIssuerDesk(command),
      };
      const readOnly = command.action === "list" || command.action === "read";
      const cached = readOnly ? reads.get(proof.command) : undefined;
      const age = cached ? proof.issuedAt - cached.proof.issuedAt : Infinity;
      let signature: `0x${string}`;
      if (cached && age >= 0 && age < 60) {
        proof = cached.proof;
        signature = cached.signature;
      } else {
        signature = await input.sign(serviceIssuerDeskMessage(proof));
        input.assertCurrent();
        if (readOnly) {
          if (reads.size >= 5) reads.clear();
          reads.set(proof.command, { proof, signature });
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
          `${base.replace(/\/$/, "")}${SERVICE_ISSUER_DESK_ROUTE}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...proof, signature }),
            signal: controller.signal,
          }
        );
        const body = (await response.json()) as {
          ok?: unknown;
          payload?: unknown;
          errorCode?: unknown;
        };
        input.assertCurrent();
        if (!response.ok || body.ok !== true)
          throw new Error(typeof body.errorCode === "string" ? body.errorCode : "desk_unavailable");
        if (typeof body.payload !== "string") throw new Error("Invalid desk response");
        const result = decodeServiceIssuerDesk(body.payload) as ServiceIssuerDeskResponse;
        if (!result || result.ok !== true) throw new Error("Invalid desk response");
        if (command.action === "list") {
          if (!Array.isArray(result.records) || result.records.length > 200)
            throw new Error("Invalid desk response");
          const records = result.records.map(record);
          if (
            records.some((r) =>
              command.selection
                ? r.context.routeId !== command.selection.routeId ||
                  r.context.poolId !== command.selection.poolId
                : r.draft.member.toLowerCase() !== input.account.toLowerCase() ||
                  r.draft.sentAt === null
            )
          )
            throw new Error("Desk response scope changed");
          return { ok: true, records, partial: records.length === 200 };
        }
        const r = record(result.record);
        if (r.draft.id !== (command.action === "save" ? command.draft.id : command.id))
          throw new Error("Desk response scope changed");
        return { ok: true, record: r };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
