import { t } from "elysia";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../../types/auth";
import { generateTokens, AUTH_CONFIG } from "../../config/auth";
import type { Kysely } from "kysely";
import type { DB } from "../../db/db.d";

export const refreshHandler = async (context: {
  headers: { authorization?: string };
  set: { status?: number | string };
  db: Kysely<DB>;
}) => {
  const { headers, set, db } = context;
  const refreshToken = headers["authorization"]?.split(" ")[1];

  if (!refreshToken) {
    set.status = 401;
    return { message: "Refresh token not provided" };
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      AUTH_CONFIG.JWT_SECRET
    ) as JwtPayload;

    const session = await db
      .selectFrom("sessions")
      .selectAll()
      .where("refresh_token", "=", refreshToken)
      .where("user_id", "=", decoded.userId)
      .executeTakeFirst();

    if (!session || new Date(session.refresh_expires_at!) < new Date()) {
      set.status = 401;
      return { message: "Invalid or expired refresh token" };
    }

    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", decoded.userId)
      .executeTakeFirst();
    if (!user) {
      set.status = 401;
      return { message: "User not found" };
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      generateTokens(Number(user.id!), user.username!);

    await db
      .updateTable("sessions")
      .set({
        auth_token: newAccessToken,
        refresh_token: newRefreshToken,
        auth_expires_at: new Date(
          Date.now() + AUTH_CONFIG.ACCESS_TOKEN_EXPIRY_MS
        ).toISOString(),
        refresh_expires_at: new Date(
          Date.now() + AUTH_CONFIG.REFRESH_TOKEN_EXPIRY_MS
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", Number(session.id!))
      .execute();

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error) {
    set.status = 401;
    return { message: "Invalid refresh token" };
  }
};

export const refreshSchema = {
  detail: {
    tags: ["Authentication"],
    summary: "Refresh access token",
    description:
      "Use a refresh token to get a new access token and refresh token pair. The refresh token should be provided in the Authorization header as Bearer token.",
    security: [{ bearerAuth: [] }],
  },
  response: {
    200: t.Object({
      accessToken: t.String({
        description: "New JWT access token (expires in 15 minutes)",
        examples: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
      }),
      refreshToken: t.String({
        description: "New JWT refresh token (expires in 7 days)",
        examples: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
      }),
    }),
    401: t.Object({
      message: t.String({
        examples: [
          "Refresh token not provided",
          "Invalid or expired refresh token",
          "User not found",
          "Invalid refresh token",
        ],
      }),
    }),
  },
};
