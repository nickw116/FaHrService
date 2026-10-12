import { clearAuth, getToken } from "./auth";

const BASE = import.meta.env.BASE_URL;

export function withBase(p: string): string {
  return BASE + p.replace(/^\/+/, "");
}

export async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(options?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(withBase(url), { ...options, headers });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // 响应不是 JSON
  }
  if (res.status === 401 && !url.startsWith("/api/auth/login")) {
    clearAuth();
    window.location.assign(withBase("login"));
    throw new Error("登录已过期，请重新登录");
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : "请求失败";
    throw new Error(message);
  }
  return data as T;
}
