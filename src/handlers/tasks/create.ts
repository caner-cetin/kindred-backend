import { t } from "elysia";
import { AuthContext } from "../../types/auth";
import { Messages } from "../../constants/messages";

export interface CreateTaskBody {
  title: string;
  description?: string;
  priority_id?: number;
  assignee_id?: number;
  due_date?: string;
}

export const createTaskHandler = async ({
  body,
  set,
  db,
  user,
}: AuthContext & { body: CreateTaskBody }) => {
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
    title: t.String({ minLength: 1, maxLength: 255 }),
    description: t.Optional(t.String({ maxLength: 1000 })),
    priority_id: t.Optional(t.Number()),
    assignee_id: t.Optional(t.Number()),
    due_date: t.Optional(t.String()),
  }),
};
