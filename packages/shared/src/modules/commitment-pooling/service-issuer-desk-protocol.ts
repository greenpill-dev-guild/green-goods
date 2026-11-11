import type { Address } from "../../types/domain";
import type {
  ServiceIssuerDeskCommand,
  ServiceIssuerDeskProof,
  ServiceIssuerDeskRequest,
  ServiceIssuerDraft,
  ServiceIssuerSignedApproval,
} from "../../public-contracts/service-issuer-desk";
import {
  issuerDeserialize,
  issuerSerialize,
  SERVICE_ISSUER_ROUTES,
} from "./service-issuer-metadata";

export const SERVICE_ISSUER_DESK_ROUTE = "/public/service-issuer-desk";
export const SERVICE_ISSUER_DESK_POOLS = SERVICE_ISSUER_ROUTES.flatMap((route) =>
  route.pools.map((pool) => ({
    routeId: route.service.id,
    poolId: pool.id,
    chainId: 100 as const,
    sourceChainId: route.service.sourceChainId,
    garden: pool.garden,
    name: pool.name,
    deployment: pool.deployment,
  }))
);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid desk object");
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, fields: readonly string[]) => {
  if (Object.keys(value).length !== fields.length || fields.some((field) => !(field in value)))
    throw new Error("Invalid desk fields");
};
const text = (value: unknown, limit = 240, allowLineBreaks = false): string => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > limit ||
    [...value].some((c) => c.charCodeAt(0) < 32 && !(allowLineBreaks && (c === "\n" || c === "\r")))
  )
    throw new Error("Invalid desk text");
  return value;
};
const address = (value: unknown): Address => {
  if (typeof value !== "string" || !/^0x(?!0{40}$)[a-f\d]{40}$/i.test(value))
    throw new Error("Invalid desk account");
  return value.toLowerCase() as Address;
};
const id = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,95}$/.test(value))
    throw new Error("Invalid draft ID");
  return value;
};
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max)
    throw new Error("Invalid desk integer");
  return value as number;
};
const uint = (value: unknown, min = 0n): bigint => {
  if (typeof value !== "bigint" || value < min || value >= (1n << 256n) - 1n)
    throw new Error("Invalid desk amount");
  return value;
};
const hash = (value: unknown): `0x${string}` => {
  if (typeof value !== "string" || !/^0x(?!0{64}$)[a-f\d]{64}$/i.test(value))
    throw new Error("Invalid terms digest");
  return value.toLowerCase() as `0x${string}`;
};
const selection = (value: unknown) => {
  const s = object(value);
  exact(s, ["routeId", "poolId"]);
  return { routeId: id(s.routeId), poolId: id(s.poolId) };
};
export function parseServiceIssuerDraft(value: unknown): ServiceIssuerDraft {
  const d = object(value);
  exact(d, [
    "version",
    "id",
    "member",
    "memberName",
    "preparedBy",
    "garden",
    "sourceChainId",
    "sentAt",
    "terms",
    "changed",
  ]);
  if (d.version !== 1 || !Array.isArray(d.changed) || d.changed.length > 20)
    throw new Error("Invalid draft");
  const t = object(d.terms);
  exact(t, [
    "revision",
    "service",
    "token",
    "capacity",
    "issue",
    "rewardAllowance",
    "poolHoldingCap",
    "priceIndex",
    "poolFee",
    "exchangePool",
    "replyBusinessDays",
    "acceptanceDays",
    "document",
  ]);
  const service = object(t.service);
  exact(service, ["title", "buys", "scope", "remedy", "unit"]);
  const token = object(t.token);
  exact(token, ["name", "symbol", "decimals"]);
  if (
    typeof token.name !== "string" ||
    token.name.trim() !== token.name ||
    typeof service.unit !== "string" ||
    service.unit.trim() !== service.unit
  )
    throw new Error("Deployment text must not contain surrounding whitespace");
  const capacity = object(t.capacity);
  exact(capacity, ["units", "weeks"]);
  const issue = object(t.issue);
  exact(issue, ["total", "pool"]);
  const pool = object(t.exchangePool);
  exact(pool, ["chainId", "id", "address"]);
  const document = object(t.document);
  exact(document, ["reference", "digest"]);
  let documentUrl: URL;
  try {
    documentUrl = new URL(text(document.reference, 500));
  } catch {
    throw new Error("Invalid draft references");
  }
  if (
    pool.chainId !== 100 ||
    documentUrl.protocol !== "https:" ||
    documentUrl.username ||
    documentUrl.password ||
    token.decimals !== 6 ||
    typeof token.symbol !== "string" ||
    !/^[A-Z][A-Z0-9]{1,11}$/.test(token.symbol)
  )
    throw new Error("Invalid draft references");
  const changed = d.changed.map((key) => {
    if (
      typeof key !== "string" ||
      !Object.keys(t).includes(key) ||
      ["revision", "token"].includes(key)
    )
      throw new Error("Invalid changed setting");
    return key as ServiceIssuerDraft["changed"][number];
  });
  const terms = {
    revision: integer(t.revision, 1),
    service: {
      title: text(service.title, 120),
      buys: text(service.buys, 2000, true),
      scope: text(service.scope, 2000, true),
      remedy: text(service.remedy, 2000, true),
      unit: text(service.unit, 80),
    },
    token: {
      name: text(token.name, 120),
      symbol: text(token.symbol, 24),
      decimals: integer(token.decimals, 0, 255),
    },
    capacity: { units: uint(capacity.units, 1n), weeks: integer(capacity.weeks, 1) },
    issue: { total: uint(issue.total, 1n), pool: uint(issue.pool, 1n) },
    rewardAllowance: uint(t.rewardAllowance),
    poolHoldingCap: uint(t.poolHoldingCap, 1n),
    priceIndex: uint(t.priceIndex, 1n),
    poolFee: uint(t.poolFee),
    exchangePool: { chainId: 100 as const, id: id(pool.id), address: address(pool.address) },
    replyBusinessDays: integer(t.replyBusinessDays, 1),
    acceptanceDays: integer(t.acceptanceDays, 1),
    document: { reference: text(document.reference, 500), digest: hash(document.digest) },
  };
  if (
    terms.issue.pool > terms.issue.total ||
    terms.issue.total > terms.capacity.units ||
    terms.issue.pool > terms.poolHoldingCap ||
    terms.poolFee > 1_000_000n
  )
    throw new Error("Draft issuance exceeds reviewed capacity");
  return {
    version: 1,
    id: id(d.id),
    member: address(d.member),
    memberName: text(d.memberName, 120),
    preparedBy: text(d.preparedBy, 120),
    garden: text(d.garden, 120),
    sourceChainId: integer(d.sourceChainId, 1),
    sentAt: d.sentAt === null ? null : uint(d.sentAt, 1n),
    terms,
    changed,
  };
}
export function parseServiceIssuerApproval(value: unknown): ServiceIssuerSignedApproval {
  const a = object(value);
  exact(a, [
    "version",
    "draftId",
    "revision",
    "member",
    "service",
    "termsDigest",
    "signedAt",
    "signature",
  ]);
  if (
    a.version !== 1 ||
    typeof a.signature !== "string" ||
    !/^0x(?:[a-f\d]{2}){1,8192}$/i.test(a.signature)
  )
    throw new Error("Invalid member approval");
  return {
    version: 1,
    draftId: id(a.draftId),
    revision: integer(a.revision, 1),
    member: address(a.member),
    service: text(a.service, 120),
    termsDigest: hash(a.termsDigest),
    signedAt: uint(a.signedAt, 1n),
    signature: a.signature as `0x${string}`,
  };
}
export function parseServiceIssuerDeskCommand(encoded: string): ServiceIssuerDeskCommand {
  const c = object(issuerDeserialize(encoded));
  if (c.action === "list") {
    exact(c, ["action", "selection"]);
    return { action: "list", selection: c.selection === null ? null : selection(c.selection) };
  }
  if (c.action === "read") {
    exact(c, ["action", "id"]);
    return { action: "read", id: id(c.id) };
  }
  if (c.action === "save") {
    exact(c, ["action", "selection", "draft", "expectedRevision"]);
    return {
      action: "save",
      selection: selection(c.selection),
      draft: parseServiceIssuerDraft(c.draft),
      expectedRevision: c.expectedRevision === null ? null : integer(c.expectedRevision),
    };
  }
  if (c.action === "send" || c.action === "decline") {
    exact(c, ["action", "id", "expectedRevision"]);
    return { action: c.action, id: id(c.id), expectedRevision: integer(c.expectedRevision) };
  }
  if (c.action === "approve") {
    exact(c, ["action", "id", "expectedRevision", "approval"]);
    return {
      action: "approve",
      id: id(c.id),
      expectedRevision: integer(c.expectedRevision),
      approval: parseServiceIssuerApproval(c.approval),
    };
  }
  throw new Error("Unknown desk action");
}
export function parseServiceIssuerDeskRequest(
  value: unknown,
  now: number,
  audience: string
): ServiceIssuerDeskRequest {
  const r = object(value);
  exact(r, ["version", "chainId", "actor", "issuedAt", "audience", "command", "signature"]);
  if (
    r.version !== 1 ||
    r.chainId !== 100 ||
    !Number.isSafeInteger(r.issuedAt) ||
    (r.issuedAt as number) > now + 30 ||
    now - (r.issuedAt as number) > 300 ||
    r.audience !== audience ||
    !/^https?:\/\//.test(audience) ||
    typeof r.command !== "string" ||
    r.command.length > 48_000 ||
    typeof r.signature !== "string" ||
    !/^0x(?:[a-f\d]{2}){1,8192}$/i.test(r.signature)
  )
    throw new Error("Invalid desk proof");
  return {
    version: 1,
    chainId: 100,
    actor: address(r.actor),
    issuedAt: r.issuedAt as number,
    audience,
    command: r.command,
    signature: r.signature as `0x${string}`,
  };
}
export function serviceIssuerDeskMessage(proof: ServiceIssuerDeskProof): string {
  const { signature: _, ...parsed } = parseServiceIssuerDeskRequest(
    { ...proof, signature: "0x00" },
    proof.issuedAt,
    proof.audience
  );
  return `Green Goods service issuer desk\n${JSON.stringify(parsed)}`;
}
export { issuerSerialize as encodeServiceIssuerDesk, issuerDeserialize as decodeServiceIssuerDesk };
