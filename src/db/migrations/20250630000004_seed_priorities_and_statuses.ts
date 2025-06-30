import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // default statuses
  await db
    .insertInto("statuses")
    .values([
      { id: 1, name: "To Do" },
      { id: 2, name: "In Progress" },
      { id: 3, name: "Completed" },
    ])
    .execute();

  // higher level = higher priority
  await db
    .insertInto("priorities")
    .values([
      { id: 1, name: "Low", level: 1 },
      { id: 2, name: "Medium", level: 2 },
      { id: 3, name: "High", level: 3 },
      { id: 4, name: "Critical", level: 4 },
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.deleteFrom("priorities").execute();
  await db.deleteFrom("statuses").execute();
}
