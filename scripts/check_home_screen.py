import subprocess
import time
import os
import json
import urllib.request
import base64

def main():
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ]
    chrome_exe = next((p for p in chrome_paths if os.path.exists(p)), None)
    if not chrome_exe:
        print("No browser found")
        return

    browser_proc = subprocess.Popen([
        chrome_exe,
        "--remote-debugging-port=9222",
        "--headless=new",
        "--disable-gpu=false",
        "--window-size=1280,800"
    ])
    time.sleep(2)

    try:
        req = urllib.request.urlopen("http://127.0.0.1:9222/json")
        tabs = json.loads(req.read().decode())
        ws_url = tabs[0]["webSocketDebuggerUrl"]

        import asyncio
        import websockets

        async def run():
            async with websockets.connect(ws_url) as ws:
                async def send(method, params=None):
                    msg_id = int(time.time() * 1000) % 1000000
                    await ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
                    while True:
                        res = json.loads(await ws.recv())
                        if res.get("id") == msg_id:
                            return res.get("result", {})

                await send("Page.enable")
                await send("Page.navigate", {"url": "http://localhost:3000/road-riot/index.html"})
                await asyncio.sleep(4)

                # Capture full screenshot
                snap = await send("Page.captureScreenshot", {"format": "png"})
                img_data = base64.b64decode(snap["data"])
                out_path = r"C:\Users\nagas\.gemini\antigravity\brain\8ea69033-02ce-4c15-aaf2-824a48008b4e\current_home_screen.png"
                with open(out_path, "wb") as f:
                    f.write(img_data)
                print(f"Captured screenshot to: {out_path}")

                # Check DOM of menu-right-card
                dom_eval = await send("Runtime.evaluate", {
                    "expression": "document.querySelector('#menu-right-card').innerHTML"
                })
                print("menu-right-card HTML:")
                print(dom_eval.get("result", {}).get("value", "")[:500])

        asyncio.run(run())
    finally:
        browser_proc.terminate()
        browser_proc.wait(timeout=2)

if __name__ == "__main__":
    main()
