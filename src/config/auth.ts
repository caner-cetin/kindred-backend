import jwt from "jsonwebtoken";

export const AUTH_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || "supersecretjwtkey",
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",
  ACCESS_TOKEN_EXPIRY_MS: 15 * 60 * 1000, // 15 minutes in milliseconds
  REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
} as const;

export const generateTokens = (userId: number, username: string) => {
  const accessToken = jwt.sign({ userId, username }, AUTH_CONFIG.JWT_SECRET, {
    expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ userId, username }, AUTH_CONFIG.JWT_SECRET, {
    expiresIn: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY,
  });
  return { accessToken, refreshToken };
};
