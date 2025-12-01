// src/views/LoginView.jsx
import { removeAuthCookie } from "../utils/authUtils";

export default function LoginView({ onLogin, onLogout }) {
  return (
    <div className="login-container">
      <h1>💕 选择你的身份</h1>
      <button onClick={() => onLogin("tom")}>我是 Tom</button>
      <button onClick={() => onLogin("香啵猪")}>我是 香啵猪</button>
      <button className="logout-btn" onClick={onLogout}>
        切换账号 / 退出
      </button>
    </div>
  );
}