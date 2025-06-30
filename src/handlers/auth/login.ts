import { t } from "elysia";
import type { Users } from "../../db/db.d";
import bcrypt from "bcrypt";
import type { AuthContext, LoginBody } from "../../types/auth";
import { generateTokens, AUTH_CONFIG } from "../../config/auth";

export const loginHandler = async ({
  body,
  set,
  db,
}: AuthContext & { body: LoginBody }) => {
  try {
    const { username, password } = body;

    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("username", "=", username)
      .executeTakeFirst();
    if (!user) {
      set.status = 401;
      return { message: "Invalid credentials" };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash!);
    if (!isPasswordValid) {
      set.status = 401;
      return { message: "Invalid credentials" };
    }

    const { accessToken, refreshToken } = generateTokens(
      Number(user.id!),
      user.username!,
    );

    await db
      .insertInto("sessions")
      .values({
        user_id: Number(user.id!),
        refresh_token: refreshToken,
        auth_token: accessToken,
        auth_expires_at: new Date(
          Date.now() + AUTH_CONFIG.ACCESS_TOKEN_EXPIRY_MS,
        ).toISOString(),
        refresh_expires_at: new Date(
          Date.now() + AUTH_CONFIG.REFRESH_TOKEN_EXPIRY_MS,
        ).toISOString(),
      })
      .execute();

    return {
      accessToken,
      refreshToken,
      user: { id: user.id!, username: user.username! },
    };
  } catch (error) {
    set.status = 500;
    return { message: "Internal server error" };
  }
};

export const loginSchema = {
  body: t.Object({
    username: t.String(),
    password: t.String(),
  }),
};
