import { t } from "elysia";
import { Messages } from "../../constants/messages";
import type { Kysely } from "kysely";
import type { DB } from "../../db/db.d";
import type { UserData } from "../../types/auth";

export const getTaskMetadataHandler = async (context: {
  set: { status?: number | string };
  db: Kysely<DB>;
  user: UserData | null;
}) => {
  const { set, db, user } = context;
  if (!user) {
    set.status = 401;
    return { message: Messages.AUTH_REQUIRED };
  }

  try {
    // Get all priorities
    const priorities = await db
      .selectFrom("priorities")
      .selectAll()
      .orderBy("level", "asc")
      .execute();

    // Get all statuses
    const statuses = await db.selectFrom("statuses").selectAll().execute();

    // Get all users for assignment
    const users = await db
      .selectFrom("users")
      .select(["id", "username", "email", "full_name"])
      .execute();

    return {
      priorities: priorities.map(p => ({ id: p.id!, name: p.name })),
      statuses: statuses.map(s => ({ id: s.id!, name: s.name })),
      users: users.map(u => ({ id: u.id!, username: u.username, email: u.email })),
    };
  } catch (error) {
    console.error(Messages.GET_TASK_METADATA_ERROR, error);
    set.status = 500;
    return { message: Messages.INTERNAL_SERVER_ERROR };
  }
};

export const getTaskMetadataSchema = {
  detail: {
    tags: ["Tasks"],
    summary: "Get task metadata",
    description:
      "Retrieve available priorities, statuses, and users for task creation and updates.",
    security: [{ bearerAuth: [] }],
  },
  response: {
    200: t.Object({
      priorities: t.Array(
        t.Object({
          id: t.Number(),
          name: t.String({ examples: ["Low", "Medium", "High", "Critical"] }),
        })
      ),
      statuses: t.Array(
        t.Object({
          id: t.Number(),
          name: t.String({ examples: ["To Do", "In Progress", "Completed"] }),
        })
      ),
      users: t.Array(
        t.Object({
          id: t.Number(),
          username: t.String(),
          email: t.String(),
        })
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
