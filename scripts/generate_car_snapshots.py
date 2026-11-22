import http.server
import socketserver
import json
import base64
import os
import subprocess
import time
import sys

PORT = 8089
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_DIR = os.path.join(ROOT_DIR, "road-riot", "assets", "previews")
os.makedirs(OUTPUT_DIR, exist_ok=True)

done_event = False

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def do_POST(self):
        global done_event
        if self.path == '/save_snapshot':
            length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(length)
            payload = json.loads(body.decode('utf-8'))
            car_id = payload['carId']
            data_url = payload['data']
            # data:image/png;base64,...
            header, encoded = data_url.split(',', 1)
            raw = base64.b64decode(encoded)
            file_path = os.path.join(OUTPUT_DIR, f"{car_id}.png")
            with open(file_path, 'wb') as f:
                f.write(raw)
            print(f"[SNAPSHOT] Saved: {file_path} ({len(raw)} bytes)")
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b"OK")
        elif self.path == '/done':
            done_event = True
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"DONE")
        else:
            self.send_response(404)
            self.end_headers()

def main():
    global done_event
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.timeout = 1.0
        print(f"Serving HTTP on port {PORT} from {ROOT_DIR}...")

        # Find Chrome
        chrome_paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        ]
        chrome_exe = next((p for p in chrome_paths if os.path.exists(p)), None)
        if not chrome_exe:
            print("Neither Chrome nor Edge found!")
            sys.exit(1)

        url = f"http://localhost:{PORT}/road-riot/tools/snapshot_cars.html"
        print(f"Launching {chrome_exe} with {url}...")
        browser_proc = subprocess.Popen([
            chrome_exe,
            "--headless=new",
            "--disable-gpu=false",
            "--use-gl=angle",
            url
        ])

        start_time = time.time()
        while not done_event and time.time() - start_time < 90:
            httpd.handle_request()

        try:
            browser_proc.terminate()
            browser_proc.wait(timeout=2)
        except Exception:
            pass

    print("Snapshot generation finished. Verifying outputs:")
    for f in os.listdir(OUTPUT_DIR):
        print(f" - {f}")

if __name__ == "__main__":
    main()
