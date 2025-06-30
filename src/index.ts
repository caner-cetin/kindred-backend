import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { migrateToLatest } from "./db/migrate";
import { signupHandler, signupSchema } from "./handlers/auth/signup";
import { loginHandler, loginSchema } from "./handlers/auth/login";
import { refreshHandler } from "./handlers/auth/refresh";
import { verifyAccessToken } from "./handlers/auth/verify";
import { meHandler } from "./handlers/auth/me";
import { Kysely } from "kysely";
import Database from "bun:sqlite";
import { DB } from "./db/db.d";
import { BunSqliteDialect } from "kysely-bun-sqlite";

export const createApp = async (dbPath?: string) => {
  const actualDbPath =
    dbPath || process.env.SQLITE_FILE_LOCATION || "sqlite.db";

  // Create database file if needed (but not for memory)
  if (actualDbPath !== ":memory:") {
    const sqlite_db_exists = await Bun.file(actualDbPath).exists();
    if (!sqlite_db_exists) await Bun.write(actualDbPath, Buffer.from([]));
  }

  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({
      database: new Database(actualDbPath),
    }),
  });

  // Run migrations on the same db instance
  await migrateToLatest(db);

  const app = new Elysia()
    .decorate("db", db)
    .decorate("verifyAccessToken", verifyAccessToken)
    .derive(async ({ headers, verifyAccessToken, db }) => {
      const authHeader = headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { user: null };
      }

      const token = authHeader.split(" ")[1];
      const user = await verifyAccessToken(token, db);
      return { user };
    })
    .use(cors())
    .post("/signup", signupHandler, signupSchema)
    .post("/login", loginHandler, loginSchema)
    .post("/refresh", refreshHandler)
    .get("/me", meHandler);

  return app;
};

if (import.meta.main) {
  const app = await createApp();
  app.listen(process.env.PORT || 3000);
  console.log(
    `Elysia is running at http://localhost:${process.env.PORT || 3000}`,
  );
}

export type App = ReturnType<typeof createApp>;
