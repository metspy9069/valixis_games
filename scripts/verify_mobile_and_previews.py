import asyncio
import json
import base64
import os
import subprocess
import time
import urllib.request
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9222
ARTIFACTS_DIR = r"C:\Users\nagas\.gemini\antigravity\brain\8ea69033-02ce-4c15-aaf2-824a48008b4e"

async def run_cdp():
    # 1. Start Chrome with remote debugging
    proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--disable-gpu=false",
        "--use-gl=angle",
        "--window-size=1280,720"
    ])
    try:
        await asyncio.sleep(1.8)
        # Fetch targets
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as resp:
            targets = json.loads(resp.read().decode())
        ws_url = targets[0]["webSocketDebuggerUrl"]
        print(f"Connected to Chrome CDP: {ws_url}")

        async with websockets.connect(ws_url, max_size=25 * 1024 * 1024) as ws:
            msg_id = 0
            async def send(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    res = json.loads(await ws.recv())
                    if res.get("id") == msg_id:
                        return res.get("result", {})

            await send("Page.enable")
            await send("Runtime.enable")

            # Navigate to Road Riot
            print("Navigating to http://localhost:8088/road-riot/index.html...")
            await send("Page.navigate", {"url": "http://localhost:8088/road-riot/index.html"})
            await asyncio.sleep(3.0)

            # Check for cartoon preview slot in main menu
            slot_exists = await send("Runtime.evaluate", {
                "expression": "Boolean(document.querySelector('#menu-car-preview-slot'))",
                "returnByValue": True
            })
            print("Cartoon preview slot exists in DOM:", slot_exists.get("result", {}).get("value"))

            # Screenshot 1: Desktop Main Menu
            res = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "road_riot_menu_verified_no_cartoon.png"), "wb") as f:
                f.write(base64.b64decode(res["data"]))
            print("Saved road_riot_menu_verified_no_cartoon.png")

            # Open Showroom
            print("Opening Showroom...")
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#menu-showroom-btn')?.click() || (window.game && window.game.openGarage())"
            })
            await asyncio.sleep(1.5)

            # Verify Showroom cards use real 3D previews
            preview_srcs = await send("Runtime.evaluate", {
                "expression": "Array.from(document.querySelectorAll('.garage-card-thumb')).map(img => img.src)",
                "returnByValue": True
            })
            print("Showroom preview image sources:", preview_srcs.get("result", {}).get("value"))

            # Screenshot 2: Showroom with Real 3D Preview Cards
            res = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "road_riot_showroom_real_3d_cards.png"), "wb") as f:
                f.write(base64.b64decode(res["data"]))
            print("Saved road_riot_showroom_real_3d_cards.png")

            # Switch to Titan Juggernaut in Showroom
            await send("Runtime.evaluate", {
                "expression": "document.querySelectorAll('.garage-card')[4]?.click()"
            })
            await asyncio.sleep(1.0)
            res = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "road_riot_showroom_titan_juggernaut.png"), "wb") as f:
                f.write(base64.b64decode(res["data"]))
            print("Saved road_riot_showroom_titan_juggernaut.png")

            # Close Showroom
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#garage-close-btn')?.click()"
            })
            await asyncio.sleep(0.5)

            # Emulate Mobile Device (iPhone 14 / Pixel: 390x844, DPR: 2.0, mobile: True)
            print("Emulating Mobile Viewport 390x844...")
            await send("Emulation.setDeviceMetricsOverride", {
                "width": 390,
                "height": 844,
                "deviceScaleFactor": 2.0,
                "mobile": True
            })
            await send("Emulation.setTouchEmulationEnabled", {
                "enabled": True,
                "maxTouchPoints": 5
            })
            await send("Runtime.evaluate", {
                "expression": "window.dispatchEvent(new Event('resize'))"
            })
            await asyncio.sleep(0.5)

            # Start Race on Mobile
            print("Starting Race on Mobile (calling startCountdown and startRun)...")
            await send("Runtime.evaluate", {
                "expression": "window.game.startCountdown(); window.game.startRun();"
            })
            await asyncio.sleep(3.0)

            # Check car speed after 3s of driving
            speed_info = await send("Runtime.evaluate", {
                "expression": "({ speed: window.game?.player?.speed, kmh: Math.round((window.game?.player?.speed || 0) * 9), isMobile: window.game?.isMobileDevice, dpr: window.game?.renderer?.getPixelRatio(), gear: window.game?.lastGear })",
                "returnByValue": True
            })
            print("Mobile Speed Info:", speed_info.get("result", {}).get("value"))

            # Screenshot 3: Mobile Gameplay at Full Speed
            res = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "road_riot_mobile_gameplay_verified.png"), "wb") as f:
                f.write(base64.b64decode(res["data"]))
            print("Saved road_riot_mobile_gameplay_verified.png")

            # Test Brake Button Interaction & Deceleration
            print("Testing Brake Touch...")
            await send("Runtime.evaluate", {
                "expression": "window.game.keys.add('ArrowDown')"
            })
            await asyncio.sleep(1.0)
            brake_info = await send("Runtime.evaluate", {
                "expression": "({ speed: window.game?.player?.speed, kmh: Math.round((window.game?.player?.speed || 0) * 9), isBraking: window.game?.player?.isBraking })",
                "returnByValue": True
            })
            print("Braking Speed Info:", brake_info.get("result", {}).get("value"))

            # Release Brake
            print("Releasing Brake...")
            await send("Runtime.evaluate", {
                "expression": "window.game.keys.delete('ArrowDown')"
            })
            await asyncio.sleep(2.0)
            accelerate_info = await send("Runtime.evaluate", {
                "expression": "({ speed: window.game?.player?.speed, kmh: Math.round((window.game?.player?.speed || 0) * 9), gear: window.game?.lastGear })",
                "returnByValue": True
            })
            print("Resumed Acceleration Info:", accelerate_info.get("result", {}).get("value"))

    finally:
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(run_cdp())
