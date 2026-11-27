import asyncio
import json
import base64
import os
import subprocess
import urllib.request
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_PORT = 9222
URL = "http://localhost:3000/road-riot/index.html"
ARTIFACTS_DIR = r"C:\Users\nagas\.gemini\antigravity\brain\8ea69033-02ce-4c15-aaf2-824a48008b4e"
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

async def run_verification():
    print(f"[CDP] Launching Chrome on port {CDP_PORT}...")
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--disable-gpu=false",
        "--use-gl=angle",
        "--window-size=1280,720"
    ])

    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json") as resp:
            targets = json.loads(resp.read().decode())
        page_target = next(t for t in targets if t.get("type") == "page")
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"[CDP] Connected to: {ws_url}")

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            msg_id = 0
            async def send(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    raw = await ws.recv()
                    res = json.loads(raw)
                    if res.get("id") == msg_id:
                        return res.get("result", {})

            await send("Page.enable")
            await send("Runtime.enable")
            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(3.5)

            # 1. Capture Initial Supercar Specifications card with Apex 3D render
            snap1 = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "supercar_spec_card_apex_3d.png"), "wb") as f:
                f.write(base64.b64decode(snap1["data"]))
            print("[CDP] Captured: supercar_spec_card_apex_3d.png")

            # 2. Click next supercar arrow to cycle to Venom
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#menu-next-car-btn').click()"
            })
            await asyncio.sleep(1.0)

            # 3. Capture second car (Venom Drift-R)
            snap2 = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "supercar_spec_card_venom_3d.png"), "wb") as f:
                f.write(base64.b64decode(snap2["data"]))
            print("[CDP] Captured: supercar_spec_card_venom_3d.png")

            # 4. Read telemetry from DOM
            eval_res = await send("Runtime.evaluate", {
                "expression": """
                ({
                    carName: document.querySelector('#menu-equipped-car')?.textContent,
                    carTier: document.querySelector('#menu-car-tier-badge')?.textContent,
                    thumbSrc: document.querySelector('#menu-car-thumb')?.src,
                    topSpeed: document.querySelector('#menu-val-speed')?.textContent,
                    accel: document.querySelector('#menu-val-accel')?.textContent,
                    handling: document.querySelector('#menu-val-handling')?.textContent
                })
                """,
                "returnByValue": True
            })
            print("[CDP] Telemetry:", json.dumps(eval_res.get("result", {}).get("value", {}), indent=2))

    finally:
        chrome_proc.terminate()
        chrome_proc.wait(timeout=2)

if __name__ == "__main__":
    asyncio.run(run_verification())
