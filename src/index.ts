import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { migrateToLatest } from "./db/migrate";
import { signupHandler, signupSchema } from "./handlers/auth/signup";
import { loginHandler, loginSchema } from "./handlers/auth/login";
import { refreshHandler } from "./handlers/auth/refresh";
import { verifyAccessToken } from "./handlers/auth/verify";
import { meHandler } from "./handlers/auth/me";
import { createTaskHandler, createTaskSchema } from "./handlers/tasks/create";
import { updateTaskHandler, updateTaskSchema } from "./handlers/tasks/update";
import {
  updateTaskStatusHandler,
  updateTaskStatusSchema,
} from "./handlers/tasks/status";
import { listTasksHandler, listTasksSchema } from "./handlers/tasks/list";
import { deleteTaskHandler, deleteTaskSchema } from "./handlers/tasks/delete";
import { getTaskMetadataHandler } from "./handlers/tasks/metadata";
import { Kysely } from "kysely";
import Database from "bun:sqlite";
import { DB } from "./db/db.d";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { swagger } from "@elysiajs/swagger";

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
    .use(swagger())
    .use(cors())
    .post("/signup", signupHandler, signupSchema)
    .post("/login", loginHandler, loginSchema)
    .post("/refresh", refreshHandler)
    .get("/me", meHandler)
    .post("/tasks", createTaskHandler, createTaskSchema)
    .get("/tasks", listTasksHandler, listTasksSchema)
    .get("/tasks/metadata", getTaskMetadataHandler)
    .put("/tasks/:id", updateTaskHandler, updateTaskSchema)
    .patch("/tasks/:id/status", updateTaskStatusHandler, updateTaskStatusSchema)
    .delete("/tasks/:id", deleteTaskHandler, deleteTaskSchema);

  return app;
};

if (import.meta.main) {
  const app = await createApp();
  app.listen(process.env.PORT || 3000);
  console.log(
    `Elysia is running at http://localhost:${process.env.PORT || 3000}`
  );
}

export type App = Awaited<ReturnType<typeof createApp>>;
