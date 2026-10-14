import assert from "node:assert/strict";

type EventMap = Record<string, unknown>;

export async function assertConvergesUnderDelivery<Events extends EventMap, Projection>({
  events,
  orders,
  read,
}: {
  events: Events;
  orders: ReadonlyArray<ReadonlyArray<keyof Events>>;
  read: (orderedEvents: Array<Events[keyof Events]>) => Promise<Projection>;
}): Promise<Projection[]> {
  assert.ok(orders.length > 1, "delivery law needs at least two orders");
  const projections = await Promise.all(
    orders.map((order) => read(order.map((key) => events[key])))
  );
  for (const projection of projections.slice(1)) {
    assert.deepEqual(projection, projections[0]);
  }
  return projections;
}

type DeliveryItem<Event> = Event | readonly Event[];

function flatten<Event>(items: readonly DeliveryItem<Event>[]): Event[] {
  return items.flatMap((item) => (Array.isArray(item) ? [...item] : [item as Event]));
}

export async function assertRelationshipInEitherOrder<Event, Projection>({
  relationship,
  entity,
  read,
}: {
  relationship: DeliveryItem<Event>;
  entity: DeliveryItem<Event>;
  read: (orderedEvents: Event[]) => Promise<Projection>;
}): Promise<[Projection, Projection]> {
  const relationshipFirst = await read(flatten([relationship, entity]));
  const entityFirst = await read(flatten([entity, relationship]));
  assert.deepEqual(entityFirst, relationshipFirst);
  return [relationshipFirst, entityFirst];
}
