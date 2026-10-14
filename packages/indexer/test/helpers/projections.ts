import assert from "node:assert/strict";

interface EntityReader<Entity> {
  get(id: string): Promise<Entity | undefined>;
}

export async function readProjection<Entity>(reader: EntityReader<Entity>, id: string) {
  return reader.get(id);
}

export async function assertAbsent<Entity>(reader: EntityReader<Entity>, id: string) {
  assert.equal(await readProjection(reader, id), undefined);
}

export function assertProjection<Entity extends object>(
  entity: Entity | undefined,
  expected: Partial<Entity>
): asserts entity is Entity {
  assert.ok(entity);
  for (const [field, value] of Object.entries(expected)) {
    assert.deepEqual((entity as Record<string, unknown>)[field], value, field);
  }
}

export function assertGardenProjection<Entity extends object>(
  garden: Entity | undefined,
  expected: Partial<Entity>
): asserts garden is Entity {
  assertProjection(garden, expected);
}

type GardenRole = "gardeners" | "operators" | "evaluators" | "owners" | "funders" | "communities";

export function assertRoleArrays(
  garden: Partial<Record<GardenRole, readonly string[]>> | undefined,
  expected: Partial<Record<GardenRole, readonly string[]>>
): void {
  assert.ok(garden);
  for (const [role, addresses] of Object.entries(expected)) {
    assert.deepEqual(garden[role as GardenRole], addresses, `Garden.${role}`);
  }
}
