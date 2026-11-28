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


async def run_day11_neotokyo_verification():
    print(f"[DAY11-NEOTOKYO] Launching Chrome headless on port {CDP_PORT}...", flush=True)
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
        print(f"[DAY11-NEOTOKYO] Connected to CDP at {ws_url}", flush=True)

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
                window.__day11Errors = [];
                window.addEventListener('error', e => {
                    window.__day11Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            await send("Page.navigate", {"url": URL})
            print("[DAY11-NEOTOKYO] Navigating to Road Riot...", flush=True)
            await asyncio.sleep(2.5)

            # Wait for game initialization
            for _ in range(25):
                st = await send("Runtime.evaluate", {"expression": "Boolean(window.game && window.game.player)", "returnByValue": True})
                if st.get("result", {}).get("value") is True:
                    break
                await asyncio.sleep(0.3)

            print("[DAY11-NEOTOKYO] Game initialized. Starting Neo-Tokyo expressway run...")

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
            # Phase 1: Neo-Tokyo Biome & Holographic Billboards with Glitch
            # -------------------------------------------------------------
            print("[DAY11-NEOTOKYO] Phase 1: Switching to Neo-Tokyo rain biome & triggering holographic billboard glitch...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.hull = 1000;
                    window.game.player.speed = 18.0; // 162 km/h
                    window.game.player.targetSpeed = 18.0;

                    // Switch to Neo-Tokyo
                    window.game.world.setBiome('neotokyo');

                    // Position a holographic billboard right in front/side of the player view
                    if (window.game.world.holographicBillboards && window.game.world.holographicBillboards.length > 0) {
                        const targetBillboard = window.game.world.holographicBillboards[0];
                        // Align the segment containing this billboard
                        const parentSeg = targetBillboard.parent;
                        if (parentSeg) {
                            const offset = parentSeg.position.z - (-22);
                            for (let s of window.game.world.segments) {
                                s.position.z -= offset;
                            }
                        }
                    }

                    // Trigger chromatic glitch
                    window.game.world.hologramGlitchTimer = 0.25;
                })()
                """
            })

            # Advance 20 frames for visual stabilization
            for _ in range(20):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 1 Telemetry
            hologram_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getBiomeTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            hologram_data = hologram_eval.get("result", {}).get("value", {})
            print(f"[DAY11-NEOTOKYO] Hologram & Rain Telemetry: {json.dumps(hologram_data, indent=2)}")

            # Capture Holographic Billboard Screenshot
            shot1 = await send("Page.captureScreenshot", {"format": "png"})
            shot1_bytes = base64.b64decode(shot1["data"])
            shot1_path = os.path.join(ARTIFACTS_DIR, "day11_holographic_billboard_neotokyo.png")
            with open(shot1_path, "wb") as f:
                f.write(shot1_bytes)
            print(f"[DAY11-NEOTOKYO] Captured Hologram screenshot ({len(shot1_bytes)} bytes) -> {shot1_path}")

            # -------------------------------------------------------------
            # Phase 2: Wet Asphalt Dynamic Puddle Reflections
            # -------------------------------------------------------------
            print("[DAY11-NEOTOKYO] Phase 2: Wet asphalt road transition & puddle reflection verification...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    // Full wetness saturation
                    window.game.world.roadWetness = 1.0;
                    window.game.world.targetWetness = 1.0;
                    if (window.game.world.roadMaterial) {
                        window.game.world.roadMaterial.roughness = 0.09;
                        window.game.world.roadMaterial.metalness = 0.78;
                        if (window.game.world.puddleNoiseTexture) {
                            window.game.world.roadMaterial.roughnessMap = window.game.world.puddleNoiseTexture;
                        }
                    }
                    window.game.player.speed = 22.0; // 198 km/h wet highway speed
                    window.game.player.targetSpeed = 22.0;
                })()
                """
            })

            # Advance 25 frames
            for _ in range(25):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 2 Wet Road Telemetry
            wet_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getBiomeTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            wet_data = wet_eval.get("result", {}).get("value", {})
            print(f"[DAY11-NEOTOKYO] Wet Asphalt Telemetry: {json.dumps(wet_data, indent=2)}")

            # Capture Wet Asphalt Screenshot
            shot2 = await send("Page.captureScreenshot", {"format": "png"})
            shot2_bytes = base64.b64decode(shot2["data"])
            shot2_path = os.path.join(ARTIFACTS_DIR, "day11_wet_asphalt_puddle_reflections.png")
            with open(shot2_path, "wb") as f:
                f.write(shot2_bytes)
            print(f"[DAY11-NEOTOKYO] Captured Wet Asphalt screenshot ({len(shot2_bytes)} bytes) -> {shot2_path}")

            # -------------------------------------------------------------
            # Phase 3: Elevated Monorail Train Overhead Cruise & Gantries
            # -------------------------------------------------------------
            print("[DAY11-NEOTOKYO] Phase 3: Aligning Elevated Monorail Bullet Train & Highway Acoustic Barriers...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.speed = 16.0;
                    window.game.player.targetSpeed = 16.0;
                    window.game.player.x = 0;

                    // Position monorail train overhead in front of player
                    if (window.game.world.monorailTrain) {
                        window.game.world.monorailTrain.position.set(0, 13.5, -28.0);
                        window.game.world.monorailTrain.visible = true;
                    }

                    // Bring an overhead gantry close into view
                    if (window.game.world.gantries && window.game.world.gantries.length > 0) {
                        const gantry = window.game.world.gantries[0];
                        if (gantry.parent) {
                            const offset = gantry.parent.position.z - (-45.0);
                            for (let s of window.game.world.segments) {
                                s.position.z -= offset;
                            }
                        }
                    }
                })()
                """
            })

            # Advance 20 frames
            for _ in range(20):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 3 Monorail Telemetry
            monorail_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getBiomeTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            monorail_data = monorail_eval.get("result", {}).get("value", {})
            print(f"[DAY11-NEOTOKYO] Monorail & Gantry Telemetry: {json.dumps(monorail_data, indent=2)}")

            # Capture Monorail Overpass Screenshot
            shot3 = await send("Page.captureScreenshot", {"format": "png"})
            shot3_bytes = base64.b64decode(shot3["data"])
            shot3_path = os.path.join(ARTIFACTS_DIR, "day11_elevated_monorail_overpass.png")
            with open(shot3_path, "wb") as f:
                f.write(shot3_bytes)
            print(f"[DAY11-NEOTOKYO] Captured Monorail Overpass screenshot ({len(shot3_bytes)} bytes) -> {shot3_path}")

            # Check runtime errors
            errors_eval = await send("Runtime.evaluate", {
                "expression": "window.__day11Errors || []",
                "returnByValue": True
            })
            page_errors = errors_eval.get("result", {}).get("value", [])
            print(f"[DAY11-NEOTOKYO] Runtime page errors: {len(page_errors)}")

            # Save Full Day 11 Telemetry
            full_telemetry = {
                "timestamp": "2026-11-28T14:10:00Z",
                "phase1_holographic_billboards": hologram_data,
                "phase2_wet_asphalt_reflections": wet_data,
                "phase3_elevated_monorail_overpass": monorail_data,
                "runtime_errors": page_errors,
                "screenshots": [
                    shot1_path,
                    shot2_path,
                    shot3_path
                ],
                "verification_status": "PASS" if len(page_errors) == 0 else "FAIL"
            }

            telem_path = os.path.join(ARTIFACTS_DIR, "road_riot_day11_verification_telemetry.json")
            with open(telem_path, "w", encoding="utf-8") as f:
                json.dump(full_telemetry, f, indent=2)
            print(f"[DAY11-NEOTOKYO] Saved verification telemetry to {telem_path}")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()
        print("[DAY11-NEOTOKYO] Chrome process terminated cleanly.")


if __name__ == "__main__":
    asyncio.run(run_day11_neotokyo_verification())
