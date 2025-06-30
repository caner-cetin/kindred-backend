import { t } from "elysia";
import { sql, type ExpressionBuilder } from "kysely";
import type { StatusName, DB } from "../../db/db.d";
import { Messages } from "../../constants/messages";
import type { Kysely } from "kysely";
import type { UserData } from "../../types/auth";

interface ListTasksQuery {
  status?: string;
  priority?: string;
  assignee?: "me" | "unassigned" | "created";
  title?: string;
  due_date_start?: string;
  due_date_end?: string;
  created_at_start?: string;
  created_at_end?: string;
}

export const listTasksHandler = async (context: {
  query: ListTasksQuery;
  set: { status?: number | string };
  db: Kysely<DB>;
  user: UserData | null;
}) => {
  const { query, set, db, user } = context;
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
    }: ListTasksQuery = query;

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
      .where((eb: ExpressionBuilder<DB, "tasks">) =>
        eb.or([
          eb("tasks.creator_id", "=", userId),
          eb("tasks.assignee_id", "=", userId),
        ])
      );

    // Apply filters if provided
    if (status) {
      query_builder = query_builder.where(
        "statuses.name",
        "=",
        status as StatusName
      );
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
      query_builder = query_builder.where(
        "tasks.due_date",
        ">=",
        due_date_start
      );
    }

    if (due_date_end) {
      query_builder = query_builder.where("tasks.due_date", "<=", due_date_end);
    }

    if (created_at_start) {
      query_builder = query_builder.where(
        "tasks.created_at",
        ">=",
        created_at_start
      );
    }

    if (created_at_end) {
      query_builder = query_builder.where(
        "tasks.created_at",
        "<=",
        created_at_end
      );
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
      .where((eb: any) =>
        eb.or([
          eb("tasks.creator_id", "=", userId),
          eb("tasks.assignee_id", "=", userId),
        ])
      )
      .groupBy("statuses.name")
      .execute();

    return {
      tasks: tasks.map(task => ({
        ...task,
        id: task.id!,
        created_at: task.created_at || new Date().toISOString(),
        updated_at: task.updated_at || new Date().toISOString(),
      })),
      stats: stats.reduce((acc: Record<string, number>, stat: any) => {
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
      status: t.Optional(
        t.String({
          description: "Filter by task status",
          examples: ["To Do", "In Progress", "Completed"],
        })
      ),
      priority: t.Optional(
        t.String({
          description: "Filter by priority level",
          examples: ["Low", "Medium", "High", "Critical"],
        })
      ),
      assignee: t.Optional(
        t.Union(
          [t.Literal("me"), t.Literal("unassigned"), t.Literal("created")],
          {
            description:
              'Filter by assignee: "me" for tasks assigned to you, "unassigned" for tasks without assignee, "created" for tasks you created',
          }
        )
      ),
      title: t.Optional(
        t.String({
          description: "Filter by task title (partial match)",
          examples: ["bug", "feature", "fix"],
        })
      ),
      due_date_start: t.Optional(
        t.String({
          description:
            "Filter tasks with due date after this date (ISO format)",
          examples: ["2024-01-01T00:00:00.000Z"],
        })
      ),
      due_date_end: t.Optional(
        t.String({
          description:
            "Filter tasks with due date before this date (ISO format)",
          examples: ["2024-12-31T23:59:59.000Z"],
        })
      ),
      created_at_start: t.Optional(
        t.String({
          description: "Filter tasks created after this date (ISO format)",
          examples: ["2024-01-01T00:00:00.000Z"],
        })
      ),
      created_at_end: t.Optional(
        t.String({
          description: "Filter tasks created before this date (ISO format)",
          examples: ["2024-12-31T23:59:59.000Z"],
        })
      ),
      search: t.Optional(
        t.String({
          description: "General search term (currently unused)",
          examples: ["bug fix", "feature"],
        })
      ),
    })
  ),
  detail: {
    tags: ["Tasks"],
    summary: "List tasks",
    description:
      "Retrieve a list of tasks that the user has created or is assigned to. Results can be filtered by various criteria and are ordered by priority level and creation date.",
    security: [{ bearerAuth: [] }],
  },
  response: {
    200: t.Object({
      tasks: t.Array(
        t.Object({
          id: t.Number(),
          title: t.String(),
          description: t.Union([t.String(), t.Null()]),
          due_date: t.Union([t.String(), t.Null()]),
          created_at: t.String(),
          updated_at: t.String(),
          status: t.Union([t.String(), t.Null()]),
          priority: t.Union([t.String(), t.Null()]),
          priority_level: t.Union([t.Number(), t.Null()]),
          creator_username: t.Union([t.String(), t.Null()]),
          assignee_username: t.Union([t.String(), t.Null()]),
          creator_id: t.Number(),
          assignee_id: t.Union([t.Number(), t.Null()]),
        })
      ),
      stats: t.Object(
        {},
        {
          additionalProperties: t.Number(),
          description: "Task count by status",
          examples: [{ "To Do": 5, "In Progress": 3, Completed: 10 }],
        }
      ),
    }),
    401: t.Object({
      message: t.String({ examples: ["Authentication required"] }),
    }),
    500: t.Object({
      message: t.String({ examples: ["Internal server error"] }),
    }),
  },
};
