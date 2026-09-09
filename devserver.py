"""Local dev server that disables caching entirely, so edits always show up
immediately (including on browser back/forward navigation)."""
import functools
import http.server
import os
import sys

SITE_DIR = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    handler = functools.partial(NoCacheHandler, directory=SITE_DIR)
    http.server.test(HandlerClass=handler, port=port)
