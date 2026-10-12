import type { Role, UserInfo } from "./types";

const TOKEN_KEY = "fahr_token";
const USER_KEY = "fahr_user";

/** 电子简历系统地址：店长/客户hr 不属于 HRS 内部用户，访问 HRS 时引导过去 */
export const RESUME_URL = import.meta.env.PROD
  ? "https://resume.nickhome.cloud/"
  : "http://localhost:3100/";

export function isResumeOnlyRole(role: Role | undefined): boolean {
  return role === "manager" || role === "hr";
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setAuth(token: string, user: UserInfo): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
