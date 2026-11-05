import { timingSafeEqual } from "node:crypto";
import type { Address } from "@green-goods/shared/public-contracts";
import type { GardenJoinRequestCountGrant } from "@green-goods/shared/public-contracts/join-requests";
import {
  GARDEN_JOIN_REQUEST_RETENTION_MS,
  type GardenJoinRequestCipher,
} from "./garden-join-requests";

// As long as a request can wait unanswered. Using a grant never extends it; only a signed queue
// read issues a new one, so each browser proves the steward is present at least this often.
const COUNT_GRANT_LIFETIME_SECONDS = GARDEN_JOIN_REQUEST_RETENTION_MS / 1000;

/** Whose read a grant carries. The role is left out: the chain answers that on every read. */
type GardenJoinRequestCountGrantSubject = {
  chainId: number;
  gardenAddress: Address;
  accountAddress: Address;
};

export type GardenJoinRequestCountGrants = {
  issue(subject: GardenJoinRequestCountGrantSubject, nowMs: number): GardenJoinRequestCountGrant;
  verify(token: string | null, nowMs: number): GardenJoinRequestCountGrantSubject | undefined;
};

type CountGrantPayload = GardenJoinRequestCountGrantSubject & { version: 1; expiresAt: number };

/**
 * Tokens that let a steward's browser read one garden's waiting total without a signature. Each is
 * signed with the join-request key under its own label, so rotating that key ends every grant, and
 * no server state is kept. A stolen token reveals that one number, for as long as the account that
 * earned it keeps its role.
 */
export function createGardenJoinRequestCountGrants(
  cipher: Pick<GardenJoinRequestCipher, "countGrantKey">
): GardenJoinRequestCountGrants {
  return {
    issue(subject, nowMs) {
      const expiresAt = Math.floor(nowMs / 1000) + COUNT_GRANT_LIFETIME_SECONDS;
      const payload = Buffer.from(
        JSON.stringify({ version: 1, ...subject, expiresAt } satisfies CountGrantPayload)
      ).toString("base64url");
      return { token: `${payload}.${cipher.countGrantKey(payload)}`, expiresAt };
    },
    verify(token, nowMs) {
      const [payload, signature, extra] = token?.split(".") ?? [];
      if (!payload || !signature || extra !== undefined) return undefined;
      const supplied = Buffer.from(signature);
      const expected = Buffer.from(cipher.countGrantKey(payload));
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return undefined;
      }
      const grant = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8")
      ) as CountGrantPayload;
      if (grant.version !== 1 || grant.expiresAt <= Math.floor(nowMs / 1000)) return undefined;
      return {
        chainId: grant.chainId,
        gardenAddress: grant.gardenAddress,
        accountAddress: grant.accountAddress,
      };
    },
  };
}
