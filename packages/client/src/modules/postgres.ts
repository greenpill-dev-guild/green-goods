import { ColumnType } from "kysely";
import { createKysely } from "@vercel/postgres-kysely";

interface GardenerTable extends GardenerCard {
  // You can specify a different type for each operation (select, insert and
  // update) using the `ColumnType<SelectType, InsertType, UpdateType>`
  // wrapper. Here we define a column `modified_at` that is selected as
  // a `Date`, can optionally be provided as a `string` in inserts and
  // can never be updated:
  modified_at: ColumnType<Date, string | undefined, never>;
}

// Keys of this interface are table names.
export interface Database {
  gardener: GardenerTable;
}

export const db = createKysely<Database>();

export function createGardener(draft: UserDraft) {
  // return db.gardener.insert({ first_name });
}

// export function getGardener(id: string): Promise<GardenerCard> {
//   // return db.selectFrom("gardener").where("gardener.id", "==", id);
// }

export function getGardeners() {
  // return db.gardener.select();
}

export function updateGardener(id: number, first_name: string) {
  // return db.gardener.update({ id }, { first_name });
}

export function deleteGardener(id: number) {
  // return db.gardener.delete({ id });
}

// await db
//   .insertInto('pet')
//   .values({ name: 'Catto', species: 'cat', owner_id: id })
//   .execute();

// const person = await db
//   .selectFrom('person')
//   .innerJoin('pet', 'pet.owner_id', 'person.id')
//   .select(['first_name', 'pet.name as pet_name'])
//   .where('person.id', '=', id)
//   .executeTakeFirst();
