import socket
import socketserver
import sqlite3
from datetime import datetime
from socketserver import BaseServer
import threading

def _now():
    return datetime.now().__str__()[:23]

class MyTCPserver():
    address_family = socket.AF_INET
    socket_type = socket.SOCK_STREAM
    request_queue_size = 5
    clients_lock = threading.Lock()
    clients = []  # [(conn, nickname), ...]

    def __init__(self, address, port):
        self.server_address = address
        self.server_port = port
        self.socket = socket.socket(self.address_family,
                                    self.socket_type)
    
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind((self.server_address, self.server_port))
        #self.server_address = self.socket.getsockname()

    def server_activate(self):
        self.socket.listen(self.request_queue_size)

    def server_close(self):
        self.socket.close()
    
    def get_request(self):
        return self.socket.accept()
    
    def close_request(self, request):
        request.close()

    def shutdown_request(self, request):
        try:
            request.shutdown(socket.SHUT_WR)
        except OSError:
            pass
        finally:
            self.close_request(request)
    
    def handle_clients(self, conn, addr):
        nickname = "Guest"
        conn.send("pls enter your name:".encode('utf-8') + b'\n')
        try:
            data = conn.recv(1024).decode('utf-8').strip()
            if data:
                nickname = data
                print(f"[DEBUG] user [user {data}] logging in")
            with self.clients_lock:
                self.clients.append((conn, nickname))
                msg = f"[user {nickname}] has entered the chat"
                self._broadcast(msg, nickname)
            while True:
                data = conn.recv(1024).decode('utf-8').strip()
                msg = f"[user {nickname}] says {data}"
                self._broadcast(msg, nickname)
                print(f"[DEBUG] [user {nickname}] says {data}")
        except KeyboardInterrupt as e:
            print(f"[DEBUG] [user {nickname}] use keyboard interrrupt")
            pass
        except UnicodeDecodeError as e:
            print(f"[DEBUG] [user {nickname}] has error {e}")
            pass
        finally:
            with self.clients_lock:
                self.clients[:] = [(c, n) for c, n in self.clients[:] if c != conn ]
                msg = f"[user {nickname}] has left the chat"
                self._broadcast(msg, nickname)
                print(f"[DEBUG] [user {nickname}] has left the chat")
            conn.close()

    def handle_clients_forever(self):
        try:
            while True:
                conn, addr = self.socket.accept()
                thread = threading.Thread(target = self.handle_clients, args=(conn, addr))
                thread.daemon = True
                thread.start()
        except KeyboardInterrupt:
            print("\n[!] Closing the server...")
        finally:
            self.server_close()

    def _broadcast(self, msg, user):
        try:
            for c, nickname in self.clients:
                c.send(f"[{_now()}] {msg}\n".encode('utf-8'))
        except Exception as e:
            print(f" {user} _broadcast err with {e}")
        return 

        

if __name__ == "__main__":
    server = MyTCPserver("127.0.0.1", 8099)
    server.server_bind()
    server.server_activate()
    print("[DEBUG] I'm starting a TCP server")
    server.handle_clients_forever()
    
