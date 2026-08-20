import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { ensureUser } from "@/lib/db/userdata";

/**
 * The auth seam.
 *
 * There is no real auth yet. Every visitor gets a stable anonymous id in a `jot_uid` cookie,
 * which is also the row this app's FK-honest `ensureUser` needs to exist. Every route handler
 * calls this one function to find out "who is asking" — when real auth lands, only this
 * function's body changes; every call site already just wants a user id back.
 */

const COOKIE_NAME = "jot_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function getCurrentUserId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;

  if (existing) {
    ensureUser(existing);
    return existing;
  }

  const id = randomUUID();
  // Route Handlers (unlike Server Components) can write cookies directly through this API.
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  ensureUser(id);
  return id;
}

/** Read-only counterpart for Server Components, where cookies cannot be mutated. */
export async function getExistingUserId(): Promise<string | null> {
  const existing = (await cookies()).get(COOKIE_NAME)?.value;
  if (!existing) return null;
  ensureUser(existing);
  return existing;
}
