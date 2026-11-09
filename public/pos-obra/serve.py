"""Servidor local do site, sem cache: o celular e o computador sempre recebem a versão mais nova."""
import http.server


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
