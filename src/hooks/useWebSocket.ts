// src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from "react";

export function useWebSocket(wsUrl: string | null, onMessage: (data: any) => void, deps: any[] = []) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!wsUrl) return;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        reconnectRef.current = 0;
        setSocket(ws);
        console.log("WS connected:", wsUrl);
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessage(data);
        } catch (err) {
          console.error("WS parse error", err);
        }
      };
      ws.onerror = () => {
        console.error("WS error");
      };
      ws.onclose = () => {
        setSocket(null);
        const attempt = Math.min(reconnectRef.current + 1, 6);
        reconnectRef.current = attempt;
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        timerRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (socket?.readyState === WebSocket.OPEN) socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl, ...deps]);

  const sendMessage = (data: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };
  return { sendMessage };
}
