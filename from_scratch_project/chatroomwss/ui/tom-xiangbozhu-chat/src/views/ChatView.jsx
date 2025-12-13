import { useState, useEffect, useRef } from "react";
import {
  formatDisplayTime,
  shouldShowDateHeader,
  formatFullLocalDate,
} from "../utils/timeUtils";
import { useLastLogoutTimes } from "../hooks/useLastLogoutTimes";
import { useWebSocket } from "../hooks/useWebSocket";

//add web push
const VAPID_PUBLIC_KEY =
  "BDb8-UVyCaiPiywsHX8Lr29tcIhoE7eMemeCGHUjWFLSciDWfh4leFNVamBIn4HlkFOvkmzz_36fyrj5-n0IF4s";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function setupPushSubscription() {
  if (!("serviceWorker" in navigator)) return;
  if (!("PushManager" in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const reg = await navigator.serviceWorker.ready;

  // 避免重复订阅
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // 发给后端保存
  await fetch("/xbzchat/v1/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
    credentials: "include",
  });
}

const requestPushPermission = async () => {
  if (Notification.permission === "denied") {
    alert("你之前拒绝了通知，请在浏览器设置里手动开启");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    // 成功允许 → 再注册 Service Worker 并订阅
    await setupPushSubscription();
    alert("桌面通知已开启！");
  } else {
    alert("未允许通知，将无法收到桌面提醒");
  }
};

export default function ChatView({ nickname, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [reconnecting, setReconnecting] = useState(false);
  const messagesEndRef = useRef(null);
  const historyBufferRef = useRef([]);

  const lastLogoutTimes = useLastLogoutTimes(true, 15000);

  const fileInputRef = useRef(null);

  const {
    sendMessage: wsSend,
    close: wsClose,
    connect: wsConnect,
  } = useWebSocket({
    nickname,
    onMessage: (msg) => setMessages((prev) => [...prev, msg]),
    onOnlineUsers: (users) => setOnlineUsers(users),
    onHistory: (msg) => {
      historyBufferRef.current.push(msg);
      setMessages([...historyBufferRef.current]);
    },
    onOpen: () => {
      historyBufferRef.current = [];
      setMessages([]);
      setReconnecting(false);
    },
    onClose: () => {
      setReconnecting(true);
    },
  });

  // 初始化连接
  useEffect(() => {
    wsConnect();
  }, [wsConnect]);

  // 自动滚动
  useEffect(() => {
    if (!reconnecting) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    }
  }, [messages, reconnecting]);

  const sendMessage = () => {
    if (inputText.trim()) {
      wsSend(inputText.trim());
      setInputText("");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/xbzchat/v1/upload_image", {
        method: "POST",
        body: formData,
        credentials: "include", // 重要！携带 Cookie 鉴权
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("上传失败：" + (err.detail || "未知错误"));
        return;
      }

      const { image_id } = await res.json();
      // 发送一条特殊消息，包含 image_id
      wsSend(`[img:${image_id}]`);
    } catch (err) {
      console.error("Upload error:", err);
      alert("网络错误，请重试");
    } finally {
      // 清空 input，允许重复上传同名文件
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = () => {
    wsClose();
    onLogout();
  };

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

      <div>
        {(
          <button
            onClick={requestPushPermission}
            className="notification-button"
          >
            开启桌面通知 🔔
          </button>
        )}
      </div>

      <div className="messages">
        {messages.map((msg, i) => {
          const prevMsg = messages[i - 1];
          console.log("debug 1:", msg, msg.timestamp);
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
                    <strong>{msg.nickname}:</strong>{" "}
                    {msg.content.startsWith("[img:") &&
                    msg.content.endsWith("]") ? (
                      <div className="image-message">
                        <img
                          src={`/xbzchat/v1/image/${msg.content.slice(5, -1)}`}
                          alt="聊天图片"
                          loading="lazy"
                          onLoad={() => {
                            // 图片加载完成后，再尝试滚动到底部
                            messagesEndRef.current?.scrollIntoView({
                              behavior: "auto",
                            });
                          }}
                          onError={(e) => {
                            e.target.alt = "图片加载失败";
                            e.target.style.opacity = "0.6";
                          }}
                        />
                      </div>
                    ) : (
                      msg.content
                    )}
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
          ➤
        </button>
        <input
          type="file"
          accept="image/*"
          //capture="environment" // iOS 优先调用相机
          onChange={handleImageUpload}
          style={{ display: "none" }}
          ref={fileInputRef}
        />

        <button onClick={() => fileInputRef.current?.click()}>📷</button>
      </div>
    </div>
  );
}
