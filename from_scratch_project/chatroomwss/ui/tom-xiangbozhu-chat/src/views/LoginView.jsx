// src/views/LoginView.jsx
import { useState } from "react";
import { removeAuthCookie } from "../utils/authUtils";

export default function LoginView({ onLogin, onLogout }) {
  const [loading, setLoading] = useState(false);

  const handleBackendLogin = async (nickname) => {
    setLoading(true);
    try {
      const res = await fetch("/xbzchat/v1/login_http", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname }),
        credentials: "include", // ⚠️ 关键！让浏览器发送/接收 Cookie
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("登录失败：" + (err.detail || "未知错误"));
        return;
      }

      // 后端已设置 auth_user Cookie，前端可安全进入聊天
      onLogin(nickname);
    } catch (err) {
      console.error("Login error:", err);
      alert("网络错误，请检查连接");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h1>💕 选择你的身份</h1>
      <button onClick={() => handleBackendLogin("tom")} disabled={loading}>
        我是 Tom
      </button>
      <button onClick={() => handleBackendLogin("香啵猪")} disabled={loading}>
        我是 香啵猪
      </button>
      <button className="logout-btn" onClick={onLogout}>
        切换账号 / 退出
      </button>
    </div>
  );
}
