import { AuthContext } from "../../types/auth";
import { Messages } from "../../constants/messages";

export const getTaskMetadataHandler = async ({
  set,
  db,
  user,
}: AuthContext & { user: any }) => {
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
      priorities,
      statuses,
      users,
    };
  } catch (error) {
    console.error(Messages.GET_TASK_METADATA_ERROR, error);
    set.status = 500;
    return { message: Messages.INTERNAL_SERVER_ERROR };
  }
};
