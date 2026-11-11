import { hashTypedData, type Hex } from "viem";
import type { Address } from "@green-goods/shared/types";
import type {
  ServiceIssuerDeskContext,
  ServiceIssuerDeskRecord,
  ServiceIssuerDeskResponse,
  ServiceIssuerDeskSelection,
} from "@green-goods/shared/public-contracts/service-issuer-desk";
import {
  encodeServiceIssuerDesk,
  parseServiceIssuerDeskCommand,
  parseServiceIssuerDeskRequest,
  SERVICE_ISSUER_DESK_POOLS,
  serviceIssuerDeskMessage,
} from "@green-goods/shared/modules/commitment-pooling/service-issuer-desk-protocol";
import {
  serviceIssuerApprovalTypedData,
  serviceIssuerDraftApproval,
  serviceIssuerTermsDigest,
} from "@green-goods/shared/modules/commitment-pooling/service-issuer-approval-terms";
import type { AccountSignatureVerifier } from "./account-signatures";
import type { ServiceIssuerDeskStore } from "./db/service-issuer-desk";

export class ServiceIssuerDeskError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400
  ) {
    super(code);
  }
}
export interface ServiceIssuerDeskAuthority {
  context(selection: ServiceIssuerDeskSelection): ServiceIssuerDeskContext;
  canManage(selection: ServiceIssuerDeskSelection, actor: Address): Promise<boolean>;
}
export function serviceIssuerDeskContext(
  selection: ServiceIssuerDeskSelection
): ServiceIssuerDeskContext {
  const pool = SERVICE_ISSUER_DESK_POOLS.find(
    (p) => p.routeId === selection.routeId && p.poolId === selection.poolId
  );
  if (!pool) throw new ServiceIssuerDeskError("pool_unavailable", 403);
  return {
    routeId: pool.routeId,
    poolId: pool.poolId,
    chainId: 100,
    sourceChainId: pool.sourceChainId,
    garden: pool.garden.toLowerCase() as Address,
  };
}
export function createServiceIssuerDeskService(deps: {
  store: ServiceIssuerDeskStore;
  authority: ServiceIssuerDeskAuthority;
  verify: AccountSignatureVerifier;
  verifyApproval(input: {
    chainId: 100;
    address: Address;
    hash: Hex;
    signature: Hex;
  }): Promise<boolean>;
  now?: () => number;
}) {
  const now = () => deps.now?.() ?? Math.floor(Date.now() / 1000);
  const manage = async (selection: ServiceIssuerDeskSelection, actor: Address) => {
    if (!(await deps.authority.canManage(selection, actor)))
      throw new ServiceIssuerDeskError("not_authorized", 403);
  };
  return {
    async request(value: unknown, audience: string): Promise<ServiceIssuerDeskResponse> {
      let proof;
      let command;
      try {
        proof = parseServiceIssuerDeskRequest(value, now(), audience);
        command = parseServiceIssuerDeskCommand(proof.command);
      } catch {
        throw new ServiceIssuerDeskError("invalid_request");
      }
      if (
        !(await deps.verify({
          chainId: 100,
          address: proof.actor,
          message: serviceIssuerDeskMessage(proof),
          signature: proof.signature,
        }))
      )
        throw new ServiceIssuerDeskError("signature_invalid", 401);
      if (command.action === "list") {
        if (command.selection) await manage(command.selection, proof.actor);
        const records = deps.store.list(command.selection, proof.actor);
        return { ok: true, records, partial: records.length === 200 };
      }
      const existing = deps.store.get(command.action === "save" ? command.draft.id : command.id);
      if (command.action === "save") {
        await manage(command.selection, proof.actor);
        const context = deps.authority.context(command.selection);
        const configured = SERVICE_ISSUER_DESK_POOLS.find(
          (p) => p.routeId === context.routeId && p.poolId === context.poolId
        );
        if (
          existing &&
          existing.draft.sentAt === null &&
          command.draft.sentAt === null &&
          (command.expectedRevision === existing.revision - 1 ||
            (command.expectedRevision === null && existing.revision === 0)) &&
          encodeServiceIssuerDesk(existing.context) === encodeServiceIssuerDesk(context) &&
          existing.draft.memberName === command.draft.memberName &&
          serviceIssuerTermsDigest(existing.draft) === serviceIssuerTermsDigest(command.draft)
        )
          return { ok: true, record: existing };
        // The authority supplies the canonical pool address, never the draft's display labels.
        if (
          !configured ||
          command.draft.sourceChainId !== context.sourceChainId ||
          command.draft.terms.exchangePool?.id !== context.poolId ||
          command.draft.terms.exchangePool.address.toLowerCase() !==
            configured.deployment.address.toLowerCase() ||
          command.draft.sentAt !== null ||
          command.draft.terms.revision !== (existing?.draft.terms.revision ?? 0) + 1
        )
          throw new ServiceIssuerDeskError("draft_context_changed", 409);
        if (
          existing &&
          encodeServiceIssuerDesk(existing.context) !== encodeServiceIssuerDesk(context)
        )
          throw new ServiceIssuerDeskError("draft_context_changed", 409);
        const changed = existing
          ? (Object.keys(command.draft.terms).filter(
              (key) =>
                !["revision", "token"].includes(key) &&
                encodeServiceIssuerDesk(
                  command.draft.terms[key as keyof typeof command.draft.terms]
                ) !==
                  encodeServiceIssuerDesk(
                    existing.draft.terms[key as keyof typeof existing.draft.terms]
                  )
            ) as ServiceIssuerDeskRecord["draft"]["changed"])
          : [];
        const draft = {
          ...command.draft,
          preparedBy: proof.actor,
          garden: context.garden,
          changed,
        };
        return {
          ok: true,
          record: deps.store.write(
            {
              draft,
              context,
              revision: 0,
              approval: null,
              declinedAt: null,
              createdBy: existing?.createdBy ?? proof.actor,
              updatedAt: new Date(now() * 1000).toISOString(),
            },
            command.expectedRevision
          ),
        };
      }
      if (!existing) throw new ServiceIssuerDeskError("not_found", 404);
      const member = existing.draft.member.toLowerCase() === proof.actor.toLowerCase();
      if (command.action === "read") {
        if (!member || existing.draft.sentAt === null) await manage(existing.context, proof.actor);
        return { ok: true, record: existing };
      }
      if (command.action === "send") {
        await manage(existing.context, proof.actor);
        if (existing.draft.sentAt !== null) {
          if (
            command.expectedRevision === existing.revision ||
            command.expectedRevision === existing.revision - 1
          )
            return { ok: true, record: existing };
          throw new ServiceIssuerDeskError("revision_conflict", 409);
        }
        return {
          ok: true,
          record: deps.store.write(
            {
              ...existing,
              draft: { ...existing.draft, sentAt: BigInt(now()) },
              updatedAt: new Date(now() * 1000).toISOString(),
            },
            command.expectedRevision
          ),
        };
      }
      if (!member || existing.draft.sentAt === null)
        throw new ServiceIssuerDeskError("not_authorized", 403);
      if (command.action === "decline") {
        if (existing.approval !== null) throw new ServiceIssuerDeskError("already_decided", 409);
        if (
          existing.declinedAt !== null &&
          (command.expectedRevision === existing.revision ||
            command.expectedRevision === existing.revision - 1)
        )
          return { ok: true, record: existing };
        return {
          ok: true,
          record: deps.store.write(
            {
              ...existing,
              declinedAt: BigInt(now()),
              approval: null,
              updatedAt: new Date(now() * 1000).toISOString(),
            },
            command.expectedRevision
          ),
        };
      }
      const approval = command.approval;
      if (
        existing.approval &&
        encodeServiceIssuerDesk(existing.approval) === encodeServiceIssuerDesk(approval)
      )
        return { ok: true, record: existing };
      if (existing.approval !== null) throw new ServiceIssuerDeskError("already_decided", 409);
      if (
        existing.declinedAt !== null ||
        command.expectedRevision !== existing.revision ||
        serviceIssuerDraftApproval(existing.draft, approval) !== "current" ||
        approval.service !== existing.draft.terms.service.title ||
        approval.signedAt < existing.draft.sentAt ||
        approval.signedAt > BigInt(now() + 30) ||
        BigInt(now()) - approval.signedAt > 300n
      )
        throw new ServiceIssuerDeskError("approval_outdated", 409);
      const { signature, ...unsigned } = approval;
      if (
        !(await deps.verifyApproval({
          chainId: 100,
          address: existing.draft.member,
          hash: hashTypedData(serviceIssuerApprovalTypedData(unsigned)),
          signature,
        }))
      )
        throw new ServiceIssuerDeskError("approval_signature_invalid", 401);
      return {
        ok: true,
        record: deps.store.write(
          { ...existing, approval, updatedAt: new Date(now() * 1000).toISOString() },
          command.expectedRevision
        ),
      };
    },
  };
}
export type ServiceIssuerDeskService = ReturnType<typeof createServiceIssuerDeskService>;
