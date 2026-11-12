"""Static dev server for the prototype that disables browser caching.

Python's default http.server lets browsers reuse stale copies of the JS modules, so edits
don't show without a hard refresh. Usage: python3 tools/serve.py [port]  (serves this folder's parent)
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Serving {root} at http://localhost:{port}/prototype/ (no-cache)")
        httpd.serve_forever()
