import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const SESSION_COOKIE_NAME = "swr_teacher_session";

export interface TeacherAuthConfig {
  password: string;
  sessionSecret: string;
  sessionTtlMs: number;
  secureCookie: boolean;
}

export const teacherCookieOptions = (config: TeacherAuthConfig) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.secureCookie,
  path: "/",
  maxAge: config.sessionTtlMs,
});

function digest(value: string): Buffer {
  return createHmac("sha256", "speak-with-rhythm-password-check")
    .update(value)
    .digest();
}

export function passwordMatches(
  suppliedPassword: string,
  expectedPassword: string,
): boolean {
  return timingSafeEqual(digest(suppliedPassword), digest(expectedPassword));
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createTeacherSession(config: TeacherAuthConfig): string {
  const payload = `${Date.now()}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${sign(payload, config.sessionSecret)}`;
}

export function isValidTeacherSession(
  token: string | undefined,
  config: TeacherAuthConfig,
): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [issuedAtText, nonce, suppliedSignature] = parts;
  const issuedAt = Number(issuedAtText);
  if (
    !Number.isFinite(issuedAt) ||
    Date.now() - issuedAt > config.sessionTtlMs ||
    issuedAt > Date.now() + 30_000
  ) {
    return false;
  }

  const payload = `${issuedAtText}.${nonce}`;
  const expectedSignature = sign(payload, config.sessionSecret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function readCookie(
  cookieHeader: string | undefined,
  name = SESSION_COOKIE_NAME,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) {
      continue;
    }

    const key = pair.slice(0, separator).trim();
    if (key === name) {
      try {
        return decodeURIComponent(pair.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

export { SESSION_COOKIE_NAME };
