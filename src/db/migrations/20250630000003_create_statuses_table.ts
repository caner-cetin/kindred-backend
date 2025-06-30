import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("statuses")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("name", "text", (col) =>
      col.notNull().check(sql`name in ('To Do', 'In Progress', 'Completed')`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("statuses").execute();
}
