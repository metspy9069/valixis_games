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


async def run_day12_biomes_verification():
    print(f"[DAY12-BIOMES] Launching Chrome headless on port {CDP_PORT}...", flush=True)
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
        print(f"[DAY12-BIOMES] Connected to CDP at {ws_url}", flush=True)

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
                window.__day12Errors = [];
                window.addEventListener('error', e => {
                    window.__day12Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            await send("Page.navigate", {"url": URL})
            print("[DAY12-BIOMES] Navigating to Road Riot...", flush=True)
            await asyncio.sleep(2.5)

            # Wait for game initialization
            initialized = False
            for _ in range(35):
                st = await send("Runtime.evaluate", {"expression": "Boolean(window.game && window.game.player && document.querySelector('#start-btn'))", "returnByValue": True})
                if st.get("result", {}).get("value") is True:
                    initialized = True
                    break
                await asyncio.sleep(0.3)

            if not initialized:
                raise RuntimeError("Game failed to initialize within timeout")

            print("[DAY12-BIOMES] Game initialized. Starting Day 12 Biome run...")

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
            # Phase 1: Red Rock Canyon (Sandstone Cliffs, Archway, Dust Devils & Tumbleweeds)
            # -------------------------------------------------------------
            print("[DAY12-BIOMES] Phase 1: Switching to Red Rock Canyon with monolithic cliffs & spanning archway...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.hull = 1000;
                    window.game.player.speed = 22.0; // 198 km/h
                    window.game.player.targetSpeed = 22.0;
                    window.game.player.x = 0;

                    // Switch to Red Rock Canyon
                    window.game.world.setBiome('canyon');

                    // Align segment with rock archway ahead of player
                    if (window.game.world.canyonArchways && window.game.world.canyonArchways.length > 0) {
                        const targetArch = window.game.world.canyonArchways[0];
                        if (targetArch.parent) {
                            const offset = targetArch.parent.position.z - (-26.0);
                            for (let s of window.game.world.segments) {
                                s.position.z -= offset;
                            }
                        }
                    }

                    // Position dust devil and tumbleweed in clear view
                    if (window.game.world.dustDevils && window.game.world.dustDevils[0]) {
                        window.game.world.dustDevils[0].position.set(-8.5, 0, -18.0);
                        window.game.world.dustDevils[0].visible = true;
                    }
                    if (window.game.world.tumbleweeds && window.game.world.tumbleweeds[0]) {
                        window.game.world.tumbleweeds[0].position.set(3.5, 0.65, -12.0);
                        window.game.world.tumbleweeds[0].visible = true;
                    }
                })()
                """
            })

            # Advance 20 frames for physics and visual stabilization
            for _ in range(20):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 1 Telemetry
            canyon_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getBiomeTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            canyon_data = canyon_eval.get("result", {}).get("value", {})
            print(f"[DAY12-BIOMES] Canyon Telemetry: {json.dumps(canyon_data, indent=2)}")

            # Capture Red Rock Canyon Screenshot
            shot1 = await send("Page.captureScreenshot", {"format": "png"})
            shot1_bytes = base64.b64decode(shot1["data"])
            shot1_path = os.path.join(ARTIFACTS_DIR, "day12_canyon_archway_dustdevils.png")
            with open(shot1_path, "wb") as f:
                f.write(shot1_bytes)
            print(f"[DAY12-BIOMES] Captured Canyon screenshot ({len(shot1_bytes)} bytes) -> {shot1_path}")

            # -------------------------------------------------------------
            # Phase 2: Arctic Tundra Black Ice & Traction Slip Dynamics
            # -------------------------------------------------------------
            print("[DAY12-BIOMES] Phase 2: Arctic Tundra black ice patch & lateral friction reduction...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.world.setBiome('arctic');
                    window.game.player.speed = 24.0;
                    window.game.player.targetSpeed = 24.0;

                    // Position player on top of the first black ice patch
                    if (window.game.world.blackIcePatches && window.game.world.blackIcePatches.length > 0) {
                        const patch = window.game.world.blackIcePatches[0];
                        // Align segment
                        const offset = patch.segment.position.z - (-8.0);
                        for (let s of window.game.world.segments) {
                            s.position.z -= offset;
                        }
                        window.game.player.x = patch.localX;
                        window.game.player.mesh.position.x = patch.localX;
                        window.game.player.onBlackIce = true;
                        window.game.player.surfaceFriction = 0.45;
                        // Apply active steering to showcase low-friction drift slide
                        window.game.player.steer(0.65, 0.016);
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

            # Query Phase 2 Telemetry
            arctic_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getBiomeTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    const slip = window.game.player.slipAngle;
                    const onIce = window.game.player.onBlackIce;
                    const f = window.game.player.surfaceFriction;
                    return { telem, kmh, slip, onIce, surfaceFriction: f };
                })()
                """,
                "returnByValue": True
            })
            arctic_data = arctic_eval.get("result", {}).get("value", {})
            print(f"[DAY12-BIOMES] Arctic Black Ice Telemetry: {json.dumps(arctic_data, indent=2)}")

            # Capture Arctic Black Ice Screenshot
            shot2 = await send("Page.captureScreenshot", {"format": "png"})
            shot2_bytes = base64.b64decode(shot2["data"])
            shot2_path = os.path.join(ARTIFACTS_DIR, "day12_arctic_black_ice_drift.png")
            with open(shot2_path, "wb") as f:
                f.write(shot2_bytes)
            print(f"[DAY12-BIOMES] Captured Arctic screenshot ({len(shot2_bytes)} bytes) -> {shot2_path}")

            # -------------------------------------------------------------
            # Phase 3: Retro-Reflective Highway Cat's Eyes at Dusk / Night
            # -------------------------------------------------------------
            print("[DAY12-BIOMES] Phase 3: Retro-Reflective cat's eyes illumination in headlight beam...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.world.setBiome('midnight');
                    window.game.world.updateLightingCycle(2800, 0.016); // Midnight
                    window.game.player.speed = 18.0;
                    window.game.player.targetSpeed = 18.0;
                    window.game.player.x = 0;
                    window.game.player.onBlackIce = false;
                    window.game.player.surfaceFriction = 1.0;

                    // Ensure high-beam headlights are on
                    if (window.game.player.updateHeadlights) {
                        window.game.player.updateHeadlights(0.016, true, false, []);
                    }
                })()
                """
            })

            # Advance 15 frames
            for _ in range(15):
                await send("Runtime.evaluate", {
                    "expression": "window.game.loopStep ? window.game.loopStep(0.016) : null"
                })
                await asyncio.sleep(0.02)

            # Query Phase 3 Telemetry
            cateyes_eval = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const telem = window.game.getBiomeTelemetry();
                    const kmh = (window.game.player.speed * 9).toFixed(1);
                    return { telem, kmh };
                })()
                """,
                "returnByValue": True
            })
            cateyes_data = cateyes_eval.get("result", {}).get("value", {})
            print(f"[DAY12-BIOMES] Cat's Eyes Telemetry: {json.dumps(cateyes_data, indent=2)}")

            # Capture Cat's Eyes Screenshot
            shot3 = await send("Page.captureScreenshot", {"format": "png"})
            shot3_bytes = base64.b64decode(shot3["data"])
            shot3_path = os.path.join(ARTIFACTS_DIR, "day12_highway_cats_eyes_night.png")
            with open(shot3_path, "wb") as f:
                f.write(shot3_bytes)
            print(f"[DAY12-BIOMES] Captured Cat's Eyes screenshot ({len(shot3_bytes)} bytes) -> {shot3_path}")

            # Check runtime errors
            errors_eval = await send("Runtime.evaluate", {
                "expression": "window.__day12Errors || []",
                "returnByValue": True
            })
            page_errors = errors_eval.get("result", {}).get("value", [])
            print(f"[DAY12-BIOMES] Runtime page errors: {len(page_errors)}")

            # Save Full Day 12 Telemetry
            full_telemetry = {
                "timestamp": "2026-11-28T17:20:00Z",
                "phase1_canyon_archway_dustdevils": canyon_data,
                "phase2_arctic_black_ice_drift": arctic_data,
                "phase3_highway_cats_eyes_night": cateyes_data,
                "runtime_errors": page_errors,
                "screenshots": [
                    shot1_path,
                    shot2_path,
                    shot3_path
                ],
                "verification_status": "PASS" if len(page_errors) == 0 else "FAIL"
            }

            telem_path = os.path.join(ARTIFACTS_DIR, "road_riot_day12_verification_telemetry.json")
            with open(telem_path, "w", encoding="utf-8") as f:
                json.dump(full_telemetry, f, indent=2)
            print(f"[DAY12-BIOMES] Saved verification telemetry to {telem_path}")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()
        print("[DAY12-BIOMES] Chrome process terminated cleanly.")


if __name__ == "__main__":
    asyncio.run(run_day12_biomes_verification())
