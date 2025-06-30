import { Context } from "elysia";
import { DB, Users } from "../db/db.d";
import { Kysely } from "kysely";

export interface AuthContext extends Context {
  db: Kysely<DB>;
}

export interface MeContext extends Context {
  user: Users | null;
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
