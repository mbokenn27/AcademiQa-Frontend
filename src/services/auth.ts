// src/services/auth.ts
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SignUpData {
  username: string;
  email: string;
  password: string;
  [k: string]: any;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  [k: string]: any;
}

// ————————————————————————————————————————
// Base + helpers
// Expect VITE_API_BASE to be either
//   https://host          OR
//   https://host/api
// We’ll safely ensure we hit /api/* exactly once.
// ————————————————————————————————————————
const RAW_BASE = (import.meta as any).env?.VITE_API_BASE || "";
const BASE = String(RAW_BASE).replace(/\/+$/, ""); // trim trailing slash

function api(path: string) {
  // ensure we end up with .../api/<path>
  const p = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return `${BASE}${p}`;
}

function authHeader() {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const detail = (body as any)?.detail || (body as any)?.error || res.statusText;
    throw new Error(typeof detail === "string" ? detail : `Request failed: ${res.status}`);
  }
  return body as T;
}

// ————————————————————————————————————————
// Auth service
// ————————————————————————————————————————
export const authService = {
  // POST /api/token/ -> { access, refresh } (DRF SimpleJWT)
  // then GET /api/auth/user/
  async login(credentials: LoginCredentials): Promise<{
    user: User;
    access_token: string;
    refresh_token: string;
  }> {
    const tokenResp = await jsonFetch<{ access?: string; refresh?: string; access_token?: string; refresh_token?: string }>(
      api("/token/"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      }
    );

    const access = tokenResp.access || tokenResp.access_token;
    const refresh = tokenResp.refresh || tokenResp.refresh_token;

    if (!access) throw new Error("Login failed: no access token returned");

    localStorage.setItem("access_token", access);
    if (refresh) localStorage.setItem("refresh_token", refresh);

    // Try to read user info
    let user: User;
    try {
      user = await jsonFetch<User>(api("/auth/user/"), { headers: authHeader() });
    } catch {
      // If your backend returned user in login response, fall back to that
      user = (tokenResp as any).user as User;
      if (!user) throw new Error("Login succeeded but user info not available");
    }

    return { user, access_token: access, refresh_token: refresh || "" };
  },

  // POST /api/token/refresh/ -> { access }
  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string }> {
    const resp = await jsonFetch<{ access?: string; refresh?: string; access_token?: string; refresh_token?: string }>(
      api("/token/refresh/"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      }
    );

    const access = resp.access || resp.access_token;
    const refresh = resp.refresh || resp.refresh_token;

    if (!access) throw new Error("Refresh failed: no access token returned");

    return { access_token: access, ...(refresh ? { refresh_token: refresh } : {}) };
  },

  // GET /api/auth/user/
  async getCurrentUser(): Promise<User> {
    return jsonFetch<User>(api("/auth/user/"), { headers: authHeader() });
  },

  // If you have sign-up, adjust the endpoint if your backend differs
  // Common choices: /api/auth/signup/ or /api/auth/register/
  async signup(data: SignUpData): Promise<{
    user: User;
    access_token: string;
    refresh_token: string;
  }> {
    // Try /signup/ first; fallback to /register/
    let resp:
      | { user?: User; access?: string; refresh?: string; access_token?: string; refresh_token?: string }
      | undefined;

    try {
      resp = await jsonFetch(api("/auth/signup/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      resp = await jsonFetch(api("/auth/register/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }

    const access = (resp as any).access || (resp as any).access_token;
    const refresh = (resp as any).refresh || (resp as any).refresh_token;
    const user = (resp as any).user as User;

    if (!access || !user) throw new Error("Signup failed");

    return { user, access_token: access, refresh_token: refresh || "" };
  },

  logout() {
    // If you have a server-side logout, call it here. Otherwise local only.
    // await fetch(api('/auth/logout/'), { method: 'POST', headers: authHeader() }).catch(() => {});
    return;
  },
};
