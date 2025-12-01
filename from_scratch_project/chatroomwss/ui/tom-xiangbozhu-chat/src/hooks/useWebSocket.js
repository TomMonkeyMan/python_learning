// src/hooks/useWebSocket.js
import { useRef, useEffect, useCallback } from "react";

const getWebSocketUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/xbzchat/ws`;
};

export const useWebSocket = ({
  nickname,
  onMessage,
  onOnlineUsers,
  onHistory,
  onOpen,
  onClose,
}) => {
  const wsRef = useRef(null);
  const historyBufferRef = useRef([]);

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      [WebSocket.CONNECTING, WebSocket.OPEN].includes(wsRef.current.readyState)
    ) {
      return;
    }

    historyBufferRef.current = [];
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    let pingTimer = null;
    let pongTimeout = null;

    const startHeartbeat = () => {
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          if (pongTimeout) {
            clearTimeout(pongTimeout);
            pongTimeout = null;
          }
          ws.send(JSON.stringify({ type: "ping" }));
          pongTimeout = setTimeout(() => {
            console.warn("❌ Pong timeout, closing connection...");
            ws.close();
          }, 5000);
        }
      }, 20000);
    };

    const stopHeartbeat = () => {
      clearInterval(pingTimer);
      if (pongTimeout) {
        clearTimeout(pongTimeout);
        pongTimeout = null;
      }
    };

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      ws.send(JSON.stringify({ nickname }));
      startHeartbeat();
      if (onOpen) onOpen();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "pong") {
        if (pongTimeout) {
          clearTimeout(pongTimeout);
          pongTimeout = null;
        }
        return;
      }

      if (data.type === "online_users") {
        if (onOnlineUsers) onOnlineUsers(data.users);
      } else if (data.type === "history") {
        historyBufferRef.current.push(data);
        //if (onHistory) onHistory([...historyBufferRef.current]);
        if (onHistory) onHistory(data);
      } else if (data.type === "message" || data.type === "system") {
        if (onMessage) onMessage(data);
      }
    };

    ws.onclose = () => {
      console.log("⚠️ WebSocket disconnected");
      stopHeartbeat();
      if (onClose) onClose();
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
      stopHeartbeat();
    };

    return ws;
  }, [nickname, onMessage, onOnlineUsers, onHistory, onOpen, onClose]);

  // 页面可见性检测：iOS 后台恢复
  const testConnectionAndReconnectIfNeeded = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connect();
      return;
    }

    let pongReceived = false;
    const onPong = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong") {
          pongReceived = true;
          ws.removeEventListener("message", onPong);
        }
      } catch {}
    };

    ws.addEventListener("message", onPong);
    ws.send(JSON.stringify({ type: "ping" }));

    setTimeout(() => {
      ws.removeEventListener("message", onPong);
      if (!pongReceived) {
        console.log(
          "📱 Connection appears dead after page resume, reconnecting...",
        );
        connect();
      }
    }, 3000);
  }, [connect]);

  // 暴露 send 方法
  const sendMessage = useCallback((content) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content }));
    }
  }, []);

  // 定期兜底检查
  useEffect(() => {
    if (!nickname) return;
    const interval = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log("🔍 Periodic check: dead connection, reconnecting...");
        connect();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [nickname, connect]);

  // 页面可见性监听
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && nickname) {
        testConnectionAndReconnectIfNeeded();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [nickname, testConnectionAndReconnectIfNeeded]);

  useEffect(() => {
    const handlePageShow = () => {
      if (!document.hidden && nickname) {
        testConnectionAndReconnectIfNeeded();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [nickname, testConnectionAndReconnectIfNeeded]);

  // 清理
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return { connect, sendMessage, wsRef };
};
