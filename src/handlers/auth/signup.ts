import { t } from "elysia";
import bcrypt from "bcrypt";
import type { SignupBody } from "../../types/auth";
import { generateTokens, AUTH_CONFIG } from "../../config/auth";
import type { Kysely } from "kysely";
import type { DB } from "../../db/db.d";

export const signupHandler = async (context: {
  body: SignupBody;
  set: { status?: number | string };
  db: Kysely<DB>;
}) => {
  const { body, set, db } = context;
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
      newUser.username!
    );

    await db
      .insertInto("sessions")
      .values({
        user_id: Number(newUser.id!),
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
      user: { id: newUser.id!, username: newUser.username! },
    };
  } catch (error) {
    set.status = 500;
    return { message: "Internal server error" };
  }
};

export const signupSchema = {
  body: t.Object({
    username: t.String({
      description: "Unique username for the account",
      examples: ["johndoe", "admin", "newuser"],
    }),
    password: t.String({
      description: "Password for the account",
      examples: ["mySecurePassword123"],
    }),
    email: t.String({
      description: "Email address for the account",
      examples: ["john@example.com", "user@domain.com"],
    }),
    fullName: t.Optional(
      t.String({
        description: "Optional full name of the user",
        examples: ["John Doe", "Jane Smith"],
      })
    ),
  }),
  detail: {
    tags: ["Authentication"],
    summary: "User registration",
    description:
      "Create a new user account. Returns JWT tokens for immediate authentication after successful registration.",
  },
  response: {
    201: t.Object({
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
        username: t.String({ examples: ["johndoe", "newuser"] }),
      }),
    }),
    409: t.Object({
      message: t.String({ examples: ["Username already exists"] }),
    }),
    500: t.Object({
      message: t.String({ examples: ["Internal server error"] }),
    }),
  },
};
