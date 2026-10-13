import { beforeEach, describe, expect, it } from "vitest";
import { AuthError, normalisePhone, requestOtp, sanitizeReturnTo, userForToken, verifyOtp } from "./auth";
import { resetStore } from "./store";

describe("return to the property after login (open-redirect safe)", () => {
  it.each([
    ["/p/PR-1001", "/p/PR-1001"],
    ["/p/PR-1001?from=whatsapp", "/p/PR-1001?from=whatsapp"],
    ["/requests", "/requests"],
    [null, "/"],
    ["", "/"],
    ["https://evil.example/p/PR-1001", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["/login?next=/p/x", "/"],
    ["/api/v1/me", "/"],
    ["p/PR-1001", "/"],
  ])("%s -> %s", (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });
});

describe("OTP login", () => {
  beforeEach(() => resetStore());

  it("normalises Indian mobile numbers", () => {
    expect(normalisePhone("98765 43210")).toBe("+919876543210");
    expect(normalisePhone("+919876543210")).toBe("+919876543210");
    expect(normalisePhone("12345")).toBeNull();
  });

  it("asks a new user for their name without burning the code", () => {
    const { challengeId } = requestOtp("9876543210");
    expect(() => verifyOtp(challengeId, "123456")).toThrow(AuthError);
    const { user, session } = verifyOtp(challengeId, "123456", "Priya");
    expect(user.role).toBe("student");
    expect(userForToken(session.token)?.id).toBe(user.id);
  });

  it("locks a code after repeated wrong attempts", () => {
    const { challengeId } = requestOtp("9876543210");
    for (let i = 0; i < 5; i++) expect(() => verifyOtp(challengeId, "000000", "x")).toThrow(/Incorrect/);
    expect(() => verifyOtp(challengeId, "123456", "x")).toThrow(/expired/);
  });
});
