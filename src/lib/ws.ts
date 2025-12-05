// src/lib/ws.ts
export function resolveWsUrl(path = "/client/") {
  const raw =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_WS_BASE) ||
    (process.env.REACT_APP_WS_BASE as string) ||
    window.location.origin.replace(/^http/i, "ws"); // http->ws, https->wss

  const base = raw.replace(/\/+$/, ""); // trim trailing slash
  const cleanPath = ("/ws/" + path.replace(/^\/+/, "")).replace(/\/{2,}/g, "/"); // ensure /ws/<...>

  const token = localStorage.getItem("access_token");
  return token
    ? `${base}${cleanPath}?token=${encodeURIComponent(token)}`
    : `${base}${cleanPath}`;
}
