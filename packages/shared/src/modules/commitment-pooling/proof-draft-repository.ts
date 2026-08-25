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
  return {
    async load(key) {
      return (await ports.drafts.getImagesForDraft(key)).map(({ file }) => file);
    },
    save(key, files) {
      return ports.drafts.setImagesForDraft(key, files);
    },
    async clear(key) {
      await ports.drafts.setImagesForDraft(key, []);
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
  drafts: draftDB,
  media: mediaResourceManager,
});
