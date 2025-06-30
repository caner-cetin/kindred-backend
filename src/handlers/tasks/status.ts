import { t } from "elysia";
import { Messages } from "../../constants/messages";
import { broadcastTaskEvent } from "../../types/websocket";
import type { Kysely } from "kysely";
import type { DB } from "../../db/db.d";
import type { UserData } from "../../types/auth";

export interface UpdateTaskStatusBody {
  status: "To Do" | "In Progress" | "Completed";
}

export const updateTaskStatusHandler = async (context: {
  body: UpdateTaskStatusBody;
  params: { id: string };
  set: { status?: number | string };
  db: Kysely<DB>;
  user: UserData | null;
}) => {
  const { body, params, set, db, user } = context;
  if (!user) {
    set.status = 401;
    return { message: Messages.AUTH_REQUIRED };
  }

  try {
    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      set.status = 400;
      return { message: Messages.INVALID_TASK_ID };
    }

    // Check if task exists and user has permission to update status
    const existingTask = await db
      .selectFrom("tasks")
      .selectAll()
      .where("id", "=", taskId)
      .executeTakeFirst();

    if (!existingTask) {
      set.status = 404;
      return { message: Messages.TASK_NOT_FOUND };
    }

    // Only creator or assignee can update task status
    const userId = Number(user.id!);
    if (
      existingTask.creator_id !== userId &&
      existingTask.assignee_id !== userId
    ) {
      set.status = 403;
      return { message: Messages.PERMISSION_DENIED };
    }

    const { status } = body;

    // Get the status ID
    const statusRecord = await db
      .selectFrom("statuses")
      .selectAll()
      .where("name", "=", status)
      .executeTakeFirst();

    if (!statusRecord) {
      set.status = 400;
      return { message: Messages.INVALID_STATUS };
    }

    // Update task status
    const updatedTask = await db
      .updateTable("tasks")
      .set({
        status_id: Number(statusRecord.id!),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", taskId)
      .returning([
        "id",
        "title",
        "description",
        "due_date",
        "created_at",
        "updated_at",
      ])
      .executeTakeFirstOrThrow();

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
      .where("tasks.id", "=", taskId)
      .executeTakeFirst();

    if (fullTask) {
      broadcastTaskEvent(
        {
          type: "TASK_STATUS_CHANGED",
          taskId: taskId,
          task: fullTask,
          userId: Number(user.id!),
          timestamp: new Date().toISOString(),
        },
        fullTask
      );
    }

    return {
      message: Messages.TASK_STATUS_UPDATED_SUCCESS,
      task: updatedTask,
      status: status,
    };
  } catch (error) {
    console.error(Messages.UPDATE_TASK_STATUS_ERROR, error);
    set.status = 500;
    return { message: Messages.INTERNAL_SERVER_ERROR };
  }
};

export const updateTaskStatusSchema = {
  body: t.Object({
    status: t.Union(
      [t.Literal("To Do"), t.Literal("In Progress"), t.Literal("Completed")],
      {
        description: "New status for the task",
        examples: ["To Do", "In Progress", "Completed"],
      }
    ),
  }),
  params: t.Object({
    id: t.String({
      description: "Task ID to update status for",
      examples: ["1", "5", "42"],
    }),
  }),
  detail: {
    tags: ["Tasks"],
    summary: "Update task status",
    description:
      "Update the status of an existing task. Only the task creator or assignee can update the status. Broadcasts the status change event via WebSocket to all connected clients.",
    security: [{ bearerAuth: [] }],
  },
  response: {
    200: t.Object({
      message: t.String({ examples: ["Task status updated successfully"] }),
      task: t.Object({
        id: t.Number(),
        title: t.String(),
        description: t.Union([t.String(), t.Null()]),
        due_date: t.Union([t.String(), t.Null()]),
        created_at: t.String(),
        updated_at: t.String(),
      }),
      status: t.String({ examples: ["To Do", "In Progress", "Completed"] }),
    }),
    400: t.Object({
      message: t.String({ examples: ["Invalid task ID", "Invalid status"] }),
    }),
    401: t.Object({
      message: t.String({ examples: ["Authentication required"] }),
    }),
    403: t.Object({
      message: t.String({ examples: ["Permission denied"] }),
    }),
    404: t.Object({
      message: t.String({ examples: ["Task not found"] }),
    }),
    500: t.Object({
      message: t.String({ examples: ["Internal server error"] }),
    }),
  },
};
