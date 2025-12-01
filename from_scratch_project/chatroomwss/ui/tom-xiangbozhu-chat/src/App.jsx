// src/App.jsx
import { useState, useEffect } from "react";
import { isAuthenticated, removeAuthCookie } from "./utils/authUtils";
import PasswordView from "./views/PasswordView";
import LoginView from "./views/LoginView";
import ChatView from "./views/ChatView";
import "./App.css";

function App() {
  const [view, setView] = useState("password");
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    if (isAuthenticated()) {
      setView("login");
    }
  }, []);

  const handleAuthSuccess = () => {
    setView("login");
  };

  const handleLogin = (nick) => {
    setNickname(nick);
    setView("chat");
  };

  const handleLogout = () => {
    removeAuthCookie();
    setView("password");
    setNickname("");
  };

  if (view === "password") {
    return <PasswordView onAuthSuccess={handleAuthSuccess} />;
  }

  if (view === "login") {
    return <LoginView onLogin={handleLogin} onLogout={handleLogout} />;
  }

  return <ChatView nickname={nickname} onLogout={handleLogout} />;
}

export default App;
