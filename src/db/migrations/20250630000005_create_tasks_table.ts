import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("tasks")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("creator_id", "integer", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("assignee_id", "integer", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("status_id", "integer", (col) =>
      col.references("statuses.id").notNull(),
    )
    .addColumn("priority_id", "integer", (col) =>
      col.references("priorities.id"),
    )
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("due_date", "timestamp")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("tasks").execute();
}
