export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function addUniqueAddress(list: readonly string[], address: string): string[] {
  const normalized = normalizeAddress(address);
  if (list.some((item) => normalizeAddress(item) === normalized)) {
    return [...list];
  }
  return [...list, normalized];
}

export function removeAddress(list: readonly string[], address: string): string[] {
  const normalized = normalizeAddress(address);
  return list.filter((item) => normalizeAddress(item) !== normalized);
}
