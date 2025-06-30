import { t } from "elysia";
import type { AuthContext } from "../../types/auth";
import { Messages } from "../../constants/messages";

export interface UpdateTaskStatusBody {
  status: "To Do" | "In Progress" | "Completed";
}

export const updateTaskStatusHandler = async ({
  body,
  params,
  set,
  db,
  user,
}: AuthContext & { body: UpdateTaskStatusBody; params: { id: string } }) => {
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
    status: t.Union([
      t.Literal("To Do"),
      t.Literal("In Progress"),
      t.Literal("Completed"),
    ]),
  }),
  params: t.Object({
    id: t.String(),
  }),
};
