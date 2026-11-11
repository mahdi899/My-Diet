"""Plain HTTP forwarder. The server talks to this PC; this PC calls OpenRouter with its own TLS."""
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LISTEN = ("127.0.0.1", 18081)
ALLOWED_HOST = "openrouter.ai"
DROP = {"host", "content-length", "connection", "transfer-encoding", "accept-encoding"}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_request(self) -> None:
        host = (self.headers.get("Host") or "").split(":")[0].lower()
        if host != ALLOWED_HOST:
            self.send_error(403)
            return
        length = int(self.headers.get("Content-Length") or "0")
        body = self.rfile.read(length) if length else None
        forwarded = {key: value for key, value in self.headers.items() if key.lower() not in DROP}
        try:
            connection = http.client.HTTPSConnection(ALLOWED_HOST, timeout=90)
            connection.request(self.command, self.path, body=body, headers=forwarded)
            upstream = connection.getresponse()
        except Exception as error:
            self.send_error(502, str(error)[:200])
            return
        self.send_response(upstream.status)
        for key, value in upstream.getheaders():
            if key.lower() not in {"transfer-encoding", "connection", "content-length"}:
                self.send_header(key, value)
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()
        while True:
            chunk = upstream.read(65536)
            if not chunk:
                break
            self.wfile.write(chunk)
        connection.close()

    def do_GET(self) -> None:
        self.do_request()

    def do_POST(self) -> None:
        self.do_request()

    def log_message(self, fmt: str, *args) -> None:
        return


def main() -> None:
    ThreadingHTTPServer(LISTEN, Handler).serve_forever()


if __name__ == "__main__":
    main()
