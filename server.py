"""IngTeacher yerel sunucusu: statik arayuz + calisma yedegi kaydi."""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKUP_PATH = ROOT / "ingteacher_kaldigim_yer.md"
MAX_BACKUP_SIZE = 20 * 1024 * 1024


class IngTeacherHandler(SimpleHTTPRequestHandler):
    def send_json(self, status: HTTPStatus, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/api/backup":
            if not BACKUP_PATH.exists():
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "Henüz çalışma yedeği oluşturulmadı."})
                return
            body = BACKUP_PATH.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/backup":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Bilinmeyen API adresi."})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_BACKUP_SIZE:
                raise ValueError("Yedek boyutu izin verilen sınırda değil.")
            request = json.loads(self.rfile.read(content_length).decode("utf-8"))
            markdown = request.get("content")
            if not isinstance(markdown, str) or "INGTEACHER_BACKUP:" not in markdown:
                raise ValueError("Geçerli bir IngTeacher yedeği gönderilmedi.")

            temporary_path = BACKUP_PATH.with_suffix(".md.tmp")
            temporary_path.write_text(markdown, encoding="utf-8")
            temporary_path.replace(BACKUP_PATH)
            self.send_json(HTTPStatus.OK, {"path": str(BACKUP_PATH)})
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 5173), IngTeacherHandler)
    print("IngTeacher http://127.0.0.1:5173 adresinde çalışıyor.")
    print(f"Çalışma yedeği: {BACKUP_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
