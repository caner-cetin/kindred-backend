import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("priorities")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("level", "integer", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("priorities").execute();
}
