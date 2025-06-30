import { describe, it, expect, beforeAll } from "bun:test";
import { App, createApp } from "../src/index";
import { treaty } from "@elysiajs/eden";

describe("Auth", () => {
  let api: any;

  beforeAll(async () => {
    const app = await createApp(":memory:");
    api = treaty(app);
  });
  it("should allow a user to sign up", async () => {
    const { data, status } = await api.signup.post({
      username: "testuser",
      password: "password123",
      email: "test@example.com",
      fullName: "Test User",
    });

    expect(status).toEqual(200);
    expect(data).not.toBeNull();
    expect(data).toHaveProperty("accessToken");
    expect(data).toHaveProperty("refreshToken");
    expect(data?.user).not.toBeNull();
    expect(data?.user?.username).toEqual("testuser");
  });

  it("should not allow signup with existing username", async () => {
    await api.signup.post({
      username: "existinguser",
      password: "password123",
      email: "existing@example.com",
    });

    const { data, error, status } = await api.signup.post({
      username: "existinguser",
      password: "anotherpassword",
      email: "another@example.com",
    });

    expect(status).toEqual(409);
    expect(error).not.toBeNull();
    expect(error?.value?.message).toEqual("Username already exists");
  });

  it("should allow a user to log in", async () => {
    await api.signup.post({
      username: "loginuser",
      password: "loginpassword",
      email: "login@example.com",
    });

    const { data, status } = await api.login.post({
      username: "loginuser",
      password: "loginpassword",
    });

    expect(status).toEqual(200);
    expect(data).toHaveProperty("accessToken");
    expect(data).toHaveProperty("refreshToken");
  });

  it("should not allow login with invalid credentials", async () => {
    const { data, error, status } = await api.login.post({
      username: "nonexistentuser",
      password: "wrongpassword",
    });

    expect(status).toEqual(401);
    expect(error).not.toBeNull();
    expect(error?.value?.message).toEqual("Invalid credentials");
  });

  it("should return user info with a valid access token", async () => {
    const { data: signupData } = await api.signup.post({
      username: "protecteduser",
      password: "protectedpassword",
      email: "protected@example.com",
    });

    expect(signupData).not.toBeNull();
    const accessToken = signupData?.accessToken;

    const { data, status } = await api.me.get({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(status).toEqual(200);
    expect(data).toHaveProperty("id");
    expect(data?.username).toEqual("protecteduser");
    expect(data?.email).toEqual("protected@example.com");
    expect(data).not.toHaveProperty("password_hash");
  });

  it("should not return user info without an access token", async () => {
    const { data, error, status } = await api.me.get();

    expect(status).toEqual(401);
    expect(error).not.toBeNull();
    expect(error?.value?.message).toEqual("No token provided");
  });

  it("should not return user info with an invalid access token", async () => {
    const { data, error, status } = await api.me.get({
      headers: {
        Authorization: "Bearer invalidtoken",
      },
    });

    expect(status).toEqual(401);
    expect(error).not.toBeNull();
    expect(error?.value?.message).toEqual("Invalid or expired token");
  });

  it("should refresh tokens with a valid refresh token", async () => {
    const { data: signupData } = await api.signup.post({
      username: "refreshuser",
      password: "refreshpassword",
      email: "refresh@example.com",
    });

    const refreshToken = signupData.refreshToken;

    const { data, status } = await api.refresh.post(undefined, {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    expect(status).toEqual(200);
    expect(data).toHaveProperty("accessToken");
    expect(data).toHaveProperty("refreshToken");
  });

  it("should not refresh tokens with an invalid refresh token", async () => {
    const { data, error, status } = await api.refresh.post(undefined, {
      headers: {
        Authorization: "Bearer invalidrefreshtoken",
      },
    });

    expect(status).toEqual(401);
    expect(error).not.toBeNull();
    expect(error?.value?.message).toEqual("Invalid refresh token");
  });
});
