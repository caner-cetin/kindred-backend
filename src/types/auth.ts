import type { Kysely } from "kysely";
import type { DB } from "../db/db.d";
import type { Context } from "elysia";

// Type for user data that comes back from database queries
export type UserData = {
  id: number | null;
  username: string;
  email: string;
  full_name: string | null;
  password_hash: string;
  created_at: string | null;
};

// Elysia context type with proper `set` structure
export interface ElysiaSetContext {
  status?: number | string;
  headers?: Record<string, string>;
}

// Handler context for login (no user authentication required)
export interface LoginHandlerContext {
  body: LoginBody;
  db: Kysely<DB>;
  set: ElysiaSetContext;
}

// Handler context for refresh (no user authentication required)
export interface RefreshHandlerContext {
  body: { refreshToken: string };
  db: Kysely<DB>;
  set: ElysiaSetContext;
  headers: Record<string, string | undefined>;
}

// Handler context for signup (no user authentication required)
export interface SignupHandlerContext {
  body: SignupBody;
  db: Kysely<DB>;
  set: ElysiaSetContext;
}

// Handler context for authenticated routes
export interface AuthenticatedHandlerContext {
  db: Kysely<DB>;
  user: UserData | null;
  set: ElysiaSetContext;
  headers: Record<string, string | undefined>;
}

export interface JwtPayload {
  userId: number;
  username: string;
}

export interface SignupBody {
  username: string;
  password: string;
  email: string;
  fullName?: string;
}

export interface LoginBody {
  username: string;
  password: string;
}
