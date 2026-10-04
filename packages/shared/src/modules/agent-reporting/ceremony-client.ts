import {
  type AccessResponse,
  accessResponseSchema,
  type AttemptOutcome,
  type AttemptResponse,
  attemptResponseSchema,
  type ChallengeResponse,
  challengeResponseSchema,
  type OperationView,
  operationResponseSchema,
  outcomeResponseSchema,
  recoveryStepSchema,
  type ReportingErrorCode,
  reportingErrorSchema,
  type ResourceView,
  resourceViewSchema,
  grantResponseSchema,
  grantActivationResponseSchema,
  grantActivationSignatureResponseSchema,
  grantActivationSignatureRequestSchema,
  type GrantActivationSignatureRequest,
  type OutcomeRequest,
  type GrantView,
} from "./api-contract";

/**
 * Browser client for the reporting ceremony behind the same-origin `/api/messaging` proxy. It
 * sends the bootstrap header only when a person explicitly opens a link, keeps CSRF tokens in
 * memory (never in storage), and validates every response against the shared contract, so a
 * malformed or hostile response becomes a typed error instead of reaching the signing path.
 */
export class CeremonyError extends Error {
  constructor(
    readonly code: ReportingErrorCode | "malformed" | "network",
    readonly status: number
  ) {
    super(`Ceremony request failed: ${code}`);
    this.name = "CeremonyError";
  }
}

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export interface CeremonyClientOptions {
  basePath?: string;
  fetch?: Fetcher;
}

export class CeremonyClient {
  private csrf: string | null = null;
  private readonly base: string;
  private readonly call: Fetcher;

  constructor(options: CeremonyClientOptions = {}) {
    this.base = options.basePath ?? "/api/messaging";
    this.call = options.fetch ?? ((input, init) => fetch(input, init));
  }

  private async request<T>(
    method: string,
    path: string,
    schema: { parse(value: unknown): T },
    options: { body?: unknown; bootstrap?: boolean } = {}
  ): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (options.bootstrap) headers["x-gg-bootstrap"] = "1";
    if (this.csrf && method !== "GET") headers["x-gg-csrf"] = this.csrf;
    let response: Response;
    try {
      response = await this.call(`${this.base}${path}`, {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch {
      throw new CeremonyError("network", 0);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = reportingErrorSchema.safeParse(body);
      throw new CeremonyError(
        failure.success ? failure.data.errorCode : "malformed",
        response.status
      );
    }
    try {
      return schema.parse(body);
    } catch {
      throw new CeremonyError("malformed", response.status);
    }
  }

  /** Starts this browser's own challenge; call only from an explicit user action. */
  async openChallenge(requestId: string): Promise<ChallengeResponse> {
    const challenge = await this.request("POST", "/challenges", challengeResponseSchema, {
      body: { requestId },
      bootstrap: true,
    });
    this.csrf = challenge.csrfToken ?? this.csrf;
    return challenge;
  }

  challenge(challengeId: string): Promise<ChallengeResponse> {
    return this.request("GET", `/challenges/${challengeId}`, challengeResponseSchema);
  }

  submitProof(
    challengeId: string,
    proof: {
      account: `0x${string}`;
      signature: `0x${string}`;
      factory?: `0x${string}`;
      factoryData?: `0x${string}`;
    }
  ): Promise<ChallengeResponse> {
    return this.request("POST", `/challenges/${challengeId}/proof`, challengeResponseSchema, {
      body: proof,
    });
  }

  async access(challengeId: string): Promise<AccessResponse> {
    const access = await this.request("POST", "/access", accessResponseSchema, {
      body: { challengeId },
    });
    this.csrf = access.csrfToken;
    return access;
  }

  /** Restores a session after a refresh; the server rotates the CSRF token it pairs with. */
  async currentAccess(): Promise<AccessResponse> {
    const access = await this.request("GET", "/access/current", accessResponseSchema);
    this.csrf = access.csrfToken;
    return access;
  }

  endAccess(accessId: string): Promise<unknown> {
    return this.request("DELETE", `/access/${accessId}`, { parse: (value) => value });
  }

  draft(draftId: string): Promise<ResourceView> {
    return this.request("GET", `/drafts/${draftId}`, resourceViewSchema);
  }

  review(reviewId: string): Promise<ResourceView> {
    return this.request("GET", `/reviews/${reviewId}`, resourceViewSchema);
  }

  async operation(operationId: string): Promise<OperationView> {
    const { operation } = await this.request(
      "GET",
      `/operations/${operationId}`,
      operationResponseSchema
    );
    return operation;
  }

  reserveAttempt(
    operationId: string,
    input: { expectedAttemptVersion: number; payloadDigest: `0x${string}`; idempotencyKey: string }
  ): Promise<AttemptResponse> {
    return this.request("POST", `/operations/${operationId}/attempts`, attemptResponseSchema, {
      body: input,
    });
  }

  reportOutcome(
    operationId: string,
    input: {
      attemptId: string;
      idempotencyKey: string;
      payloadDigest: `0x${string}`;
      outcome: AttemptOutcome;
    }
  ) {
    return this.request("POST", `/operations/${operationId}/outcome`, outcomeResponseSchema, {
      body: input,
    });
  }

  recovery(challengeId: string) {
    return this.request("GET", `/recovery/${challengeId}`, recoveryStepSchema);
  }

  confirmRecoveryCode(challengeId: string, code: string) {
    return this.request("POST", `/recovery/${challengeId}/channel`, recoveryStepSchema, {
      body: { code },
    });
  }

  applyRecovery(challengeId: string) {
    return this.request("POST", `/recovery/${challengeId}/confirm`, recoveryStepSchema);
  }

  async proposeGrant(): Promise<GrantView> {
    return (await this.request("POST", "/execution-grants", grantResponseSchema)).grant;
  }
  async grant(grantId: string): Promise<GrantView> {
    return (await this.request("GET", `/execution-grants/${grantId}`, grantResponseSchema)).grant;
  }
  async startGrantActivation(grant: Pick<GrantView, "grantId" | "version" | "policyDigest">) {
    return (
      await this.request(
        "POST",
        `/execution-grants/${grant.grantId}/activation`,
        grantActivationResponseSchema,
        {
          body: { expectedVersion: grant.version, policyDigest: grant.policyDigest },
        }
      )
    ).resource;
  }
  async grantActivation(grantId: string) {
    return (
      await this.request(
        "GET",
        `/execution-grants/${grantId}/activation`,
        grantActivationResponseSchema
      )
    ).resource;
  }
  reserveGrantActivationAttempt(
    grantId: string,
    input: {
      expectedAttemptVersion: number;
      payloadDigest: `0x${string}`;
      idempotencyKey: string;
    }
  ) {
    return this.request(
      "POST",
      `/execution-grants/${grantId}/activation/attempts`,
      attemptResponseSchema,
      { body: input }
    );
  }
  async signGrantActivation(grantId: string, input: GrantActivationSignatureRequest) {
    return (
      await this.request(
        "POST",
        `/execution-grants/${grantId}/activation/signature`,
        grantActivationSignatureResponseSchema,
        { body: grantActivationSignatureRequestSchema.parse(input) }
      )
    ).delegateSignature;
  }
  reportGrantActivationOutcome(grantId: string, input: OutcomeRequest) {
    return this.request(
      "POST",
      `/execution-grants/${grantId}/activation/outcome`,
      outcomeResponseSchema,
      { body: input }
    );
  }
  async approveGrant(
    grant: Pick<GrantView, "grantId" | "version" | "policyDigest">,
    enableReference: `0x${string}`
  ): Promise<GrantView> {
    return (
      await this.request(
        "POST",
        `/execution-grants/${grant.grantId}/approval`,
        grantResponseSchema,
        {
          body: {
            expectedVersion: grant.version,
            policyDigest: grant.policyDigest,
            enableReference,
          },
        }
      )
    ).grant;
  }
}
