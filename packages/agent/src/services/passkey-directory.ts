/**
 * Passkey directory
 *
 * Issues every Green Goods passkey under one domain and remembers which name owns which
 * passkey, so an account created on one Green Goods site signs in on the others. It replaces
 * the hosted passkey server for new accounts: that server ties each passkey to the exact site
 * it was created on.
 *
 * The directory holds names and public keys only. It never sees a private key, and a wrong
 * entry cannot move an account: the account address follows the passkey's own key.
 */

import {
  isRegistrablePasskeyName,
  normalizePasskeyName,
  PASSKEY_NAME_MAX_LENGTH,
  PASSKEY_NAME_MIN_LENGTH,
  type PasskeyDirectoryCredential,
} from "@green-goods/shared/public-contracts";
import {
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { cose } from "@simplewebauthn/server/helpers";
import type {
  PasskeyInsertResult,
  PendingPasskeyRegistration,
  StoredPasskey,
} from "./db/passkey-directory";
import { loggers } from "./logger";
import {
  readRegistrationChallenge,
  toRegistrationResponse,
  uncompressedP256PublicKey,
} from "./passkey-directory-registration";

const log = loggers.api;

/** Long enough for a person to read the device prompt, short enough to bound stale sign-ups. */
const REGISTRATION_TTL_MS = 5 * 60 * 1000;
/** The smart account's passkey validator checks P-256 signatures, so no other key type is usable. */
const SUPPORTED_ALGORITHMS = [cose.COSEALG.ES256];

export type PasskeyRelyingParty = {
  /** The domain every passkey is issued under, for example `greengoods.app`. */
  id: string;
  /** The name a device shows beside the passkey. */
  name: string;
};

export type PasskeyDirectoryStore = {
  findByName(userName: string): Promise<StoredPasskey | undefined>;
  insert(passkey: StoredPasskey): Promise<PasskeyInsertResult>;
  /** Remember a started sign-up, and drop the ones that expired before `now`. */
  saveChallenge(pending: PendingPasskeyRegistration, now: number): Promise<void>;
  /** Hand out a pending registration once; expired or unknown challenges return nothing. */
  takeChallenge(challenge: string, now: number): Promise<PendingPasskeyRegistration | undefined>;
};

/** Whether the hosted passkey server that predates this directory already holds a name. */
export type HostedPasskeyNameCheck = (userName: string) => Promise<boolean>;

export type PasskeyDirectoryErrorCode =
  | "invalid_name"
  | "name_taken"
  | "origin_not_allowed"
  | "registration_expired"
  | "verification_failed"
  | "unavailable";

const ERROR_MESSAGES: Record<PasskeyDirectoryErrorCode, string> = {
  invalid_name: `Names need ${PASSKEY_NAME_MIN_LENGTH} to ${PASSKEY_NAME_MAX_LENGTH} characters.`,
  name_taken: "That name is already registered.",
  origin_not_allowed: "Passkeys are not available from this origin.",
  registration_expired: "Passkey verification expired. Start again.",
  verification_failed: "Passkey verification failed.",
  unavailable: "Passkey sign-up is unavailable right now.",
};

/** A refusal the caller may show as is: the message carries no internal detail. */
export class PasskeyDirectoryError extends Error {
  constructor(readonly code: PasskeyDirectoryErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "PasskeyDirectoryError";
  }
}

export type VerifiedPasskeyRegistration = {
  success: true;
  id: string;
  publicKey: `0x${string}`;
  userName: string;
};

export type PasskeyDirectory = {
  startRegistration(input: {
    userName: unknown;
    origin: string;
  }): Promise<PublicKeyCredentialCreationOptionsJSON>;
  verifyRegistration(input: {
    response: unknown;
    userName: unknown;
    origin: string;
  }): Promise<VerifiedPasskeyRegistration>;
  getCredentials(input: { userName: unknown }): Promise<PasskeyDirectoryCredential[]>;
};

export type PasskeyDirectoryDeps = {
  store: PasskeyDirectoryStore;
  relyingParty: PasskeyRelyingParty;
  /** Omit only where no hosted list exists, as in local development. */
  hostedNameTaken?: HostedPasskeyNameCheck;
  /** Lets `localhost` pages register passkeys under `localhost`. Never set in production. */
  allowLocalDevelopment?: boolean;
  now?: () => number;
};

/**
 * The domain a page may register a passkey under: the directory's own domain for that domain
 * and its subdomains over HTTPS, `localhost` in local development, and nothing for any other
 * origin. A browser enforces the same rule, so an unlisted origin could not use the passkey.
 */
function passkeyDomainForOrigin(
  origin: string,
  relyingPartyId: string,
  allowLocalDevelopment = false
): string | undefined {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  const domain = relyingPartyId.toLowerCase();
  if (url.protocol === "https:" && (host === domain || host.endsWith(`.${domain}`))) return domain;
  if (allowLocalDevelopment && host === "localhost") return host;
  return undefined;
}

export function createPasskeyDirectory(deps: PasskeyDirectoryDeps): PasskeyDirectory {
  const now = deps.now ?? Date.now;

  const requireDomain = (origin: string): string => {
    const domain = passkeyDomainForOrigin(
      origin,
      deps.relyingParty.id,
      deps.allowLocalDevelopment === true
    );
    if (!domain) throw new PasskeyDirectoryError("origin_not_allowed");
    return domain;
  };

  const assertNameFree = async (userName: string): Promise<void> => {
    if (await deps.store.findByName(userName)) throw new PasskeyDirectoryError("name_taken");
    if (!deps.hostedNameTaken) return;
    let heldOnHostedServer: boolean;
    try {
      heldOnHostedServer = await deps.hostedNameTaken(userName);
    } catch (err) {
      // Without the hosted list a name someone already owns could be handed out twice.
      log.warn({ err }, "Hosted passkey name check failed; refusing the registration");
      throw new PasskeyDirectoryError("unavailable");
    }
    if (heldOnHostedServer) throw new PasskeyDirectoryError("name_taken");
  };

  return {
    async startRegistration(input) {
      const userName = requireName(input.userName);
      const rpId = requireDomain(input.origin);
      await assertNameFree(userName);

      const options = await generateRegistrationOptions({
        rpName: deps.relyingParty.name,
        rpID: rpId,
        userName,
        userDisplayName: userName,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          // Every later sign-in and signature requires user verification, so the passkey must
          // support it from the start.
          userVerification: "required",
          authenticatorAttachment: "platform",
        },
        supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
      });
      const startedAt = now();
      await deps.store.saveChallenge(
        {
          challenge: options.challenge,
          userName,
          rpId,
          origin: input.origin,
          expiresAt: startedAt + REGISTRATION_TTL_MS,
        },
        startedAt
      );
      return options;
    },

    async verifyRegistration(input) {
      const userName = requireName(input.userName);
      const response = toRegistrationResponse(input.response);
      const challenge = response ? readRegistrationChallenge(response) : undefined;
      if (!response || !challenge) throw new PasskeyDirectoryError("verification_failed");

      // The challenge is spent whether or not the rest succeeds: one sign-up, one attempt.
      const pending = await deps.store.takeChallenge(challenge, now());
      if (!pending || pending.userName !== userName || pending.origin !== input.origin) {
        throw new PasskeyDirectoryError("registration_expired");
      }

      let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
      try {
        verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: pending.challenge,
          expectedOrigin: pending.origin,
          expectedRPID: pending.rpId,
          requireUserVerification: true,
          supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
        });
      } catch (err) {
        log.warn({ err, rpId: pending.rpId }, "Passkey registration failed verification");
        throw new PasskeyDirectoryError("verification_failed");
      }
      if (!verification.verified) throw new PasskeyDirectoryError("verification_failed");

      const { credential } = verification.registrationInfo;
      const publicKey = uncompressedP256PublicKey(credential.publicKey);
      if (!publicKey) throw new PasskeyDirectoryError("verification_failed");

      const result = await deps.store.insert({
        userName,
        credentialId: credential.id,
        publicKey,
        rpId: pending.rpId,
        origin: pending.origin,
        createdAt: new Date(now()).toISOString(),
      });
      if (!result.ok) {
        throw new PasskeyDirectoryError(
          result.reason === "name_taken" ? "name_taken" : "verification_failed"
        );
      }
      // The site and domain only: a name is a person's, and stays out of the log.
      log.info({ rpId: pending.rpId, origin: pending.origin }, "Passkey registered");
      return { success: true, id: credential.id, publicKey, userName };
    },

    async getCredentials(input) {
      const userName = readName(input.userName);
      if (!userName) return [];
      const stored = await deps.store.findByName(userName);
      if (!stored) return [];
      return [{ id: stored.credentialId, publicKey: stored.publicKey, rpId: stored.rpId }];
    },
  };
}

function readName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const userName = normalizePasskeyName(value);
  return isRegistrablePasskeyName(userName) ? userName : undefined;
}

function requireName(value: unknown): string {
  const userName = readName(value);
  if (!userName) throw new PasskeyDirectoryError("invalid_name");
  return userName;
}
