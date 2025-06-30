import { t } from "elysia";
import { Messages } from "../../constants/messages";
import { broadcastTaskEvent } from "../../types/websocket";
import type { Kysely } from "kysely";
import type { DB } from "../../db/db.d.ts";
import type { UserData } from "../../types/auth";

export interface CreateTaskBody {
  title: string;
  description?: string;
  priority_id?: number;
  assignee_id?: number;
  due_date?: string;
}

export const createTaskHandler = async (context: {
  body: CreateTaskBody;
  set: { status?: number | string };
  db: Kysely<DB>;
  user: UserData | null;
}) => {
  const { body, set, db, user } = context;
  if (!user) {
    set.status = 401;
    return { message: Messages.AUTH_REQUIRED };
  }

  try {
    const { title, description, priority_id, assignee_id, due_date } = body;

    // Get the default "To Do" status
    const defaultStatus = await db
      .selectFrom("statuses")
      .selectAll()
      .where("name", "=", "To Do")
      .executeTakeFirst();

    if (!defaultStatus) {
      set.status = 500;
      return { message: Messages.DEFAULT_STATUS_NOT_FOUND };
    }

    // Validate assignee exists if provided
    if (assignee_id) {
      const assignee = await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", assignee_id)
        .executeTakeFirst();

      if (!assignee) {
        set.status = 400;
        return { message: Messages.ASSIGNEE_NOT_FOUND };
      }
    }

    // Validate priority exists if provided
    if (priority_id) {
      const priority = await db
        .selectFrom("priorities")
        .select("id")
        .where("id", "=", priority_id)
        .executeTakeFirst();

      if (!priority) {
        set.status = 400;
        return { message: Messages.PRIORITY_NOT_FOUND };
      }
    }

    // Create the task
    const newTask = await db
      .insertInto("tasks")
      .values({
        creator_id: Number(user.id!),
        assignee_id: assignee_id || null,
        status_id: Number(defaultStatus.id!),
        priority_id: priority_id || null,
        title,
        description: description || null,
        due_date: due_date ? new Date(due_date).toISOString() : null,
      })
      .returning([
        "id",
        "title",
        "description",
        "due_date",
        "created_at",
        "updated_at",
      ])
      .executeTakeFirstOrThrow();

    // Get full task data with related info for WebSocket broadcast
    const fullTask = await db
      .selectFrom("tasks")
      .leftJoin("users as creator", "tasks.creator_id", "creator.id")
      .leftJoin("users as assignee", "tasks.assignee_id", "assignee.id")
      .leftJoin("statuses", "tasks.status_id", "statuses.id")
      .leftJoin("priorities", "tasks.priority_id", "priorities.id")
      .select([
        "tasks.id",
        "tasks.title",
        "tasks.description",
        "tasks.due_date",
        "tasks.created_at",
        "tasks.updated_at",
        "tasks.creator_id",
        "tasks.assignee_id",
        "creator.username as creator_username",
        "assignee.username as assignee_username",
        "statuses.name as status",
        "priorities.name as priority",
      ])
      .where("tasks.id", "=", Number(newTask.id!))
      .executeTakeFirst();

    if (fullTask) {
      broadcastTaskEvent(
        {
          type: "TASK_CREATED",
          taskId: Number(fullTask.id!),
          task: fullTask,
          userId: Number(user.id!),
          timestamp: new Date().toISOString(),
        },
        fullTask
      );
    }

    return {
      message: Messages.TASK_CREATED_SUCCESS,
      task: newTask,
    };
  } catch (error) {
    console.error(Messages.CREATE_TASK_ERROR, error);
    set.status = 500;
    return { message: Messages.INTERNAL_SERVER_ERROR };
  }
};

export const createTaskSchema = {
  body: t.Object({
    title: t.String({
      minLength: 1,
      maxLength: 255,
      description: "Task title",
      examples: [
        "Fix login bug",
        "Implement user dashboard",
        "Write API documentation",
      ],
    }),
    description: t.Optional(
      t.String({
        maxLength: 1000,
        description: "Optional task description with more details",
        examples: ["This task involves fixing the authentication flow..."],
      })
    ),
    priority_id: t.Optional(
      t.Number({
        description:
          "Priority ID (1=Low, 2=Medium, 3=High, 4=Critical). Get available priorities from /tasks/metadata",
        examples: [2, 3],
      })
    ),
    assignee_id: t.Optional(
      t.Number({
        description:
          "User ID to assign this task to. Get available users from /tasks/metadata",
        examples: [1, 5, 12],
      })
    ),
    due_date: t.Optional(
      t.String({
        description: "Due date in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
        examples: ["2024-12-31T23:59:59.000Z", "2024-01-15T09:00:00.000Z"],
      })
    ),
  }),
  detail: {
    tags: ["Tasks"],
    summary: "Create a new task",
    description:
      "Creates a new task and assigns it to the specified user. Broadcasts the task creation event via WebSocket to all connected clients.",
    security: [{ bearerAuth: [] }],
  },
  response: {
    201: t.Object({
      message: t.String({ examples: ["Task created successfully"] }),
      task: t.Object({
        id: t.Number(),
        title: t.String(),
        description: t.Union([t.String(), t.Null()]),
        due_date: t.Union([t.String(), t.Null()]),
        created_at: t.String(),
        updated_at: t.String(),
      }),
    }),
    400: t.Object({
      message: t.String({
        examples: ["Assignee not found", "Priority not found"],
      }),
    }),
    401: t.Object({
      message: t.String({ examples: ["Authentication required"] }),
    }),
    500: t.Object({
      message: t.String({ examples: ["Internal server error"] }),
    }),
  },
};
