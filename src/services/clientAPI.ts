// src/services/clientAPI.ts

function resolveApiBase(): string {
  const vite = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";
  const cra  = (process.env.REACT_APP_API_BASE as string) || "";
  const raw  = (vite || cra || "").trim();

  // No env provided → same-origin '/api'
  if (!raw) return "/api";

  // Normalize trailing slash
  const noTrail = raw.replace(/\/+$/, "");

  // If absolute URL with no path → add '/api'
  if (/^https?:\/\/[^/]+$/i.test(noTrail)) return `${noTrail}/api`;

  // If already ends with '/api' or has a path → use as-is
  return noTrail.endsWith("/api") ? noTrail : noTrail; // leave custom paths untouched
}

// Join base + path safely, stripping accidental '/api' prefix from path.
function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p0 = path.startsWith("/") ? path : `/${path}`;
  const p = p0.replace(/^\/api\/(.*)$/i, "/$1"); // guard against '/api/...'
  return `${b}${p}`;
}

const API_BASE = resolveApiBase();

// ---- Auth header & fetch handling -------------------------------------------
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`, // WHY: avoid 'Bearer null'
  "Content-Type": "application/json",
});

async function handle(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  // If 204/empty, guard JSON parse
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null as unknown as any;
  return res.json();
}

// ---- Public API --------------------------------------------------------------
export const clientAPI = {
  // Current user
  getCurrentUser: () =>
    fetch(joinUrl(API_BASE, "/auth/user/"), { headers: authHeaders() }).then(handle),

  // Client tasks
  getTasks: () =>
    fetch(joinUrl(API_BASE, "/tasks/"), { headers: authHeaders() }).then(handle),

  getTask: (id: string | number) =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/`), { headers: authHeaders() }).then(handle),

  createTask: (data: any) =>
    fetch(joinUrl(API_BASE, "/tasks/"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    }).then(handle),

  updateTask: (id: string | number, data: any) =>
    fetch(joinUrl(API_BASE, `/tasks/${id}/`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(data),
    }).then(handle),

  // Budget negotiation (client)
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

  // Chat
  getMessages: (taskId: string | number) =>
    fetch(joinUrl(API_BASE, `/tasks/${taskId}/chat/`), { headers: authHeaders() }).then(handle),

  sendMessage: (taskId: string | number, messageData: any) =>
    fetch(joinUrl(API_BASE, `/tasks/${taskId}/chat/`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(messageData),
    }).then(handle),

  // Notifications
  getNotifications: () =>
    fetch(joinUrl(API_BASE, "/notifications/"), { headers: authHeaders() }).then(handle),

  markNotificationRead: (id: string | number) =>
    fetch(joinUrl(API_BASE, `/notifications/${id}/read/`), {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),
};

export default clientAPI;
