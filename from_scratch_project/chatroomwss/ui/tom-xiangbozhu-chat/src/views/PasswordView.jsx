// src/views/PasswordView.jsx
import { useState } from "react";
import { SHARED_PASSWORD } from "../constants";
import { setAuthCookie } from "../utils/authUtils";

export default function PasswordView({ onAuthSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (password === SHARED_PASSWORD) {
      setAuthCookie();
      onAuthSuccess();
      setError("");
    } else {
      setError("密码错误，请重试");
      setPassword("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="password-container">
      <h1>🔒 私密聊天室</h1>
      <p>请输入共享密码：</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="密码"
        autoFocus
      />
      {error && <p className="error">{error}</p>}
      <button onClick={handleSubmit} disabled={!password}>
        确认
      </button>
    </div>
  );
}