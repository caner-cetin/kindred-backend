import { t } from "elysia";
import { type AuthContext } from "../../types/auth";
import { Messages } from "../../constants/messages";

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

    await db.deleteFrom("tasks").where("id", "=", taskId).execute();

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
