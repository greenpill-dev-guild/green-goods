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
  operators?: GardenMemberLike[]
) => {
  const gardenerIds = new Set<string>();
  const operatorIds = new Set<string>();

  (gardeners ?? []).forEach((member) => {
    const key = resolveGardenMemberKey(member);
    if (key) gardenerIds.add(key);
  });

  (operators ?? []).forEach((member) => {
    const key = resolveGardenMemberKey(member);
    if (key) operatorIds.add(key);
  });

  const memberIds = gardenerIds.union(operatorIds);

  return {
    gardenerIds,
    operatorIds,
    memberIds,
  };
};

export const gardenHasMember = (
  target: string | null | undefined,
  gardeners?: GardenMemberLike[],
  operators?: GardenMemberLike[]
) => {
  if (!target) return false;
  const normalizedTarget = target.toLowerCase();
  const { memberIds } = buildGardenMemberSets(gardeners, operators);
  return memberIds.has(normalizedTarget);
};
