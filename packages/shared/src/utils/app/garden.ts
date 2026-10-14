export type GardenMemberLike =
  | string
  | null
  | undefined
  | {
      account?: string | null;
      id?: string | null;
    };

const toLowerCaseSafe = (value: string | null | undefined) =>
  typeof value === "string" && value.length ? value.toLowerCase() : null;

export const resolveGardenMemberKey = (value: GardenMemberLike): string | null => {
  if (typeof value === "string") {
    return toLowerCaseSafe(value);
  }

  if (value && typeof value === "object") {
    if ("account" in value) {
      return toLowerCaseSafe(value.account ?? null);
    }

    if ("id" in value) {
      return toLowerCaseSafe(value.id ?? null);
    }
  }

  return null;
};

export const buildGardenMemberSets = (
  gardeners?: GardenMemberLike[],
  stewards?: GardenMemberLike[]
) => {
  const gardenerIds = new Set<string>();
  const stewardIds = new Set<string>();

  (gardeners ?? []).forEach((member) => {
    const key = resolveGardenMemberKey(member);
    if (key) gardenerIds.add(key);
  });

  (stewards ?? []).forEach((member) => {
    const key = resolveGardenMemberKey(member);
    if (key) stewardIds.add(key);
  });

  // Use spread instead of Set.prototype.union for wider compatibility
  const memberIds = new Set([...gardenerIds, ...stewardIds]);

  return {
    gardenerIds,
    stewardIds,
    memberIds,
  };
};

export const gardenHasMember = (
  target: string | null | undefined,
  gardeners?: GardenMemberLike[],
  stewards?: GardenMemberLike[]
) => {
  if (!target) return false;
  const normalizedTarget = target.toLowerCase();
  const { memberIds } = buildGardenMemberSets(gardeners, stewards);
  return memberIds.has(normalizedTarget);
};
