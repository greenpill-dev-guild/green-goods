const processing = new Set<string>();
export function hasActiveWorkExecution(): boolean {
  return processing.size > 0;
}
export function claimWorkJobs(ids: string[]): (() => void) | null {
  if (ids.some((id) => processing.has(id))) return null;
  ids.forEach((id) => processing.add(id));
  return () => {
    ids.forEach((id) => processing.delete(id));
  };
}
