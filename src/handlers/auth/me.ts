import type { MeContext } from "../../types/auth";

export const meHandler = ({ set, user, headers }: MeContext) => {
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
    createdAt: user.created_at,
  };
};
