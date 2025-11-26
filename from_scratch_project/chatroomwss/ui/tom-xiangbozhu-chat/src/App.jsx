// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [view, setView] = useState('login'); // 'login' | 'chat'
  const [nickname, setNickname] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 连接 WebSocket
  const connect = (nick) => {
    setNickname(nick);
    setView('chat');

    // 开发阶段：ws://localhost:8099
    const ws = new WebSocket('ws://localhost:8099');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ nickname: nick }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'online_users') {
        setOnlineUsers(data.users);
      } else if (['message', 'system', 'history'].includes(data.type)) {
        setMessages((prev) => [...prev, data]);
      }
    };

    ws.onclose = () => {
      alert('连接断开，请刷新页面重试。');
    };
  };

  const sendMessage = () => {
    if (!inputText.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ content: inputText.trim() }));
    setInputText('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  // 清理连接
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  if (view === 'login') {
    return (
      <div className="login-container">
        <h1>💕 只属于 Tom 和 香啵猪 的秘密聊天室</h1>
        <p>请选择你的身份：</p>
        <button onClick={() => connect('tom')}>我是 Tom</button>
        <button onClick={() => connect('香啵猪')}>我是 香啵猪</button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header>
        <h2>私密聊天中 💬</h2>
        <div className="online">在线：{onlineUsers.join(', ') || '加载中...'}</div>
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