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


async def run_day09_weather_verification():
    print(f"[DAY09-WEATHER] Launching Chrome headless on port {CDP_PORT}...")
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--disable-gpu=false",
        "--use-gl=angle",
        "--window-size=1280,720",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
    ])

    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json") as resp:
            targets = json.loads(resp.read().decode())
        page_target = next(t for t in targets if t.get("type") == "page")
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"[DAY09-WEATHER] Connected to CDP at {ws_url}")

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
                        if "error" in res:
                            print(f"[CDP ERROR] {res['error']}", flush=True)
                        result = res.get("result", {})
                        if "exceptionDetails" in result:
                            print(f"[CDP EXCEPTION] {result['exceptionDetails']}", flush=True)
                        return result

            await send("Page.enable")
            await send("Runtime.enable")
            await send("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                window.__day09Errors = [];
                window.addEventListener('error', e => {
                    window.__day09Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            await send("Page.navigate", {"url": URL})
            print("[DAY09-WEATHER] Navigating to Road Riot...")
            await asyncio.sleep(2.5)

            # Wait for game initialization
            for _ in range(25):
                st = await send("Runtime.evaluate", {"expression": "Boolean(window.game && window.game.player)", "returnByValue": True})
                if st.get("result", {}).get("value") is True:
                    break
                await asyncio.sleep(0.3)

            print("[DAY09-WEATHER] Game initialized. Starting highway run for weather testing...")

            # Start Game
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#start-btn').click()"
            })
            for _ in range(25):
                st = await send("Runtime.evaluate", {"expression": "window.game?.state", "returnByValue": True})
                if st.get("result", {}).get("value") == "RUNNING":
                    break
                await asyncio.sleep(0.3)

            # Phase 1: High-Speed Rain Streaks & Screen-Space Refraction Droplets
            print("[DAY09-WEATHER] Phase 1: Activating Rain Weather & Screen Droplet System...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.hull = 1000;
                    window.game.world.setWeatherType('rain');
                    window.game.player.speed = 18.0; // 162 km/h
                    window.game.player.targetSpeed = 18.0;
                })()
                """
            })

            # Advance 35 simulation frames
            for _ in range(35):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 1 Telemetry
            rain_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getWeatherTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            rain_data = rain_eval.get("result", {}).get("value", {})
            print(f"[DAY09-WEATHER] Rain Telemetry: {json.dumps(rain_data, indent=2)}")

            # Capture Rain Streaks & Screen Droplets Screenshot
            shot1 = await send("Page.captureScreenshot", {"format": "png"})
            shot1_bytes = base64.b64decode(shot1["data"])
            shot1_path = os.path.join(ARTIFACTS_DIR, "day09_rain_streaks_droplets.png")
            with open(shot1_path, "wb") as f:
                f.write(shot1_bytes)
            print(f"[DAY09-WEATHER] Captured Rain & Droplets screenshot ({len(shot1_bytes)} bytes) -> {shot1_path}")

            # Phase 2: High-Speed Asphalt Tire Water Spray Plumes & Downshift Overrun Backfire
            print("[DAY09-WEATHER] Phase 2: Accelerating to 225 KM/H for Tire Spray Plumes & Backfire...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.speed = 25.0; // 225 km/h
                    window.game.player.targetSpeed = 26.0;
                    window.game.player.isBoosting = true;
                    window.game.player.nitro = 100;
                    window.game.player.triggerBackfire('downshift');
                })()
                """
            })

            # Run 25 frames
            for _ in range(25):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 2 Spray & Backfire Telemetry
            spray_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getWeatherTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    const perf = window.game.getPerformanceMetrics ? window.game.getPerformanceMetrics() : null;
                    return { telem, kmh, perf };
                })()
                """,
                "returnByValue": True
            })
            spray_data = spray_eval.get("result", {}).get("value", {})
            print(f"[DAY09-WEATHER] Spray & Backfire Telemetry: {json.dumps(spray_data, indent=2)}")

            # Capture High-Speed Tire Spray Screenshot
            shot2 = await send("Page.captureScreenshot", {"format": "png"})
            shot2_bytes = base64.b64decode(shot2["data"])
            shot2_path = os.path.join(ARTIFACTS_DIR, "day09_tire_spray_highspeed.png")
            with open(shot2_path, "wb") as f:
                f.write(shot2_bytes)
            print(f"[DAY09-WEATHER] Captured Tire Spray Plume screenshot ({len(shot2_bytes)} bytes) -> {shot2_path}")

            # Phase 3: Arctic Blizzard Swirling Particle Snow & Windshield Edge Frost
            print("[DAY09-WEATHER] Phase 3: Activating Arctic Blizzard & Crosswind Frost...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.world.setWeatherType('snow');
                    window.game.player.speed = 19.0; // 171 km/h
                    window.game.player.targetSpeed = 19.0;
                    window.game.player.isBoosting = false;
                })()
                """
            })

            # Run 40 frames for blizzard particles and frost accumulation
            for _ in range(40):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 3 Arctic Telemetry
            snow_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getWeatherTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            snow_data = snow_eval.get("result", {}).get("value", {})
            print(f"[DAY09-WEATHER] Arctic Blizzard Telemetry: {json.dumps(snow_data, indent=2)}")

            # Capture Arctic Blizzard Screenshot
            shot3 = await send("Page.captureScreenshot", {"format": "png"})
            shot3_bytes = base64.b64decode(shot3["data"])
            shot3_path = os.path.join(ARTIFACTS_DIR, "day09_arctic_blizzard.png")
            with open(shot3_path, "wb") as f:
                f.write(shot3_bytes)
            print(f"[DAY09-WEATHER] Captured Arctic Blizzard screenshot ({len(shot3_bytes)} bytes) -> {shot3_path}")

            # Check runtime errors
            errors_eval = await send("Runtime.evaluate", {
                "expression": "window.__day09Errors || []",
                "returnByValue": True
            })
            page_errors = errors_eval.get("result", {}).get("value", [])
            print(f"[DAY09-WEATHER] Runtime page errors: {len(page_errors)}")

            # Save Full Day 09 Telemetry
            full_telemetry = {
                "timestamp": "2026-11-28T13:25:00Z",
                "phase1_rain_and_droplets": rain_data,
                "phase2_tire_spray_and_backfire": spray_data,
                "phase3_arctic_blizzard_and_frost": snow_data,
                "runtime_errors": page_errors,
                "screenshots": [
                    shot1_path,
                    shot2_path,
                    shot3_path
                ],
                "verification_status": "PASS" if len(page_errors) == 0 else "FAIL"
            }

            telem_path = os.path.join(ARTIFACTS_DIR, "road_riot_day09_verification_telemetry.json")
            with open(telem_path, "w", encoding="utf-8") as f:
                json.dump(full_telemetry, f, indent=2)
            print(f"[DAY09-WEATHER] Saved verification telemetry to {telem_path}")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()
        print("[DAY09-WEATHER] Chrome process terminated cleanly.")


if __name__ == "__main__":
    asyncio.run(run_day09_weather_verification())
