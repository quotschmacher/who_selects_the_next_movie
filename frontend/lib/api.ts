const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
async function handle(res) {
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}
export const api = {
  async get(path) { const res = await fetch(`${BACKEND}${path}`, { method: "GET", cache: "no-store" }); return handle(res); },
  async post(path, body) { const res = await fetch(`${BACKEND}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return handle(res); },
  async del(path) { const res = await fetch(`${BACKEND}${path}`, { method: "DELETE" }); return handle(res); },
  async patch(path, body) { const res = await fetch(`${BACKEND}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return handle(res); },
};
