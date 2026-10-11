export async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // 响应不是 JSON
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
