from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import sys
from datetime import datetime
import socket
import io
import json
# we need to rewrite a Patch to override the method on GET/POST
# for GET, we directly return the datetime
# for post, we directly return the parsing JSON res
__version__ = "1.0"



class MyHTTPRequestHandler(BaseHTTPRequestHandler):

    server_version = "MyHTTPRequestHandler/" + __version__
    GET_ROUTES = {
    "/time": "_handle_time",
    "/now": "_handle_now",
    "/status": "_handle_status"
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_time = datetime.now().__str__()
    
    def _get_now(self):
        return datetime.now().__str__()
    
    def _handle_time(self):
        return self._get_now()
    
    def _handle_now(self):
        return self._get_now()
    
    def _handle_status(self):
        return "health"

    def do_GET(self):
        """Serve a GET request"""
        print(f"[DEBUG] the path is {self.path}")

        handler_name = self.GET_ROUTES.get(self.path)

        if self.path == "/tiashi":
            print("i'm in tiashi path")
            self.send_response_only(520)
            #self.send_header("Content-Type", "application/json")
            self.end_headers()
            return 
        
        elif handler_name and hasattr(self, handler_name):
            response = getattr(self, handler_name)()
            out_put_json = {"current_time": response}
            encoded = json.dumps(out_put_json).encode('utf-8', 'surrogateescape')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(encoded)


        elif self.path == '/':
            time_now = self._get_now()
            print(f"I'm sending GET resonese")
            #f = io.BytesIO()
            out_put_json = {"current_time": time_now}
            encoded = json.dumps(out_put_json).encode('utf-8', 'surrogateescape')
            #f.write(encoded)
            #f.seek(0)
            #self.send_response_only(200, f"time is {time_now}")
            self.send_response(200)
            #, f"time is {time_now}")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(encoded)
        else:
            self.send_error(404)
        return True

    # return a json with new attr
    def do_POST(self) -> bool:
        if self.path == "/json":
            #json.loads(self.requestline)
            content_length = int(self.headers.get('Content-Length', 0))
            #print(self.headers, content_length)
            raw_data = self.rfile.read(content_length)
            js_data = json.loads(raw_data)
            js_data['time_now'] = self._handle_now()
            encoded = json.dumps(js_data).encode('utf-8', 'surrogateescape')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(encoded)
            #print("this is a debug", raw_data)
            pass
        else:
            self.send_error(404)

        return True

def _get_best_family(*address):
    infos = socket.getaddrinfo(
        *address,
        type=socket.SOCK_STREAM,
        flags=socket.AI_PASSIVE,
    )
    family, type, proto, canonname, sockaddr = next(iter(infos))
    return family, sockaddr

def test(HandlerClass=BaseHTTPRequestHandler,
         ServerClass=ThreadingHTTPServer,
         protocol="HTTP/1.0", port=8000, bind=None):
    """Test the HTTP request handler class.

    This runs an HTTP server on port 8000 (or the port argument).

    """
    ServerClass.address_family, addr = _get_best_family(bind, port)
    HandlerClass.protocol_version = protocol

    
    server = ServerClass(addr, HandlerClass)

    with server as httpd:
        host, port = httpd.socket.getsockname()[:2]
        url_host = f'[{host}]' if ':' in host else host
        protocol = 'HTTP'
        print(
            f"Serving {protocol} on {host} port {port} "
            f"({protocol.lower()}://{url_host}:{port}/) ..."
        )
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nKeyboard interrupt received, exiting.")
            sys.exit(0)


if __name__ == '__main__':
    handler_class = MyHTTPRequestHandler
    test(
        HandlerClass=handler_class,
        ServerClass=ThreadingHTTPServer,
        port="8090",
        bind="127.0.0.1",
        protocol="HTTP/1.0",
    )