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
  const [reconnecting, setReconnecting] = useState(false); // ← 新增：重连状态
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasReceivedHistoryRef = useRef(false); // ← 标记是否已接收过历史

  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/xbzchat/ws`;
  };

  const connectWebSocket = (nick) => {
    if (
      wsRef.current?.readyState === WebSocket.CONNECTING ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    // 开始重连
    setReconnecting(true);
    hasReceivedHistoryRef.current = false; // 重置历史标记

    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      ws.send(JSON.stringify({ nickname: nick }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'online_users') {
        setOnlineUsers(data.users);
      } else if (data.type === 'history') {
        // 第一次收到 history：替换整个消息列表
        if (!hasReceivedHistoryRef.current) {
          setMessages([data]); // 如果 history 是单条包含数组，可能需要 data.messages
          hasReceivedHistoryRef.current = true;
        }
        // 如果后端分多次发 history，你可能需要累积后再 set，但通常是一次性
      } else if (data.type === 'message' || data.type === 'system') {
        // 实时消息：追加
        setMessages((prev) => [...prev, data]);
      }
    };

    ws.onclose = () => {
      console.log('⚠️ WebSocket disconnected');
      // 不立即重连，等 visibilitychange 触发
    };

    ws.onerror = (err) => {
      console.error('❌ WebSocket error:', err);
    };

    // 连接成功或失败后，隐藏 loading（这里简化：只要 onopen 或 onclose 就关）
    // 更严谨的做法是监听 onopen 后关闭 loading
    ws.addEventListener('open', () => setReconnecting(false));
    ws.addEventListener('close', () => {
      if (!document.hidden) {
        setReconnecting(false);
      }
    });
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
