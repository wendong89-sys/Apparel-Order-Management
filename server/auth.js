import crypto from "node:crypto";

import { readUsers, verifyPassword } from "./store.js";

const sessions = new Map();
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 12 * 60 * 60 * 1000);

export async function login(username, password) {
  const users = await readUsers();
  const user = users.find((item) => item.username === username);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const publicUser = { id: user.id, username: user.username, name: user.name, role: user.role };
  sessions.set(token, { user: publicUser, expiresAt: Date.now() + SESSION_TTL_MS });
  return { token, user: publicUser };
}

export function authenticate(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}
