import sys
from http.server import HTTPServer
from RangeHTTPServer import RangeRequestHandler
from socketserver import ThreadingMixIn

# 1. Make the server multi-threaded
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

# 2. Catch and ignore OpenCV's abrupt disconnects
class QuietVideoHandler(RangeRequestHandler):
    def log_message(self, format, *args):
        pass # Suppress standard HTTP logs to keep terminal clean

    def handle(self):
        try:
            super().handle()
        except ConnectionError:
            pass # Ignore the WinError 10053/10054 when OpenCV drops the connection

if __name__ == '__main__':
    port = int(sys.argv[1])
    server = ThreadedHTTPServer(('127.0.0.1', port), QuietVideoHandler)
    print(f"[*] Threaded Video Server running on http://127.0.0.1:{port}")
    server.serve_forever()