// src/App.jsx
import { useState, useEffect, useRef, Fragment } from "react";
import Cookies from "js-cookie";
import "./App.css";

const SHARED_PASSWORD = "xbzmb";
// 解析后端 EST 时间字符串为标准 Date（UTC 内部表示）
const parseBackendTimestamp = (timestampStr) => {
  const clean = timestampStr.replace(/\.\d{3}$/, "");
  const iso = clean.replace(" ", "T") + "-05:00"; // EST = UTC-5
  return new Date(iso);
};

// 获取用户本地“今天”的日期字符串（YYYY-MM-DD）
const getLocalToday = () => {
  return new Date().toLocaleDateString("sv-SE");
};

const getLocalYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE");
};

// 格式化显示时间（按用户本地时区）
const formatDisplayTime = (timestamp) => {
  const msgDate = parseBackendTimestamp(timestamp);
  const dateStr = msgDate.toLocaleDateString("sv-SE"); // 用户本地日期

  const today = getLocalToday();
  const yesterday = getLocalYesterday();

  const timePart = msgDate.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dateStr === today) {
    return timePart;
  } else if (dateStr === yesterday) {
    return `昨天 ${timePart}`;
  } else {
    const datePart =
      msgDate
        .toLocaleDateString("zh-CN", {
          month: "numeric",
          day: "numeric",
        })
        .replace("/", "月") + "日";
    return `${datePart} ${timePart}`;
  }
};

// 判断是否需要日期横幅（按用户本地日期）
const shouldShowDateHeader = (currentMsg, prevMsg) => {
  if (!prevMsg) return true;
  const curr = parseBackendTimestamp(currentMsg.timestamp).toLocaleDateString(
    "sv-SE",
  );
  const prev = parseBackendTimestamp(prevMsg.timestamp).toLocaleDateString(
    "sv-SE",
  );
  return curr !== prev;
};

// 用于 date-header 的完整本地日期
const formatFullLocalDate = (timestamp) => {
  const d = parseBackendTimestamp(timestamp);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

function App() {
  const [view, setView] = useState("password");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nickname, setNickname] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastLogoutTimes, setLastLogoutTimes] = useState({}); // { "tom": "2025-...", "香啵猪": "..." }
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const historyBufferRef = useRef([]);

  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}/xbzchat/ws`;
  };

  // 🔁 封装：尝试 ping 探测当前连接是否真实可用
  const testConnectionAndReconnectIfNeeded = (nick) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket(nick);
      return;
    }

    // 发送探测 ping
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

    // 3 秒超时判断
    setTimeout(() => {
      ws.removeEventListener("message", onPong);
      if (!pongReceived) {
        console.log(
          "📱 Connection appears dead after page resume, reconnecting...",
        );
        connectWebSocket(nick);
      }
    }, 3000);
  };

  const connectWebSocket = (nick) => {
    if (
      wsRef.current &&
      [WebSocket.CONNECTING, WebSocket.OPEN].includes(wsRef.current.readyState)
    ) {
      return;
    }

    setReconnecting(true);
    historyBufferRef.current = [];
    setMessages([]);

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
      }, 20000); // ⏱ 心跳缩短到 20s，更适应 NAT/移动网络
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
      ws.send(JSON.stringify({ nickname: nick }));
      startHeartbeat();
      setReconnecting(false);
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
        setOnlineUsers(data.users);
      } else if (data.type === "history") {
        historyBufferRef.current.push(data);
        setMessages([...historyBufferRef.current]);
      } else if (data.type === "message" || data.type === "system") {
        setMessages((prev) => [...prev, data]);
      }
    };

    ws.onclose = () => {
      console.log("⚠️ WebSocket disconnected");
      stopHeartbeat();
      if (view === "chat" && !document.hidden) {
        setTimeout(() => connectWebSocket(nick), 1000);
      } else {
        setReconnecting(false);
      }
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
      stopHeartbeat();
    };
  };

  // 最后登录时间
  useEffect(() => {
    const fetchLastLogout = async () => {
      try {
        const res = await fetch("/xbzchat/v1/last_online_time");
        const data = await res.json(); // data 是数组！

        // ✅ 转换成对象：{ "tom": "2025-...", "香啵猪": "2025-..." }
        const logoutMap = {};
        data.forEach((item) => {
          logoutMap[item.nick_name] = item.last_logout_time;
        });

        setLastLogoutTimes(logoutMap); // 存为对象
      } catch (err) {
        console.error("Failed to fetch last logout times", err);
      }
    };

    fetchLastLogout();
  }, []);

  // 初始化认证
  useEffect(() => {
    const auth = Cookies.get("chat_auth");
    if (auth === "true") {
      setView("login");
    }
  }, []);

  // 自动滚动
  useEffect(() => {
    if (!reconnecting) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, reconnecting]);

  // 📱 页面可见性变化：iOS 后台切回检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && view === "chat" && nickname) {
        testConnectionAndReconnectIfNeeded(nickname);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [view, nickname]);

  // 📱 pageshow：iOS 冻结恢复兜底（非常重要！）
  useEffect(() => {
    const handlePageShow = () => {
      if (view === "chat" && !document.hidden && nickname) {
        testConnectionAndReconnectIfNeeded(nickname);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [view, nickname]);

  // 清理 WebSocket
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 20s 定时兜底检查（防止极端情况）
  useEffect(() => {
    if (view !== "chat" || !nickname) return;

    const interval = setInterval(() => {
      if (!reconnecting && !document.hidden) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.log("🔍 Periodic check: dead connection, reconnecting...");
          connectWebSocket(nickname);
        }
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [view, nickname, reconnecting]);

  // ===== 交互逻辑 =====

  const handlePasswordSubmit = () => {
    if (password === SHARED_PASSWORD) {
      Cookies.set("chat_auth", "true", {
        expires: 30,
        path: "/xbzchat",
        secure: window.location.hostname !== "localhost",
        sameSite: "Strict",
      });
      setView("login");
      setPasswordError("");
    } else {
      setPasswordError("密码错误，请重试");
      setPassword("");
    }
  };

  const handlePasswordKeyPress = (e) => {
    if (e.key === "Enter") handlePasswordSubmit();
  };

  const connect = (nick) => {
    setNickname(nick);
    setView("chat");
    connectWebSocket(nick);
    try {
      const res = fetch("/xbzchat/v1/last_online_time");
      if (res.ok) {
        const data = res.json();
        const timeMap = {};
        data.forEach((item) => {
          timeMap[item.nick_name] = item.last_logout_time; // 假设后端返回字段是 last_logout_time
        });
        setLastLogoutTimes(timeMap);
      }
    } catch (err) {
      console.warn("Failed to load last logout times:", err);
    }
  };

  const sendMessage = () => {
    if (
      !inputText.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    )
      return;
    wsRef.current.send(JSON.stringify({ content: inputText.trim() }));
    setInputText("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = () => {
    Cookies.remove("chat_auth", { path: "/xbzchat" });
    if (wsRef.current) wsRef.current.close();
    setView("password");
    setMessages([]);
    setOnlineUsers([]);
    historyBufferRef.current = [];
  };

  // ===== 渲染 =====

  if (view === "password") {
    return (
      <div className="password-container">
        <h1>🔒 私密聊天室</h1>
        <p>请输入共享密码：</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={handlePasswordKeyPress}
          placeholder="密码"
          autoFocus
        />
        {passwordError && <p className="error">{passwordError}</p>}
        <button onClick={handlePasswordSubmit} disabled={!password}>
          确认
        </button>
      </div>
    );
  }

  if (view === "login") {
    return (
      <div className="login-container">
        <h1>💕 选择你的身份</h1>
        <button onClick={() => connect("tom")}>我是 Tom</button>
        <button onClick={() => connect("香啵猪")}>我是 香啵猪</button>
        <button className="logout-btn" onClick={handleLogout}>
          切换账号 / 退出
        </button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* 主标题 */}
      <div className="chat-header">
        <h3>私密聊天中 💬</h3>
      </div>

      {/* 状态区域：在线 + 最后登出 */}
      <div className="status-bar">
        <div className="online-section">
          <strong>在线：</strong>
          {onlineUsers.length > 0 ? onlineUsers.join(", ") : "加载中..."}
        </div>

        {Object.keys(lastLogoutTimes).length > 0 && (
          <div className="last-logout-section">
            <strong>最后登出：</strong>
            {Object.entries(lastLogoutTimes).map(([user, time], i, arr) => {
              const displayTime = formatDisplayTime(time);
              return (
                <span key={user} className="last-user">
                  {i > 0 && "｜"}
                  <span className="nickname">{user}</span> · {displayTime}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="messages">
        {messages.map((msg, i) => {
          const prevMsg = messages[i - 1];
          const showDateHeader = shouldShowDateHeader(msg, prevMsg);
          const displayTime = formatDisplayTime(msg.timestamp);

          return (
            <>
              {showDateHeader && (
                <div className="date-header">
                  {formatFullLocalDate(msg.timestamp)}
                </div>
              )}
              <div
                className={`msg ${msg.type === "system" ? "system" : msg.nickname === nickname ? "me" : "other"}`}
              >
                {msg.type === "system" ? (
                  <em>{msg.content}</em>
                ) : (
                  <>
                    <strong>{msg.nickname}:</strong> {msg.content}
                  </>
                )}
                {msg.type !== "system" && (
                  <div className="msg-time">{displayTime}</div>
                )}
              </div>
            </>
          );
        })}

        {reconnecting && (
          <div className="reconnect-indicator">🔁 正在重连...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息..."
          maxLength={200}
        />
        <button onClick={sendMessage} disabled={!inputText.trim()}>
          发送
        </button>
      </div>
    </div>
  );
}

export default App;
