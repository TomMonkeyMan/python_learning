#!/usr/bin/env python

import asyncio
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosedOK
from asyncio import Lock
import logging
import secrets
from datetime import datetime
from websockets.exceptions import ConnectionClosed
import sqlite3

logging.basicConfig(
    format="%(asctime)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("websockets")
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())



def _now():
    return datetime.now().__str__()[:23]


def _init_DB():
    conn = sqlite3.connect('chat.db')
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        join_key TEXT NOT NULL,
        nick_name TEXT NOT NULL,
        status TEXT NOT NULL,
        time_stamp TEXT NOT NULL
    )
    ''')
    conn.commit()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS message_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        join_key TEXT NOT NULL,
        nick_name TEXT NOT NULL,
        message TEXT NOT NULL,
        time_stamp TEXT NOT NULL
    )
    ''')
    conn.commit()

class MyWebSS():

    def __init__(self, host_address, port):
        self.host_address = host_address
        self.port = port
        self.client = {}
        self.clients_lock = Lock()
        self.db_lock = Lock()
        self.conn = sqlite3.connect('chat.db')
        self.cursor = self.conn.cursor()
        self._shutdown = asyncio.Event()

    async def start_server(self):
        async with serve(self.handler, self.host_address, self.port) as server:
            await server.serve_forever()
    
    async def save_message_to_DB(self, join_key, nickname, message, time_stamp):
        async with self.db_lock:
            self.cursor.execute("INSERT INTO message_history (join_key, nick_name, message, time_stamp) VALUES (?, ?, ?, ?)", (join_key, nickname, message, time_stamp))
            self.conn.commit()
    
    async def save_login_status_to_DB(self, status, join_key, nickname , time_stamp):
        async with self.db_lock:
            self.cursor.execute("INSERT INTO users_status (join_key, nick_name, status, time_stamp) VALUES (?, ?, ?, ?)", (join_key, nickname, status, time_stamp))
            self.conn.commit()

    async def load_history(self, websocket):
        self.cursor.execute("SELECT * FROM message_history LIMIT 50")
        rows = self.cursor.fetchall()
        for _, _, _, message, time_stamp in rows:
            if ('has entered the chat' not in message) and ('has left the chat' not in message):
                await websocket.send(f'[history] [{time_stamp}] {message}')
    
    # save the msg to DB and broadcast
    async def _broadcast(self, join_key, nickname, message):
        time_stamp = _now()
        await self.save_message_to_DB(join_key, nickname, message, time_stamp)
        for websocket, nickname in self.client.values():
            try:
                new_messgae = f"[{time_stamp}] {message}"
                await websocket.send(new_messgae)
            except ConnectionClosed:
                pass
    
    async def handler(self, websocket):
        nickname = "Guest"
        await websocket.send("pls enter your name:".encode('utf-8') + b'\n')
        name = await websocket.recv()
        nickname = name if name else nickname
        join_key = secrets.token_urlsafe(12)
        async with self.clients_lock:
            self.client[join_key] = (websocket, nickname)
            await self.save_login_status_to_DB("login", join_key, nickname , _now())
            logging.info(f"{nickname} has joined the chat")

        await self.load_history(websocket)
        await self._broadcast(join_key, nickname, f"[user {nickname}] has entered the chat")
        
        while True:
            try:
                message = await websocket.recv()
                await self._broadcast(join_key, nickname, f"[user {nickname} says:] {message}")
            except Exception as ConnectionClosedOK:
                logging.info(f"[user {nickname}] has left the chat")
                await self._broadcast(join_key, nickname, f"[user {nickname}] has left the chat")
                await self.save_login_status_to_DB("logout", join_key, nickname , _now())
                del self.client[join_key]
                logging.info(f"self.client is updated now with: {self.client}")
                break

if __name__ == "__main__":
    _init_DB()
    server = MyWebSS("127.0.0.1", 8099)
    asyncio.run(server.start_server())