import * as path from "path";
import { promises as fs } from "fs";
import { Kysely, Migrator, FileMigrationProvider } from "kysely";
import { DB } from "./db";
import Database from "bun:sqlite";
import { BunSqliteDialect } from "kysely-bun-sqlite";
export async function migrateToLatest(db: Kysely<DB>) {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "./migrations"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    throw error;
  }
}
