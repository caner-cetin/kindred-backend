import { t } from "elysia";
import type { AuthContext } from "../../types/auth";
import { Messages } from "../../constants/messages";
import { broadcastTaskEvent } from "../../types/websocket";

export interface UpdateTaskBody {
  title?: string;
  description?: string;
  priority_id?: number;
  assignee_id?: number;
  due_date?: string;
}

export const updateTaskHandler = async ({
  body,
  params,
  set,
  db,
  user,
}: AuthContext & { body: UpdateTaskBody; params: { id: string } }) => {
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

    // Check if task exists and user has permission to edit
    const existingTask = await db
      .selectFrom("tasks")
      .selectAll()
      .where("id", "=", taskId)
      .executeTakeFirst();

    if (!existingTask) {
      set.status = 404;
      return { message: Messages.TASK_NOT_FOUND };
    }

    // Only creator or assignee can edit the task
    const userId = Number(user.id!);
    if (
      existingTask.creator_id !== userId &&
      existingTask.assignee_id !== userId
    ) {
      set.status = 403;
      return { message: Messages.PERMISSION_DENIED };
    }

    const { title, description, priority_id, assignee_id, due_date } = body;

    // Validate assignee exists if provided
    if (assignee_id !== undefined) {
      if (assignee_id !== null) {
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
    }

    // Validate priority exists if provided
    if (priority_id !== undefined) {
      if (priority_id !== null) {
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
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority_id !== undefined) updateData.priority_id = priority_id;
    if (assignee_id !== undefined) updateData.assignee_id = assignee_id;
    if (due_date !== undefined) {
      updateData.due_date = due_date ? new Date(due_date).toISOString() : null;
    }

    // Update the task
    const updatedTask = await db
      .updateTable("tasks")
      .set(updateData)
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
          type: "TASK_UPDATED",
          taskId: taskId,
          task: fullTask,
          userId: Number(user.id!),
          timestamp: new Date().toISOString(),
        },
        fullTask
      );
    }

    return {
      message: Messages.TASK_UPDATED_SUCCESS,
      task: updatedTask,
    };
  } catch (error) {
    console.error(Messages.UPDATE_TASK_ERROR, error);
    set.status = 500;
    return { message: Messages.INTERNAL_SERVER_ERROR };
  }
};

export const updateTaskSchema = {
  body: t.Object({
    title: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    description: t.Optional(t.String({ maxLength: 1000 })),
    priority_id: t.Optional(t.Union([t.Number(), t.Null()])),
    assignee_id: t.Optional(t.Union([t.Number(), t.Null()])),
    due_date: t.Optional(t.Union([t.String(), t.Null()])),
  }),
  params: t.Object({
    id: t.String(),
  }),
};
