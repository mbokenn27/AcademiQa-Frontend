// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  task?: any;
  message?: any;
  user_id?: number;
  username?: string;
  is_typing?: boolean;
}

/** Read WS base from env (Vite or CRA), fallback to window.origin (http->ws, https->wss). */
function getWsBase(): string {
  const vite = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_WS_BASE) || "";
  const cra  = (process.env.REACT_APP_WS_BASE as string) || "";
  let base = (vite || cra || "").trim();

  if (!base) {
    // derive from current page origin
    base = "wss://academiqa-backend-production.up.railway.app";
  }
  // normalize: remove trailing slash
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

/** Join base + path safely (handles whether url has leading slash). */
function joinWsUrl(base: string, path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return base + path;
}

/** Build a full ws(s) URL from either an absolute ws(s) URL or a relative path like "/ws/admin/". */
function resolveWebSocketUrl(input: string): string {
  const u = input.trim();
  if (u.startsWith("ws://") || u.startsWith("wss://")) {
    return u; // already absolute
  }
  if (u.startsWith("/")) {
    return joinWsUrl(getWsBase(), u); // relative path
  }
  // treat as relative path missing the leading slash
  return joinWsUrl(getWsBase(), "/" + u);
}

/**
 * Hook to connect to a WebSocket URL.
 * - Pass absolute ws(s) URL OR a relative path like "/ws/admin/?token=XYZ"
 * - Reconnects with backoff on non-normal close.
 */
export const useWebSocket = (url: string, onMessage: (data: WebSocketMessage) => void) => {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    try {
      const wsUrl = resolveWebSocketUrl(url);

      console.log(`🔄 Connecting to WebSocket: ${wsUrl}`);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("✅ WebSocket connected successfully");
        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log("📨 WebSocket message received:", data);
          onMessage(data);
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error);
        }
      };

      ws.current.onclose = (event) => {
        console.log("🔌 WebSocket disconnected:", event.code, event.reason);

        // Attempt reconnect after 3 seconds if not normal closure
        if (event.code !== 1000) {
          reconnectTimeout.current = setTimeout(() => {
            console.log("🔄 Attempting to reconnect WebSocket...");
            connect();
          }, 3000);
        }
      };

      ws.current.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
      };
    } catch (error) {
      console.error("❌ WebSocket connection failed:", error);
    }
  }, [url, onMessage]);

  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) ws.current.close(1000, "Component unmounted");
    };
  }, [connect, url]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  return { sendMessage, ws: ws.current };
};
