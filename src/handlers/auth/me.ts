import { t } from "elysia";
import type { UserData } from "../../types/auth";

export const meHandler = (context: {
  set: { status?: number | string };
  user: UserData | null;
  headers: { authorization?: string };
}) => {
  const { set, user, headers } = context;
  const authHeader = headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    set.status = 401;
    return { message: "No token provided" };
  }

  if (!user) {
    set.status = 401;
    return { message: "Invalid or expired token" };
  }

  return {
    id: user.id!,
    username: user.username!,
    email: user.email!,
    fullName: user.full_name,
    createdAt: user.created_at || new Date().toISOString(),
  };
};

export const meSchema = {
  detail: {
    tags: ["Authentication"],
    summary: "Get current user profile",
    description:
      "Retrieve the profile information of the currently authenticated user.",
    security: [{ bearerAuth: [] }],
  },
  response: {
    200: t.Object({
      id: t.Number({ examples: [1, 5, 12] }),
      username: t.String({ examples: ["johndoe", "admin"] }),
      email: t.String({ examples: ["john@example.com", "admin@company.com"] }),
      fullName: t.Union([t.String(), t.Null()], {
        examples: ["John Doe", null],
      }),
      createdAt: t.String({ examples: ["2024-01-15T10:30:00.000Z"] }),
    }),
    401: t.Object({
      message: t.String({
        examples: ["No token provided", "Invalid or expired token"],
      }),
    }),
  },
};
