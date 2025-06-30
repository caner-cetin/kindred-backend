import jwt from "jsonwebtoken";
import { AuthContext, JwtPayload } from "../../types/auth";
import { generateTokens, AUTH_CONFIG } from "../../config/auth";
import { Sessions, Users } from "../../db/db.d";

export const refreshHandler = async ({ headers, set, db }: AuthContext) => {
  const refreshToken = headers["authorization"]?.split(" ")[1];

  if (!refreshToken) {
    set.status = 401;
    return { message: "Refresh token not provided" };
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      AUTH_CONFIG.JWT_SECRET,
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
          Date.now() + AUTH_CONFIG.ACCESS_TOKEN_EXPIRY_MS,
        ).toISOString(),
        refresh_expires_at: new Date(
          Date.now() + AUTH_CONFIG.REFRESH_TOKEN_EXPIRY_MS,
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
