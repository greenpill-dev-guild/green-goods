/**
 * Public evidence upload, owned by the Agent for messaging reports. It uploads exactly the
 * sanitized bytes and canonical metadata a consented revision names, and nothing else; provider
 * credentials never reach a browser or model. Each completed upload is checkpointed by the caller.
 */
export interface EvidenceUploader {
  upload(input: { bytes: Uint8Array; name: string; mime: string }): Promise<{ cid: string }>;
}

class EvidenceUploadError extends Error {
  constructor(
    readonly reason: "unconfigured" | "rejected" | "timeout" | "malformed",
    readonly status?: number
  ) {
    super(`Evidence upload failed: ${reason}`);
    this.name = "EvidenceUploadError";
  }
}

export function createPinataEvidenceUploader(config: {
  jwt: string | undefined;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}): EvidenceUploader {
  const request = config.fetch ?? fetch;
  const baseUrl = (config.baseUrl ?? "https://uploads.pinata.cloud/v3").replace(/\/+$/, "");
  return {
    async upload(input) {
      if (!config.jwt) throw new EvidenceUploadError("unconfigured");
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(input.bytes)], { type: input.mime }),
        input.name
      );
      form.append("network", "public");
      form.append("name", input.name);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 30_000);
      try {
        const response = await request(`${baseUrl}/files`, {
          method: "POST",
          headers: { authorization: `Bearer ${config.jwt}` },
          body: form,
          signal: controller.signal,
        });
        if (!response.ok) throw new EvidenceUploadError("rejected", response.status);
        const body = (await response.json()) as { data?: { cid?: unknown } };
        const cid = body.data?.cid;
        if (typeof cid !== "string" || !/^[a-zA-Z0-9]{46,100}$/.test(cid))
          throw new EvidenceUploadError("malformed");
        return { cid };
      } catch (error) {
        if (error instanceof EvidenceUploadError) throw error;
        throw new EvidenceUploadError(controller.signal.aborted ? "timeout" : "rejected");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
