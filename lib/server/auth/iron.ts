import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AppSession = {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
};

const options: SessionOptions = {
  cookieName: "qacf_session",
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<AppSession>> {
  return getIronSession<AppSession>(cookies(), options);
}

export async function setUserInSession(user: { id: string; email: string; name?: string | null }) {
  const s = await getSession();
  s.userId = user.id;
  s.userEmail = user.email;
  s.userName = user.name ?? null;
  await s.save();
}

export async function requireUserId(): Promise<string> {
  const s = await getSession();
  if (!s.userId) throw new Error("AUTH_REQUIRED");
  return s.userId;
}

export async function clearSession() {
  const s = await getSession();
  await s.destroy();
}