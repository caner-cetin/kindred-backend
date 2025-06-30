import { t } from "elysia";
import { type AuthContext } from "../../types/auth";
import { Messages } from "../../constants/messages";
import { broadcastTaskEvent } from "../../types/websocket";

export const deleteTaskHandler = async ({
  params,
  set,
  db,
  user,
}: AuthContext & { params: { id: string } }) => {
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

    const existingTask = await db
      .selectFrom("tasks")
      .selectAll()
      .where("id", "=", taskId)
      .executeTakeFirst();

    if (!existingTask) {
      set.status = 404;
      return { message: Messages.TASK_NOT_FOUND };
    }

    const userId = Number(user.id!);
    if (existingTask.creator_id !== userId) {
      set.status = 403;
      return { message: Messages.TASK_DELETE_CREATOR_ONLY };
    }

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

    await db.deleteFrom("tasks").where("id", "=", taskId).execute();

    if (fullTask) {
      broadcastTaskEvent(
        {
          type: "TASK_DELETED",
          taskId: taskId,
          task: fullTask,
          userId: userId,
          timestamp: new Date().toISOString(),
        },
        fullTask
      );
    }

    return {
      message: Messages.TASK_DELETED_SUCCESS,
    };
  } catch (error) {
    console.error(Messages.DELETE_TASK_ERROR, error);
    set.status = 500;
    return { message: Messages.INTERNAL_SERVER_ERROR };
  }
};

export const deleteTaskSchema = {
  params: t.Object({
    id: t.String(),
  }),
};
