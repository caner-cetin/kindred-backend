import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("sessions")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("user_id", "integer", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("refresh_token", "text", (col) => col.notNull())
    .addColumn("auth_token", "text", (col) => col.notNull())
    .addColumn("auth_expires_at", "timestamp", (col) => col.notNull())
    .addColumn("refresh_expires_at", "timestamp", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("sessions").execute();
}
