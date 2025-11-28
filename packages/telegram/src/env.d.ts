// Augment ImportMeta for shared package compatibility
interface ImportMeta {
  env: Record<string, string | undefined>;
}
