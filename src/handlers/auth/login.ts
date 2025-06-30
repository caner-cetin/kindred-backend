import { t } from "elysia";
import type { Users, DB } from "../../db/db.d";
import bcrypt from "bcrypt";
import type { LoginBody } from "../../types/auth";
import { generateTokens, AUTH_CONFIG } from "../../config/auth";
import { Kysely } from "kysely";

export const loginHandler = async (context: {
  body: LoginBody;
  set: { status?: number | string };
  db: Kysely<DB>;
}) => {
  const { body, set, db } = context;
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
      user.username!
    );

    await db
      .insertInto("sessions")
      .values({
        user_id: Number(user.id!),
        refresh_token: refreshToken,
        auth_token: accessToken,
        auth_expires_at: new Date(
          Date.now() + AUTH_CONFIG.ACCESS_TOKEN_EXPIRY_MS
        ).toISOString(),
        refresh_expires_at: new Date(
          Date.now() + AUTH_CONFIG.REFRESH_TOKEN_EXPIRY_MS
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
    username: t.String({
      description: "Username for authentication",
      examples: ["johndoe", "admin", "testuser"],
    }),
    password: t.String({
      description: "User password",
      examples: ["password123", "mySecurePass!"],
    }),
  }),
  detail: {
    tags: ["Authentication"],
    summary: "User login",
    description:
      "Authenticate user with username and password. Returns JWT tokens for subsequent API calls.",
  },
  response: {
    200: t.Object({
      accessToken: t.String({
        description: "JWT access token (expires in 15 minutes)",
        examples: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
      }),
      refreshToken: t.String({
        description: "JWT refresh token (expires in 7 days)",
        examples: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
      }),
      user: t.Object({
        id: t.Number({ examples: [1, 5, 12] }),
        username: t.String({ examples: ["johndoe", "admin"] }),
      }),
    }),
    401: t.Object({
      message: t.String({ examples: ["Invalid credentials"] }),
    }),
    500: t.Object({
      message: t.String({ examples: ["Internal server error"] }),
    }),
  },
};
