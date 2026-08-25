import { cookies } from "next/headers";
import { apiConfig } from "@planazo/config";
import type { AuthUser } from "@planazo/types";

/**
 * Server-side session check — forwards the incoming session cookie to the
 * shared API's /auth/me. Returns null if there's no session or it's invalid.
 */
export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  const res = await fetch(`${apiConfig.baseUrl}/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}
