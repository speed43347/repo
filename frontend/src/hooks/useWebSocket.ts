import { useEffect, useRef, useCallback } from 'react';

type Handler = (data: any) => void;

export function useWebSocket(token: string | null, onMessage: Handler) {
  const ws = useRef<WebSocket | null>(null);
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  const send = useCallback((data: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    let closed = false;

    const connect = () => {
      if (closed) return;
      const socket = new WebSocket(`ws://localhost:8000/ws?token=${token}`);
      ws.current = socket;
      socket.onmessage = (e) => {
        try { onMsgRef.current(JSON.parse(e.data)); } catch {}
      };
      socket.onclose = () => { if (!closed) setTimeout(connect, 3000); };
    };

    connect();
    return () => {
      closed = true;
      ws.current?.close();
    };
  }, [token]);

  return { send };
}
