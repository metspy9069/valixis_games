import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64
import os

ARTIFACTS_DIR = r"C:\Users\nagas\.gemini\antigravity\brain\8ea69033-02ce-4c15-aaf2-824a48008b4e"

async def check_showroom():
    proc = subprocess.Popen([
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9222",
        "--disable-gpu=false",
        "--window-size=1280,720"
    ])
    try:
        await asyncio.sleep(2)
        with urllib.request.urlopen("http://127.0.0.1:9222/json") as resp:
            targets = json.loads(resp.read().decode())
        ws_url = targets[0]["webSocketDebuggerUrl"]
        async with websockets.connect(ws_url, max_size=25*1024*1024) as ws:
            msg_id = 0
            async def send(method, params=None):
                nonlocal msg_id
                msg_id += 1
                await ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
                while True:
                    r = json.loads(await ws.recv())
                    if r.get("id") == msg_id:
                        return r.get("result", {})

            await send("Page.enable")
            await send("Runtime.enable")
            await send("Page.navigate", {"url": "http://localhost:8088/road-riot/index.html"})
            
            for _ in range(25):
                await asyncio.sleep(0.5)
                res = await send("Runtime.evaluate", {
                    "expression": "Boolean(window.game?.assetPrototypes?.apex)",
                    "returnByValue": True
                })
                if res.get("result", {}).get("value"):
                    break
            
            # Click Showroom
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#garage-btn')?.click() || window.game.openGarage()"
            })
            await asyncio.sleep(1.2)
            
            ss = await send("Page.captureScreenshot", {"format": "png"})
            out_path = os.path.join(ARTIFACTS_DIR, "road_riot_showroom_sanitized_hero.png")
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(ss["data"]))
            print(f"Saved {out_path}")
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(check_showroom())
