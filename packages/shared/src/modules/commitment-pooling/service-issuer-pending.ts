import {
  issuerDeserialize,
  issuerDigest,
  issuerSame,
  issuerSerialize,
} from "./service-issuer-metadata";
import type {
  ServiceIssuerActor,
  ServiceIssuerPending,
  ServiceIssuerReview,
} from "./service-issuer-types";

const scope = (actor: ServiceIssuerActor) =>
  `green-goods:issuer-pending:v1:100:${actor.address.toLowerCase()}`;
const active = new Set<string>();
export function issuerReviewFingerprint(
  review: Omit<ServiceIssuerReview, "fingerprint"> | ServiceIssuerReview
) {
  const { fingerprint: _, ...rest } = review as ServiceIssuerReview;
  return issuerDigest(rest);
}
export function createIssuerPendingStore(
  storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">
) {
  const read = (actor: ServiceIssuerActor) => {
    const raw = storage().getItem(scope(actor));
    if (!raw) return null;
    const p = issuerDeserialize(raw) as ServiceIssuerPending;
    const r = p?.review;
    const ref = p?.submission?.broadcastReference;
    if (
      p?.version !== 1 ||
      !r ||
      r.version !== 1 ||
      r.evidence !== "live-review" ||
      !issuerSame(p.actor.address, actor.address) ||
      !issuerSame(r.actor.address, actor.address) ||
      issuerDigest(p.actor) !== issuerDigest(r.actor) ||
      r.call.chainId !== 100 ||
      !r.call.account ||
      !issuerSame(r.call.account, actor.address) ||
      r.fingerprint !== issuerReviewFingerprint(r) ||
      (p.submission && !/^0x[a-f0-9]{64}$/i.test(p.submission.hash)) ||
      (ref &&
        (ref.chainId !== 100 ||
          !/^0x[a-f0-9]{64}$/i.test(ref.hash) ||
          !["transaction", "user-operation"].includes(ref.kind) ||
          (ref.kind === "transaction" &&
            (!ref.account || !issuerSame(ref.account, actor.address)))))
    )
      throw new Error("Stored issuer submission needs operator reconciliation");
    return p;
  };
  return {
    read,
    save: (p: ServiceIssuerPending) => storage().setItem(scope(p.actor), issuerSerialize(p)),
    clear: (p: ServiceIssuerPending) => {
      const current = read(p.actor);
      if (
        current?.review.fingerprint === p.review.fingerprint &&
        current.submission?.hash === p.submission?.hash
      )
        storage().removeItem(scope(p.actor));
    },
  };
}
/** Sending and reconciliation share one process/browser exclusion boundary and never delete a later record. */
export function withIssuerSubmissionLock<T>(
  actor: ServiceIssuerActor,
  work: () => Promise<T>
): Promise<T> {
  const run = async () => {
    const key = scope(actor);
    if (active.has(key)) throw new Error("Issuer submission already active");
    active.add(key);
    try {
      return await work();
    } finally {
      active.delete(key);
    }
  };
  if (typeof window === "undefined") return run();
  if (!navigator.locks)
    return Promise.reject(new Error("Exclusive issuer submission locking unavailable"));
  return navigator.locks.request(
    `green-goods:service:${actor.address.toLowerCase()}`,
    { ifAvailable: true },
    (lock) => {
      if (!lock) throw new Error("Service submission already active in another tab");
      return run();
    }
  );
}
