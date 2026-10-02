import { draftDB } from "../job-queue/draft-db";
import { mediaResourceManager } from "../job-queue/media-resource-manager";

export interface ProofDraftRepository {
  load(key: string): Promise<File[]>;
  save(key: string, files: File[]): Promise<void>;
  clear(key: string): Promise<void>;
  previewUrls(key: string, files: File[]): string[];
  revoke(key: string): void;
}

export interface ProofDraftRepositoryPorts {
  drafts: {
    getImagesForDraft(key: string): Promise<Array<{ file: File }>>;
    setImagesForDraft(key: string, files: File[]): Promise<void>;
  };
  media: {
    getOrCreateUrl(file: File, key: string): string;
    cleanupUrls(key: string): void;
  };
}

export function createProofDraftRepository(ports: ProofDraftRepositoryPorts): ProofDraftRepository {
  // File serialization can outlive the tap that queues a proof. Keep clear
  // behind earlier saves so a late save cannot resurrect cleared attachments.
  const writes = new Map<string, Promise<void>>();
  const write = (key: string, files: File[]) => {
    const previous = writes.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => ports.drafts.setImagesForDraft(key, files));
    writes.set(key, next);
    const forget = () => {
      if (writes.get(key) === next) writes.delete(key);
    };
    void next.then(forget, forget);
    return next;
  };
  return {
    async load(key) {
      // Reopening the composer may race a save from the route being left.
      // Read the last durable files only after that write has settled.
      await writes.get(key)?.catch(() => undefined);
      return (await ports.drafts.getImagesForDraft(key)).map(({ file }) => file);
    },
    save(key, files) {
      return write(key, files);
    },
    async clear(key) {
      await write(key, []);
      ports.media.cleanupUrls(key);
    },
    previewUrls(key, files) {
      return files.map((file) => ports.media.getOrCreateUrl(file, key));
    },
    revoke(key) {
      ports.media.cleanupUrls(key);
    },
  };
}

export const proofDraftRepository = createProofDraftRepository({
  drafts: {
    getImagesForDraft: (key) => draftDB.getImagesForDraft(key),
    setImagesForDraft: (key, files) => draftDB.setImagesForProof(key, files),
  },
  media: mediaResourceManager,
});
