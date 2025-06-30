import { Kysely } from "kysely";
import type { DB } from "../../db/db.d";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../../types/auth";
import { AUTH_CONFIG } from "../../config/auth";

export const verifyAccessToken = async (token: string, db: Kysely<DB>) => {
  try {
    const decoded = jwt.verify(token, AUTH_CONFIG.JWT_SECRET) as JwtPayload;

    // Check if token exists in sessions and is not expired
    const session = await db
      .selectFrom("sessions")
      .selectAll()
      .where("auth_token", "=", token)
      .where("user_id", "=", decoded.userId)
      .executeTakeFirst();

    if (!session || new Date(session.auth_expires_at!) < new Date()) {
      return null;
    }

    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", Number(decoded.userId))
      .executeTakeFirst();

    if (!user) {
      return null;
    }
    return user;
  } catch (error) {
    return null;
  }
};
