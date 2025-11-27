#!/usr/bin/env python

import asyncio
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosedOK,ConnectionClosed
from asyncio import Lock
import logging
import secrets
from datetime import datetime
import sqlite3
from html import escape
from typing import Dict, Tuple
import aiosqlite
import json

logging.basicConfig(
    format="%(asctime)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("websockets")
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())



def _now():
    return datetime.now().__str__()[:23]

def sanitize_input(text: str) -> str:
    """防止 XSS：转义 HTML 特殊字符"""
    if not isinstance(text, str):
        text = str(text)
    return escape(text.strip())

async def _init_db():
    async with aiosqlite.connect("chat.db") as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users_status (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                join_key TEXT NOT NULL,
                nick_name TEXT NOT NULL,
                status TEXT NOT NULL,
                time_stamp TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS message_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                join_key TEXT NOT NULL,
                nick_name TEXT NOT NULL,
                message TEXT NOT NULL,
                time_stamp TEXT NOT NULL
            )
        """)
        await db.commit()

class MyWebSS():

    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.clients_lock = Lock()

        # self.clients[join_key] = (websocket, nickname)
        self.clients: Dict[str, Tuple[asyncio.StreamWriter, str]] = {}
        self.nick_to_key: Dict[str, str] = {}
        self.db_lock = Lock()
        self.conn = sqlite3.connect('chat.db')
        self.cursor = self.conn.cursor()
        self._shutdown = asyncio.Event()
        self.db_path = "chat.db"

    async def start_server(self):
        async with serve(self.handler, self.host, self.port) as server:
            await server.serve_forever()
    
    async def save_message_to_DB(self, join_key, nickname, message, time_stamp):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO message_history (join_key, nick_name, message, time_stamp) VALUES (?, ?, ?, ?)",
                (join_key, nickname, message, time_stamp),
            )
            await db.commit()
    
    async def save_login_status_to_DB(self, status, join_key, nickname , time_stamp):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO users_status (join_key, nick_name, status, time_stamp) VALUES (?, ?, ?, ?)",
                (join_key, nickname, status, time_stamp),
            )
            await db.commit()

    async def load_history(self, websocket):
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT nick_name, message, time_stamp FROM message_history ORDER BY id DESC LIMIT 50") as cursor:
                rows = await cursor.fetchall()
        # 从旧到新发送
        for row in reversed(rows):
            nick, msg, ts = row
            logging.info(f"{nick} # {msg} # {ts}")
            if "has entered" in msg or "has left" in msg:
                continue  # 跳过系统消息
            else:
                payload = {
                    "type": "history",
                    "nickname": nick,
                    "content": msg,
                    "timestamp": ts,
                }
                await websocket.send(json.dumps(payload))
    
    async def get_online_users(self) -> list:
        async with self.clients_lock:
            return [nick for _, nick in self.clients.values()]
        
    async def broadcast_online_list(self):
        online_users = await self.get_online_users()
        payload = {
            "type": "online_users",
            "users": online_users,
        }
        message = json.dumps(payload)
        async with self.clients_lock:
            for ws, _ in list(self.clients.values()):
                try:
                    await ws.send(message)
                except ConnectionClosed:
                    pass

    async def broadcast_message(self, join_key: str, nickname: str, content: str, msg_type: str = "message"):
        time_stamp = _now()
        # 保存到 DB（仅普通消息）
        if msg_type == "message":
            await self.save_message_to_DB(join_key, nickname, content, time_stamp)

        payload = {
            "type": msg_type,
            "nickname": nickname,
            "content": content,
            "timestamp": time_stamp,
        }
        message = json.dumps(payload)
        async with self.clients_lock:
            for ws, _ in list(self.clients.values()):
                try:
                    await ws.send(message)
                except ConnectionClosed:
                    pass
    
    async def handler(self, websocket):
        nickname = "Guest"
        join_key = secrets.token_urlsafe(12)
        
        # 发送欢迎信息（纯文本兼容老客户端，但建议前端用 JSON）
        welcome = {
            "type": "welcome",
            "message": "Welcome to the chat! Please send your nickname as a string or JSON {\"nickname\": \"...\"}."
        }
        await websocket.send(json.dumps(welcome))
        try:
            raw = await websocket.recv()
            # 尝试解析为 JSON，否则当作纯文本昵称
            try:
                data = json.loads(raw)
                if isinstance(data, dict):
                    input_nick = data.get("nickname", "Guest")
                else:
                    input_nick = str(data)
            except json.JSONDecodeError:
                input_nick = raw
            nickname = sanitize_input(input_nick) or "Guest"

            # 防止全空白或超长昵称
            nickname = nickname[:20]


            # === 新增逻辑：踢掉同名旧用户 ===
            async with self.clients_lock:
                if nickname in self.nick_to_key:
                    old_join_key = self.nick_to_key[nickname]
                    if old_join_key in self.clients:
                        old_ws, _ = self.clients[old_join_key]
                        logger.info(f"Kicking previous connection for nickname: {nickname}")
                        try:
                            await old_ws.close(code=1000, reason="Reconnected from another device")
                        except Exception as e:
                            logger.debug(f"Error closing old connection: {e}")
                        # 清理旧记录（注意：不要在这里发广播，等 finally 统一处理）
                        del self.clients[old_join_key]
                        # 注意：不立即 del self.nick_to_key[nickname]，因为下面会覆盖

                # 注册新用户
                self.clients[join_key] = (websocket, nickname)
                self.nick_to_key[nickname] = join_key
                logger.info(f"{nickname} has joined the chat")

            await self.save_login_status_to_DB("login", join_key, nickname, _now())
            logger.info(f"{nickname} has joined the chat")

            # 发送历史消息
            await self.load_history(websocket)

            # 广播加入消息 & 更新在线列表
            await self.broadcast_message(join_key, nickname, f"{nickname} has entered the chat", "system")
            await self.broadcast_online_list()

            # 主消息循环
            while True:
                raw = await websocket.recv()

                # 检查是否为退出指令
                try:
                    data = json.loads(raw)
                    is_dict = isinstance(data, dict)
                except json.JSONDecodeError:
                    data = None
                    is_dict = False

                if is_dict:
                    if data.get("type") == "ping":
                        await websocket.send(json.dumps({"type": "pong"}))
                        continue
                    if data.get("action") == "quit":
                        break
                    elif "content" in data:
                        content = sanitize_input(data["content"])
                        if content:
                            await self.broadcast_message(join_key, nickname, content, "message")
                else:
                    content = str(sanitize_input(raw))
                    await self.broadcast_message(join_key, nickname, content, "message")


        except (ConnectionClosedOK, ConnectionClosed):
            pass
        finally:
            # 清理用户
            async with self.clients_lock:
                if join_key in self.clients:
                    _, current_nick = self.clients[join_key]
                    del self.clients[join_key]
                    # 只有当 nick_to_key 指向当前 join_key 时才删除（防止被新连接覆盖后误删）
                    if self.nick_to_key.get(current_nick) == join_key:
                        del self.nick_to_key[current_nick]

            await self.save_login_status_to_DB("logout", join_key, nickname, _now())
            logger.info(f"{nickname} has left the chat")
            await self.broadcast_message(join_key, nickname, f"{nickname} has left the chat", "system")
            await self.broadcast_online_list()


if __name__ == "__main__":
    asyncio.run(_init_db())
    server = MyWebSS("127.0.0.1", 8099)
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user.")