import { t } from "elysia";
import { sql } from "kysely";
import type { AuthContext } from "../../types/auth";
import { Messages } from "../../constants/messages";

export const listTasksHandler = async ({
  query,
  set,
  db,
  user,
}: AuthContext & {
  query: {
    status?: string;
    priority?: string;
    assignee?: string;
    search?: string;
  };
}) => {
  if (!user) {
    set.status = 401;
    return { message: Messages.AUTH_REQUIRED };
  }

  try {
    const userId = Number(user.id!);
    const {
      status,
      priority,
      assignee,
      title,
      due_date_start,
      due_date_end,
      created_at_start,
      created_at_end,
    } = query;

    let query_builder = db
      .selectFrom("tasks")
      .leftJoin("statuses", "tasks.status_id", "statuses.id")
      .leftJoin("priorities", "tasks.priority_id", "priorities.id")
      .leftJoin("users as creator", "tasks.creator_id", "creator.id")
      .leftJoin(
        "users as assignee_user",
        "tasks.assignee_id",
        "assignee_user.id"
      )
      .select([
        "tasks.id",
        "tasks.title",
        "tasks.description",
        "tasks.due_date",
        "tasks.created_at",
        "tasks.updated_at",
        "statuses.name as status",
        "priorities.name as priority",
        "priorities.level as priority_level",
        "creator.username as creator_username",
        "assignee_user.username as assignee_username",
        "tasks.creator_id",
        "tasks.assignee_id",
      ])
      // Show tasks where user is creator or assignee
      .where((eb) =>
        eb.or([
          eb("tasks.creator_id", "=", userId),
          eb("tasks.assignee_id", "=", userId),
        ])
      );

    // Apply filters if provided
    if (status) {
      query_builder = query_builder.where("statuses.name", "=", status);
    }

    if (priority) {
      query_builder = query_builder.where("priorities.name", "=", priority);
    }

    if (assignee === "me") {
      query_builder = query_builder.where("tasks.assignee_id", "=", userId);
    } else if (assignee === "unassigned") {
      query_builder = query_builder.where("tasks.assignee_id", "is", null);
    } else if (assignee === "created") {
      query_builder = query_builder.where("tasks.creator_id", "=", userId);
    }

    if (title) {
      query_builder = query_builder.where("tasks.title", "like", `%${title}%`);
    }

    if (due_date_start) {
      query_builder = query_builder.where("tasks.due_date", ">=", due_date_start);
    }

    if (due_date_end) {
      query_builder = query_builder.where("tasks.due_date", "<=", due_date_end);
    }

    if (created_at_start) {
      query_builder = query_builder.where("tasks.created_at", ">=", created_at_start);
    }

    if (created_at_end) {
      query_builder = query_builder.where("tasks.created_at", "<=", created_at_end);
    }

    // Order by priority level (higher level = higher priority) and then by created date
    const tasks = await query_builder
      .orderBy("priorities.level", "desc")
      .orderBy("tasks.created_at", "desc")
      .execute();

    const stats = await db
      .selectFrom("tasks")
      .leftJoin("statuses", "tasks.status_id", "statuses.id")
      .select(["statuses.name as status", db.fn.count("tasks.id").as("count")])
      .where((eb) =>
        eb.or([
          eb("tasks.creator_id", "=", userId),
          eb("tasks.assignee_id", "=", userId),
        ])
      )
      .groupBy("statuses.name")
      .execute();

    return {
      tasks,
      stats: stats.reduce((acc, stat) => {
        acc[stat.status || "unknown"] = Number(stat.count);
        return acc;
      }, {} as Record<string, number>),
    };
  } catch (error) {
    console.error(Messages.LIST_TASKS_ERROR, error);
    set.status = 500;
    return { message: Messages.INTERNAL_SERVER_ERROR };
  }
};

export const listTasksSchema = {
  query: t.Optional(
    t.Object({
      status: t.Optional(t.String()),
      priority: t.Optional(t.String()),
      assignee: t.Optional(
        t.Union([
          t.Literal("me"),
          t.Literal("unassigned"),
          t.Literal("created"),
        ])
      ),
      title: t.Optional(t.String()),
      due_date_start: t.Optional(t.String()),
      due_date_end: t.Optional(t.String()),
      created_at_start: t.Optional(t.String()),
      created_at_end: t.Optional(t.String()),
      search: t.Optional(t.String()),
    })
  ),
};
