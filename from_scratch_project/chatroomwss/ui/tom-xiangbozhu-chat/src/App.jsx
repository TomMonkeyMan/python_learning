// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import './App.css';

const SHARED_PASSWORD = 'xbzmb';

function App() {
  const [view, setView] = useState('password');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [nickname, setNickname] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  // ✅ 删除 hasReceivedHistoryRef
  const historyBufferRef = useRef([]); // ✅ 新增：用于累积 history 消息

  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/xbzchat/ws`;
  };

  const connectWebSocket = (nick) => {
    if (wsRef.current && [WebSocket.CONNECTING, WebSocket.OPEN].includes(wsRef.current.readyState)) {
      return;
    }

    // ✅ 开始重连：清空历史 buffer 和 UI
    setReconnecting(true);
    historyBufferRef.current = []; // 清空缓冲区
    setMessages([]);               // 立即清空聊天界面

    if (wsRef.current) wsRef.current.close();

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
          ws.send(JSON.stringify({ type: 'ping' }));
          pongTimeout = setTimeout(() => {
            console.warn('❌ Pong timeout, closing connection...');
            ws.close(); // 触发 onclose
          }, 5000);
        }
      }, 30000);
    };

    const stopHeartbeat = () => {
      clearInterval(pingTimer);
      if (pongTimeout) {
        clearTimeout(pongTimeout);
        pongTimeout = null;
      }
    };

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      ws.send(JSON.stringify({ nickname: nick }));
      startHeartbeat();
      setReconnecting(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'pong') {
        clearTimeout(pongTimeout);
        return;
      }

      if (data.type === 'online_users') {
        setOnlineUsers(data.users);
      } else if (data.type === 'history') {
        // ✅ 逐条接收 history：累积并更新 UI
        historyBufferRef.current.push(data);
        setMessages([...historyBufferRef.current]);
      } else if (data.type === 'message' || data.type === 'system') {
        // 实时消息：直接追加（此时历史已加载中或完成）
        setMessages((prev) => [...prev, data]);
      }
    };

    ws.onclose = () => {
      console.log('⚠️ WebSocket disconnected');
      stopHeartbeat();
      if (view === 'chat' && !document.hidden) {
        setTimeout(() => connectWebSocket(nick), 1000);
      } else {
        setReconnecting(false);
    }
    };

    ws.onerror = (err) => {
      console.error('❌ WebSocket error:', err);
      stopHeartbeat();
    };

    //ws.addEventListener('open', () => setReconnecting(false));
    //ws.addEventListener('close', () => {
    //  if (!document.hidden) {
    //    setReconnecting(false);
    //  }
    //});
  };

  // 初始化认证
  useEffect(() => {
    const auth = Cookies.get('chat_auth');
    if (auth === 'true') {
      setView('login');
    }
  }, []);

  // 自动滚动（排除重连中）
  useEffect(() => {
    if (!reconnecting) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, reconnecting]);

  // 切回页面时重连
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && view === 'chat') {
        connectWebSocket(nickname);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [view, nickname]);

  // 清理
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 20s 检查一次状态
  useEffect(() => {
    if (view !== 'chat') return;

    const interval = setInterval(() => {
      if (
        !reconnecting &&
        wsRef.current?.readyState !== WebSocket.OPEN &&
        !document.hidden
      ) {
        console.log('🔍 Detected dead connection, auto-reconnecting...');
        connectWebSocket(nickname);
      }
    }, 20000); // 每 20 秒检查一次

    return () => clearInterval(interval);
  }, [view, nickname, reconnecting]);

  // ===== 交互 =====

  const handlePasswordSubmit = () => {
    if (password === SHARED_PASSWORD) {
      Cookies.set('chat_auth', 'true', {
        expires: 30,
        path: '/xbzchat',
        secure: window.location.hostname !== 'localhost',
        sameSite: 'Strict'
      });
      setView('login');
      setPasswordError('');
    } else {
      setPasswordError('密码错误，请重试');
      setPassword('');
    }
  };

  const handlePasswordKeyPress = (e) => {
    if (e.key === 'Enter') handlePasswordSubmit();
  };

  const connect = (nick) => {
    setNickname(nick);
    setView('chat');
    connectWebSocket(nick);
  };

  const sendMessage = () => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content: inputText.trim() }));
    setInputText('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = () => {
    Cookies.remove('chat_auth', { path: '/xbzchat' });
    if (wsRef.current) wsRef.current.close();
    setView('password');
    setMessages([]);
    setOnlineUsers([]);
    // 可选：清空 buffer
    historyBufferRef.current = [];
  };

  // ===== 渲染 =====

  if (view === 'password') {
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

  if (view === 'login') {
    return (
      <div className="login-container">
        <h1>💕 选择你的身份</h1>
        <button onClick={() => connect('tom')}>我是 Tom</button>
        <button onClick={() => connect('香啵猪')}>我是 香啵猪</button>
        <button className="logout-btn" onClick={handleLogout}>
          切换账号 / 退出
        </button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header>
        <h2>私密聊天中 💬</h2>
        <div className="online">在线：{onlineUsers.length > 0 ? onlineUsers.join(', ') : '加载中...'}</div>
      </header>

      <div className="messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`msg ${
              msg.type === 'system'
                ? 'system'
                : msg.nickname === nickname
                ? 'me'
                : 'other'
            }`}
          >
            {msg.type === 'system' ? (
              <em>{msg.content}</em>
            ) : (
              <>
                <strong>{msg.nickname}:</strong> {msg.content}
              </>
            )}
          </div>
        ))}
        {reconnecting && (
          <div className="reconnect-indicator">
            🔁 正在重连...
          </div>
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
