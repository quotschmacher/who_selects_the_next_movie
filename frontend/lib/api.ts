const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function handle<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  async get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${BACKEND}${path}`, { method: "GET", cache: "no-store" });
    return handle<T>(res);
  },
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BACKEND}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return handle<T>(res);
  },
  async del<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${BACKEND}${path}`, { method: "DELETE" });
    return handle<T>(res);
  },
  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BACKEND}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return handle<T>(res);
  },
};
