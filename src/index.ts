import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { migrateToLatest } from "./db/migrate";
import { signupHandler, signupSchema } from "./handlers/auth/signup";
import { loginHandler, loginSchema } from "./handlers/auth/login";
import { refreshHandler, refreshSchema } from "./handlers/auth/refresh";
import { verifyAccessToken } from "./handlers/auth/verify";
import { meHandler, meSchema } from "./handlers/auth/me";
import { createTaskHandler, createTaskSchema } from "./handlers/tasks/create";
import { updateTaskHandler, updateTaskSchema } from "./handlers/tasks/update";
import {
  updateTaskStatusHandler,
  updateTaskStatusSchema,
} from "./handlers/tasks/status";
import { listTasksHandler, listTasksSchema } from "./handlers/tasks/list";
import { deleteTaskHandler, deleteTaskSchema } from "./handlers/tasks/delete";
import {
  getTaskMetadataHandler,
  getTaskMetadataSchema,
} from "./handlers/tasks/metadata";
import { Kysely } from "kysely";
import Database from "bun:sqlite";
import type { DB } from "./db/db.d";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { swagger } from "@elysiajs/swagger";
import { connectedUsers } from "./types/websocket";
import type { UserData } from "./types/auth";

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
      const dbUser = await verifyAccessToken(token, db);
      
      const user: UserData | null = dbUser ? {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        full_name: dbUser.full_name,
        password_hash: dbUser.password_hash,
        created_at: dbUser.created_at
      } : null;
      
      return { user };
    })
    .use(
      swagger({
        documentation: {
          servers: [
            {
              url: "https://apitrack.cansu.dev",
              description: "Production server",
            },
            {
              url: "http://localhost:3001",
              description: "Development server",
            },
          ],
          components: {
            securitySchemes: {
              bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description:
                  "JWT access token obtained from the `/login` endpoint. Token expires in 15 minutes.",
              },
            },
            schemas: {
              Error: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "Human-readable error message",
                  },
                  code: {
                    type: "string",
                    description: "Machine-readable error code",
                    example: [
                      "AUTH_REQUIRED",
                      "TASK_NOT_FOUND",
                      "VALIDATION_ERROR",
                    ],
                  },
                },
                required: ["message"],
              },
              Task: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Unique task identifier" },
                  title: { type: "string", description: "Task title" },
                  description: {
                    type: "string",
                    nullable: true,
                    description: "Optional task description",
                  },
                  status: {
                    type: "string",
                    enum: ["To Do", "In Progress", "Completed"],
                    description: "Current task status",
                  },
                  priority: {
                    type: "string",
                    enum: ["Low", "Medium", "High", "Critical"],
                    description: "Task priority level",
                  },
                  due_date: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                    description: "Task due date in ISO 8601 format",
                  },
                  creator_username: {
                    type: "string",
                    description: "Username of task creator",
                  },
                  assignee_username: {
                    type: "string",
                    nullable: true,
                    description: "Username of assigned user",
                  },
                  created_at: {
                    type: "string",
                    format: "date-time",
                    description: "Task creation timestamp",
                  },
                  updated_at: {
                    type: "string",
                    format: "date-time",
                    description: "Last update timestamp",
                  },
                },
              },
              User: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Unique user identifier" },
                  username: {
                    type: "string",
                    description: "User's unique username",
                  },
                  email: {
                    type: "string",
                    format: "email",
                    description: "User's email address",
                  },
                },
              },
            },
          },
          tags: [
            {
              name: "Authentication",
              description: "User authentication and session management",
            },
            {
              name: "Tasks",
              description: "Complete task management operations",
            },
            {
              name: "WebSocket",
              description: "Real-time communication and live updates",
            },
          ],
        },
      })
    )
    .use(cors())
    .post("/signup", signupHandler, signupSchema)
    .post("/login", loginHandler, loginSchema)
    .post("/refresh", refreshHandler, refreshSchema)
    .get("/me", meHandler, meSchema)
    .post("/tasks", createTaskHandler, createTaskSchema)
    .get("/tasks", listTasksHandler, listTasksSchema)
    .get("/tasks/metadata", getTaskMetadataHandler, getTaskMetadataSchema)
    .put("/tasks/:id", updateTaskHandler, updateTaskSchema)
    .patch("/tasks/:id/status", updateTaskStatusHandler, updateTaskStatusSchema)
    .delete("/tasks/:id", deleteTaskHandler, deleteTaskSchema)
    .ws("/ws", {
      message: async (ws, message: { type: string; token?: string }) => {
        try {
          const data = message;

          // Handle authentication for WebSocket
          if (data.type === "auth" && data.token) {
            const user = await verifyAccessToken(data.token, db);
            if (user && user.id) {
              connectedUsers.set(user.id, {
                id: user.id,
                username: user.username,
                ws: ws,
              });
              ws.send(
                JSON.stringify({
                  type: "auth",
                  status: "authenticated",
                  userId: user.id,
                })
              );
            } else {
              ws.send(JSON.stringify({ type: "auth", status: "failed" }));
              ws.close();
            }
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      },
      close: (ws) => {
        // Remove user from connected users when they disconnect
        for (const [userId, userData] of connectedUsers.entries()) {
          if (userData.ws === ws) {
            connectedUsers.delete(userId);
            break;
          }
        }
      },
      open: () => {
        // WebSocket connection opened
      },
    });

  return app;
};

if (import.meta.main) {
  const app = await createApp();
  const port = process.env.PORT || 3000;
  console.log(`elysia listening at ${port}`);
  app.listen(port);
}

export type App = Awaited<ReturnType<typeof createApp>>;
