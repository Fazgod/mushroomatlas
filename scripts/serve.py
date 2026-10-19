#!/usr/bin/env python3
"""Local dev server for dist/ with single-page-app fallback (like Cloudflare _redirects)."""
import http.server, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist"))
class H(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        p = self.translate_path(self.path.split("?")[0])
        if not os.path.exists(p) or (os.path.isdir(p) and not os.path.exists(os.path.join(p, "index.html"))):
            self.path = "/index.html"
        return super().send_head()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("", int(sys.argv[1]) if len(sys.argv) > 1 else 8800), H).serve_forever()
