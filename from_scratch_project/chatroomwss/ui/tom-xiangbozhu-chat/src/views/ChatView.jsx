import { useState, useEffect, useRef } from "react";
import {
  formatDisplayTime,
  shouldShowDateHeader,
  formatFullLocalDate,
} from "../utils/timeUtils";
import { useLastLogoutTimes } from "../hooks/useLastLogoutTimes";
import { useWebSocket } from "../hooks/useWebSocket";

export default function ChatView({ nickname, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [reconnecting, setReconnecting] = useState(false);
  const messagesEndRef = useRef(null);
  const historyBufferRef = useRef([]);

  const lastLogoutTimes = useLastLogoutTimes(true, 15000);

  const { sendMessage: wsSend, close: wsClose, connect: wsConnect } = useWebSocket({
    nickname,
    onMessage: (msg) => setMessages(prev => [...prev, msg]),
    onOnlineUsers: (users) => setOnlineUsers(users),
    onHistory: (msg) => {
      historyBufferRef.current.push(msg);
      setMessages([...historyBufferRef.current]);
    },
    onOpen: () => {
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
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, reconnecting]);

  const sendMessage = () => {
    if (inputText.trim()) {
      wsSend(inputText.trim());
      setInputText("");
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