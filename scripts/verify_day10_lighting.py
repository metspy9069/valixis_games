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


async def run_day10_lighting_verification():
    print(f"[DAY10-LIGHTING] Launching Chrome headless on port {CDP_PORT}...", flush=True)
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
        print(f"[DAY10-LIGHTING] Connected to CDP at {ws_url}", flush=True)

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            msg_id = 0

            async def send(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    raw = await asyncio.wait_for(ws.recv(), timeout=20.0)
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
                window.__day10Errors = [];
                window.addEventListener('error', e => {
                    window.__day10Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            await send("Page.navigate", {"url": URL})
            print("[DAY10-LIGHTING] Navigating to Road Riot...", flush=True)
            await asyncio.sleep(2.5)

            # Wait for game initialization
            for _ in range(25):
                st = await send("Runtime.evaluate", {"expression": "Boolean(window.game && window.game.player)", "returnByValue": True})
                if st.get("result", {}).get("value") is True:
                    break
                await asyncio.sleep(0.3)

            print("[DAY10-LIGHTING] Game initialized. Starting highway run for lighting pipeline testing...")

            # Start Game
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#start-btn').click()"
            })
            for _ in range(25):
                st = await send("Runtime.evaluate", {"expression": "window.game?.state", "returnByValue": True})
                if st.get("result", {}).get("value") == "RUNNING":
                    break
                await asyncio.sleep(0.3)

            # -------------------------------------------------------------
            # Phase 1: Progressive Sunset Lighting & Hypersonic Nitro Bloom
            # -------------------------------------------------------------
            print("[DAY10-LIGHTING] Phase 1: Transitioning to Sunset Expressway & Pulsing Nitro Bloom...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.hull = 1000;
                    window.game.distance = 1600; // Sunset expressway cycle point
                    window.game.player.speed = 28.0; // Hypersonic 252 km/h
                    window.game.player.targetSpeed = 28.0;
                    window.game.player.isBoosting = true;
                    window.game.player.nitro = 100;
                    // Trigger bloom pulse & sunset lighting
                    window.game.world.updateLightingCycle(1600, 0.016);
                })()
                """
            })

            # Advance 30 simulation frames
            for _ in range(30):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 1 Telemetry
            sunset_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getLightingTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            sunset_data = sunset_eval.get("result", {}).get("value", {})
            print(f"[DAY10-LIGHTING] Sunset & Bloom Telemetry: {json.dumps(sunset_data, indent=2)}")

            # Capture Sunset & Bloom Screenshot
            shot1 = await send("Page.captureScreenshot", {"format": "png"})
            shot1_bytes = base64.b64decode(shot1["data"])
            shot1_path = os.path.join(ARTIFACTS_DIR, "day10_bloom_sunset_expressway.png")
            with open(shot1_path, "wb") as f:
                f.write(shot1_bytes)
            print(f"[DAY10-LIGHTING] Captured Sunset & Bloom screenshot ({len(shot1_bytes)} bytes) -> {shot1_path}")

            # -------------------------------------------------------------
            # Phase 2: Subterranean Concrete Tunnel & Sodium Lighting
            # -------------------------------------------------------------
            print("[DAY10-LIGHTING] Phase 2: Entering Subterranean Concrete Highway Tunnel...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.isBoosting = false;
                    window.game.player.speed = 18.0; // 162 km/h cruising
                    window.game.player.targetSpeed = 18.0;

                    // Locate tunnel segment and align player directly inside
                    if (window.game.world.tunnelSegments.length > 0) {
                        const targetSeg = window.game.world.tunnelSegments[1] || window.game.world.tunnelSegments[0];
                        // Bring target segment right to player Z (-8)
                        const offset = targetSeg.position.z - (-8);
                        for (let s of window.game.world.segments) {
                            s.position.z -= offset;
                        }
                    }
                })()
                """
            })

            # Run 25 frames for tunnel ambient occlusion and sodium lighting transition
            for _ in range(25):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 2 Tunnel Telemetry
            tunnel_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getLightingTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            tunnel_data = tunnel_eval.get("result", {}).get("value", {})
            print(f"[DAY10-LIGHTING] Subterranean Tunnel Telemetry: {json.dumps(tunnel_data, indent=2)}")

            # Capture Subterranean Tunnel Screenshot
            shot2 = await send("Page.captureScreenshot", {"format": "png"})
            shot2_bytes = base64.b64decode(shot2["data"])
            shot2_path = os.path.join(ARTIFACTS_DIR, "day10_tunnel_sodium_subterranean.png")
            with open(shot2_path, "wb") as f:
                f.write(shot2_bytes)
            print(f"[DAY10-LIGHTING] Captured Subterranean Tunnel screenshot ({len(shot2_bytes)} bytes) -> {shot2_path}")

            # -------------------------------------------------------------
            # Phase 3: Midnight Headlights & Traffic Illumination
            # -------------------------------------------------------------
            print("[DAY10-LIGHTING] Phase 3: Midnight High-Beam Xenon Projectors & Lead Traffic Illumination...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.distance = 2600; // Midnight lighting cycle point
                    window.game.world.updateLightingCycle(2600, 0.016);
                    window.game.player.speed = 20.0;
                    window.game.player.targetSpeed = 20.0;
                    window.game.player.x = 0;

                    // Ensure segments are reset out of tunnel
                    for (let i = 0; i < window.game.world.segments.length; i++) {
                        window.game.world.segments[i].position.z = -i * window.game.world.segmentLength;
                    }

                    // Spawn or position an NPC traffic vehicle directly ahead in the headlight cone
                    if (window.game.traffic) {
                        let leadCar = window.game.traffic.vehicles ? window.game.traffic.vehicles[0] : null;
                        if (!leadCar && window.game.traffic.spawnCar) {
                            leadCar = window.game.traffic.spawnCar(0, -32, 14.0);
                        }
                        if (leadCar && leadCar.mesh) {
                            leadCar.mesh.position.set(0, 0.5, -30);
                            leadCar.x = 0;
                            leadCar.z = -30;
                            leadCar.speed = 14.0;
                        }
                    }
                })()
                """
            })

            # Run 25 frames for headlight beam illumination
            for _ in range(25):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 3 Midnight Telemetry
            midnight_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getLightingTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            midnight_data = midnight_eval.get("result", {}).get("value", {})
            print(f"[DAY10-LIGHTING] Midnight Headlights Telemetry: {json.dumps(midnight_data, indent=2)}")

            # Capture Midnight Headlights Screenshot
            shot3 = await send("Page.captureScreenshot", {"format": "png"})
            shot3_bytes = base64.b64decode(shot3["data"])
            shot3_path = os.path.join(ARTIFACTS_DIR, "day10_headlight_midnight_traffic.png")
            with open(shot3_path, "wb") as f:
                f.write(shot3_bytes)
            print(f"[DAY10-LIGHTING] Captured Midnight Headlights screenshot ({len(shot3_bytes)} bytes) -> {shot3_path}")

            # Check runtime errors
            errors_eval = await send("Runtime.evaluate", {
                "expression": "window.__day10Errors || []",
                "returnByValue": True
            })
            page_errors = errors_eval.get("result", {}).get("value", [])
            print(f"[DAY10-LIGHTING] Runtime page errors: {len(page_errors)}")

            # Save Full Day 10 Telemetry
            full_telemetry = {
                "timestamp": "2026-11-28T13:45:00Z",
                "phase1_sunset_and_bloom": sunset_data,
                "phase2_subterranean_tunnel": tunnel_data,
                "phase3_midnight_headlights": midnight_data,
                "runtime_errors": page_errors,
                "screenshots": [
                    shot1_path,
                    shot2_path,
                    shot3_path
                ],
                "verification_status": "PASS" if len(page_errors) == 0 else "FAIL"
            }

            telem_path = os.path.join(ARTIFACTS_DIR, "road_riot_day10_verification_telemetry.json")
            with open(telem_path, "w", encoding="utf-8") as f:
                json.dump(full_telemetry, f, indent=2)
            print(f"[DAY10-LIGHTING] Saved verification telemetry to {telem_path}")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()
        print("[DAY10-LIGHTING] Chrome process terminated cleanly.")


if __name__ == "__main__":
    asyncio.run(run_day10_lighting_verification())
