import { t } from "elysia";
import bcrypt from "bcrypt";
import type { AuthContext, SignupBody } from "../../types/auth";
import { generateTokens, AUTH_CONFIG } from "../../config/auth";

export const signupHandler = async ({
  body,
  set,
  db,
}: AuthContext & { body: SignupBody }) => {
  try {
    const { username, password, email, fullName } = body;

    const existingUser = await db
      .selectFrom("users")
      .selectAll()
      .where("username", "=", username)
      .executeTakeFirst();
    if (existingUser) {
      set.status = 409;
      return { message: "Username already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db
      .insertInto("users")
      .values({
        username,
        password_hash: hashedPassword,
        email,
        full_name: fullName,
      })
      .execute();

    const newUser = await db
      .selectFrom("users")
      .where("username", "=", username)
      .selectAll()
      .executeTakeFirstOrThrow();

    const { accessToken, refreshToken } = generateTokens(
      Number(newUser.id!),
      newUser.username!,
    );

    await db
      .insertInto("sessions")
      .values({
        user_id: Number(newUser.id!),
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
      user: { id: newUser.id!, username: newUser.username! },
    };
  } catch (error) {
    set.status = 500;
    return { message: "Internal server error" };
  }
};

export const signupSchema = {
  body: t.Object({
    username: t.String(),
    password: t.String(),
    email: t.String(),
    fullName: t.Optional(t.String()),
  }),
};
