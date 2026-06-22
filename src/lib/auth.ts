import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "gd_auth";

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET env var is missing or too short. Set it to a long random string in .env.local"
    );
  }
  return s;
}

export function expectedToken(): string {
  const username = process.env.AUTH_USERNAME ?? "";
  return crypto
    .createHmac("sha256", getSecret())
    .update(username)
    .digest("hex");
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.AUTH_USERNAME ?? "";
  const expectedPass = process.env.AUTH_PASSWORD ?? "";
  if (!expectedUser || !expectedPass) return false;

  const a = Buffer.from(username);
  const b = Buffer.from(expectedUser);
  const c = Buffer.from(password);
  const d = Buffer.from(expectedPass);
  if (a.length !== b.length || c.length !== d.length) return false;
  return (
    crypto.timingSafeEqual(a, b) && crypto.timingSafeEqual(c, d)
  );
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expectedToken(), "hex")
    );
  } catch {
    return false;
  }
}
