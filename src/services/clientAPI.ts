/**
 * REST + WS client helpers (Vite).
 * - VITE_API_URL: '/api' or 'https://api.example.com/api'
 * - VITE_WS_URL : 'wss://example.com/ws' (optional; /client/ added automatically)
 */

function resolveApiBase(): string {
  const raw =
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_API_URL) ||
    (process.env.REACT_APP_API_URL as string) ||
    "";

  if (!raw) return "/api";
  const noTrail = raw.trim().replace(/\/+$/, "");
  // Absolute host with no path → append '/api'
  if (/^https?:\/\/[^/]+$/i.test(noTrail)) return `${noTrail}/api`;
  return noTrail; // already '/api' or has a path
}

// Join base + path safely; strip '/api/' from path to avoid '/api/api/...'
function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p0 = path.startsWith("/") ? path : `/${path}`;
  const p = p0.replace(/^\/api\/(.*)$/i, "/$1");
  return `${b}${p}`;
}

const API_BASE = resolveApiBase();

// ------------- WS URL -------------
export function resolveWsUrl(): string {
  const fromEnv =
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_WS_URL) ||
    "";
  const normalized = fromEnv.trim().replace(/\/+$/, "");
  if (normalized) return `${normalized}/client/`;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws/client/`;
  }
  return "ws://localhost:8000/ws/client/";
}

const authHeaders = () => ({
  Authorization: localStorage.getItem("access_token")
    ? `Bearer ${localStorage.getItem("access_token")}`
    : "",
  "Content-Type": "application/json",
});

async function handle(res: Response) {
  if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null as unknown as any;
  return res.json();
}

export const clientAPI = {
  getCurrentUser: () =>
    fetch(joinUrl(API_BASE, "/auth/user/"), { headers: authHeaders() }).then(handle),

  getTasks: () => fetch(joinUrl(API_BASE, "/tasks/"), { headers: authHeaders() }).then(handle),

  getTask: (id: string | number) =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/`), { headers: authHeaders() }).then(handle),

  createTask: (data: unknown) =>
    fetch(joinUrl(API_BASE, "/tasks/"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    }).then(handle),

  updateTask: (id: string | number, data: unknown) =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(data),
    }).then(handle),

  acceptBudget: (id: string | number) =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/accept-budget/`), {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),

  counterBudget: (id: string | number, amount: number, reason = "") =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/counter-budget/`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ amount, reason }),
    }).then(handle),

  rejectBudget: (id: string | number) =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/reject-budget/`), {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),

  withdrawTask: (id: string | number, reason = "") =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/withdraw/`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    }).then(handle),

  approveTask: (id: string | number) =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/approve/`), {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),

  requestRevision: (id: string | number, feedback: string) =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/request-revision/`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ feedback }),
    }).then(handle),

  getMessages: (taskId: string | number) =>
    fetch(joinUrl(API_BASE, `/tasks/${taskId}/chat/`), { headers: authHeaders() }).then(handle),

  sendMessage: (taskId: string | number, messageData: unknown) =>
    fetch(joinUrl(API_BASE, `/tasks/${taskId}/chat/`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(messageData),
    }).then(handle),

  getNotifications: () =>
    fetch(joinUrl(API_BASE, "/notifications/"), { headers: authHeaders() }).then(handle),

  markNotificationRead: (id: string | number) =>
    fetch(joinUrl(API_BASE, `/notifications/${id}/read/`), {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),
};

export function getWebSocket(tokenParamKey = "token"): WebSocket {
  const url = new URL(resolveWsUrl());
  const access = localStorage.getItem("access_token");
  if (access) url.searchParams.set(tokenParamKey, access); // if your backend expects JWT in query
  return new WebSocket(url.toString());
}
